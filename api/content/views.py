from django.db.models import Q
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

        return Response({"status": "updated"})


class AuthorContentViewSet(ReviewActionMixin, viewsets.ModelViewSet):
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
        return super().destroy(request, *args, **kwargs)


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
        return super().destroy(request, *args, **kwargs)
