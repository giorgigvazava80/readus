from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone as dt_timezone
from html import escape

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from django.db.models import Avg, Count, Q
from django.http import Http404, HttpResponse
from django.urls import reverse
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.exceptions import PermissionDenied, Throttled, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Notification
from accounts.utils import create_audit_log, create_notification, is_writer_approved
from content.models import Book, Chapter, Poem, StatusChoices, Story
from core.cache_utils import (
    apply_public_cache_headers,
    build_public_not_modified_response,
    canonicalize_request_path,
    get_public_cache_meta,
    safe_cache_get,
    safe_cache_set,
)

from .models import AuthorFollow, CommentAnchorType, ContentComment, ContentReaction, ContentViewEvent, ReadingProgress, ReactionType
from .serializers import (
    CommentCreateSerializer,
    CommentModerationSerializer,
    ContentCommentSerializer,
    ReadingProgressByWorkUpsertSerializer,
    ReadingProgressSerializer,
    ReadingProgressUpsertSerializer,
)
from .services import (
    CONTENT_MODEL_TO_CATEGORY,
    build_target_payload,
    bump_public_content_cache_version,
    extract_keywords_from_target,
    get_period_start,
    get_viewer_anon_key,
    is_target_anonymous,
    notify_comment_event,
    notify_follow_event,
    notify_like_event,
    user_can_access_target,
    user_can_moderate_target_comments,
)
from .targets import extract_target_paragraphs, get_target_author, get_target_category, is_target_public, resolve_target


REACTION_COOLDOWN_SECONDS = int(getattr(settings, "ENGAGEMENT_REACTION_COOLDOWN_SECONDS", 4))
DISCOVERY_PUBLIC_CACHE_SECONDS = int(getattr(settings, "CACHE_TTL_PUBLIC_LIST", 120))


def _public_queryset_for_category(category: str):
    if category == "books":
        return Book.objects.filter(
            status=StatusChoices.APPROVED,
            is_hidden=False,
            is_deleted=False,
        ).select_related("author")
    if category == "stories":
        return Story.objects.filter(
            status=StatusChoices.APPROVED,
            is_hidden=False,
            is_deleted=False,
        ).select_related("author")
    if category == "poems":
        return Poem.objects.filter(
            status=StatusChoices.APPROVED,
            is_hidden=False,
            is_deleted=False,
        ).select_related("author")
    if category == "chapters":
        return Chapter.objects.filter(
            status=StatusChoices.APPROVED,
            book__status=StatusChoices.APPROVED,
            book__is_hidden=False,
            book__is_deleted=False,
        ).select_related("book", "book__author")
    raise Http404("Unsupported target category.")


def _resolve_target_for_request(request, category: str, identifier: str):
    target = resolve_target(category, identifier, public_only=False)
    if not user_can_access_target(request.user, target):
        raise Http404("Target not found.")
    return target


def _resolve_public_target(category: str, identifier: str):
    return resolve_target(category, identifier, public_only=True)


def _reaction_content_type_id(target) -> int:
    return ContentType.objects.get_for_model(type(target)).id


def _reaction_cooldown_key(user_id: int, target, action: str) -> str:
    content_type_id = _reaction_content_type_id(target)
    return f"engagement:reaction:{user_id}:{content_type_id}:{target.id}:{action}"


def _enforce_reaction_cooldown(user_id: int, target, action: str) -> None:
    key = _reaction_cooldown_key(user_id, target, action)
    if safe_cache_get(key):
        raise Throttled(detail="Too many like actions. Please wait a moment.", wait=REACTION_COOLDOWN_SECONDS)
    safe_cache_set(key, "1", timeout=REACTION_COOLDOWN_SECONDS)


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


def _init_metric_state() -> dict[str, float]:
    return {
        "views": 0,
        "unique_readers": 0,
        "likes": 0,
        "comments": 0,
        "completion_estimate": 0.0,
        "completion_rate": 0.0,
    }


def _build_interaction_metrics(start_at=None) -> dict[tuple[int, int], dict[str, float]]:
    metrics: dict[tuple[int, int], dict[str, float]] = defaultdict(_init_metric_state)

    view_qs = ContentViewEvent.objects.all()
    if start_at:
        view_qs = view_qs.filter(created_at__gte=start_at)
    view_rows = view_qs.values("content_type_id", "object_id").annotate(
        views=Count("id"),
        unique_users=Count("user_id", distinct=True),
        unique_anons=Count("anon_key", distinct=True, filter=~Q(anon_key="")),
    )
    for row in view_rows:
        key = (row["content_type_id"], row["object_id"])
        state = metrics[key]
        state["views"] = float(row["views"] or 0)
        state["unique_readers"] = float((row["unique_users"] or 0) + (row["unique_anons"] or 0))

    reaction_qs = ContentReaction.objects.filter(reaction=ReactionType.LIKE)
    if start_at:
        reaction_qs = reaction_qs.filter(created_at__gte=start_at)
    reaction_rows = reaction_qs.values("content_type_id", "object_id").annotate(likes=Count("id"))
    for row in reaction_rows:
        key = (row["content_type_id"], row["object_id"])
        metrics[key]["likes"] = float(row["likes"] or 0)

    comment_qs = ContentComment.objects.filter(is_hidden=False)
    if start_at:
        comment_qs = comment_qs.filter(created_at__gte=start_at)
    comment_rows = comment_qs.values("content_type_id", "object_id").annotate(comments=Count("id"))
    for row in comment_rows:
        key = (row["content_type_id"], row["object_id"])
        metrics[key]["comments"] = float(row["comments"] or 0)

    progress_qs = ReadingProgress.objects.all()
    if start_at:
        progress_qs = progress_qs.filter(updated_at__gte=start_at)
    progress_rows = progress_qs.values("content_type_id", "object_id").annotate(
        progress_avg=Avg("progress_percent"),
        total=Count("id"),
        completed=Count("id", filter=Q(completed=True)),
    )
    for row in progress_rows:
        key = (row["content_type_id"], row["object_id"])
        total = float(row["total"] or 0)
        completed = float(row["completed"] or 0)
        metrics[key]["completion_estimate"] = float(row["progress_avg"] or 0)
        metrics[key]["completion_rate"] = (completed / total) * 100 if total > 0 else 0.0

    return metrics


def _load_public_targets_for_metric_keys(metric_keys: set[tuple[int, int]]) -> dict[tuple[int, int], object]:
    if not metric_keys:
        return {}

    by_ct: dict[int, set[int]] = defaultdict(set)
    for content_type_id, object_id in metric_keys:
        by_ct[content_type_id].add(object_id)

    content_types = {ct.id: ct for ct in ContentType.objects.filter(id__in=by_ct.keys())}
    target_map: dict[tuple[int, int], object] = {}

    for ct_id, object_ids in by_ct.items():
        ct = content_types.get(ct_id)
        if not ct:
            continue
        category = CONTENT_MODEL_TO_CATEGORY.get(ct.model)
        if not category:
            continue

        queryset = _public_queryset_for_category(category).filter(id__in=object_ids)
        for target in queryset:
            target_map[(ct_id, target.id)] = target

    return target_map


def _trending_window_to_start(window: str):
    now = timezone.now()
    normalized = (window or "").strip().lower()
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


def _today_start():
    now = timezone.now()
    return now.replace(hour=0, minute=0, second=0, microsecond=0)


def _record_view_event_dedup(request, target, *, paragraph_index=None) -> bool:
    content_type = ContentType.objects.get_for_model(type(target))
    queryset = ContentViewEvent.objects.filter(
        content_type=content_type,
        object_id=target.id,
        created_at__gte=_today_start(),
    )
    kwargs = {
        "content_type": content_type,
        "object_id": target.id,
        "paragraph_index": paragraph_index,
    }

    if request.user and request.user.is_authenticated:
        if queryset.filter(user=request.user).exists():
            return False
        kwargs["user"] = request.user
    else:
        anon_key = get_viewer_anon_key(request)
        if queryset.filter(user__isnull=True, anon_key=anon_key).exists():
            return False
        kwargs["anon_key"] = anon_key

    ContentViewEvent.objects.create(**kwargs)
    bump_public_content_cache_version()
    return True


def _resolve_public_work(work_id: int, work_type: str | None = None):
    model_map = {
        "books": Book,
        "stories": Story,
        "poems": Poem,
    }
    filters = {
        "id": work_id,
        "status": StatusChoices.APPROVED,
        "is_hidden": False,
        "is_deleted": False,
    }

    if work_type:
        model = model_map.get(work_type)
        if not model:
            raise ValidationError({"work_type": "Unsupported work type."})
        work = model.objects.filter(**filters).select_related("author").first()
        if not work:
            raise Http404("Work not found.")
        return work, work_type

    found = []
    for category, model in model_map.items():
        work = model.objects.filter(**filters).select_related("author").first()
        if work:
            found.append((work, category))

    if not found:
        raise Http404("Work not found.")
    if len(found) > 1:
        raise ValidationError({"work_id": "Ambiguous work id. Provide work_type."})

    return found[0]


def _author_has_public_profile(author_id: int) -> bool:
    base = {
        "author_id": author_id,
        "status": StatusChoices.APPROVED,
        "is_hidden": False,
        "is_deleted": False,
        "is_anonymous": False,
    }
    return (
        Book.objects.filter(**base).exists()
        or Story.objects.filter(**base).exists()
        or Poem.objects.filter(**base).exists()
    )


class AuthorFollowToggleView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, author_username: str):
        User = get_user_model()
        author = User.objects.filter(username=author_username).first()
        if not author:
            raise Http404("Author not found.")
        if not _author_has_public_profile(author.id):
            raise Http404("Author not found.")
        if author.id == request.user.id:
            raise ValidationError({"detail": "You cannot follow yourself."})

        _, created = AuthorFollow.objects.get_or_create(follower=request.user, author=author)
        if created:
            notify_follow_event(actor=request.user, author=author)
            bump_public_content_cache_version()

        followers_count = AuthorFollow.objects.filter(author=author).count()
        return Response(
            {
                "is_following": True,
                "follower_count": followers_count,
                "author_username": author.username,
            }
        )

    def delete(self, request, author_username: str):
        User = get_user_model()
        author = User.objects.filter(username=author_username).first()
        if not author:
            raise Http404("Author not found.")
        if not _author_has_public_profile(author.id):
            raise Http404("Author not found.")

        deleted, _ = AuthorFollow.objects.filter(follower=request.user, author=author).delete()
        if deleted:
            bump_public_content_cache_version()

        followers_count = AuthorFollow.objects.filter(author=author).count()
        return Response(
            {
                "is_following": False,
                "follower_count": followers_count,
                "author_username": author.username,
            }
        )


class FollowingFeedView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        followed_author_ids = list(
            AuthorFollow.objects.filter(follower=request.user).values_list("author_id", flat=True)
        )
        if not followed_author_ids:
            return self.get_paginated_response([]) if self.paginator else Response([])

        items = []
        books = _public_queryset_for_category("books").filter(author_id__in=followed_author_ids, is_anonymous=False)
        stories = _public_queryset_for_category("stories").filter(author_id__in=followed_author_ids, is_anonymous=False)
        poems = _public_queryset_for_category("poems").filter(author_id__in=followed_author_ids, is_anonymous=False)
        chapters = _public_queryset_for_category("chapters").filter(
            book__author_id__in=followed_author_ids,
            book__is_anonymous=False,
        )

        for target in [*books, *stories, *poems, *chapters]:
            payload = build_target_payload(target, request=request)
            payload["published_at"] = getattr(target, "created_at", None)
            items.append(payload)

        items.sort(
            key=lambda row: row.get("published_at") or datetime.min.replace(tzinfo=dt_timezone.utc),
            reverse=True,
        )
        page = self.paginate_queryset(items)
        if page is not None:
            return self.get_paginated_response(page)
        return Response(items)


class ReadingProgressDetailView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, category: str, identifier: str):
        target = _resolve_target_for_request(request, category, identifier)
        content_type = ContentType.objects.get_for_model(type(target))
        progress = ReadingProgress.objects.filter(
            user=request.user,
            content_type=content_type,
            object_id=target.id,
        ).first()

        if not progress:
            return Response({"progress": None})

        data = ReadingProgressSerializer(progress).data
        data["target"] = build_target_payload(target, request=request)
        return Response({"progress": data})

    def put(self, request, category: str, identifier: str):
        target = _resolve_target_for_request(request, category, identifier)
        serializer = ReadingProgressUpsertSerializer(data=request.data, context={"target": target})
        serializer.is_valid(raise_exception=True)

        content_type = ContentType.objects.get_for_model(type(target))
        progress, created = ReadingProgress.objects.get_or_create(
            user=request.user,
            content_type=content_type,
            object_id=target.id,
        )
        update_fields = []
        for field in ["progress_percent", "paragraph_index", "cursor", "completed", "last_position"]:
            if field in serializer.validated_data:
                setattr(progress, field, serializer.validated_data[field])
                update_fields.append(field)

        if isinstance(target, Chapter):
            if progress.chapter_id != target.id:
                progress.chapter = target
                update_fields.append("chapter")
        elif progress.chapter_id is not None:
            progress.chapter = None
            update_fields.append("chapter")

        if "last_position" not in serializer.validated_data:
            inferred_position = dict(progress.last_position or {})
            if "paragraph_index" in serializer.validated_data:
                inferred_position["paragraph_index"] = serializer.validated_data["paragraph_index"]
            if "cursor" in serializer.validated_data and serializer.validated_data["cursor"]:
                inferred_position["cursor"] = serializer.validated_data["cursor"]
            if inferred_position != (progress.last_position or {}):
                progress.last_position = inferred_position
                update_fields.append("last_position")

        if not update_fields:
            update_fields = ["updated_at"]
        progress.save(update_fields=[*update_fields, "updated_at"])

        _record_view_event_dedup(
            request,
            target,
            paragraph_index=getattr(progress, "paragraph_index", None),
        )

        data = ReadingProgressSerializer(progress).data
        data["target"] = build_target_payload(target, request=request)
        return Response({"progress": data, "created": created})


class ContinueReadingView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        queryset = ReadingProgress.objects.filter(user=request.user).select_related("content_type").order_by("-updated_at")
        items = []
        for progress in queryset[:250]:
            target = progress.target
            if not target:
                continue
            if not is_target_public(target):
                continue
            payload = ReadingProgressSerializer(progress).data
            payload["target"] = build_target_payload(target, request=request)
            items.append(payload)

        page = self.paginate_queryset(items)
        if page is not None:
            return self.get_paginated_response(page)
        return Response(items)


class ReadingProgressUpsertView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ReadingProgressByWorkUpsertSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        work_id = serializer.validated_data["work_id"]
        chapter_id = serializer.validated_data.get("chapter_id")
        work_type = serializer.validated_data.get("work_type")

        chapter = None
        if chapter_id is not None:
            chapter = (
                Chapter.objects.select_related("book", "book__author")
                .filter(id=chapter_id)
                .first()
            )
            if not chapter or not is_target_public(chapter):
                raise Http404("Chapter not found.")

            if chapter.book_id != work_id:
                raise ValidationError({"work_id": "work_id must match the chapter's book id."})

            work = chapter.book
            resolved_work_type = "books"
            target = chapter
        else:
            work, resolved_work_type = _resolve_public_work(work_id, work_type)
            target = work

        content_type = ContentType.objects.get_for_model(type(target))
        progress, created = ReadingProgress.objects.get_or_create(
            user=request.user,
            content_type=content_type,
            object_id=target.id,
        )

        progress_percent = serializer.validated_data["progress_percent"]
        last_position = serializer.validated_data.get("last_position", {})
        if last_position is None:
            last_position = {}

        progress.progress_percent = progress_percent
        progress.completed = float(progress_percent) >= 100
        progress.last_position = last_position
        progress.chapter = chapter

        paragraph_index = last_position.get("paragraph_index")
        if isinstance(paragraph_index, int) and paragraph_index >= 0:
            progress.paragraph_index = paragraph_index

        cursor = last_position.get("cursor")
        if isinstance(cursor, str):
            progress.cursor = cursor[:120]

        progress.save(
            update_fields=[
                "progress_percent",
                "completed",
                "last_position",
                "chapter",
                "paragraph_index",
                "cursor",
                "updated_at",
            ]
        )

        _record_view_event_dedup(
            request,
            target,
            paragraph_index=progress.paragraph_index,
        )

        response_payload = {
            "id": progress.id,
            "work_type": resolved_work_type,
            "work": build_target_payload(work, request=request),
            "chapter": build_target_payload(chapter, request=request) if chapter else None,
            "progress_percent": progress.progress_percent,
            "last_position": progress.last_position,
            "last_read_at": progress.updated_at,
            "created": created,
        }
        return Response(response_payload, status=status.HTTP_200_OK)


class MeContinueReadingView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        limit = _parse_limit(request.query_params.get("limit", "10"), default=10, max_value=50)
        queryset = (
            ReadingProgress.objects.filter(user=request.user)
            .select_related("content_type", "chapter", "chapter__book", "chapter__book__author")
            .order_by("-updated_at")
        )

        results = []
        seen_works = set()

        for progress in queryset[:500]:
            target = progress.target
            if not target:
                continue

            chapter = progress.chapter if progress.chapter_id else None
            work = None
            if chapter and is_target_public(chapter):
                work = chapter.book
            elif isinstance(target, Chapter) and is_target_public(target):
                chapter = target
                work = target.book
            elif isinstance(target, (Book, Story, Poem)) and is_target_public(target):
                work = target
                chapter = None

            if not work or not is_target_public(work):
                continue

            progress_value = float(progress.progress_percent or 0)
            if progress_value <= 0 or progress_value >= 100:
                continue

            work_key = (type(work).__name__.lower(), work.id)
            if work_key in seen_works:
                continue
            seen_works.add(work_key)

            work_payload = build_target_payload(work, request=request)
            chapter_payload = build_target_payload(chapter, request=request) if chapter else None
            target_read_path = chapter_payload["read_path"] if chapter_payload else work_payload["read_path"]
            results.append(
                {
                    "id": progress.id,
                    "work_type": work_payload["category"],
                    "work": work_payload,
                    "chapter": chapter_payload,
                    "progress_percent": progress.progress_percent,
                    "last_position": progress.last_position or {},
                    "last_read_at": progress.updated_at,
                    "target_read_path": target_read_path,
                }
            )
            if len(results) >= limit:
                break

        return Response({"results": results})


class ContentViewEventCreateView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, category: str, identifier: str):
        target = _resolve_public_target(category, identifier)
        paragraph_index = request.data.get("paragraph_index")
        if paragraph_index in {"", None}:
            paragraph_index = None
        elif not str(paragraph_index).isdigit():
            raise ValidationError({"paragraph_index": "Paragraph index must be a non-negative integer."})
        else:
            paragraph_index = int(paragraph_index)

        _record_view_event_dedup(request, target, paragraph_index=paragraph_index)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ContentReactionView(APIView):
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get(self, request, category: str, identifier: str):
        target = _resolve_target_for_request(request, category, identifier)
        return Response(_reaction_summary(target, user=request.user))

    def post(self, request, category: str, identifier: str):
        target = _resolve_target_for_request(request, category, identifier)
        if not request.user or not request.user.is_authenticated:
            raise PermissionDenied("Authentication required.")

        _enforce_reaction_cooldown(request.user.id, target, "like")
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

    def delete(self, request, category: str, identifier: str):
        target = _resolve_target_for_request(request, category, identifier)
        if not request.user or not request.user.is_authenticated:
            raise PermissionDenied("Authentication required.")

        _enforce_reaction_cooldown(request.user.id, target, "unlike")
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


class ContentCommentsView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get(self, request, category: str, identifier: str):
        target = _resolve_target_for_request(request, category, identifier)
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
            payload = ContentCommentSerializer(page, many=True, context=serializer_context).data
            return self.get_paginated_response(payload)

        payload = ContentCommentSerializer(queryset, many=True, context=serializer_context).data
        return Response(payload)

    def post(self, request, category: str, identifier: str):
        if not request.user or not request.user.is_authenticated:
            raise PermissionDenied("Authentication required.")

        target = _resolve_target_for_request(request, category, identifier)
        content_type = ContentType.objects.get_for_model(type(target))

        parent = None
        parent_id = request.data.get("parent_id")
        if parent_id not in {"", None}:
            parent = ContentComment.objects.select_related("user").filter(id=parent_id).first()
            if not parent:
                raise ValidationError({"parent_id": "Parent comment does not exist."})
            if parent.content_type_id != content_type.id or parent.object_id != target.id:
                raise ValidationError({"parent_id": "Parent comment does not belong to this content."})

        serializer = CommentCreateSerializer(
            data=request.data,
            context={"target": target, "parent": parent},
        )
        serializer.is_valid(raise_exception=True)

        paragraph_index = serializer.validated_data.get("paragraph_index")
        if paragraph_index is None and parent is not None:
            paragraph_index = parent.paragraph_index

        excerpt = ""
        if paragraph_index is not None:
            paragraphs = extract_target_paragraphs(target)
            if paragraphs and paragraph_index < len(paragraphs):
                excerpt = paragraphs[paragraph_index][:220]

        comment = ContentComment.objects.create(
            user=request.user,
            content_type=content_type,
            object_id=target.id,
            parent=parent,
            body=serializer.validated_data["body"],
            anchor_type=CommentAnchorType.PARAGRAPH,
            anchor_key=f"p:{paragraph_index}" if paragraph_index is not None else "",
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


class CommentModerationView(APIView):
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
        if is_hidden:
            comment.hidden_reason = reason
            comment.hidden_by = request.user
            comment.hidden_at = timezone.now()
        else:
            comment.hidden_reason = ""
            comment.hidden_by = None
            comment.hidden_at = None
        comment.save(update_fields=["is_hidden", "hidden_reason", "hidden_by", "hidden_at", "updated_at"])

        create_audit_log(
            actor=request.user,
            action="comment_moderated",
            target_type="content_comment",
            target_id=comment.id,
            description="Comment moderation state changed",
            metadata={
                "is_hidden": is_hidden,
                "reason": reason,
                "target_category": get_target_category(target),
                "target_id": target.id,
            },
            request=request,
        )

        if is_hidden and comment.user_id != request.user.id:
            create_notification(
                user=comment.user,
                category=Notification.Category.COMMENT,
                title="Your comment was hidden",
                message="A moderator hid one of your comments.",
                title_ka="თქვენი კომენტარი დაიმალა",
                message_ka="მოდერატორმა თქვენი ერთ-ერთი კომენტარი დამალა.",
                metadata={"comment_id": comment.id, "reason": reason},
            )

        bump_public_content_cache_version()
        data = ContentCommentSerializer(comment, context={"request": request, "viewer_can_moderate": True}).data
        return Response(data)


class TrendingView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        cache_meta = get_public_cache_meta(
            "public-discover:trending",
            canonicalize_request_path(request),
        )
        not_modified = build_public_not_modified_response(
            request,
            etag=cache_meta["etag"],
            last_modified=cache_meta["last_modified"],
        )
        if not_modified is not None:
            not_modified["X-Cache"] = "REVALIDATED"
            return apply_public_cache_headers(
                not_modified,
                etag=cache_meta["etag"],
                last_modified=cache_meta["last_modified"],
            )

        cached_payload = safe_cache_get(cache_meta["cache_key"])
        if cached_payload is not None:
            response = Response(cached_payload)
            response["X-Cache"] = "HIT"
            return apply_public_cache_headers(
                response,
                etag=cache_meta["etag"],
                last_modified=cache_meta["last_modified"],
            )

        start_at, normalized_window = _trending_window_to_start(request.query_params.get("window", "week"))
        limit = _parse_limit(request.query_params.get("limit", "20"))

        metrics = _build_interaction_metrics(start_at=start_at)
        target_map = _load_public_targets_for_metric_keys(set(metrics.keys()))

        ranked = []
        for key, stats_map in metrics.items():
            target = target_map.get(key)
            if not target:
                continue

            score = (
                stats_map["views"]
                + (stats_map["unique_readers"] * 2.0)
                + (stats_map["likes"] * 3.0)
                + (stats_map["comments"] * 4.0)
            )
            if score <= 0:
                continue

            payload = build_target_payload(target, request=request)
            ranked.append(
                {
                    **payload,
                    "score": round(score, 2),
                    "views": int(stats_map["views"]),
                    "unique_readers": int(stats_map["unique_readers"]),
                    "likes": int(stats_map["likes"]),
                    "comments": int(stats_map["comments"]),
                }
            )

        ranked.sort(
            key=lambda row: (
                -float(row["score"]),
                row.get("created_at") or datetime.min.replace(tzinfo=dt_timezone.utc),
            )
        )
        payload = {"window": normalized_window, "results": ranked[:limit]}
        safe_cache_set(
            cache_meta["cache_key"],
            payload,
            timeout=DISCOVERY_PUBLIC_CACHE_SECONDS,
            jitter=True,
        )
        response = Response(payload)
        response["X-Cache"] = "MISS"
        return apply_public_cache_headers(
            response,
            etag=cache_meta["etag"],
            last_modified=cache_meta["last_modified"],
        )


class RecommendationsView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        limit = _parse_limit(request.query_params.get("limit", "20"))

        week_start = timezone.now() - timedelta(days=7)
        popularity_metrics = _build_interaction_metrics(start_at=week_start)
        public_popularity_targets = _load_public_targets_for_metric_keys(set(popularity_metrics.keys()))

        if not request.user or not request.user.is_authenticated:
            cache_meta = get_public_cache_meta(
                "public-discover:recommendations",
                canonicalize_request_path(request),
            )
            not_modified = build_public_not_modified_response(
                request,
                etag=cache_meta["etag"],
                last_modified=cache_meta["last_modified"],
            )
            if not_modified is not None:
                not_modified["X-Cache"] = "REVALIDATED"
                return apply_public_cache_headers(
                    not_modified,
                    etag=cache_meta["etag"],
                    last_modified=cache_meta["last_modified"],
                )

            cached_payload = safe_cache_get(cache_meta["cache_key"])
            if cached_payload is not None:
                response = Response(cached_payload)
                response["X-Cache"] = "HIT"
                return apply_public_cache_headers(
                    response,
                    etag=cache_meta["etag"],
                    last_modified=cache_meta["last_modified"],
                )

            rows = []
            for key, stats_map in popularity_metrics.items():
                target = public_popularity_targets.get(key)
                if not target:
                    continue
                score = stats_map["views"] + (stats_map["likes"] * 3.0) + (stats_map["comments"] * 4.0)
                if score <= 0:
                    continue
                payload = build_target_payload(target, request=request)
                payload["explain_reason"] = "Popular this week."
                payload["score"] = round(score, 2)
                rows.append(payload)
            rows.sort(
                key=lambda row: (
                    -float(row["score"]),
                    row.get("created_at") or datetime.min.replace(tzinfo=dt_timezone.utc),
                )
            )
            payload = {"results": rows[:limit]}
            safe_cache_set(
                cache_meta["cache_key"],
                payload,
                timeout=DISCOVERY_PUBLIC_CACHE_SECONDS,
                jitter=True,
            )
            response = Response(payload)
            response["X-Cache"] = "MISS"
            return apply_public_cache_headers(
                response,
                etag=cache_meta["etag"],
                last_modified=cache_meta["last_modified"],
            )

        followed_author_ids = set(
            AuthorFollow.objects.filter(follower=request.user).values_list("author_id", flat=True)
        )
        history = list(
            ReadingProgress.objects.filter(user=request.user)
            .select_related("content_type")
            .order_by("-updated_at")[:150]
        )
        history_pairs = {(item.content_type_id, item.object_id) for item in history}

        preferred_categories: dict[str, int] = defaultdict(int)
        keyword_source_lists: list[list[str]] = []
        for progress in history:
            target = progress.target
            if not target:
                continue
            preferred_categories[get_target_category(target)] += 1
            keyword_source_lists.append(extract_keywords_from_target(target, max_items=6))

        sorted_categories = sorted(preferred_categories.items(), key=lambda item: (-item[1], item[0]))
        top_categories = {category for category, _ in sorted_categories[:2]}
        preferred_keywords = set()
        for words in keyword_source_lists:
            preferred_keywords.update(words[:3])

        candidate_targets = []
        for category in ["books", "stories", "poems", "chapters"]:
            queryset = _public_queryset_for_category(category).order_by("-created_at")[:180]
            candidate_targets.extend(list(queryset))

        scored = []
        for target in candidate_targets:
            content_type = ContentType.objects.get_for_model(type(target))
            key = (content_type.id, target.id)
            if key in history_pairs:
                continue

            base_stats = popularity_metrics.get(key, _init_metric_state())
            score = base_stats["views"] + (base_stats["likes"] * 2.0) + (base_stats["comments"] * 3.0)
            reasons = []
            author = get_target_author(target)
            category = get_target_category(target)

            if author and author.id in followed_author_ids and not is_target_anonymous(target):
                score += 70
                reasons.append("You follow this author.")

            if category in top_categories:
                score += 25
                reasons.append(f"Matches your reading history in {category}.")

            candidate_keywords = set(extract_keywords_from_target(target, max_items=6))
            overlap = sorted(preferred_keywords.intersection(candidate_keywords))
            if overlap:
                score += min(3, len(overlap)) * 10
                reasons.append(f"Shares themes you read: {', '.join(overlap[:3])}.")

            created_at = getattr(target, "created_at", None)
            if created_at:
                age_days = (timezone.now() - created_at).days
                if age_days <= 7:
                    score += 10
                elif age_days <= 30:
                    score += 5

            if score <= 0:
                continue

            payload = build_target_payload(target, request=request)
            payload["score"] = round(score, 2)
            payload["explain_reason"] = reasons[0] if reasons else "Popular this week."
            scored.append(payload)

        scored.sort(
            key=lambda row: (
                -float(row["score"]),
                row.get("created_at") or datetime.min.replace(tzinfo=dt_timezone.utc),
            )
        )
        return Response({"results": scored[:limit]})


class WriterAnalyticsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not (is_writer_approved(request.user) or request.user.is_staff):
            raise PermissionDenied("Only approved writers can access analytics.")

        start_at, normalized_range = get_period_start(request.query_params.get("range", "7d"))

        books = list(Book.objects.filter(author=request.user, is_deleted=False).select_related("author"))
        stories = list(Story.objects.filter(author=request.user, is_deleted=False).select_related("author"))
        poems = list(Poem.objects.filter(author=request.user, is_deleted=False).select_related("author"))
        book_ids = [book.id for book in books]
        chapters = list(
            Chapter.objects.filter(book_id__in=book_ids).select_related("book", "book__author").order_by("order")
        )

        all_targets = [*books, *stories, *poems, *chapters]
        all_pairs = {
            (ContentType.objects.get_for_model(type(target)).id, target.id)
            for target in all_targets
        }
        metrics = _build_interaction_metrics(start_at=start_at)
        filtered_metrics = {key: value for key, value in metrics.items() if key in all_pairs}

        chapters_by_book: dict[int, list[Chapter]] = defaultdict(list)
        for chapter in chapters:
            chapters_by_book[chapter.book_id].append(chapter)

        chapter_ct_id = ContentType.objects.get_for_model(Chapter).id
        work_rows = []
        for target in [*books, *stories, *poems]:
            ct_id = ContentType.objects.get_for_model(type(target)).id
            key = (ct_id, target.id)
            stat = filtered_metrics.get(key, _init_metric_state())
            payload = build_target_payload(target, request=request)

            row = {
                **payload,
                "metrics": {
                    "views": int(stat["views"]),
                    "unique_readers": int(stat["unique_readers"]),
                    "likes": int(stat["likes"]),
                    "comments": int(stat["comments"]),
                    "completion_estimate": round(float(stat["completion_estimate"]), 2),
                    "completion_rate": round(float(stat["completion_rate"]), 2),
                },
                "chapters": [],
            }

            if isinstance(target, Book):
                chapter_rows = []
                for chapter in chapters_by_book.get(target.id, []):
                    chapter_key = (chapter_ct_id, chapter.id)
                    chapter_stat = filtered_metrics.get(chapter_key, _init_metric_state())
                    chapter_rows.append(
                        {
                            **build_target_payload(chapter, request=request),
                            "order": chapter.order,
                            "metrics": {
                                "views": int(chapter_stat["views"]),
                                "unique_readers": int(chapter_stat["unique_readers"]),
                                "likes": int(chapter_stat["likes"]),
                                "comments": int(chapter_stat["comments"]),
                                "completion_estimate": round(float(chapter_stat["completion_estimate"]), 2),
                                "completion_rate": round(float(chapter_stat["completion_rate"]), 2),
                            },
                        }
                    )
                row["chapters"] = chapter_rows

            work_rows.append(row)

        totals = {
            "views": sum(row["metrics"]["views"] for row in work_rows),
            "unique_readers": sum(row["metrics"]["unique_readers"] for row in work_rows),
            "likes": sum(row["metrics"]["likes"] for row in work_rows),
            "comments": sum(row["metrics"]["comments"] for row in work_rows),
        }

        return Response(
            {
                "range": normalized_range,
                "generated_at": timezone.now(),
                "totals": totals,
                "works": work_rows,
            }
        )


class ShareMetadataView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, category: str, identifier: str):
        cache_meta = get_public_cache_meta("public-share:metadata", canonicalize_request_path(request))
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

        target = _resolve_public_target(category, identifier)
        payload = build_target_payload(target, request=request)
        share_url = request.build_absolute_uri()
        read_url = payload["read_url"]
        title = str(payload["title"])
        excerpt = str(payload["excerpt"] or f"Read '{title}' on Readus.")
        category_label = str(payload["category"]).rstrip("s").capitalize()

        image_url = payload.get("cover_image")
        if not image_url:
            image_url = request.build_absolute_uri(
                reverse(
                    "engagement-share-image",
                    kwargs={"category": category, "identifier": identifier},
                )
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
  <meta property="og:image" content="{escape(str(image_url))}" />
  <meta property="article:section" content="{escape(category_label)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="{escape(title)}" />
  <meta name="twitter:description" content="{escape(excerpt)}" />
  <meta name="twitter:image" content="{escape(str(image_url))}" />
  <meta http-equiv="refresh" content="0; url={escape(str(read_url))}" />
</head>
<body>
  <p>Redirecting to <a href="{escape(str(read_url))}">{escape(str(read_url))}</a>...</p>
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


class ShareImageView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, category: str, identifier: str):
        cache_meta = get_public_cache_meta("public-share:image", canonicalize_request_path(request))
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

        target = _resolve_public_target(category, identifier)
        payload = build_target_payload(target, request=request)
        title = escape(str(payload["title"]))[:120]
        subtitle = escape(str(payload["author_display_name"]))[:80]
        excerpt = escape(str(payload["excerpt"] or ""))[:180]

        svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0%" x2="100%" y1="0%" y2="100%">
      <stop offset="0%" stop-color="#1f2937" />
      <stop offset="100%" stop-color="#7c2d12" />
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)" />
  <rect x="56" y="56" width="1088" height="518" rx="28" fill="rgba(255,255,255,0.06)" />
  <text x="90" y="160" font-family="Georgia, serif" font-size="62" fill="#fff">{title}</text>
  <text x="90" y="230" font-family="Arial, sans-serif" font-size="34" fill="#fcd34d">by {subtitle}</text>
  <text x="90" y="315" font-family="Arial, sans-serif" font-size="30" fill="#e5e7eb">{excerpt}</text>
  <text x="90" y="560" font-family="Arial, sans-serif" font-size="34" fill="#f9fafb">Readus</text>
</svg>
"""
        response = HttpResponse(svg, content_type="image/svg+xml")
        return apply_public_cache_headers(
            response,
            etag=cache_meta["etag"],
            last_modified=cache_meta["last_modified"],
            vary_on_auth=False,
        )
