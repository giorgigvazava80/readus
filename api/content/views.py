from hashlib import sha256

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.files.storage import default_storage
from django.db.models import Count, F, Q, Value
from django.db.models.functions import Concat
from django.http import Http404
from django.utils import timezone
from rest_framework import generics, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from accounts.emailing import send_mail_safe
from accounts.models import Notification
from accounts.permissions import PasswordChangeNotForced
from accounts.utils import can_manage_content, can_review_content, create_audit_log, create_notification
from content.models import Book, Chapter, Poem, StatusChoices, Story
from content.permissions import CanReviewContent, IsApprovedWriterOrReadOnly
from content.serializers import (
    BookSerializer,
    ChapterSerializer,
    ContentReviewSerializer,
    PoemSerializer,
    PublicAuthorSummarySerializer,
    StorySerializer,
)
from engagement.models import AuthorFollow


PUBLIC_CONTENT_CACHE_VERSION_KEY = "public-content-cache-version"
ANONYMOUS_AUTHOR_KEY = "anonymous"


def _send_review_email(user, status_value):
    if not user.email:
        return

    if status_value == StatusChoices.APPROVED:
        subject = "Your content was approved"
        body = "One of your submissions was approved and is now visible to readers."
    else:
        subject = "Your content was rejected"
        body = "One of your submissions was rejected. Check rejection reason in your dashboard."

    send_mail_safe(subject, body, None, [user.email], fail_silently=True)


def _get_public_cache_version() -> int:
    version = cache.get(PUBLIC_CONTENT_CACHE_VERSION_KEY)
    if version is None:
        cache.set(PUBLIC_CONTENT_CACHE_VERSION_KEY, 1, timeout=None)
        return 1
    return int(version)


def _bump_public_cache_version() -> None:
    if cache.get(PUBLIC_CONTENT_CACHE_VERSION_KEY) is None:
        cache.set(PUBLIC_CONTENT_CACHE_VERSION_KEY, 1, timeout=None)
    try:
        cache.incr(PUBLIC_CONTENT_CACHE_VERSION_KEY)
    except ValueError:
        current = cache.get(PUBLIC_CONTENT_CACHE_VERSION_KEY) or 1
        cache.set(PUBLIC_CONTENT_CACHE_VERSION_KEY, int(current) + 1, timeout=None)


def _public_cache_key(prefix: str, path: str) -> str:
    path_hash = sha256(path.encode("utf-8")).hexdigest()
    version = _get_public_cache_version()
    return f"{prefix}:v{version}:{path_hash}"


def _public_content_base_q() -> Q:
    return Q(status=StatusChoices.APPROVED, is_hidden=False, is_deleted=False)


def _resolve_profile_photo_url(photo_name: str | None) -> str | None:
    if not photo_name:
        return None

    raw = str(photo_name).strip()
    if not raw:
        return None

    if raw.startswith(("http://", "https://", "//")):
        return raw

    try:
        return default_storage.url(raw)
    except Exception:
        media_url = settings.MEDIA_URL or "/media/"
        if not media_url.endswith("/"):
            media_url = f"{media_url}/"

        return f"{media_url}{raw.lstrip('/')}"


def _build_anonymous_summary() -> dict[str, object] | None:
    base = _public_content_base_q() & Q(is_anonymous=True)
    books_count = Book.objects.filter(base).count()
    stories_count = Story.objects.filter(base).count()
    poems_count = Poem.objects.filter(base).count()
    works_count = books_count + stories_count + poems_count
    if works_count <= 0:
        return None

    return {
        "id": None,
        "key": ANONYMOUS_AUTHOR_KEY,
        "display_name": "Anonymous",
        "username": None,
        "profile_photo": None,
        "works_count": works_count,
        "books_count": books_count,
        "stories_count": stories_count,
        "poems_count": poems_count,
        "follower_count": 0,
        "is_following": False,
        "is_anonymous": True,
    }


def _anonymous_matches_search(search: str) -> bool:
    if not search:
        return True

    normalized = search.lower()
    aliases = ("anonymous", "anon", "ანონიმური", "ანონიმ")
    return any(normalized in alias for alias in aliases)


def _build_named_author_queryset(search: str = ""):
    User = get_user_model()
    books_public_q = Q(
        book_items__status=StatusChoices.APPROVED,
        book_items__is_hidden=False,
        book_items__is_anonymous=False,
        book_items__is_deleted=False,
    )
    stories_public_q = Q(
        story_items__status=StatusChoices.APPROVED,
        story_items__is_hidden=False,
        story_items__is_anonymous=False,
        story_items__is_deleted=False,
    )
    poems_public_q = Q(
        poem_items__status=StatusChoices.APPROVED,
        poem_items__is_hidden=False,
        poem_items__is_anonymous=False,
        poem_items__is_deleted=False,
    )

    queryset = (
        User.objects.annotate(
            books_count=Count(
                "book_items",
                filter=books_public_q,
                distinct=True,
            ),
            stories_count=Count(
                "story_items",
                filter=stories_public_q,
                distinct=True,
            ),
            poems_count=Count(
                "poem_items",
                filter=poems_public_q,
                distinct=True,
            ),
        )
        .annotate(
            works_count=F("books_count") + F("stories_count") + F("poems_count"),
            follower_count=Count("author_followers", distinct=True),
            full_name=Concat("first_name", Value(" "), "last_name"),
        )
        .filter(works_count__gt=0)
    )

    if search:
        queryset = queryset.filter(
            Q(username__icontains=search)
            | Q(first_name__icontains=search)
            | Q(last_name__icontains=search)
            | Q(full_name__icontains=search)
        )

    return queryset


def _to_named_author_summary(row: dict[str, object]) -> dict[str, object]:
    full_name = str(row.get("full_name") or "").strip()
    username = str(row.get("username") or "").strip()
    display_name = full_name or username

    return {
        "id": int(row["id"]) if row.get("id") is not None else None,
        "key": username,
        "display_name": display_name,
        "username": username,
        "profile_photo": _resolve_profile_photo_url(row.get("profile_photo")),
        "works_count": int(row.get("works_count") or 0),
        "books_count": int(row.get("books_count") or 0),
        "stories_count": int(row.get("stories_count") or 0),
        "poems_count": int(row.get("poems_count") or 0),
        "follower_count": int(row.get("follower_count") or 0),
        "is_following": bool(row.get("is_following", False)),
        "is_anonymous": False,
    }


def _get_author_summary_by_key(author_key: str) -> dict[str, object]:
    normalized_key = author_key.strip()
    if not normalized_key:
        raise Http404("Author not found.")

    if normalized_key == ANONYMOUS_AUTHOR_KEY:
        anonymous_summary = _build_anonymous_summary()
        if not anonymous_summary:
            raise Http404("Author not found.")
        return anonymous_summary

    row = (
        _build_named_author_queryset()
        .filter(username=normalized_key)
        .values(
            "id",
            "username",
            "full_name",
            "profile__profile_photo",
            "works_count",
            "books_count",
            "stories_count",
            "poems_count",
            "follower_count",
        )
        .first()
    )
    if not row:
        raise Http404("Author not found.")

    row["profile_photo"] = row.pop("profile__profile_photo", None)
    return _to_named_author_summary(row)


class PublicAuthorListView(generics.GenericAPIView):
    serializer_class = PublicAuthorSummarySerializer
    permission_classes = [permissions.AllowAny]

    def _can_use_public_cache(self, request):
        user = request.user
        return request.method == "GET" and not (user and user.is_authenticated)

    def get(self, request):
        use_cache = self._can_use_public_cache(request)
        cache_key = _public_cache_key("public-authors:list", request.get_full_path())
        if use_cache:
            cached_payload = cache.get(cache_key)
            if cached_payload is not None:
                response = Response(cached_payload)
                response["X-Cache"] = "HIT"
                return response

        search = request.query_params.get("q", "").strip()
        named_rows = (
            _build_named_author_queryset(search)
            .values(
                "id",
                "username",
                "full_name",
                "profile__profile_photo",
                "works_count",
                "books_count",
                "stories_count",
                "poems_count",
                "follower_count",
            )
        )
        authors = []
        for row in named_rows:
            row["profile_photo"] = row.pop("profile__profile_photo", None)
            authors.append(_to_named_author_summary(row))

        if request.user and request.user.is_authenticated:
            followed_author_ids = set(
                AuthorFollow.objects.filter(follower=request.user).values_list("author_id", flat=True)
            )
            for item in authors:
                author_id = item.get("id")
                item["is_following"] = bool(author_id and author_id in followed_author_ids)

        anonymous_summary = _build_anonymous_summary()
        if anonymous_summary and _anonymous_matches_search(search):
            authors.append(anonymous_summary)

        authors.sort(key=lambda item: (-int(item["works_count"]), str(item["display_name"]).lower()))

        page = self.paginate_queryset(authors)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            response = self.get_paginated_response(serializer.data)
        else:
            serializer = self.get_serializer(authors, many=True)
            response = Response(serializer.data)

        if use_cache and response.status_code == status.HTTP_200_OK:
            cache.set(cache_key, response.data, timeout=getattr(settings, "CACHE_TTL_PUBLIC_LIST", 120))
            response["X-Cache"] = "MISS"

        return response


class PublicAuthorDetailView(generics.GenericAPIView):
    serializer_class = PublicAuthorSummarySerializer
    permission_classes = [permissions.AllowAny]

    def _can_use_public_cache(self, request):
        user = request.user
        return request.method == "GET" and not (user and user.is_authenticated)

    def get(self, request, author_key: str):
        use_cache = self._can_use_public_cache(request)
        cache_key = _public_cache_key("public-authors:detail", request.get_full_path())
        if use_cache:
            cached_payload = cache.get(cache_key)
            if cached_payload is not None:
                response = Response(cached_payload)
                response["X-Cache"] = "HIT"
                return response

        summary = _get_author_summary_by_key(author_key)
        if request.user and request.user.is_authenticated and summary.get("id"):
            summary["is_following"] = AuthorFollow.objects.filter(
                follower=request.user,
                author_id=summary["id"],
            ).exists()
        serializer = self.get_serializer(summary)
        response = Response(serializer.data)

        if use_cache and response.status_code == status.HTTP_200_OK:
            cache.set(cache_key, response.data, timeout=getattr(settings, "CACHE_TTL_PUBLIC_DETAIL", 300))
            response["X-Cache"] = "MISS"

        return response


class ReviewActionMixin:
    @action(
        detail=True,
        methods=["post"],
        permission_classes=[permissions.IsAuthenticated, PasswordChangeNotForced, CanReviewContent],
        serializer_class=ContentReviewSerializer,
    )
    def review(self, request, pk=None):
        obj = self.get_object()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        status_value = serializer.validated_data["status"]
        reason = serializer.validated_data.get("rejection_reason", "")
        previous_status = obj.status

        if isinstance(obj, Book) and status_value == StatusChoices.APPROVED:
            has_approved_chapters = obj.chapters.filter(status=StatusChoices.APPROVED).exists()
            if not has_approved_chapters and obj.chapters.exists():
                return Response(
                    {"detail": "At least one chapter must be approved before approving this book."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        obj.set_status(status_value, user=request.user, reason=reason)

        if previous_status != StatusChoices.APPROVED and status_value == StatusChoices.APPROVED:
            from engagement.services import notify_followers_about_publication

            notify_followers_about_publication(obj)

        author = obj.book.author if isinstance(obj, Chapter) else obj.author
        create_notification(
            user=author,
            category=Notification.Category.CONTENT_REVIEW,
            title="Content review updated",
            message=(
                "Your submission was approved."
                if status_value == StatusChoices.APPROVED
                else "Your submission was rejected. Check rejection reason in your dashboard."
            ),
            metadata={
                "content_type": obj.__class__.__name__.lower(),
                "content_id": obj.id,
                "status": status_value,
            },
        )
        _send_review_email(author, status_value)

        create_audit_log(
            actor=request.user,
            action="content_reviewed",
            target_type=obj.__class__.__name__.lower(),
            target_id=obj.id,
            description="Content review status updated",
            metadata={
                "old_status": previous_status,
                "new_status": status_value,
                "rejection_reason": reason,
            },
            request=request,
        )

        _bump_public_cache_version()
        return Response({"status": "updated"})


class AuthorContentViewSet(ReviewActionMixin, viewsets.ModelViewSet):
    permission_classes = [IsApprovedWriterOrReadOnly]

    def _can_use_public_cache(self, request):
        user = request.user
        return request.method == "GET" and not (user and user.is_authenticated)

    def list(self, request, *args, **kwargs):
        if not self._can_use_public_cache(request):
            return super().list(request, *args, **kwargs)

        cache_key = _public_cache_key(f"public-content:{self.basename}:list", request.get_full_path())
        cached_payload = cache.get(cache_key)
        if cached_payload is not None:
            response = Response(cached_payload)
            response["X-Cache"] = "HIT"
            return response

        response = super().list(request, *args, **kwargs)
        if response.status_code == status.HTTP_200_OK:
            cache.set(cache_key, response.data, timeout=getattr(settings, "CACHE_TTL_PUBLIC_LIST", 120))
            response["X-Cache"] = "MISS"
        return response

    def retrieve(self, request, *args, **kwargs):
        if not self._can_use_public_cache(request):
            return super().retrieve(request, *args, **kwargs)

        cache_key = _public_cache_key(f"public-content:{self.basename}:detail", request.get_full_path())
        cached_payload = cache.get(cache_key)
        if cached_payload is not None:
            response = Response(cached_payload)
            response["X-Cache"] = "HIT"
            return response

        response = super().retrieve(request, *args, **kwargs)
        if response.status_code == status.HTTP_200_OK:
            cache.set(cache_key, response.data, timeout=getattr(settings, "CACHE_TTL_PUBLIC_DETAIL", 300))
            response["X-Cache"] = "MISS"
        return response

    def get_object(self):
        queryset = self.filter_queryset(self.get_queryset())
        lookup_url_kwarg = self.lookup_url_kwarg or self.lookup_field
        lookup_value = self.kwargs.get(lookup_url_kwarg)

        if lookup_value is None:
            return super().get_object()

        obj = queryset.filter(public_slug=lookup_value).first()
        if obj is None and str(lookup_value).isdigit():
            obj = queryset.filter(**{self.lookup_field: int(lookup_value)}).first()
        if obj is None:
            raise Http404("No content matches the given query.")

        self.check_object_permissions(self.request, obj)
        return obj

    def get_queryset(self):
        queryset = super().get_queryset()
        request = self.request
        user = request.user

        mine = request.query_params.get("mine", "0") in {"1", "true", "True"}
        deleted_only = request.query_params.get("deleted", "0") in {"1", "true", "True"}
        status_filter = request.query_params.get("status", "").strip()
        q = request.query_params.get("q", "").strip()
        author_filter = request.query_params.get("author", "").strip()
        date_from = request.query_params.get("date_from", "").strip()
        date_to = request.query_params.get("date_to", "").strip()
        include_deleted_for_action = getattr(self, "action", "") in {"restore", "hard_delete", "cleanup"}

        if not deleted_only and not include_deleted_for_action:
            queryset = queryset.filter(is_deleted=False)

        if deleted_only:
            if not user.is_authenticated:
                return queryset.none()
            queryset = queryset.filter(is_deleted=True)
            if mine or not (can_manage_content(user) or can_review_content(user)):
                queryset = queryset.filter(author=user)
        else:
            if mine:
                if not user.is_authenticated:
                    return queryset.none()
                queryset = queryset.filter(author=user)
            else:
                if not user.is_authenticated:
                    queryset = queryset.filter(status=StatusChoices.APPROVED, is_hidden=False)
                elif not (can_manage_content(user) or can_review_content(user)):
                    queryset = queryset.filter(Q(status=StatusChoices.APPROVED, is_hidden=False) | Q(author=user))

        if status_filter:
            queryset = queryset.filter(status=status_filter)

        if q:
            queryset = queryset.filter(Q(title__icontains=q) | Q(description__icontains=q) | Q(extracted_text__icontains=q))

        if author_filter:
            if author_filter == ANONYMOUS_AUTHOR_KEY:
                queryset = queryset.filter(is_anonymous=True)
            else:
                queryset = queryset.filter(author__username=author_filter, is_anonymous=False)

        if date_from:
            queryset = queryset.filter(created_at__date__gte=date_from)

        if date_to:
            queryset = queryset.filter(created_at__date__lte=date_to)

        return queryset.order_by("-created_at")

    def perform_create(self, serializer):
        obj = serializer.save()
        create_audit_log(
            actor=self.request.user,
            action="content_submitted",
            target_type=obj.__class__.__name__.lower(),
            target_id=obj.id,
            description="Content submitted for review",
            metadata={"status": obj.status},
            request=self.request,
        )
        _bump_public_cache_version()

    def update(self, request, *args, **kwargs):
        response = super().update(request, *args, **kwargs)
        obj = self.get_object()
        create_audit_log(
            actor=request.user,
            action="content_updated",
            target_type=obj.__class__.__name__.lower(),
            target_id=obj.id,
            description="Content updated",
            request=request,
        )
        _bump_public_cache_version()
        return response

    def destroy(self, request, *args, **kwargs):
        obj = self.get_object()
        if obj.is_deleted:
            return Response(status=status.HTTP_204_NO_CONTENT)

        obj.is_deleted = True
        obj.deleted_at = timezone.now()
        obj.save(update_fields=["is_deleted", "deleted_at", "updated_at"])
        create_audit_log(
            actor=request.user,
            action="content_moved_to_bin",
            target_type=obj.__class__.__name__.lower(),
            target_id=obj.id,
            description="Content moved to recycle bin",
            request=request,
        )
        _bump_public_cache_version()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    def restore(self, request, *args, **kwargs):
        obj = self.get_object()
        if not obj.is_deleted:
            return Response({"detail": "Item is not in recycle bin."}, status=status.HTTP_400_BAD_REQUEST)

        obj.is_deleted = False
        obj.deleted_at = None
        obj.save(update_fields=["is_deleted", "deleted_at", "updated_at"])
        create_audit_log(
            actor=request.user,
            action="content_restored",
            target_type=obj.__class__.__name__.lower(),
            target_id=obj.id,
            description="Content restored from recycle bin",
            request=request,
        )
        _bump_public_cache_version()
        serializer = self.get_serializer(obj)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["delete"], url_path="hard-delete")
    def hard_delete(self, request, *args, **kwargs):
        obj = self.get_object()
        if not obj.is_deleted:
            return Response(
                {"detail": "Move item to recycle bin first."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        create_audit_log(
            actor=request.user,
            action="content_permanently_deleted",
            target_type=obj.__class__.__name__.lower(),
            target_id=obj.id,
            description="Content permanently deleted from recycle bin",
            request=request,
        )
        obj.delete()
        _bump_public_cache_version()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["post"])
    def cleanup(self, request, *args, **kwargs):
        deleted_queryset = self.queryset.filter(author=request.user, is_deleted=True)
        deleted_count = deleted_queryset.count()

        if deleted_count <= 0:
            return Response({"deleted_count": 0}, status=status.HTTP_200_OK)

        deleted_queryset.delete()
        create_audit_log(
            actor=request.user,
            action="content_recycle_bin_cleaned",
            target_type=self.basename or self.__class__.__name__.lower(),
            target_id=request.user.id,
            description="Recycle bin cleaned",
            metadata={"deleted_count": deleted_count},
            request=request,
        )
        _bump_public_cache_version()
        return Response({"deleted_count": deleted_count}, status=status.HTTP_200_OK)


class StoryViewSet(AuthorContentViewSet):
    queryset = Story.objects.select_related("author").all()
    serializer_class = StorySerializer


class PoemViewSet(AuthorContentViewSet):
    queryset = Poem.objects.select_related("author").all()
    serializer_class = PoemSerializer


class BookViewSet(AuthorContentViewSet):
    queryset = Book.objects.select_related("author").all().prefetch_related("chapters")
    serializer_class = BookSerializer

    def get_queryset(self):
        # Start with base queryset logic from AuthorContentViewSet
        queryset = super().get_queryset()
        
        request = self.request
        user = request.user
        mine = request.query_params.get("mine", "0") in {"1", "true", "True"}
        status_filter = request.query_params.get("status", "").strip()

        # Custom logic for redactors viewing the review queue
        if not mine and (can_manage_content(user) or can_review_content(user)):
            if status_filter == StatusChoices.DRAFT:
                # Include books in draft state OR books with at least one draft chapter
                queryset = Book.objects.filter(
                    Q(status=StatusChoices.DRAFT) | Q(chapters__status=StatusChoices.DRAFT),
                    is_deleted=False,
                ).select_related("author").prefetch_related("chapters").distinct()

        return queryset.order_by("-created_at")


class ChapterViewSet(ReviewActionMixin, viewsets.ModelViewSet):
    queryset = Chapter.objects.select_related("book", "book__author")
    serializer_class = ChapterSerializer
    permission_classes = [IsApprovedWriterOrReadOnly]

    def get_queryset(self):
        queryset = super().get_queryset()
        request = self.request
        user = request.user

        mine = request.query_params.get("mine", "0") in {"1", "true", "True"}
        status_filter = request.query_params.get("status", "").strip()
        q = request.query_params.get("q", "").strip()
        date_from = request.query_params.get("date_from", "").strip()
        date_to = request.query_params.get("date_to", "").strip()

        book_id = request.query_params.get("book")
        if book_id:
            queryset = queryset.filter(book_id=book_id)

        if mine:
            if not user.is_authenticated:
                return queryset.none()
            queryset = queryset.filter(book__author=user)
        else:
            if not user.is_authenticated:
                queryset = queryset.filter(
                    status=StatusChoices.APPROVED, 
                    book__status=StatusChoices.APPROVED,
                    book__is_hidden=False
                )
            elif not (can_manage_content(user) or can_review_content(user)):
                queryset = queryset.filter(
                    (Q(status=StatusChoices.APPROVED, book__status=StatusChoices.APPROVED, book__is_hidden=False))
                    | Q(book__author=user)
                )

        if status_filter:
            queryset = queryset.filter(status=status_filter)

        if q:
            queryset = queryset.filter(Q(title__icontains=q) | Q(body__icontains=q) | Q(book__title__icontains=q))

        if date_from:
            queryset = queryset.filter(created_at__date__gte=date_from)

        if date_to:
            queryset = queryset.filter(created_at__date__lte=date_to)

        return queryset.order_by("-created_at")

    def perform_create(self, serializer):
        book = serializer.validated_data["book"]
        user = self.request.user

        if book.author_id != user.id and not can_manage_content(user):
            raise PermissionDenied("You can only add chapters to your own books.")

        chapter = serializer.save()
        create_audit_log(
            actor=user,
            action="content_submitted",
            target_type="chapter",
            target_id=chapter.id,
            description="Chapter submitted for review",
            metadata={"book_id": book.id, "status": chapter.status},
            request=self.request,
        )
        _bump_public_cache_version()

    def update(self, request, *args, **kwargs):
        response = super().update(request, *args, **kwargs)
        obj = self.get_object()
        create_audit_log(
            actor=request.user,
            action="content_updated",
            target_type="chapter",
            target_id=obj.id,
            description="Chapter updated",
            request=request,
        )
        _bump_public_cache_version()
        return response

    def destroy(self, request, *args, **kwargs):
        obj = self.get_object()
        create_audit_log(
            actor=request.user,
            action="content_deleted",
            target_type="chapter",
            target_id=obj.id,
            description="Content deleted",
            request=request,
        )
        response = super().destroy(request, *args, **kwargs)
        _bump_public_cache_version()
        return response
