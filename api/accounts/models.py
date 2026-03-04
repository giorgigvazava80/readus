from django.conf import settings
from django.db import models

from .constants import REGISTERED_ROLE_READER, REGISTERED_ROLE_WRITER


class RegisteredRole(models.TextChoices):
    READER = REGISTERED_ROLE_READER, "Reader"
    WRITER = REGISTERED_ROLE_WRITER, "Writer"


class WriterApplicationStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    APPROVED = "approved", "Approved"
    REJECTED = "rejected", "Rejected"


class UserProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="profile",
    )
    role_registered = models.CharField(
        max_length=20,
        choices=RegisteredRole.choices,
        default=RegisteredRole.READER,
    )
    is_writer_approved = models.BooleanField(default=False)
    birth_date = models.DateField(blank=True, null=True)
    profile_photo = models.ImageField(upload_to="profiles/", blank=True, null=True)
    forced_password_change = models.BooleanField(default=False)
    is_root = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Profile<{self.user.username}>"


class RedactorPermission(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="redactor_permissions",
    )
    can_review_writer_applications = models.BooleanField(default=True)
    can_review_content = models.BooleanField(default=True)
    can_manage_content = models.BooleanField(default=False)
    can_manage_redactors = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"RedactorPermission<{self.user.username}>"


class WriterApplication(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="writer_applications",
    )
    sample_text = models.TextField(blank=True)
    sample_file = models.FileField(upload_to="writer_samples/", blank=True, null=True)
    status = models.CharField(
        max_length=20,
        choices=WriterApplicationStatus.choices,
        default=WriterApplicationStatus.PENDING,
    )
    review_comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    reviewed_at = models.DateTimeField(blank=True, null=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="writer_reviews",
    )

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user.username} - {self.status}"


class Notification(models.Model):
    class Category(models.TextChoices):
        VERIFICATION = "verification", "Verification"
        WRITER_APPLICATION = "writer_application", "Writer application"
        CONTENT_REVIEW = "content_review", "Content review"
        SYSTEM = "system", "System"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    category = models.CharField(max_length=40, choices=Category.choices)
    title = models.CharField(max_length=255)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Notification<{self.user.username}:{self.category}>"


class AuditLog(models.Model):
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs",
    )
    action = models.CharField(max_length=80)
    target_type = models.CharField(max_length=80)
    target_id = models.CharField(max_length=80, blank=True)
    description = models.CharField(max_length=255)
    metadata = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"AuditLog<{self.action}>"
