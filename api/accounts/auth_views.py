from allauth.socialaccount.providers.facebook.views import FacebookOAuth2Adapter
from allauth.socialaccount.providers.google.views import GoogleOAuth2Adapter
from allauth.socialaccount.providers.oauth2.client import OAuth2Client
from django.conf import settings
from django.utils.translation import gettext_lazy as _
from dj_rest_auth.registration.views import SocialLoginView, VerifyEmailView
from rest_framework import status
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken


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
    client_class = OAuth2Client
    callback_url = settings.SOCIAL_AUTH_GOOGLE_CALLBACK_URL or None


class FacebookLoginView(SocialLoginView):
    adapter_class = FacebookOAuth2Adapter
    client_class = OAuth2Client
    callback_url = settings.SOCIAL_AUTH_FACEBOOK_CALLBACK_URL or None
