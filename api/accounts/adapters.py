from allauth.account.adapter import DefaultAccountAdapter
from django.conf import settings


class ReadusAccountAdapter(DefaultAccountAdapter):
    def get_email_confirmation_url(self, request, emailconfirmation):
        frontend_base_url = getattr(settings, "FRONTEND_BASE_URL", "").rstrip("/")
        if frontend_base_url:
            return f"{frontend_base_url}/verify-email?key={emailconfirmation.key}"
        return super().get_email_confirmation_url(request, emailconfirmation)
