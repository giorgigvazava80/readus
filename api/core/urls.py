"""
URL configuration for core project.
"""

from dj_rest_auth.views import PasswordResetConfirmView, PasswordResetView
from django.conf import settings
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path, re_path
from drf_yasg import openapi
from drf_yasg.views import get_schema_view
from rest_framework import permissions

from accounts.auth_views import FacebookLoginView, GoogleLoginView, VerifyEmailAndLoginView
from core.media_views import serve_cached_media
from engagement.contract_views import ShareChapterHtmlView, ShareWorkHtmlView


def healthcheck(_request):
    return JsonResponse({"status": "ok"})


def socialaccount_signup_placeholder(_request):
    return JsonResponse(
        {
            "detail": (
                "Social signup form route is unavailable in API mode. "
                "Complete signup through the frontend flow."
            )
        },
        status=400,
    )


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
    path(
        "auth/social/signup/",
        socialaccount_signup_placeholder,
        name="socialaccount_signup",
    ),
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
    path("api/", include("engagement.follow_urls")),
    path("api/", include("engagement.progress_urls")),
    path("api/", include("engagement.contract_urls")),
    path("api/content/", include("content.urls")),
    path("api/engagement/", include("engagement.urls")),
    path("share/work/<int:work_id>/", ShareWorkHtmlView.as_view(), name="share-work-html-public"),
    path("share/chapter/<int:chapter_id>/", ShareChapterHtmlView.as_view(), name="share-chapter-html-public"),
]

if settings.DEBUG or getattr(settings, "SERVE_MEDIA", False):
    media_prefix = settings.MEDIA_URL.lstrip("/")
    urlpatterns += [
        re_path(
            rf"^{media_prefix}(?P<path>.*)$",
            serve_cached_media,
            {"document_root": settings.MEDIA_ROOT},
        )
    ]
