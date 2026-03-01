from rest_framework.permissions import SAFE_METHODS, BasePermission

from accounts.utils import can_manage_content, can_review_content, is_email_verified, is_writer_approved
from content.models import Chapter


class CanReviewContent(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and can_review_content(user))


class IsApprovedWriterOrReadOnly(BasePermission):
    message = "Only approved writers can create or edit content."

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True

        user = request.user
        if not user or not user.is_authenticated:
            return False

        if can_manage_content(user):
            return True

        if not is_email_verified(user):
            self.message = "Verify your email before creating content."
            return False

        return is_writer_approved(user)

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True

        user = request.user
        if not user or not user.is_authenticated:
            return False

        if can_manage_content(user):
            return True

        if not (is_email_verified(user) and is_writer_approved(user)):
            return False

        if hasattr(obj, "author"):
            return obj.author_id == user.id

        if isinstance(obj, Chapter):
            return obj.book.author_id == user.id

        return False
