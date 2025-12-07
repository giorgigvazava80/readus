from django.db import models
from django.conf import settings

class BaseWork(models.Model):
    STATUS_DRAFT = "draft"
    STATUS_PENDING = "pending_review"
    STATUS_PUBLISHED = "published"
    STATUS_REJECTED = "rejected"

    STATUS_CHOICES = [
        (STATUS_DRAFT, "draft"),
        (STATUS_PENDING, "pending"),
        (STATUS_PUBLISHED, "published"),
        (STATUS_REJECTED, "rejected"),
    ]

    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="works",
    )

    title = models.CharField(max_length=255)
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default=STATUS_DRAFT
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


    class Meta:
        abstract = True


class Story(BaseWork):
    body = models.TextField()

class Poem(BaseWork):
    body = models.TextField()

class Book(BaseWork):
    foreword = models.TextField(blank=True)
    final_word = models.TextField(blank=True)

class Chapter(models.Model):
    book = models.ForeignKey(
        Book,
        on_delete=models.CASCADE,
        related_name='chapters',
    )

    order = models.PositiveIntegerField()
    title = models.CharField(max_length=255)
    body = models.TextField()

    class Meta:
        ordering = ["order"]
        unique_together = ('book', 'order')

    def __str__(self):
        return f"{self.book.title} - Chapter {self.order}: {self.title}"