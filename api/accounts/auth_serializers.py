from urllib.parse import urlencode

from allauth.account.utils import user_pk_to_url_str
from django.conf import settings
from dj_rest_auth.forms import default_url_generator
from dj_rest_auth.serializers import PasswordChangeSerializer, PasswordResetSerializer

from .utils import get_profile


def frontend_password_reset_url_generator(request, user, temp_key):
    frontend_base_url = getattr(settings, "FRONTEND_BASE_URL", "").rstrip("/")
    if not frontend_base_url:
        return default_url_generator(request, user, temp_key)

    query = urlencode(
        {
            "uid": user_pk_to_url_str(user),
            "token": temp_key,
        }
    )
    return f"{frontend_base_url}/reset-password?{query}"


class FrontendPasswordResetSerializer(PasswordResetSerializer):
    def get_email_options(self):
        options = super().get_email_options()
        options["url_generator"] = frontend_password_reset_url_generator
        return options


class ProfileAwarePasswordChangeSerializer(PasswordChangeSerializer):
    def save(self):
        super().save()
        profile = get_profile(self.user)
        if profile.forced_password_change:
            profile.forced_password_change = False
            profile.save(update_fields=["forced_password_change", "updated_at"])
