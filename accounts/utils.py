from __future__ import annotations

from typing import Any

from allauth.account.models import EmailAddress
from django.contrib.auth.models import Group

from .constants import GROUP_ADMINS, GROUP_READERS, GROUP_REDACTORS, GROUP_WRITERS
from .models import AuditLog, Notification, RedactorPermission, UserProfile


def ensure_default_groups() -> None:
    for group_name in [GROUP_READERS, GROUP_WRITERS, GROUP_REDACTORS, GROUP_ADMINS]:
        Group.objects.get_or_create(name=group_name)


def get_profile(user):
    cached = getattr(user, "_cached_profile", None)
    if cached is not None:
        return cached

    profile, _ = UserProfile.objects.get_or_create(user=user)
    setattr(user, "_cached_profile", profile)
    return profile


def get_redactor_permissions_obj(user):
    cached = getattr(user, "_cached_redactor_permissions", None)
    if cached is not None:
        return cached

    permission_obj, _ = RedactorPermission.objects.get_or_create(user=user)
    setattr(user, "_cached_redactor_permissions", permission_obj)
    return permission_obj


def _get_group_names(user) -> set[str]:
    cached = getattr(user, "_cached_group_names", None)
    if cached is not None:
        return cached

    prefetched = getattr(user, "_prefetched_objects_cache", {})
    if "groups" in prefetched:
        names = {group.name for group in prefetched["groups"]}
    else:
        names = set(user.groups.values_list("name", flat=True))

    setattr(user, "_cached_group_names", names)
    return names


def _has_group(user, group_name: str) -> bool:
    return group_name in _get_group_names(user)


def is_email_verified(user) -> bool:
    if not user or not user.is_authenticated:
        return False
    return EmailAddress.objects.filter(user=user, verified=True).exists()


def is_admin_user(user) -> bool:
    if not user or not user.is_authenticated:
        return False
    return user.is_superuser or _has_group(user, GROUP_ADMINS)


def is_redactor_user(user) -> bool:
    if not user or not user.is_authenticated:
        return False
    if is_admin_user(user):
        return True
    if not _has_group(user, GROUP_REDACTORS):
        return False
    permissions_obj = get_redactor_permissions_obj(user)
    return permissions_obj.is_active


def can_review_writer_applications(user) -> bool:
    if is_admin_user(user):
        return True
    if not is_redactor_user(user):
        return False
    return get_redactor_permissions_obj(user).can_review_writer_applications


def can_review_content(user) -> bool:
    if is_admin_user(user):
        return True
    if not is_redactor_user(user):
        return False
    return get_redactor_permissions_obj(user).can_review_content


def can_manage_content(user) -> bool:
    if is_admin_user(user):
        return True
    if not is_redactor_user(user):
        return False
    return get_redactor_permissions_obj(user).can_manage_content


def can_manage_redactors(user) -> bool:
    if is_admin_user(user):
        return True
    if not is_redactor_user(user):
        return False
    return get_redactor_permissions_obj(user).can_manage_redactors


def is_writer_approved(user) -> bool:
    if not user or not user.is_authenticated:
        return False
    profile = get_profile(user)
    return profile.is_writer_approved


def get_effective_role(user) -> str:
    if not user or not user.is_authenticated:
        return "anonymous"

    profile = get_profile(user)
    if profile.is_root:
        return "root"
    if is_admin_user(user):
        return "admin"
    if is_redactor_user(user):
        return "redactor"
    if profile.is_writer_approved:
        return "writer"
    if profile.role_registered == "writer":
        return "pending_writer"
    return "reader"


def get_permission_payload(user) -> dict[str, bool]:
    permissions_obj = None
    if user and user.is_authenticated and _has_group(user, GROUP_REDACTORS):
        permissions_obj = get_redactor_permissions_obj(user)

    return {
        "can_review_writer_applications": can_review_writer_applications(user),
        "can_review_content": can_review_content(user),
        "can_manage_content": can_manage_content(user),
        "can_manage_redactors": can_manage_redactors(user),
        "redactor_is_active": bool(permissions_obj.is_active) if permissions_obj else False,
    }


def get_client_ip(request) -> str:
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "")


def create_audit_log(
    *,
    actor,
    action: str,
    target_type: str,
    target_id: Any = "",
    description: str,
    metadata: dict[str, Any] | None = None,
    request=None,
):
    return AuditLog.objects.create(
        actor=actor,
        action=action,
        target_type=target_type,
        target_id=str(target_id or ""),
        description=description,
        metadata=metadata or {},
        ip_address=get_client_ip(request) if request else None,
    )


def create_notification(*, user, category: str, title: str, message: str, metadata=None):
    return Notification.objects.create(
        user=user,
        category=category,
        title=title,
        message=message,
        metadata=metadata or {},
    )
