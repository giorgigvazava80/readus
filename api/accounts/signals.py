from django.contrib.auth import get_user_model
from django.db import OperationalError, ProgrammingError
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import UserProfile


User = get_user_model()


@receiver(post_save, sender=User)
def ensure_user_profile(sender, instance, created, **kwargs):
    if not created:
        return

    try:
        UserProfile.objects.get_or_create(user=instance)
    except (ProgrammingError, OperationalError):
        # During initial migrations the profile table can be unavailable.
        return
