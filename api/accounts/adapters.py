from allauth.account.adapter import DefaultAccountAdapter
from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from django.conf import settings

from .emailing import send_email_message


class ReadusAccountAdapter(DefaultAccountAdapter):
    def get_email_confirmation_url(self, request, emailconfirmation):
        frontend_base_url = getattr(settings, "FRONTEND_BASE_URL", "").rstrip("/")
        if frontend_base_url:
            return f"{frontend_base_url}/verify-email?key={emailconfirmation.key}"
        return super().get_email_confirmation_url(request, emailconfirmation)

    def send_mail(self, template_prefix, email, context):
        message = self.render_mail(template_prefix, email, context)
        send_email_message(message)


class ReadusSocialAccountAdapter(DefaultSocialAccountAdapter):
    def pre_social_login(self, request, sociallogin):
        super().pre_social_login(request, sociallogin)

        # In email-authentication flows allauth can resolve sociallogin.user
        # without binding sociallogin.account.user yet.
        if getattr(sociallogin, "user", None) and getattr(sociallogin.account, "user_id", None) is None:
            sociallogin.account.user = sociallogin.user
