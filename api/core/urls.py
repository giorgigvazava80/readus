"""
URL configuration for core project.
"""

from dj_rest_auth.views import PasswordResetConfirmView, PasswordResetView
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from drf_yasg import openapi
from drf_yasg.views import get_schema_view
from rest_framework import permissions

from accounts.auth_views import FacebookLoginView, GoogleLoginView, VerifyEmailAndLoginView


def healthcheck(_request):
    return JsonResponse({"status": "ok"})


schema_view = get_schema_view(
    openapi.Info(
        title="API Docs.",
        default_version="v1",
        description="Literature platform API",
    ),
    public=True,
    permission_classes=(permissions.AllowAny,),
)

urlpatterns = [
    path("health/", healthcheck, name="healthcheck"),
    path("admin/", admin.site.urls),
    path("auth/", include("dj_rest_auth.urls")),
    path("auth/social/google/", GoogleLoginView.as_view(), name="google_login"),
    path("auth/social/facebook/", FacebookLoginView.as_view(), name="facebook_login"),
    path(
        "auth/registration/verify-email/",
        VerifyEmailAndLoginView.as_view(),
        name="rest_verify_email",
    ),
    path("auth/registration/", include("dj_rest_auth.registration.urls")),
    path("auth/password/reset/", PasswordResetView.as_view(), name="password_reset"),
    path(
        "auth/password/reset/confirm/<str:uidb64>/<str:token>/",
        PasswordResetConfirmView.as_view(),
        name="password_reset_confirm",
    ),
    path("swagger/", schema_view.with_ui("swagger", cache_timeout=0), name="schema-swagger-ui"),
    path("redoc/", schema_view.with_ui("redoc", cache_timeout=0), name="schema-redoc"),
    path("api/accounts/", include("accounts.urls")),
    path("api/admin/", include("accounts.admin_urls")),
    path("api/notifications/", include("accounts.notification_urls")),
    path("api/content/", include("content.urls")),
]

if settings.DEBUG or getattr(settings, "SERVE_MEDIA", False):
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
