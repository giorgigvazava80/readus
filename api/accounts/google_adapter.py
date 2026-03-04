import logging

from allauth.socialaccount.providers.google.views import GoogleOAuth2Adapter
from allauth.socialaccount.providers.oauth2.client import OAuth2Error


logger = logging.getLogger(__name__)


class ReadusGoogleOAuth2Adapter(GoogleOAuth2Adapter):
    """
    Prefer standard id_token decoding, but fall back to Google userinfo on
    temporary JWT clock-skew issues (e.g. iat slightly in the future).
    """

    def complete_login(self, request, app, token, response, **kwargs):
        id_token = response.get("id_token")
        if id_token:
            try:
                data = self._decode_id_token(app, id_token)
                if self.fetch_userinfo and "picture" not in data:
                    info = self._fetch_user_info(token.token)
                    picture = info.get("picture")
                    if picture:
                        data["picture"] = picture
                return self.get_provider().sociallogin_from_response(request, data)
            except OAuth2Error:
                logger.warning(
                    "Google id_token decode failed; falling back to userinfo endpoint.",
                    exc_info=True,
                )

        if token.token:
            data = self._fetch_user_info(token.token)
            return self.get_provider().sociallogin_from_response(request, data)

        raise OAuth2Error("Missing Google access token.")
