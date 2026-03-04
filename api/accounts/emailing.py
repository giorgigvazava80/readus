import logging
import threading

from django.conf import settings
from django.core.mail import send_mail


logger = logging.getLogger(__name__)


def _send_email_message_worker(message, fail_silently: bool) -> int:
    try:
        return message.send(fail_silently=fail_silently)
    except Exception:
        logger.exception("Failed to send email message.")
        if fail_silently:
            return 0
        raise


def _send_email_message_async_worker(message) -> None:
    _send_email_message_worker(message, fail_silently=True)


def send_email_message(message, fail_silently: bool = False) -> int:
    if getattr(settings, "EMAIL_SEND_ASYNC", False):
        threading.Thread(target=_send_email_message_async_worker, args=(message,), daemon=True).start()
        return 1
    return _send_email_message_worker(message, fail_silently=fail_silently)


def _send_mail_worker(
    subject: str,
    message: str,
    from_email: str | None,
    recipient_list: list[str],
    fail_silently: bool = True,
) -> int:
    try:
        return send_mail(
            subject,
            message,
            from_email,
            recipient_list,
            fail_silently=fail_silently,
        )
    except Exception:
        logger.exception("Failed to send email.")
        if fail_silently:
            return 0
        raise


def send_mail_safe(
    subject: str,
    message: str,
    from_email: str | None,
    recipient_list: list[str],
    fail_silently: bool = True,
) -> int:
    if getattr(settings, "EMAIL_SEND_ASYNC", False):
        threading.Thread(
            target=_send_mail_worker,
            args=(subject, message, from_email, recipient_list, fail_silently),
            daemon=True,
        ).start()
        return 1
    return _send_mail_worker(subject, message, from_email, recipient_list, fail_silently)
