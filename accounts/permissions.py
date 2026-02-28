from rest_framework.permissions import BasePermission

from .utils import (
    can_manage_redactors,
    can_review_content,
    can_review_writer_applications,
    get_profile,
    is_admin_user,
    is_email_verified,
    is_redactor_user,
)


class IsAdminOrRedactor(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and (is_admin_user(user) or is_redactor_user(user)))


class IsRedactor(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and is_redactor_user(user))


class CanReviewWriterApplications(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and can_review_writer_applications(user))


class CanReviewContent(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and can_review_content(user))


class CanManageRedactors(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and can_manage_redactors(user))


class VerifiedEmailRequired(BasePermission):
    message = "Email verification is required before accessing this resource."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and is_email_verified(user))


class PasswordChangeNotForced(BasePermission):
    message = "Password change is required before continuing."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        profile = get_profile(user)
        return not profile.forced_password_change
