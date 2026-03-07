from django.db import models
from django.conf import settings
from django.utils import timezone
from django.utils.text import slugify

from .storage import build_content_upload_storage


# shared enum
class StatusChoices(models.TextChoices):
    DRAFT = 'draft', 'Draft'
    APPROVED = 'approved', 'Approved'
    REJECTED = 'rejected', 'Rejected'


class SourceType(models.TextChoices):
    MANUAL = 'manual', 'Manual'
    UPLOAD = 'upload', 'Upload'


class ContentLanguageChoices(models.TextChoices):
    ENGLISH = "en", "English"
    GEORGIAN = "ka", "Georgian"


class UploadProcessingStatus(models.TextChoices):
    IDLE = 'idle', 'Idle'
    PROCESSING = 'processing', 'Processing'
    DONE = 'done', 'Done'
    FAILED = 'failed', 'Failed'


class ChapterNumberingStyle(models.TextChoices):
    ARABIC = 'arabic', '1, 2, 3'
    ROMAN = 'roman', 'I, II, III'
    SEPARATOR = 'separator', '***'

#----------
#int to str. roman

def int_to_roman(num: int) -> str:
    # simple converter for 1..3999 (enough for you)
    val = [
        1000, 900, 500, 400,
        100, 90, 50, 40,
        10, 9, 5, 4,
        1,
    ]
    syms = [
        "M", "CM", "D", "CD",
        "C", "XC", "L", "XL",
        "X", "IX", "V", "IV",
        "I",
    ]
    roman = ""
    i = 0
    while num > 0:
        for _ in range(num // val[i]):
            roman += syms[i]
            num -= val[i]
        i += 1
    return roman

#-----------


def build_default_chapter_title(order: int, language: str = ContentLanguageChoices.ENGLISH) -> str:
    normalized = (language or ContentLanguageChoices.ENGLISH).lower()
    prefix = "თავი" if normalized == ContentLanguageChoices.GEORGIAN else "Chapter"
    return f"{prefix} {max(1, int(order or 1))}"



# ---------- Status / audit mixin ----------

class StatusTrackedModel(models.Model):
    status = models.CharField(
        max_length=10,
        choices=StatusChoices.choices,
        default=StatusChoices.DRAFT,
    )
    is_submitted_for_review = models.BooleanField(default=False, db_index=True)
    rejection_reason = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    status_changed_at = models.DateTimeField(blank=True, null=True)
    status_changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="%(class)s_status_changes",
    )

    class Meta:
        abstract = True

    def set_status(self, new_status: str, user=None, reason: str = ""):
        self.status = new_status
        self.is_submitted_for_review = False
        self.rejection_reason = reason if new_status == StatusChoices.REJECTED else ""
        self.status_changed_at = timezone.now()
        self.status_changed_by = user
        self.save(
            update_fields=[
                "status",
                "is_submitted_for_review",
                "rejection_reason",
                "status_changed_at",
                "status_changed_by",
                "updated_at",
            ]
        )



# base for all contents

class BaseContent(StatusTrackedModel):
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='%(class)s_items'
    )

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    is_anonymous = models.BooleanField(default=False)

    # manual or upload file
    source_type = models.CharField(
        max_length=10,
        choices=SourceType.choices,
        default=SourceType.MANUAL,
    )
    content_language = models.CharField(
        max_length=5,
        choices=ContentLanguageChoices.choices,
        default=ContentLanguageChoices.ENGLISH,
    )
    upload_file = models.FileField(
        storage=build_content_upload_storage,
        upload_to='uploads/content/%Y/%m/%d/',
        blank=True,
        null=True,
    )
    cover_image = models.ImageField(
        upload_to='uploads/covers/%Y/%m/%d/',
        blank=True,
        null=True,
    )
    is_hidden = models.BooleanField(default=False)
    is_deleted = models.BooleanField(default=False, db_index=True)
    deleted_at = models.DateTimeField(blank=True, null=True)
    extracted_text = models.TextField(blank=True)
    public_slug = models.SlugField(max_length=255, unique=True, blank=True, db_index=False)


    class Meta:
        abstract = True

    def _generate_public_slug(self) -> str:
        base = slugify(self.title or "")[:220] or "work"
        if base.isdigit():
            base = f"work-{base}"
        candidate = base
        index = 2
        model_cls = type(self)

        while model_cls.objects.filter(public_slug=candidate).exclude(pk=self.pk).exists():
            suffix = f"-{index}"
            candidate = f"{base[: max(1, 255 - len(suffix))]}{suffix}"
            index += 1

        return candidate

    def save(self, *args, **kwargs):
        if not self.public_slug:
            self.public_slug = self._generate_public_slug()
        super().save(*args, **kwargs)



#simple contents

#story table

class Story(BaseContent):
    body = models.TextField(blank=True)

    def __str__(self):
        return f"Story: {self.title}"


class Poem(BaseContent):
    body = models.TextField(blank=True)

    def __str__(self):
        return f"Poem: {self.title}"



# books and Chapters


class Book(BaseContent):
    foreword = models.TextField(blank=True)
    afterword = models.TextField(blank=True)
    upload_processing_status = models.CharField(
        max_length=20,
        choices=UploadProcessingStatus.choices,
        default=UploadProcessingStatus.IDLE,
    )
    upload_processing_error = models.TextField(blank=True)
    upload_processed_at = models.DateTimeField(blank=True, null=True)

    numbering_style = models.CharField(
        max_length=20,
        choices=ChapterNumberingStyle.choices,
        default=ChapterNumberingStyle.SEPARATOR,
    )

    def __str__(self):
        return f"Book: {self.title}"



class Chapter(StatusTrackedModel):
    book = models.ForeignKey(
        Book,
        on_delete=models.CASCADE,
        related_name='chapters',
    )

    #opt, can be empty when autonumbering
    title = models.CharField(max_length=255, blank=True)
    order = models.PositiveIntegerField()

    body = models.TextField(blank=True)

    class Meta:
        ordering = ['order']
        unique_together = ('book', 'order')


    @property
    def auto_label(self) -> str:
        style = self.book.numbering_style
        if style == ChapterNumberingStyle.ARABIC:
            return str(self.order)
        elif style == ChapterNumberingStyle.ROMAN:
            return  int_to_roman(self.order)
        elif style == ChapterNumberingStyle.SEPARATOR:
            return '***'


    def __str__(self):
        base = self.title or build_default_chapter_title(self.order, self.book.content_language)
        return f"{self.book.title}"


