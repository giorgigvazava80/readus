import os

import bleach
from dj_rest_auth.registration.serializers import RegisterSerializer
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from rest_framework import serializers

from .constants import (
    GROUP_READERS,
    GROUP_REDACTORS,
    GROUP_WRITERS,
    REGISTERED_ROLE_WRITER,
)
from .models import (
    AuditLog,
    Notification,
    RedactorPermission,
    UserProfile,
    WriterApplication,
    WriterApplicationStatus,
)
from .utils import (
    create_notification,
    ensure_default_groups,
    get_effective_role,
    get_permission_payload,
    get_profile,
    is_admin_user,
    is_email_verified,
    is_redactor_user,
)


User = get_user_model()


class CustomRegisterSerializer(RegisterSerializer):
    role = serializers.ChoiceField(choices=[("writer", "Writer"), ("reader", "Reader")])
    first_name = serializers.CharField(required=True)
    last_name = serializers.CharField(required=True)

    def get_cleaned_data(self):
        cleaned_data = super().get_cleaned_data()
        cleaned_data["first_name"] = self.validated_data.get("first_name", "")
        cleaned_data["last_name"] = self.validated_data.get("last_name", "")
        cleaned_data["role"] = self.validated_data.get("role", "reader")
        return cleaned_data

    def save(self, request):
        user = super().save(request)

        ensure_default_groups()
        profile = get_profile(user)

        user.first_name = self.validated_data.get("first_name", "").strip()
        user.last_name = self.validated_data.get("last_name", "").strip()
        user.save(update_fields=["first_name", "last_name"])

        profile.role_registered = self.validated_data.get("role", "reader")
        profile.is_writer_approved = False
        profile.save(update_fields=["role_registered", "is_writer_approved", "updated_at"])

        reader_group, _ = Group.objects.get_or_create(name=GROUP_READERS)
        user.groups.add(reader_group)
        user.groups.remove(*Group.objects.filter(name__in=[GROUP_WRITERS, GROUP_REDACTORS]))

        if getattr(settings, "ACCOUNT_EMAIL_VERIFICATION", "mandatory") == "none":
            create_notification(
                user=user,
                category=Notification.Category.SYSTEM,
                title="Welcome to Readus",
                message="Your account is active. You can start using the platform now.",
            )
        else:
            create_notification(
                user=user,
                category=Notification.Category.VERIFICATION,
                title="Verify your email",
                message="Check your inbox and verify your email to activate your account.",
            )

        return user


class MeSerializer(serializers.ModelSerializer):
    role_registered = serializers.SerializerMethodField()
    is_email_verified = serializers.SerializerMethodField()
    is_writer_approved = serializers.SerializerMethodField()
    is_redactor = serializers.SerializerMethodField()
    is_admin = serializers.SerializerMethodField()
    forced_password_change = serializers.SerializerMethodField()
    permissions = serializers.SerializerMethodField()
    effective_role = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "role_registered",
            "is_email_verified",
            "is_writer_approved",
            "is_redactor",
            "is_admin",
            "forced_password_change",
            "permissions",
            "effective_role",
        ]

    def get_role_registered(self, obj):
        return get_profile(obj).role_registered

    def get_is_email_verified(self, obj):
        return is_email_verified(obj)

    def get_is_writer_approved(self, obj):
        return get_profile(obj).is_writer_approved

    def get_is_redactor(self, obj):
        return is_redactor_user(obj)

    def get_is_admin(self, obj):
        return is_admin_user(obj)

    def get_forced_password_change(self, obj):
        return get_profile(obj).forced_password_change

    def get_permissions(self, obj):
        return get_permission_payload(obj)

    def get_effective_role(self, obj):
        return get_effective_role(obj)


class WriterApplicationSerializer(serializers.ModelSerializer):
    sample_text = serializers.CharField(required=False, allow_blank=True)
    sample_file = serializers.FileField(required=False, allow_null=True)

    class Meta:
        model = WriterApplication
        fields = [
            "id",
            "sample_text",
            "sample_file",
            "status",
            "review_comment",
            "created_at",
            "updated_at",
            "reviewed_at",
        ]
        read_only_fields = [
            "status",
            "review_comment",
            "created_at",
            "updated_at",
            "reviewed_at",
        ]

    def validate_sample_text(self, value):
        cleaned = bleach.clean(value or "", tags=[], attributes={}, strip=True)
        return cleaned.strip()

    def validate_sample_file(self, value):
        if not value:
            return value

        ext = os.path.splitext(value.name)[1].lower()
        valid_extensions = [".pdf", ".doc", ".docx", ".txt"]
        if ext not in valid_extensions:
            raise serializers.ValidationError("Unsupported file type. Allowed: PDF, DOC, DOCX, TXT.")

        max_size = 8 * 1024 * 1024
        if value.size > max_size:
            raise serializers.ValidationError("File is too large. Maximum file size is 8MB.")

        return value

    def validate(self, attrs):
        text = (attrs.get("sample_text") or "").strip()
        file_obj = attrs.get("sample_file")

        if not text and not file_obj:
            raise serializers.ValidationError("Provide sample_text and/or sample_file.")

        request = self.context.get("request")
        user = request.user if request else None
        if user and user.is_authenticated:
            profile = get_profile(user)
            if profile.is_writer_approved:
                raise serializers.ValidationError("You are already an approved writer.")

            has_pending = WriterApplication.objects.filter(
                user=user,
                status=WriterApplicationStatus.PENDING,
            ).exists()
            if has_pending:
                raise serializers.ValidationError("You already have a pending writer application.")

        return attrs

    def to_representation(self, instance):
        data = super().to_representation(instance)

        request = self.context.get("request")
        user = request.user if request else None

        if user and user.is_authenticated:
            can_view_comment = (
                instance.user_id == user.id
                or is_admin_user(user)
                or is_redactor_user(user)
            )
            if not can_view_comment:
                data.pop("review_comment", None)
        else:
            data.pop("review_comment", None)

        return data

    def create(self, validated_data):
        request = self.context.get("request")
        user = request.user if request else None

        if not user:
            raise serializers.ValidationError("Authenticated user is required.")

        profile = get_profile(user)
        profile.role_registered = REGISTERED_ROLE_WRITER
        profile.save(update_fields=["role_registered", "updated_at"])

        return WriterApplication.objects.create(user=user, **validated_data)


class WriterApplicationReviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = WriterApplication
        fields = ["status", "review_comment"]

    def validate(self, attrs):
        status = attrs.get("status")
        review_comment = (attrs.get("review_comment") or "").strip()

        if status == WriterApplicationStatus.REJECTED and not review_comment:
            raise serializers.ValidationError(
                {"review_comment": "Review comment is required when rejecting an application."}
            )

        return attrs

    def update(self, instance, validated_data):
        request = self.context.get("request")
        reviewer = request.user if request else None

        new_status = validated_data.get("status", instance.status)
        review_comment = bleach.clean(
            validated_data.get("review_comment", instance.review_comment),
            tags=[],
            attributes={},
            strip=True,
        ).strip()

        instance.status = new_status
        instance.review_comment = review_comment
        instance.reviewed_by = reviewer
        instance.reviewed_at = self.context["now"]
        instance.save(update_fields=["status", "review_comment", "reviewed_by", "reviewed_at", "updated_at"])

        profile = get_profile(instance.user)
        writer_group, _ = Group.objects.get_or_create(name=GROUP_WRITERS)
        reader_group, _ = Group.objects.get_or_create(name=GROUP_READERS)

        if new_status == WriterApplicationStatus.APPROVED:
            profile.role_registered = REGISTERED_ROLE_WRITER
            profile.is_writer_approved = True
            profile.save(update_fields=["role_registered", "is_writer_approved", "updated_at"])
            instance.user.groups.add(writer_group)
            instance.user.groups.remove(reader_group)
            create_notification(
                user=instance.user,
                category=Notification.Category.WRITER_APPLICATION,
                title="Writer application approved",
                message="Your writer application has been approved. You can now access the writer dashboard.",
                metadata={"application_id": instance.id, "status": new_status},
            )
        elif new_status == WriterApplicationStatus.REJECTED:
            profile.is_writer_approved = False
            profile.save(update_fields=["is_writer_approved", "updated_at"])
            instance.user.groups.add(reader_group)
            create_notification(
                user=instance.user,
                category=Notification.Category.WRITER_APPLICATION,
                title="Writer application rejected",
                message="Your writer application was rejected. See reviewer comment in your dashboard.",
                metadata={"application_id": instance.id, "status": new_status},
            )

        return instance


class RedactorPermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = RedactorPermission
        fields = [
            "can_review_writer_applications",
            "can_review_content",
            "can_manage_content",
            "can_manage_redactors",
            "is_active",
        ]


class RedactorUserSerializer(serializers.ModelSerializer):
    permissions = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "is_active",
            "permissions",
        ]

    def get_permissions(self, obj):
        permission_obj = getattr(obj, "redactor_permissions", None)
        if permission_obj is None:
            permission_obj = RedactorPermission.objects.filter(user=obj).first()

        if not permission_obj:
            return {
                "can_review_writer_applications": False,
                "can_review_content": False,
                "can_manage_content": False,
                "can_manage_redactors": False,
                "is_active": False,
            }
        return RedactorPermissionSerializer(permission_obj).data


class RedactorManageSerializer(serializers.Serializer):
    user_id = serializers.IntegerField(required=False)
    username = serializers.CharField(required=False)
    email = serializers.EmailField(required=False)
    first_name = serializers.CharField(required=False, allow_blank=True)
    last_name = serializers.CharField(required=False, allow_blank=True)
    password = serializers.CharField(required=False, write_only=True)
    can_review_writer_applications = serializers.BooleanField(required=False, default=True)
    can_review_content = serializers.BooleanField(required=False, default=True)
    can_manage_content = serializers.BooleanField(required=False, default=False)
    can_manage_redactors = serializers.BooleanField(required=False, default=False)
    is_active = serializers.BooleanField(required=False, default=True)

    def validate(self, attrs):
        if self.partial:
            return attrs

        user_id = attrs.get("user_id")
        email = attrs.get("email")

        if not user_id and not email:
            raise serializers.ValidationError("Provide either user_id or email.")

        return attrs


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = [
            "id",
            "category",
            "title",
            "message",
            "is_read",
            "metadata",
            "created_at",
        ]
        read_only_fields = ["id", "category", "title", "message", "metadata", "created_at"]


class AuditLogSerializer(serializers.ModelSerializer):
    actor_email = serializers.EmailField(source="actor.email", read_only=True)

    class Meta:
        model = AuditLog
        fields = [
            "id",
            "actor_email",
            "action",
            "target_type",
            "target_id",
            "description",
            "metadata",
            "ip_address",
            "created_at",
        ]

