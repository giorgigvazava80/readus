from hashlib import sha256

from django.conf import settings
from django.core.cache import cache
from django.db.models import Q
from django.http import Http404
from rest_framework import permissions, status, viewsets
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
    StorySerializer,
)


PUBLIC_CONTENT_CACHE_VERSION_KEY = "public-content-cache-version"


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
        status_filter = request.query_params.get("status", "").strip()
        q = request.query_params.get("q", "").strip()
        date_from = request.query_params.get("date_from", "").strip()
        date_to = request.query_params.get("date_to", "").strip()

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
        create_audit_log(
            actor=request.user,
            action="content_deleted",
            target_type=obj.__class__.__name__.lower(),
            target_id=obj.id,
            description="Content deleted",
            request=request,
        )
        response = super().destroy(request, *args, **kwargs)
        _bump_public_cache_version()
        return response


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
                    Q(status=StatusChoices.DRAFT) | Q(chapters__status=StatusChoices.DRAFT)
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
