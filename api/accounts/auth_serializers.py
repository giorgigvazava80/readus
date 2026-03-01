from dj_rest_auth.serializers import PasswordChangeSerializer

from .utils import get_profile


class ProfileAwarePasswordChangeSerializer(PasswordChangeSerializer):
    def save(self):
        super().save()
        profile = get_profile(self.user)
        if profile.forced_password_change:
            profile.forced_password_change = False
            profile.save(update_fields=["forced_password_change", "updated_at"])
