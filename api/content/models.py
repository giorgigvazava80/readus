from django.db import models
from django.conf import settings
from django.utils import timezone
from django.utils.text import slugify


# shared enum
class StatusChoices(models.TextChoices):
    DRAFT = 'draft', 'Draft'
    APPROVED = 'approved', 'Approved'
    REJECTED = 'rejected', 'Rejected'


class SourceType(models.TextChoices):
    MANUAL = 'manual', 'Manual'
    UPLOAD = 'upload', 'Upload'


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



# ---------- Status / audit mixin ----------

class StatusTrackedModel(models.Model):
    status = models.CharField(
        max_length=10,
        choices=StatusChoices.choices,
        default=StatusChoices.DRAFT,
    )
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
        self.rejection_reason = reason if new_status == StatusChoices.REJECTED else ""
        self.status_changed_at = timezone.now()
        self.status_changed_by = user
        self.save(
            update_fields=[
                "status",
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
    upload_file = models.FileField(
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
    extracted_text = models.TextField(blank=True)
    public_slug = models.SlugField(max_length=255, unique=True, blank=True)


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
    body = models.TextField()

    def __str__(self):
        return f"Poem: {self.title}"



# books and Chapters


class Book(BaseContent):
    foreword = models.TextField(blank=True)
    afterword = models.TextField(blank=True)

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
        base = self.title or f"Chapter {self.auto_label}"
        return f"{self.book.title}"


