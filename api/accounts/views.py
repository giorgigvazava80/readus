from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.db.models import Q
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from .constants import GROUP_REDACTORS
from .emailing import send_mail_safe
from .models import AuditLog, Notification, RedactorPermission, WriterApplication, WriterApplicationStatus
from .permissions import (
    CanManageRedactors,
    CanReviewWriterApplications,
    IsAdminOrRedactor,
    PasswordChangeNotForced,
    VerifiedEmailRequired,
)
from .serializers import (
    AuditLogSerializer,
    MeSerializer,
    MeUpdateSerializer,
    NotificationSerializer,
    RedactorManageSerializer,
    RedactorUserSerializer,
    WriterApplicationReviewSerializer,
    WriterApplicationSerializer,
)
from .utils import (
    can_review_writer_applications,
    create_audit_log,
    ensure_default_groups,
    get_profile,
)


User = get_user_model()


def _send_outcome_email(user, subject, body):
    if not user.email:
        return
    send_mail_safe(subject, body, None, [user.email], fail_silently=True)


class CurrentUserStateView(generics.RetrieveUpdateAPIView):
    serializer_class = MeSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_object(self):
        return self.request.user

    def get_serializer_class(self):
        if self.request.method in {"PATCH", "PUT"}:
            return MeUpdateSerializer
        return MeSerializer

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response(MeSerializer(instance, context=self.get_serializer_context()).data)


class WriterApplicationCreateView(generics.CreateAPIView):
    serializer_class = WriterApplicationSerializer
    permission_classes = [permissions.IsAuthenticated, VerifiedEmailRequired, PasswordChangeNotForced]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        return WriterApplication.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        application = serializer.save()
        create_audit_log(
            actor=self.request.user,
            action="writer_application_submitted",
            target_type="writer_application",
            target_id=application.id,
            description="User submitted writer application",
            metadata={"status": application.status},
            request=self.request,
        )


class MyWriterApplicationListView(generics.ListAPIView):
    serializer_class = WriterApplicationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return WriterApplication.objects.filter(user=self.request.user).select_related("reviewed_by").order_by("-created_at")


class PendingWriterApplicationListView(generics.ListAPIView):
    serializer_class = WriterApplicationSerializer
    permission_classes = [permissions.IsAuthenticated, PasswordChangeNotForced, CanReviewWriterApplications]

    def get_queryset(self):
        queryset = WriterApplication.objects.filter(status=WriterApplicationStatus.PENDING).select_related("user")

        q = self.request.query_params.get("q", "").strip()
        if q:
            queryset = queryset.filter(
                Q(user__username__icontains=q)
                | Q(user__email__icontains=q)
                | Q(sample_text__icontains=q)
            )

        return queryset


class ReviewWriterApplicationView(generics.UpdateAPIView):
    queryset = WriterApplication.objects.select_related("user", "reviewed_by")
    serializer_class = WriterApplicationReviewSerializer
    permission_classes = [permissions.IsAuthenticated, PasswordChangeNotForced, CanReviewWriterApplications]

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["now"] = timezone.now()
        return context

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        previous_status = instance.status

        response = super().update(request, *args, **kwargs)
        instance.refresh_from_db()

        create_audit_log(
            actor=request.user,
            action="writer_application_reviewed",
            target_type="writer_application",
            target_id=instance.id,
            description="Writer application reviewed",
            metadata={
                "old_status": previous_status,
                "new_status": instance.status,
            },
            request=request,
        )

        if instance.status == WriterApplicationStatus.APPROVED:
            _send_outcome_email(
                instance.user,
                "Writer Application Approved",
                "Your writer application has been approved. You can now publish and manage works.",
            )
        elif instance.status == WriterApplicationStatus.REJECTED:
            _send_outcome_email(
                instance.user,
                "Writer Application Rejected",
                "Your writer application was rejected. Please check reviewer comments in your dashboard.",
            )

        return response


class RedactorListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated, PasswordChangeNotForced, CanManageRedactors]

    def get(self, request):
        redactors = (
            User.objects.filter(groups__name=GROUP_REDACTORS)
            .select_related("redactor_permissions")
            .prefetch_related("groups")
            .distinct()
            .order_by("id")
        )
        return Response(RedactorUserSerializer(redactors, many=True).data)

    def post(self, request):
        serializer = RedactorManageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        payload = serializer.validated_data
        user_id = payload.get("user_id")
        email = payload.get("email")

        user = None
        if user_id:
            user = User.objects.filter(id=user_id).first()
            if not user:
                return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)
        elif email:
            user = User.objects.filter(email=email).first()

        if not user:
            username = payload.get("username")
            password = payload.get("password")
            if not username or not password or not email:
                return Response(
                    {"detail": "username, email and password are required when creating a new user."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            user = User.objects.create_user(
                username=username,
                email=email,
                password=password,
                first_name=payload.get("first_name", ""),
                last_name=payload.get("last_name", ""),
                is_active=True,
            )
            get_profile(user)

        ensure_default_groups()
        redactor_group, _ = Group.objects.get_or_create(name=GROUP_REDACTORS)
        user.groups.add(redactor_group)

        permissions_obj, _ = RedactorPermission.objects.get_or_create(user=user)
        for field in [
            "can_review_writer_applications",
            "can_review_content",
            "can_manage_content",
            "can_manage_redactors",
            "is_active",
        ]:
            if field in payload:
                setattr(permissions_obj, field, payload[field])
        permissions_obj.save()

        create_audit_log(
            actor=request.user,
            action="redactor_upserted",
            target_type="user",
            target_id=user.id,
            description="Redactor created or updated",
            metadata={
                "permissions": RedactorUserSerializer(user).data.get("permissions", {}),
            },
            request=request,
        )

        return Response(RedactorUserSerializer(user).data, status=status.HTTP_201_CREATED)


class RedactorDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated, PasswordChangeNotForced, CanManageRedactors]

    def patch(self, request, pk: int):
        user = User.objects.filter(id=pk, groups__name=GROUP_REDACTORS).first()
        if not user:
            return Response({"detail": "Redactor not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = RedactorManageSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data

        permissions_obj, _ = RedactorPermission.objects.get_or_create(user=user)

        if "email" in payload:
            user.email = payload["email"]
        if "first_name" in payload:
            user.first_name = payload["first_name"]
        if "last_name" in payload:
            user.last_name = payload["last_name"]
        if "username" in payload:
            user.username = payload["username"]
        user.save()

        for field in [
            "can_review_writer_applications",
            "can_review_content",
            "can_manage_content",
            "can_manage_redactors",
            "is_active",
        ]:
            if field in payload:
                setattr(permissions_obj, field, payload[field])
        permissions_obj.save()

        create_audit_log(
            actor=request.user,
            action="redactor_updated",
            target_type="user",
            target_id=user.id,
            description="Redactor permissions updated",
            metadata={
                "permissions": RedactorUserSerializer(user).data.get("permissions", {}),
            },
            request=request,
        )

        return Response(RedactorUserSerializer(user).data)

    def delete(self, request, pk: int):
        user = User.objects.filter(id=pk, groups__name=GROUP_REDACTORS).first()
        if not user:
            return Response({"detail": "Redactor not found."}, status=status.HTTP_404_NOT_FOUND)

        redactor_group, _ = Group.objects.get_or_create(name=GROUP_REDACTORS)
        user.groups.remove(redactor_group)
        RedactorPermission.objects.filter(user=user).delete()

        create_audit_log(
            actor=request.user,
            action="redactor_removed",
            target_type="user",
            target_id=user.id,
            description="Redactor role removed",
            request=request,
        )

        return Response(status=status.HTTP_204_NO_CONTENT)


class NotificationListView(generics.ListAPIView):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)


class NotificationUpdateView(generics.UpdateAPIView):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)

    def patch(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.is_read = request.data.get("is_read", True)
        instance.save(update_fields=["is_read"])
        return Response(NotificationSerializer(instance).data)


class AuditLogListView(generics.ListAPIView):
    serializer_class = AuditLogSerializer
    permission_classes = [permissions.IsAuthenticated, PasswordChangeNotForced, IsAdminOrRedactor]

    def get_queryset(self):
        queryset = AuditLog.objects.select_related("actor")

        user = self.request.user
        if not can_review_writer_applications(user) and not user.is_superuser:
            # Redactors without review rights only see their own actions.
            queryset = queryset.filter(actor=user)

        q = self.request.query_params.get("q", "").strip()
        actor = self.request.query_params.get("actor", "").strip()
        date_from = self.request.query_params.get("date_from", "").strip()
        date_to = self.request.query_params.get("date_to", "").strip()

        if q:
            queryset = queryset.filter(
                Q(action__icontains=q)
                | Q(description__icontains=q)
                | Q(target_type__icontains=q)
                | Q(target_id__icontains=q)
            )

        if actor:
            queryset = queryset.filter(actor__email__icontains=actor)

        if date_from:
            queryset = queryset.filter(created_at__date__gte=date_from)
        if date_to:
            queryset = queryset.filter(created_at__date__lte=date_to)

        return queryset
