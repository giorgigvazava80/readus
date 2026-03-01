from django.contrib import admin

from .models import AuditLog, Notification, RedactorPermission, UserProfile, WriterApplication


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "role_registered",
        "is_writer_approved",
        "forced_password_change",
        "is_root",
    )
    list_filter = ("role_registered", "is_writer_approved", "forced_password_change", "is_root")
    search_fields = ("user__username", "user__email")


@admin.register(RedactorPermission)
class RedactorPermissionAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "can_review_writer_applications",
        "can_review_content",
        "can_manage_content",
        "can_manage_redactors",
        "is_active",
    )
    list_filter = (
        "can_review_writer_applications",
        "can_review_content",
        "can_manage_content",
        "can_manage_redactors",
        "is_active",
    )
    search_fields = ("user__username", "user__email")


@admin.register(WriterApplication)
class WriterApplicationAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "status", "created_at", "reviewed_at", "reviewed_by")
    list_filter = ("status", "created_at", "reviewed_at")
    search_fields = ("user__username", "user__email", "review_comment")
    readonly_fields = ("created_at", "updated_at", "reviewed_at")


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "category", "title", "is_read", "created_at")
    list_filter = ("category", "is_read", "created_at")
    search_fields = ("user__username", "user__email", "title", "message")
    readonly_fields = ("created_at",)


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("id", "action", "actor", "target_type", "target_id", "created_at")
    list_filter = ("action", "target_type", "created_at")
    search_fields = ("actor__username", "actor__email", "description", "target_id")
    readonly_fields = ("created_at",)
