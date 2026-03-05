from django.contrib.contenttypes.models import ContentType
from django.db.models.signals import post_delete
from django.dispatch import receiver

from content.models import Book, Chapter, Poem, Story

from .models import ContentComment, ContentReaction, ContentViewEvent, ReadingProgress


def _cleanup_target_rows(sender, instance):
    content_type = ContentType.objects.get_for_model(sender)
    filters = {"content_type": content_type, "object_id": instance.id}

    ContentReaction.objects.filter(**filters).delete()
    ContentComment.objects.filter(**filters).delete()
    ReadingProgress.objects.filter(**filters).delete()
    ContentViewEvent.objects.filter(**filters).delete()


@receiver(post_delete, sender=Book)
@receiver(post_delete, sender=Story)
@receiver(post_delete, sender=Poem)
@receiver(post_delete, sender=Chapter)
def cleanup_engagement_after_content_delete(sender, instance, **_kwargs):
    _cleanup_target_rows(sender, instance)
