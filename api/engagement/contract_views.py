from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone as dt_timezone
from hashlib import sha256
from html import escape
from io import BytesIO

from PIL import Image, ImageDraw, ImageFont
from django.conf import settings
from django.contrib.contenttypes.models import ContentType
from django.db.models import Avg, Count, Q
from django.http import Http404, HttpResponse
from django.urls import reverse
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.exceptions import PermissionDenied, Throttled, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.utils import create_audit_log, get_profile, is_admin_user, is_writer_approved
from content.models import Book, Chapter, Poem, StatusChoices, Story
from core.cache_utils import (
    apply_public_cache_headers,
    build_public_not_modified_response,
    canonicalize_request_path,
    get_public_cache_meta,
    get_public_cache_version,
    safe_cache_get,
    safe_cache_set,
)

from .models import (
    AuthorFollow,
    CommentAnchorType,
    ContentComment,
    ContentReaction,
    ContentViewEvent,
    ReadingProgress,
    ReactionType,
    ReferralVisit,
)
from .serializers import (
    CommentCreateSerializer,
    CommentModerationSerializer,
    CommentQuerySerializer,
    ContentCommentSerializer,
    LikeToggleSerializer,
)
from .services import (
    build_target_payload,
    bump_public_content_cache_version,
    extract_keywords_from_target,
    get_period_start,
    get_referral_visitor_id,
    is_target_anonymous,
    normalize_ref_code,
    notify_comment_event,
    notify_like_event,
    user_can_access_target,
    user_can_moderate_target_comments,
)
from .targets import (
    extract_target_paragraphs,
    get_target_author,
    get_target_category,
    get_target_title,
    is_target_public,
    resolve_paragraph_index_from_anchor,
    resolve_target,
)


LIKE_COOLDOWN_SECONDS = int(getattr(settings, "ENGAGEMENT_REACTION_COOLDOWN_SECONDS", 4))
COMMENT_COOLDOWN_SECONDS = int(getattr(settings, "ENGAGEMENT_COMMENT_COOLDOWN_SECONDS", 8))
SHARE_CARD_CACHE_SECONDS = int(getattr(settings, "ENGAGEMENT_SHARE_CARD_CACHE_SECONDS", 86_400))
ANALYTICS_MAX_LIMIT = int(getattr(settings, "ANALYTICS_MAX_WORKS", 200))


def _public_work_models():
    return {
        "books": Book,
        "stories": Story,
        "poems": Poem,
    }


def _public_work_filters() -> dict[str, object]:
    return {
        "status": StatusChoices.APPROVED,
        "is_hidden": False,
        "is_deleted": False,
    }


def _resolve_public_work(work_id: int, work_type: str | None = None):
    model_map = _public_work_models()
    filters = {"id": work_id, **_public_work_filters()}

    if work_type:
        model = model_map.get(work_type)
        if not model:
            raise ValidationError({"work_type": "Unsupported work type."})
        target = model.objects.filter(**filters).select_related("author").first()
        if not target:
            raise Http404("Work not found.")
        return target, work_type

    found = []
    for category, model in model_map.items():
        target = model.objects.filter(**filters).select_related("author").first()
        if target:
            found.append((target, category))

    if not found:
        raise Http404("Work not found.")
    if len(found) > 1:
        raise ValidationError({"target_id": "Ambiguous work id. Provide work_type."})
    return found[0]


def _resolve_writer_work(user, work_id: int, work_type: str | None = None):
    model_map = _public_work_models()
    filters = {"id": work_id, "author": user, "is_deleted": False}

    if work_type:
        model = model_map.get(work_type)
        if not model:
            raise ValidationError({"work_type": "Unsupported work type."})
        target = model.objects.filter(**filters).select_related("author").first()
        if not target:
            raise Http404("Work not found.")
        return target, work_type

    found = []
    for category, model in model_map.items():
        target = model.objects.filter(**filters).select_related("author").first()
        if target:
            found.append((target, category))

    if not found:
        raise Http404("Work not found.")
    if len(found) > 1:
        raise ValidationError({"work_id": "Ambiguous work id. Provide work_type."})
    return found[0]


def _resolve_public_chapter(chapter_id: int):
    chapter = (
        Chapter.objects.select_related("book", "book__author")
        .filter(
            id=chapter_id,
            status=StatusChoices.APPROVED,
            book__status=StatusChoices.APPROVED,
            book__is_hidden=False,
            book__is_deleted=False,
        )
        .first()
    )
    if not chapter:
        raise Http404("Chapter not found.")
    return chapter


def _reaction_summary(target, *, user=None) -> dict[str, object]:
    content_type = ContentType.objects.get_for_model(type(target))
    likes_qs = ContentReaction.objects.filter(
        content_type=content_type,
        object_id=target.id,
        reaction=ReactionType.LIKE,
    )
    liked_by_me = False
    if user and user.is_authenticated:
        liked_by_me = likes_qs.filter(user=user).exists()
    return {
        "likes_count": likes_qs.count(),
        "liked_by_me": liked_by_me,
    }


def _like_cooldown_key(user_id: int, target, action: str) -> str:
    content_type_id = ContentType.objects.get_for_model(type(target)).id
    return f"likes:cooldown:{user_id}:{content_type_id}:{target.id}:{action}"


def _enforce_like_cooldown(user_id: int, target, action: str) -> None:
    key = _like_cooldown_key(user_id, target, action)
    if safe_cache_get(key):
        raise Throttled(detail="Too many like actions. Please wait a moment.", wait=LIKE_COOLDOWN_SECONDS)
    safe_cache_set(key, "1", timeout=LIKE_COOLDOWN_SECONDS)


def _comment_cooldown_key(user_id: int, target) -> str:
    content_type_id = ContentType.objects.get_for_model(type(target)).id
    return f"comments:cooldown:{user_id}:{content_type_id}:{target.id}"


def _enforce_comment_cooldown(user_id: int, target) -> None:
    key = _comment_cooldown_key(user_id, target)
    if safe_cache_get(key):
        raise Throttled(detail="Too many comments. Please wait a moment.", wait=COMMENT_COOLDOWN_SECONDS)
    safe_cache_set(key, "1", timeout=COMMENT_COOLDOWN_SECONDS)


def _start_for_discover(range_key: str) -> tuple[datetime, str]:
    now = timezone.now()
    normalized = (range_key or "").strip().lower()
    if normalized == "today":
        return now - timedelta(days=1), "today"
    if normalized == "month":
        return now - timedelta(days=30), "month"
    return now - timedelta(days=7), "week"


def _parse_limit(raw_value, *, default: int = 20, min_value: int = 1, max_value: int = 100) -> int:
    try:
        value = int(raw_value)
    except (TypeError, ValueError):
        value = default
    return min(max(value, min_value), max_value)


def _work_ct_map_for_type(type_filter: str | None = None):
    model_map = _public_work_models()
    normalized = (type_filter or "").strip().lower()
    if normalized:
        single_map = {
            "book": "books",
            "story": "stories",
            "poem": "poems",
        }
        resolved = single_map.get(normalized)
        if not resolved:
            raise ValidationError({"type": "Unsupported type. Use one of: book, story, poem."})
        model_map = {resolved: model_map[resolved]}

    ct_map = {
        category: ContentType.objects.get_for_model(model)
        for category, model in model_map.items()
    }
    return model_map, ct_map


def _public_target_map_for_ct_ids(ct_map: dict[str, ContentType]):
    key_to_target: dict[tuple[int, int], object] = {}
    for category, ct in ct_map.items():
        model = _public_work_models()[category]
        queryset = model.objects.filter(**_public_work_filters()).select_related("author")
        for item in queryset:
            key_to_target[(ct.id, item.id)] = item
    return key_to_target


def _aggregate_work_metrics(ct_ids: list[int], *, start_at=None):
    metric_rows: dict[tuple[int, int], dict[str, float]] = defaultdict(
        lambda: {
            "views": 0.0,
            "likes": 0.0,
            "comments": 0.0,
            "completions": 0.0,
            "unique_view_users": 0.0,
            "unique_anons": 0.0,
            "unique_progress_users": 0.0,
            "avg_progress": 0.0,
        }
    )

    view_qs = ContentViewEvent.objects.filter(content_type_id__in=ct_ids)
    if start_at:
        view_qs = view_qs.filter(created_at__gte=start_at)
    for row in view_qs.values("content_type_id", "object_id").annotate(
        views=Count("id"),
        unique_users=Count("user_id", distinct=True),
        unique_anons=Count("anon_key", distinct=True, filter=~Q(anon_key="")),
    ):
        key = (row["content_type_id"], row["object_id"])
        metric_rows[key]["views"] = float(row["views"] or 0)
        metric_rows[key]["unique_view_users"] = float(row["unique_users"] or 0)
        metric_rows[key]["unique_anons"] = float(row["unique_anons"] or 0)

    like_qs = ContentReaction.objects.filter(
        content_type_id__in=ct_ids,
        reaction=ReactionType.LIKE,
    )
    if start_at:
        like_qs = like_qs.filter(created_at__gte=start_at)
    for row in like_qs.values("content_type_id", "object_id").annotate(likes=Count("id")):
        key = (row["content_type_id"], row["object_id"])
        metric_rows[key]["likes"] = float(row["likes"] or 0)

    comment_qs = ContentComment.objects.filter(content_type_id__in=ct_ids, is_hidden=False)
    if start_at:
        comment_qs = comment_qs.filter(created_at__gte=start_at)
    for row in comment_qs.values("content_type_id", "object_id").annotate(comments=Count("id")):
        key = (row["content_type_id"], row["object_id"])
        metric_rows[key]["comments"] = float(row["comments"] or 0)

    progress_qs = ReadingProgress.objects.filter(content_type_id__in=ct_ids)
    if start_at:
        progress_qs = progress_qs.filter(updated_at__gte=start_at)
    for row in progress_qs.values("content_type_id", "object_id").annotate(
        completions=Count("id", filter=Q(progress_percent__gte=90)),
        avg_progress=Avg("progress_percent"),
        unique_users=Count("user_id", distinct=True),
    ):
        key = (row["content_type_id"], row["object_id"])
        metric_rows[key]["completions"] = float(row["completions"] or 0)
        metric_rows[key]["avg_progress"] = float(row["avg_progress"] or 0)
        metric_rows[key]["unique_progress_users"] = float(row["unique_users"] or 0)

    for row in metric_rows.values():
        row["unique_readers"] = max(row["unique_view_users"], row["unique_progress_users"]) + row["unique_anons"]
    return metric_rows


def _resolve_like_target_from_payload(payload, *, user=None):
    target_type = payload["target_type"]
    target_id = payload["target_id"]
    if target_type == "chapter":
        target = resolve_target("chapters", target_id, public_only=False)
        if not is_target_public(target):
            raise Http404("Chapter not found.")
        return target

    work, _work_type = _resolve_public_work(target_id, payload.get("work_type"))
    return work


def _resolve_comment_target_from_payload(payload):
    target_type = payload["target_type"]
    target_id = payload["target_id"]
    if target_type == "chapter":
        return _resolve_public_chapter(target_id)
    work, _work_type = _resolve_public_work(target_id, payload.get("work_type"))
    return work


def _is_root_user(user) -> bool:
    if not user or not user.is_authenticated:
        return False
    profile = get_profile(user)
    return bool(profile.is_root)


def _share_card_cache_version() -> int:
    return int(get_public_cache_version())


def _render_share_card_png(target) -> bytes:
    title = get_target_title(target)[:120]
    anonymous = is_target_anonymous(target)
    author = get_target_author(target)
    author_name = "Anonymous" if anonymous else (author.username if author else "Unknown")
    excerpt = (build_target_payload(target).get("excerpt") or "")[:220]
    category = get_target_category(target).rstrip("s").capitalize()

    image = Image.new("RGB", (1200, 630), "#112233")
    draw = ImageDraw.Draw(image)

    for y in range(630):
        ratio = y / 630
        r = int(17 + (85 - 17) * ratio)
        g = int(34 + (48 - 34) * ratio)
        b = int(51 + (28 - 51) * ratio)
        draw.line([(0, y), (1200, y)], fill=(r, g, b))

    title_font = ImageFont.load_default()
    body_font = ImageFont.load_default()

    draw.rounded_rectangle((48, 48, 1152, 582), radius=28, fill=(255, 255, 255, 25), outline=(255, 255, 255, 55), width=2)
    draw.text((84, 84), "Readus", fill="#f8fafc", font=body_font)
    draw.text((84, 128), category, fill="#fbbf24", font=body_font)

    title_lines = []
    words = title.split()
    line = ""
    for word in words:
        candidate = f"{line} {word}".strip()
        if len(candidate) <= 44:
            line = candidate
        else:
            if line:
                title_lines.append(line)
            line = word
    if line:
        title_lines.append(line)
    title_lines = title_lines[:3]

    y = 178
    for chunk in title_lines:
        draw.text((84, y), chunk, fill="#ffffff", font=title_font)
        y += 36

    draw.text((84, min(y + 12, 360)), f"by {author_name}", fill="#e2e8f0", font=body_font)

    excerpt_words = excerpt.split()
    excerpt_lines = []
    line = ""
    for word in excerpt_words:
        candidate = f"{line} {word}".strip()
        if len(candidate) <= 80:
            line = candidate
        else:
            if line:
                excerpt_lines.append(line)
            line = word
    if line:
        excerpt_lines.append(line)
    excerpt_lines = excerpt_lines[:4]

    y = 420
    for chunk in excerpt_lines:
        draw.text((84, y), chunk, fill="#cbd5e1", font=body_font)
        y += 26

    draw.text((84, 552), "readus", fill="#f8fafc", font=body_font)

    stream = BytesIO()
    image.save(stream, format="PNG", optimize=True)
    return stream.getvalue()


def _share_card_response(request, target):
    cache_meta = get_public_cache_meta("public-share:card", canonicalize_request_path(request))
    not_modified = build_public_not_modified_response(
        request,
        etag=cache_meta["etag"],
        last_modified=cache_meta["last_modified"],
    )
    if not_modified is not None:
        return apply_public_cache_headers(
            not_modified,
            etag=cache_meta["etag"],
            last_modified=cache_meta["last_modified"],
            vary_on_auth=False,
        )

    payload = build_target_payload(target)
    digest_source = "|".join(
        [
            str(payload.get("title") or ""),
            str(payload.get("excerpt") or ""),
            str(payload.get("author_display_name") or ""),
            str(payload.get("cover_image") or ""),
            str(getattr(target, "updated_at", "")),
            str(_share_card_cache_version()),
        ]
    )
    digest = sha256(digest_source.encode("utf-8")).hexdigest()
    cache_key = f"share-card:{get_target_category(target)}:{target.id}:{digest}"
    cached = safe_cache_get(cache_key)
    if cached:
        response = HttpResponse(cached, content_type="image/png")
        return apply_public_cache_headers(
            response,
            etag=cache_meta["etag"],
            last_modified=cache_meta["last_modified"],
            vary_on_auth=False,
        )

    data = _render_share_card_png(target)
    safe_cache_set(cache_key, data, timeout=SHARE_CARD_CACHE_SECONDS, jitter=True)
    response = HttpResponse(data, content_type="image/png")
    return apply_public_cache_headers(
        response,
        etag=cache_meta["etag"],
        last_modified=cache_meta["last_modified"],
        vary_on_auth=False,
    )


class LikesApiView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = LikeToggleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        target = _resolve_like_target_from_payload(serializer.validated_data, user=request.user)

        _enforce_like_cooldown(request.user.id, target, "like")
        content_type = ContentType.objects.get_for_model(type(target))
        _, created = ContentReaction.objects.get_or_create(
            user=request.user,
            content_type=content_type,
            object_id=target.id,
            reaction=ReactionType.LIKE,
        )
        if created:
            notify_like_event(actor=request.user, target=target)
            bump_public_content_cache_version()
        return Response(_reaction_summary(target, user=request.user))

    def delete(self, request):
        serializer = LikeToggleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        target = _resolve_like_target_from_payload(serializer.validated_data, user=request.user)

        _enforce_like_cooldown(request.user.id, target, "unlike")
        content_type = ContentType.objects.get_for_model(type(target))
        deleted, _ = ContentReaction.objects.filter(
            user=request.user,
            content_type=content_type,
            object_id=target.id,
            reaction=ReactionType.LIKE,
        ).delete()
        if deleted:
            bump_public_content_cache_version()
        return Response(_reaction_summary(target, user=request.user))


class WorkLikeStateView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, work_id: int):
        work_type = request.query_params.get("work_type")
        target, resolved_type = _resolve_public_work(work_id, work_type)
        payload = _reaction_summary(target, user=request.user)
        payload.update({"target_type": "work", "work_type": resolved_type, "target_id": target.id})
        return Response(payload)


class ChapterLikeStateView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, chapter_id: int):
        target = _resolve_public_chapter(chapter_id)
        payload = _reaction_summary(target, user=request.user)
        payload.update({"target_type": "chapter", "target_id": target.id})
        return Response(payload)


class CommentsApiView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get(self, request):
        serializer = CommentQuerySerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        target = _resolve_comment_target_from_payload(serializer.validated_data)
        if not user_can_access_target(request.user, target):
            raise Http404("Target not found.")

        content_type = ContentType.objects.get_for_model(type(target))
        can_moderate = user_can_moderate_target_comments(request.user, target)
        queryset = ContentComment.objects.filter(
            content_type=content_type,
            object_id=target.id,
            parent__isnull=True,
        ).select_related("user").prefetch_related("replies__user")
        if not can_moderate:
            queryset = queryset.filter(is_hidden=False)
        queryset = queryset.order_by("created_at")

        page = self.paginate_queryset(queryset)
        serializer_context = {"request": request, "viewer_can_moderate": can_moderate}
        if page is not None:
            data = ContentCommentSerializer(page, many=True, context=serializer_context).data
            return self.get_paginated_response(data)
        data = ContentCommentSerializer(queryset, many=True, context=serializer_context).data
        return Response(data)

    def post(self, request):
        if not request.user or not request.user.is_authenticated:
            raise PermissionDenied("Authentication required.")

        serializer = CommentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        target_payload = {
            "target_type": serializer.validated_data.get("target_type", request.data.get("target_type")),
            "target_id": serializer.validated_data.get("target_id", request.data.get("target_id")),
            "work_type": request.data.get("work_type"),
        }
        if not target_payload["target_type"] or not target_payload["target_id"]:
            raise ValidationError({"target_type": "target_type and target_id are required."})
        target = _resolve_comment_target_from_payload(target_payload)
        if not is_target_public(target):
            raise PermissionDenied("Comments are only available on public content.")

        content_type = ContentType.objects.get_for_model(type(target))
        parent = None
        parent_id = serializer.validated_data.get("parent_id")
        if parent_id:
            parent = ContentComment.objects.select_related("user").filter(id=parent_id).first()
            if not parent:
                raise ValidationError({"parent_comment": "Parent comment does not exist."})
            if parent.content_type_id != content_type.id or parent.object_id != target.id:
                raise ValidationError({"parent_comment": "Parent comment does not belong to this target."})

        _enforce_comment_cooldown(request.user.id, target)

        anchor_type = serializer.validated_data.get("anchor_type") or CommentAnchorType.PARAGRAPH
        anchor_key = (serializer.validated_data.get("anchor_key") or "").strip()
        paragraph_index = serializer.validated_data.get("paragraph_index")

        if parent and not anchor_key:
            anchor_type = parent.anchor_type
            anchor_key = parent.anchor_key
            paragraph_index = parent.paragraph_index

        if anchor_type == CommentAnchorType.BLOCK:
            if not anchor_key:
                raise ValidationError({"anchor_key": "Block comments require anchor_key."})
            resolved_index = resolve_paragraph_index_from_anchor(
                target,
                anchor_type=anchor_type,
                anchor_key=anchor_key,
            )
            if resolved_index is not None:
                paragraph_index = resolved_index
        else:
            if anchor_key.startswith("p:"):
                suffix = anchor_key[2:].strip()
                if suffix.isdigit():
                    paragraph_index = int(suffix)
            elif paragraph_index is not None:
                anchor_key = f"p:{paragraph_index}"
            elif parent:
                paragraph_index = parent.paragraph_index
                anchor_key = parent.anchor_key

            if paragraph_index is not None and not anchor_key:
                anchor_key = f"p:{paragraph_index}"

        excerpt = ""
        if paragraph_index is not None:
            paragraphs = extract_target_paragraphs(target)
            if paragraphs and 0 <= paragraph_index < len(paragraphs):
                excerpt = paragraphs[paragraph_index][:220]

        comment = ContentComment.objects.create(
            user=request.user,
            content_type=content_type,
            object_id=target.id,
            parent=parent,
            body=serializer.validated_data["body"],
            anchor_type=anchor_type,
            anchor_key=anchor_key[:120],
            paragraph_index=paragraph_index,
            excerpt=excerpt,
        )

        notify_comment_event(
            actor=request.user,
            target=target,
            comment_id=comment.id,
            reply_to_user=parent.user if parent else None,
        )
        bump_public_content_cache_version()

        data = ContentCommentSerializer(comment, context={"request": request, "viewer_can_moderate": True}).data
        return Response(data, status=status.HTTP_201_CREATED)


class CommentHideView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, comment_id: int):
        comment = ContentComment.objects.select_related("user").filter(id=comment_id).first()
        if not comment:
            raise Http404("Comment not found.")
        if not comment.target:
            raise Http404("Comment target does not exist.")

        target = comment.target
        if not user_can_moderate_target_comments(request.user, target):
            raise PermissionDenied("You do not have permission to moderate this comment.")

        serializer = CommentModerationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        is_hidden = serializer.validated_data["is_hidden"]
        reason = serializer.validated_data.get("reason", "")

        comment.is_hidden = is_hidden
        comment.hidden_reason = reason
        comment.hidden_by = request.user
        comment.hidden_at = timezone.now()
        comment.save(update_fields=["is_hidden", "hidden_reason", "hidden_by", "hidden_at", "updated_at"])

        create_audit_log(
            actor=request.user,
            action="comment_hidden" if is_hidden else "comment_unhidden",
            target_type="content_comment",
            target_id=comment.id,
            description="Comment visibility updated",
            metadata={
                "is_hidden": is_hidden,
                "reason": reason,
                "target_category": get_target_category(target),
                "target_id": target.id,
            },
            request=request,
        )

        bump_public_content_cache_version()
        data = ContentCommentSerializer(comment, context={"request": request, "viewer_can_moderate": True}).data
        return Response(data)


class CommentDeleteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, comment_id: int):
        comment = ContentComment.objects.select_related("user").filter(id=comment_id).first()
        if not comment:
            raise Http404("Comment not found.")
        if not comment.target:
            raise Http404("Comment target does not exist.")

        target = comment.target
        is_admin_or_root = is_admin_user(request.user) or _is_root_user(request.user)
        can_soft_delete = (
            comment.user_id == request.user.id or user_can_moderate_target_comments(request.user, target)
        )

        if not is_admin_or_root and not can_soft_delete:
            raise PermissionDenied("You do not have permission to delete this comment.")

        if is_admin_or_root:
            create_audit_log(
                actor=request.user,
                action="comment_hard_deleted",
                target_type="content_comment",
                target_id=comment.id,
                description="Comment hard deleted",
                metadata={
                    "target_category": get_target_category(target),
                    "target_id": target.id,
                },
                request=request,
            )
            comment.delete()
            bump_public_content_cache_version()
            return Response(status=status.HTTP_204_NO_CONTENT)

        reason = "Deleted by author" if comment.user_id == request.user.id else "Deleted by moderator"
        if not comment.is_hidden:
            comment.is_hidden = True
        comment.hidden_reason = reason
        comment.hidden_by = request.user
        comment.hidden_at = timezone.now()
        comment.save(update_fields=["is_hidden", "hidden_reason", "hidden_by", "hidden_at", "updated_at"])
        create_audit_log(
            actor=request.user,
            action="comment_soft_deleted",
            target_type="content_comment",
            target_id=comment.id,
            description="Comment soft deleted",
            metadata={
                "reason": reason,
                "target_category": get_target_category(target),
                "target_id": target.id,
            },
            request=request,
        )
        bump_public_content_cache_version()
        data = ContentCommentSerializer(comment, context={"request": request, "viewer_can_moderate": True}).data
        return Response(data)


class DiscoverTrendingView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        start_at, normalized_range = _start_for_discover(request.query_params.get("range", "week"))
        _model_map, ct_map = _work_ct_map_for_type(request.query_params.get("type"))
        limit = _parse_limit(request.query_params.get("limit", "20"), default=20, max_value=100)

        ct_ids = [ct.id for ct in ct_map.values()]
        metric_rows = _aggregate_work_metrics(ct_ids, start_at=start_at)
        target_map = _public_target_map_for_ct_ids(ct_map)

        scored = []
        for key, metrics in metric_rows.items():
            target = target_map.get(key)
            if not target:
                continue
            score = (
                metrics["views"]
                + (metrics["likes"] * 2.0)
                + (metrics["comments"] * 3.0)
                + (metrics["completions"] * 4.0)
            )
            if score <= 0:
                continue
            scored.append(
                {
                    "work": build_target_payload(target, request=request),
                    "score": round(score, 2),
                    "views": int(metrics["views"]),
                    "likes": int(metrics["likes"]),
                    "comments": int(metrics["comments"]),
                    "completions": int(metrics["completions"]),
                }
            )

        scored.sort(
            key=lambda row: (
                -float(row["score"]),
                row["work"].get("created_at") or datetime.min.replace(tzinfo=dt_timezone.utc),
            )
        )
        return Response({"range": normalized_range, "results": scored[:limit]})


class DiscoverRecommendedView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        limit = _parse_limit(request.query_params.get("limit", "20"), default=20, max_value=100)
        week_start = timezone.now() - timedelta(days=7)

        ct_map = {
            category: ContentType.objects.get_for_model(model)
            for category, model in _public_work_models().items()
        }
        ct_ids = [ct.id for ct in ct_map.values()]
        metric_rows = _aggregate_work_metrics(ct_ids, start_at=week_start)

        followed_author_ids = set(
            AuthorFollow.objects.filter(follower=request.user).values_list("author_id", flat=True)
        )
        history = list(
            ReadingProgress.objects.filter(user=request.user).select_related("content_type").order_by("-updated_at")[:250]
        )
        likes = list(
            ContentReaction.objects.filter(user=request.user, reaction=ReactionType.LIKE)
            .select_related("content_type")
            .order_by("-created_at")[:250]
        )
        completed_pairs = set(
            ReadingProgress.objects.filter(user=request.user).filter(Q(progress_percent__gte=90) | Q(completed=True)).values_list(
                "content_type_id", "object_id"
            )
        )

        preferred_categories: dict[str, int] = defaultdict(int)
        preferred_keywords: set[str] = set()
        for progress in history:
            target = progress.target
            if not target:
                continue
            preferred_categories[get_target_category(target)] += 1
            preferred_keywords.update(extract_keywords_from_target(target, max_items=6)[:3])
        for reaction in likes:
            target = reaction.target
            if not target:
                continue
            preferred_categories[get_target_category(target)] += 2
            preferred_keywords.update(extract_keywords_from_target(target, max_items=6)[:3])

        top_categories = {
            item[0]
            for item in sorted(preferred_categories.items(), key=lambda pair: (-pair[1], pair[0]))[:2]
        }

        candidates = []
        for category, model in _public_work_models().items():
            queryset = model.objects.filter(**_public_work_filters()).select_related("author").order_by("-created_at")[:300]
            for item in queryset:
                ct_id = ct_map[category].id
                if (ct_id, item.id) in completed_pairs:
                    continue
                author = get_target_author(item)
                if author and author.id == request.user.id:
                    continue
                candidates.append((ct_id, item))

        rows = []
        for ct_id, target in candidates:
            metrics = metric_rows.get((ct_id, target.id), {})
            score = (
                float(metrics.get("views", 0))
                + (float(metrics.get("likes", 0)) * 2.0)
                + (float(metrics.get("comments", 0)) * 3.0)
            )
            reason = "Popular with readers."
            author = get_target_author(target)
            category = get_target_category(target)

            if author and author.id in followed_author_ids and not is_target_anonymous(target):
                score += 90
                reason = f"Because you follow @{author.username}"
            elif category in top_categories:
                score += 35
                reason = f"Because you read {category.rstrip('s').capitalize()}"
            else:
                overlap = sorted(set(extract_keywords_from_target(target, max_items=6)).intersection(preferred_keywords))
                if overlap:
                    score += min(3, len(overlap)) * 12
                    reason = f"Because you read {overlap[0].capitalize()}"

            if score <= 0:
                continue
            rows.append(
                {
                    "work": build_target_payload(target, request=request),
                    "reason": reason,
                    "score": round(score, 2),
                }
            )

        rows.sort(
            key=lambda row: (
                -float(row["score"]),
                row["work"].get("created_at") or datetime.min.replace(tzinfo=dt_timezone.utc),
            )
        )
        return Response({"results": rows[:limit]})


def _writer_target_pairs(user):
    books = list(Book.objects.filter(author=user, is_deleted=False).select_related("author"))
    stories = list(Story.objects.filter(author=user, is_deleted=False).select_related("author"))
    poems = list(Poem.objects.filter(author=user, is_deleted=False).select_related("author"))
    chapters = list(
        Chapter.objects.filter(book__author=user, book__is_deleted=False)
        .select_related("book", "book__author")
        .order_by("order")
    )
    pairs = {
        (ContentType.objects.get_for_model(type(target)).id, target.id): target
        for target in [*books, *stories, *poems, *chapters]
    }
    return books, stories, poems, chapters, pairs


def _writer_rollup_metrics(books, stories, poems, chapters, pair_metrics, *, request):
    chapter_by_book: dict[int, list[Chapter]] = defaultdict(list)
    for chapter in chapters:
        chapter_by_book[chapter.book_id].append(chapter)

    chapter_ct_id = ContentType.objects.get_for_model(Chapter).id
    rows = []
    for work in [*books, *stories, *poems]:
        ct_id = ContentType.objects.get_for_model(type(work)).id
        base = dict(pair_metrics.get((ct_id, work.id), {}))
        base.setdefault("views", 0.0)
        base.setdefault("likes", 0.0)
        base.setdefault("comments", 0.0)
        base.setdefault("completions", 0.0)
        base.setdefault("avg_progress", 0.0)
        base.setdefault("unique_readers", 0.0)

        chapter_rows = []
        if isinstance(work, Book):
            chapter_metrics_list = []
            for chapter in chapter_by_book.get(work.id, []):
                chapter_metrics = dict(pair_metrics.get((chapter_ct_id, chapter.id), {}))
                chapter_metrics.setdefault("views", 0.0)
                chapter_metrics.setdefault("likes", 0.0)
                chapter_metrics.setdefault("comments", 0.0)
                chapter_metrics.setdefault("completions", 0.0)
                chapter_metrics.setdefault("avg_progress", 0.0)
                chapter_metrics.setdefault("unique_readers", 0.0)
                chapter_metrics_list.append(chapter_metrics)
                chapter_rows.append(
                    {
                        "chapter": build_target_payload(chapter, request=request),
                        "metrics": {
                            "views": int(chapter_metrics["views"]),
                            "unique_readers": int(chapter_metrics["unique_readers"]),
                            "likes": int(chapter_metrics["likes"]),
                            "comments": int(chapter_metrics["comments"]),
                            "completions": int(chapter_metrics["completions"]),
                            "avg_progress": round(float(chapter_metrics["avg_progress"]), 2),
                        },
                    }
                )

            if chapter_metrics_list:
                base["views"] += sum(item["views"] for item in chapter_metrics_list)
                base["likes"] += sum(item["likes"] for item in chapter_metrics_list)
                base["comments"] += sum(item["comments"] for item in chapter_metrics_list)
                base["completions"] += sum(item["completions"] for item in chapter_metrics_list)
                base["unique_readers"] += sum(item["unique_readers"] for item in chapter_metrics_list)
                non_zero_progress = [item["avg_progress"] for item in chapter_metrics_list if item["avg_progress"] > 0]
                if non_zero_progress:
                    base["avg_progress"] = sum(non_zero_progress) / len(non_zero_progress)

        rows.append(
            {
                "work": build_target_payload(work, request=request),
                "metrics": {
                    "views": int(base["views"]),
                    "unique_readers": int(base["unique_readers"]),
                    "likes": int(base["likes"]),
                    "comments": int(base["comments"]),
                    "completions": int(base["completions"]),
                    "avg_progress": round(float(base["avg_progress"]), 2),
                },
                "chapters": chapter_rows,
            }
        )

    return rows


def _referral_codes_for_user(user) -> list[str]:
    return [f"{user.username}", f"u{user.id}"]


class AnalyticsOverviewView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not (is_writer_approved(request.user) or request.user.is_staff):
            raise PermissionDenied("Only approved writers can access analytics.")

        start_at, normalized_range = get_period_start(request.query_params.get("range", "7d"))
        books, stories, poems, chapters, pair_map = _writer_target_pairs(request.user)
        pair_metrics = _aggregate_work_metrics(
            list({ct_id for ct_id, _obj_id in pair_map.keys()}),
            start_at=start_at,
        )
        filtered_metrics = {key: value for key, value in pair_metrics.items() if key in pair_map}
        rows = _writer_rollup_metrics(books, stories, poems, chapters, filtered_metrics, request=request)

        totals = {
            "views": sum(row["metrics"]["views"] for row in rows),
            "unique_readers": sum(row["metrics"]["unique_readers"] for row in rows),
            "likes": sum(row["metrics"]["likes"] for row in rows),
            "comments": sum(row["metrics"]["comments"] for row in rows),
            "completions": sum(row["metrics"]["completions"] for row in rows),
        }
        avg_progress_values = [row["metrics"]["avg_progress"] for row in rows if row["metrics"]["avg_progress"] > 0]
        totals["avg_progress"] = round(sum(avg_progress_values) / len(avg_progress_values), 2) if avg_progress_values else 0.0

        follow_qs = AuthorFollow.objects.filter(author=request.user)
        if start_at:
            follow_qs = follow_qs.filter(created_at__gte=start_at)
        follower_growth = follow_qs.count()

        ref_codes = _referral_codes_for_user(request.user)
        referral_qs = ReferralVisit.objects.filter(ref_code__in=ref_codes)
        if start_at:
            referral_qs = referral_qs.filter(first_seen_at__gte=start_at)
        reads_from_shares = referral_qs.count()

        today_start = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
        week_start = timezone.now() - timedelta(days=7)
        pair_filters = Q()
        for ct_id, obj_id in pair_map.keys():
            pair_filters |= Q(content_type_id=ct_id, object_id=obj_id)
        if pair_filters:
            reads_today = ContentViewEvent.objects.filter(pair_filters, created_at__gte=today_start).count()
            reads_7d = ContentViewEvent.objects.filter(pair_filters, created_at__gte=week_start).count()
        else:
            reads_today = 0
            reads_7d = 0

        return Response(
            {
                "range": normalized_range,
                "generated_at": timezone.now(),
                "metrics": totals,
                "follower_growth": follower_growth,
                "reads_from_shares": reads_from_shares,
                "reads_today": reads_today,
                "reads_7d": reads_7d,
            }
        )


class AnalyticsWorksView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not (is_writer_approved(request.user) or request.user.is_staff):
            raise PermissionDenied("Only approved writers can access analytics.")

        start_at, normalized_range = get_period_start(request.query_params.get("range", "7d"))
        sort_key = (request.query_params.get("sort") or "views").strip().lower()
        sort_map = {
            "views": "views",
            "likes": "likes",
            "comments": "comments",
            "completions": "completions",
        }
        metric_key = sort_map.get(sort_key, "views")

        books, stories, poems, chapters, pair_map = _writer_target_pairs(request.user)
        pair_metrics = _aggregate_work_metrics(
            list({ct_id for ct_id, _obj_id in pair_map.keys()}),
            start_at=start_at,
        )
        filtered_metrics = {key: value for key, value in pair_metrics.items() if key in pair_map}
        rows = _writer_rollup_metrics(books, stories, poems, chapters, filtered_metrics, request=request)
        rows.sort(
            key=lambda row: (
                -int(row["metrics"].get(metric_key, 0)),
                row["work"].get("created_at") or datetime.min.replace(tzinfo=dt_timezone.utc),
            )
        )
        return Response({"range": normalized_range, "sort": metric_key, "results": rows[:ANALYTICS_MAX_LIMIT]})


class AnalyticsWorkDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, work_id: int):
        if not (is_writer_approved(request.user) or request.user.is_staff):
            raise PermissionDenied("Only approved writers can access analytics.")

        start_at, normalized_range = get_period_start(request.query_params.get("range", "7d"))
        work, _work_type = _resolve_writer_work(request.user, work_id, request.query_params.get("work_type"))
        books, stories, poems, chapters, pair_map = _writer_target_pairs(request.user)
        pair_metrics = _aggregate_work_metrics(
            list({ct_id for ct_id, _obj_id in pair_map.keys()}),
            start_at=start_at,
        )
        filtered_metrics = {key: value for key, value in pair_metrics.items() if key in pair_map}
        rows = _writer_rollup_metrics(books, stories, poems, chapters, filtered_metrics, request=request)
        match = next((row for row in rows if row["work"]["id"] == work.id and row["work"]["category"] == get_target_category(work)), None)
        if not match:
            raise Http404("Work analytics not found.")
        return Response({"range": normalized_range, "result": match})


class ShareCardWorkPngView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, work_id: int):
        target, _work_type = _resolve_public_work(work_id, request.query_params.get("work_type"))
        return _share_card_response(request, target)


class ShareCardChapterPngView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, chapter_id: int):
        target = _resolve_public_chapter(chapter_id)
        return _share_card_response(request, target)


class ShareWorkHtmlView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, work_id: int):
        cache_meta = get_public_cache_meta("public-share:work-html", canonicalize_request_path(request))
        not_modified = build_public_not_modified_response(
            request,
            etag=cache_meta["etag"],
            last_modified=cache_meta["last_modified"],
        )
        if not_modified is not None:
            return apply_public_cache_headers(
                not_modified,
                etag=cache_meta["etag"],
                last_modified=cache_meta["last_modified"],
                vary_on_auth=False,
            )

        target, _work_type = _resolve_public_work(work_id, request.query_params.get("work_type"))
        payload = build_target_payload(target, request=request)
        share_url = request.build_absolute_uri()
        read_url = payload["read_url"]
        title = str(payload["title"])
        excerpt = str(payload["excerpt"] or f"Read '{title}' on Readus.")
        image_url = request.build_absolute_uri(
            reverse("share-card-work-png", kwargs={"work_id": target.id})
        )

        html_doc = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>{escape(title)} | Readus</title>
  <meta name="description" content="{escape(excerpt)}" />
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="Readus" />
  <meta property="og:title" content="{escape(title)}" />
  <meta property="og:description" content="{escape(excerpt)}" />
  <meta property="og:url" content="{escape(share_url)}" />
  <meta property="og:image" content="{escape(image_url)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="{escape(title)}" />
  <meta name="twitter:description" content="{escape(excerpt)}" />
  <meta name="twitter:image" content="{escape(image_url)}" />
  <meta http-equiv="refresh" content="0; url={escape(read_url)}" />
</head>
<body>
  <p>Redirecting to <a href="{escape(read_url)}">{escape(read_url)}</a>...</p>
</body>
</html>
"""
        response = HttpResponse(html_doc)
        return apply_public_cache_headers(
            response,
            etag=cache_meta["etag"],
            last_modified=cache_meta["last_modified"],
            vary_on_auth=False,
        )


class ShareChapterHtmlView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, chapter_id: int):
        cache_meta = get_public_cache_meta("public-share:chapter-html", canonicalize_request_path(request))
        not_modified = build_public_not_modified_response(
            request,
            etag=cache_meta["etag"],
            last_modified=cache_meta["last_modified"],
        )
        if not_modified is not None:
            return apply_public_cache_headers(
                not_modified,
                etag=cache_meta["etag"],
                last_modified=cache_meta["last_modified"],
                vary_on_auth=False,
            )

        target = _resolve_public_chapter(chapter_id)
        payload = build_target_payload(target, request=request)
        share_url = request.build_absolute_uri()
        read_url = payload["read_url"]
        title = str(payload["title"])
        excerpt = str(payload["excerpt"] or f"Read '{title}' on Readus.")
        image_url = request.build_absolute_uri(
            reverse("share-card-chapter-png", kwargs={"chapter_id": target.id})
        )

        html_doc = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>{escape(title)} | Readus</title>
  <meta name="description" content="{escape(excerpt)}" />
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="Readus" />
  <meta property="og:title" content="{escape(title)}" />
  <meta property="og:description" content="{escape(excerpt)}" />
  <meta property="og:url" content="{escape(share_url)}" />
  <meta property="og:image" content="{escape(image_url)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="{escape(title)}" />
  <meta name="twitter:description" content="{escape(excerpt)}" />
  <meta name="twitter:image" content="{escape(image_url)}" />
  <meta http-equiv="refresh" content="0; url={escape(read_url)}" />
</head>
<body>
  <p>Redirecting to <a href="{escape(read_url)}">{escape(read_url)}</a>...</p>
</body>
</html>
"""
        response = HttpResponse(html_doc)
        return apply_public_cache_headers(
            response,
            etag=cache_meta["etag"],
            last_modified=cache_meta["last_modified"],
            vary_on_auth=False,
        )


class ReferralVisitTrackView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        ref_code = normalize_ref_code(
            request.data.get("ref_code")
            or request.data.get("ref")
            or request.query_params.get("ref_code")
            or request.query_params.get("ref")
        )
        if not ref_code:
            return Response({"tracked": False, "detail": "ref_code missing."}, status=status.HTTP_200_OK)

        if request.user and request.user.is_authenticated and ref_code.lower() == request.user.username.lower():
            return Response({"tracked": False, "detail": "Self referrals are ignored."}, status=status.HTTP_200_OK)

        visitor_id = get_referral_visitor_id(request)
        defaults = {}
        if request.user and request.user.is_authenticated:
            defaults["converted_user"] = request.user

        visit, created = ReferralVisit.objects.get_or_create(
            ref_code=ref_code,
            visitor_id=visitor_id,
            defaults=defaults,
        )

        if request.user and request.user.is_authenticated and not visit.converted_user_id:
            visit.converted_user = request.user
            visit.save(update_fields=["converted_user"])

        response = Response({"tracked": True, "created": created, "ref_code": ref_code})
        response.set_cookie(
            "readus_vid",
            visitor_id,
            max_age=60 * 60 * 24 * 365,
            httponly=False,
            secure=not settings.DEBUG,
            samesite="Lax",
        )
        return response
