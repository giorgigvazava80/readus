import logging
from urllib.parse import urlsplit

from allauth.socialaccount.providers.facebook.views import FacebookOAuth2Adapter
from allauth.socialaccount.providers.google.views import GoogleOAuth2Adapter
from allauth.socialaccount.models import SocialApp
from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import URLValidator
from django.db import OperationalError, ProgrammingError
from django.utils.translation import gettext_lazy as _
from dj_rest_auth.registration.views import SocialLoginView, VerifyEmailView
from rest_framework import status
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from .oauth_client import CompatOAuth2Client

logger = logging.getLogger(__name__)


def _has_provider_app_in_settings(provider: str) -> bool:
    provider_cfg = getattr(settings, "SOCIALACCOUNT_PROVIDERS", {}).get(provider, {})
    app_cfg = provider_cfg.get("APP", {}) if isinstance(provider_cfg, dict) else {}
    return bool(app_cfg.get("client_id") and app_cfg.get("secret"))


def _has_provider_app_in_db(provider: str) -> bool:
    try:
        return SocialApp.objects.filter(provider=provider).exists()
    except (OperationalError, ProgrammingError):
        # During early boot/migrations we may not have tables yet.
        return False


def _validated_redirect_uri(value: str) -> str:
    redirect_uri = (value or "").strip()
    if not redirect_uri:
        return ""
    validator = URLValidator(schemes=["http", "https"])
    try:
        validator(redirect_uri)
        return redirect_uri
    except ValidationError:
        return ""


def _infer_redirect_uri_from_request(request) -> str:
    # Prefer explicit client value; fallback to Origin/Referer to avoid mismatch
    # when older frontend build does not send redirect_uri in payload.
    explicit = _validated_redirect_uri(str(request.data.get("redirect_uri", "")))
    if explicit:
        return explicit

    origin = str(request.META.get("HTTP_ORIGIN", "")).strip()
    origin_valid = _validated_redirect_uri(origin)
    if origin_valid:
        return f"{origin_valid.rstrip('/')}/login"

    referer = str(request.META.get("HTTP_REFERER", "")).strip()
    if referer:
        parsed = urlsplit(referer)
        if parsed.scheme in {"http", "https"} and parsed.netloc:
            base = f"{parsed.scheme}://{parsed.netloc}"
            path = parsed.path or "/login"
            # Keep admin callback path when login comes from admin frontend.
            if path.startswith("/admin/login"):
                return f"{base}/admin/login"
            return f"{base}/login"
    return ""


def _explicit_redirect_uri_from_request(request) -> str:
    return _validated_redirect_uri(str(request.data.get("redirect_uri", "")))


class VerifyEmailAndLoginView(VerifyEmailView):
    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        self.kwargs["key"] = serializer.validated_data["key"]
        confirmation = self.get_object()
        user = confirmation.email_address.user
        confirmation.confirm(self.request)

        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "detail": _("ok"),
                "access": str(refresh.access_token),
                "refresh": str(refresh),
            },
            status=status.HTTP_200_OK,
        )


class GoogleLoginView(SocialLoginView):
    adapter_class = GoogleOAuth2Adapter
    client_class = CompatOAuth2Client
    callback_url = settings.SOCIAL_AUTH_GOOGLE_CALLBACK_URL or None

    def post(self, request, *args, **kwargs):
        if not (_has_provider_app_in_settings("google") or _has_provider_app_in_db("google")):
            return Response(
                {
                    "detail": (
                        "Google OAuth is not configured on API. Set GOOGLE_OAUTH_CLIENT_ID and "
                        "GOOGLE_OAUTH_CLIENT_SECRET env vars (or configure SocialApp in Django admin)."
                    )
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        explicit_redirect_uri = _explicit_redirect_uri_from_request(request)
        if explicit_redirect_uri:
            self.callback_url = explicit_redirect_uri
        elif not self.callback_url:
            inferred_redirect_uri = _infer_redirect_uri_from_request(request)
            if inferred_redirect_uri:
                self.callback_url = inferred_redirect_uri

        try:
            return super().post(request, *args, **kwargs)
        except Exception as exc:
            logger.exception("Google social login failed")
            return Response(
                {
                    "detail": "Google authentication failed.",
                    "error": str(exc),
                    "error_type": exc.__class__.__name__,
                    "callback_url": self.callback_url or "",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )


class FacebookLoginView(SocialLoginView):
    adapter_class = FacebookOAuth2Adapter
    client_class = CompatOAuth2Client
    callback_url = settings.SOCIAL_AUTH_FACEBOOK_CALLBACK_URL or None

    def post(self, request, *args, **kwargs):
        if not (_has_provider_app_in_settings("facebook") or _has_provider_app_in_db("facebook")):
            return Response(
                {
                    "detail": (
                        "Facebook OAuth is not configured on API. Set FACEBOOK_OAUTH_CLIENT_ID and "
                        "FACEBOOK_OAUTH_CLIENT_SECRET env vars (or configure SocialApp in Django admin)."
                    )
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        explicit_redirect_uri = _explicit_redirect_uri_from_request(request)
        if explicit_redirect_uri:
            self.callback_url = explicit_redirect_uri
        elif not self.callback_url:
            inferred_redirect_uri = _infer_redirect_uri_from_request(request)
            if inferred_redirect_uri:
                self.callback_url = inferred_redirect_uri

        try:
            return super().post(request, *args, **kwargs)
        except Exception as exc:
            logger.exception("Facebook social login failed")
            return Response(
                {
                    "detail": "Facebook authentication failed.",
                    "error": str(exc),
                    "error_type": exc.__class__.__name__,
                    "callback_url": self.callback_url or "",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
