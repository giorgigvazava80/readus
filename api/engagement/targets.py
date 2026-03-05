from __future__ import annotations

import re
from dataclasses import dataclass
from html import unescape
from typing import Any

from django.contrib.contenttypes.models import ContentType
from django.db.models import Model, Q
from django.http import Http404

from content.models import Book, Chapter, Poem, StatusChoices, Story


TARGET_CATEGORY_MODEL_MAP = {
    "books": Book,
    "stories": Story,
    "poems": Poem,
    "chapters": Chapter,
}


@dataclass(frozen=True)
class TargetDescriptor:
    category: str
    model: type[Model]
    content_type: ContentType


def get_target_descriptor(category: str) -> TargetDescriptor:
    key = (category or "").strip().lower()
    model = TARGET_CATEGORY_MODEL_MAP.get(key)
    if not model:
        raise Http404("Unsupported target category.")

    content_type = ContentType.objects.get_for_model(model)
    return TargetDescriptor(category=key, model=model, content_type=content_type)


def resolve_target(category: str, identifier: str | int, *, public_only: bool = False) -> Model:
    descriptor = get_target_descriptor(category)
    lookup = str(identifier).strip()
    if not lookup:
        raise Http404("Invalid target identifier.")

    queryset = descriptor.model.objects.all()
    obj = queryset.filter(pk=int(lookup)).first() if lookup.isdigit() else None

    if obj is None and descriptor.category != "chapters":
        obj = queryset.filter(public_slug=lookup).first()

    if obj is None:
        raise Http404("Target not found.")

    if public_only and not is_target_public(obj):
        raise Http404("Target not found.")
    return obj


def get_target_category(instance: Model) -> str:
    if isinstance(instance, Book):
        return "books"
    if isinstance(instance, Story):
        return "stories"
    if isinstance(instance, Poem):
        return "poems"
    if isinstance(instance, Chapter):
        return "chapters"
    raise ValueError("Unsupported target type.")


def get_target_author(instance: Model):
    if isinstance(instance, Chapter):
        return instance.book.author
    if hasattr(instance, "author"):
        return instance.author
    return None


def get_target_title(instance: Model) -> str:
    if isinstance(instance, Chapter):
        chapter_title = instance.title or f"Chapter {instance.auto_label or instance.order}"
        return f"{instance.book.title} - {chapter_title}"
    return getattr(instance, "title", "") or "Untitled"


def get_target_public_identifier(instance: Model) -> str:
    if isinstance(instance, Chapter):
        return str(instance.id)
    return str(getattr(instance, "public_slug", "") or instance.id)


def is_target_public(instance: Model) -> bool:
    if isinstance(instance, Chapter):
        book = instance.book
        return (
            instance.status == StatusChoices.APPROVED
            and book.status == StatusChoices.APPROVED
            and not book.is_hidden
            and not book.is_deleted
        )

    if isinstance(instance, (Book, Story, Poem)):
        return (
            instance.status == StatusChoices.APPROVED
            and not instance.is_hidden
            and not instance.is_deleted
        )
    return False


def is_target_accessible_for_author(instance: Model) -> bool:
    if isinstance(instance, Chapter):
        return not instance.book.is_deleted
    if isinstance(instance, (Book, Story, Poem)):
        return not instance.is_deleted
    return False


def _html_to_plain_paragraphs(value: str) -> list[str]:
    if not value:
        return []
    text = value
    text = re.sub(r"(?i)</p\s*>", "\n\n", text)
    text = re.sub(r"(?i)<br\s*/?>", "\n", text)
    text = re.sub(r"<[^>]+>", " ", text)
    text = unescape(text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    paragraphs = [chunk.strip() for chunk in re.split(r"\n\s*\n", text) if chunk.strip()]
    return paragraphs


def _extract_block_id_from_attrs(attrs: str) -> str | None:
    if not attrs:
        return None
    patterns = [
        r'data-block-id\s*=\s*"([^"]+)"',
        r"data-block-id\s*=\s*'([^']+)'",
        r'id\s*=\s*"([^"]+)"',
        r"id\s*=\s*'([^']+)'",
    ]
    for pattern in patterns:
        match = re.search(pattern, attrs, flags=re.IGNORECASE)
        if match:
            value = (match.group(1) or "").strip()
            if value:
                return value[:120]
    return None


def _html_to_anchor_rows(value: str) -> list[dict[str, Any]]:
    if not value:
        return []

    rows: list[dict[str, Any]] = []
    block_pattern = re.compile(
        r"(?is)<(p|div|h1|h2|h3|blockquote|li)([^>]*)>(.*?)</\1>",
    )
    for match in block_pattern.finditer(value):
        attrs = match.group(2) or ""
        inner = match.group(3) or ""
        text_value = _html_to_plain_paragraphs(inner)
        if not text_value:
            continue
        rows.append(
            {
                "text": " ".join(text_value).strip(),
                "block_id": _extract_block_id_from_attrs(attrs),
            }
        )

    if rows:
        return rows
    return [{"text": paragraph, "block_id": None} for paragraph in _html_to_plain_paragraphs(value)]


def extract_target_anchor_rows(instance: Model) -> list[dict[str, Any]]:
    if isinstance(instance, Chapter):
        return _html_to_anchor_rows(instance.body)

    if isinstance(instance, (Story, Poem)):
        if instance.source_type == "upload" and instance.extracted_text:
            return [
                {"text": p.strip(), "block_id": None}
                for p in re.split(r"\n\s*\n", instance.extracted_text)
                if p.strip()
            ]
        return _html_to_anchor_rows(instance.body)

    if isinstance(instance, Book):
        if instance.source_type == "upload" and instance.extracted_text:
            return [
                {"text": p.strip(), "block_id": None}
                for p in re.split(r"\n\s*\n", instance.extracted_text)
                if p.strip()
            ]
        return _html_to_anchor_rows(instance.foreword)

    return []


def extract_target_paragraphs(instance: Model) -> list[str]:
    return [str(row.get("text") or "").strip() for row in extract_target_anchor_rows(instance) if row.get("text")]


def resolve_paragraph_index_from_anchor(instance: Model, *, anchor_type: str, anchor_key: str) -> int | None:
    normalized_type = (anchor_type or "").strip().lower()
    normalized_key = (anchor_key or "").strip()
    if not normalized_type:
        return None

    if normalized_type == "paragraph":
        if normalized_key.startswith("p:") and normalized_key[2:].strip().isdigit():
            return int(normalized_key[2:].strip())
        return None

    if normalized_type != "block" or not normalized_key:
        return None

    rows = extract_target_anchor_rows(instance)
    for index, row in enumerate(rows):
        if str(row.get("block_id") or "").strip() == normalized_key:
            return index
    return None


def extract_target_excerpt(instance: Model, max_len: int = 190) -> str:
    candidates: list[str] = []
    if isinstance(instance, Chapter):
        candidates = extract_target_paragraphs(instance)
    elif isinstance(instance, (Story, Poem)):
        candidates = extract_target_paragraphs(instance)
    elif isinstance(instance, Book):
        candidates = extract_target_paragraphs(instance)

    text = " ".join(candidates).strip()
    if not text:
        return ""
    if len(text) <= max_len:
        return text
    return f"{text[: max_len - 3].rstrip()}..."


def visible_content_q_for_category(category: str) -> Q:
    if category == "chapters":
        return Q(
            status=StatusChoices.APPROVED,
            book__status=StatusChoices.APPROVED,
            book__is_hidden=False,
            book__is_deleted=False,
        )
    return Q(status=StatusChoices.APPROVED, is_hidden=False, is_deleted=False)
