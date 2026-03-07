from __future__ import annotations

import html
import re
from dataclasses import dataclass

from django.db import transaction
from django.db.models import Max
from django.utils import timezone

from .background_jobs import submit_background_job
from .file_extract import extract_text_from_upload
from .models import (
    Book,
    Chapter,
    SourceType,
    StatusChoices,
    UploadProcessingStatus,
    build_default_chapter_title,
)


MAX_IMPORTED_CHAPTERS = 300
FALLBACK_CHAPTER_CHAR_TARGET = 9000

SEPARATOR_ONLY_TITLES = {
    "***",
    "---",
    "___",
    "~~~",
    "●",
    "* * *",
    "- - -",
    "_ _ _",
}

SEPARATOR_CHARS = {"*", "-", "_", "~", "●", "•", "·", "–", "—"}

MOJIBAKE_REPLACEMENTS = {
    "â€”": "—",  # mojibake em dash
    "â€“": "–",  # mojibake en dash
    "â€˜": "‘",  # mojibake left single quote
    "â€™": "’",  # mojibake right single quote
    "â€œ": "“",  # mojibake left double quote
    "â€": "”",  # mojibake right double quote
    "â€¢": "•",  # mojibake bullet
    "â€¦": "…",  # mojibake ellipsis
    "â—": "●",  # mojibake black circle
}

HEADING_PATTERNS = [
    re.compile(r"^\s*#{1,6}\s+.+$"),
    re.compile(r"^\s*(?:chapter|chap\.?|ch\.)\s+[\divxlcdm]+\b.*$", re.IGNORECASE),
    re.compile(r"^\s*(?:part|section|book|volume)\s+[\divxlcdm]+\b.*$", re.IGNORECASE),
    re.compile(r"^\s*(?:prologue|epilogue|introduction|foreword|afterword)\b.*$", re.IGNORECASE),
    re.compile(r"^\s*(?:\d+|[ivxlcdm]+)[\)\.\-:]\s+.{1,120}$", re.IGNORECASE),
    re.compile(r"^\s*chapter\s+[a-z]+\b.*$", re.IGNORECASE),
    re.compile(r"^\s*part\s+[a-z]+\b.*$", re.IGNORECASE),
    re.compile(r"^\s*section\s+[a-z]+\b.*$", re.IGNORECASE),
    re.compile(r"^\s*book\s+[a-z]+\b.*$", re.IGNORECASE),
    re.compile(r"^\s*volume\s+[a-z]+\b.*$", re.IGNORECASE),
    re.compile(r"^\s*chapter\s+\d+\s*[:.\-]\s*.+$", re.IGNORECASE),
    re.compile(r"^\s*part\s+\d+\s*[:.\-]\s*.+$", re.IGNORECASE),
    re.compile(r"^\s*section\s+\d+\s*[:.\-]\s*.+$", re.IGNORECASE),
    re.compile(r"^\s*book\s+\d+\s*[:.\-]\s*.+$", re.IGNORECASE),
    re.compile(r"^\s*volume\s+\d+\s*[:.\-]\s*.+$", re.IGNORECASE),
    re.compile(r"^\s*chapter\s+[ivxlcdm]+\s*[:.\-]\s*.+$", re.IGNORECASE),
    re.compile(r"^\s*part\s+[ivxlcdm]+\s*[:.\-]\s*.+$", re.IGNORECASE),
    re.compile(r"^\s*section\s+[ivxlcdm]+\s*[:.\-]\s*.+$", re.IGNORECASE),
    re.compile(r"^\s*book\s+[ivxlcdm]+\s*[:.\-]\s*.+$", re.IGNORECASE),
    re.compile(r"^\s*volume\s+[ivxlcdm]+\s*[:.\-]\s*.+$", re.IGNORECASE),
    re.compile(r"^\s*თავი\s*[\divxlcdmა-ჰ]+\b.*$", re.IGNORECASE),
    re.compile(r"^\s*(?:პროლოგი|ეპილოგი|შესავალი|წინასიტყვაობა|ბოლოსიტყვაობა)\b.*$", re.IGNORECASE),
]


@dataclass
class ParsedChapter:
    title: str
    body_html: str


def queue_book_upload_processing(book_id: int, *, expected_upload_name: str) -> None:
    submit_background_job(process_book_upload, book_id, expected_upload_name=expected_upload_name)


def process_book_upload(book_id: int, *, expected_upload_name: str) -> None:
    book = Book.objects.filter(id=book_id).first()
    if not book:
        return
    if book.source_type != SourceType.UPLOAD or not book.upload_file:
        return
    if expected_upload_name and book.upload_file.name != expected_upload_name:
        return

    _set_processing_state(book, status_value=UploadProcessingStatus.PROCESSING, error_text="")

    try:
        extracted = extract_text_from_upload(book.upload_file)
        normalized_text = _normalize_text(extracted)
        parsed_chapters = split_text_into_chapters(
            normalized_text,
            fallback_language=book.content_language,
        )
    except Exception as exc:
        _set_processing_state(
            book,
            status_value=UploadProcessingStatus.FAILED,
            error_text=f"Upload analysis failed: {exc}",
            mark_processed=True,
        )
        return

    with transaction.atomic():
        locked_book = Book.objects.select_for_update().filter(id=book_id).first()
        if not locked_book:
            return
        if locked_book.source_type != SourceType.UPLOAD or not locked_book.upload_file:
            return
        if expected_upload_name and locked_book.upload_file.name != expected_upload_name:
            return

        _replace_draft_chapters(locked_book, parsed_chapters, fallback_text=normalized_text)
        locked_book.extracted_text = normalized_text
        locked_book.upload_processing_status = UploadProcessingStatus.DONE
        locked_book.upload_processing_error = ""
        locked_book.upload_processed_at = timezone.now()
        locked_book.save(
            update_fields=[
                "extracted_text",
                "upload_processing_status",
                "upload_processing_error",
                "upload_processed_at",
                "updated_at",
            ]
        )


def split_text_into_chapters(raw_text: str, *, fallback_language: str = "en") -> list[ParsedChapter]:
    text = _normalize_text(raw_text)
    if not text:
        return []

    lines = text.split("\n")
    results: list[ParsedChapter] = []
    current_title = ""
    current_lines: list[str] = []

    for index, line in enumerate(lines):
        stripped = line.strip()
        if not stripped:
            current_lines.append("")
            continue

        previous_line = lines[index - 1] if index > 0 else ""
        next_line = lines[index + 1] if index + 1 < len(lines) else ""
        if _is_standalone_numeric_heading(stripped, previous_line, next_line, index):
            if _has_content(current_lines):
                if _should_drop_leading_preamble(current_lines, results):
                    current_lines = []
                else:
                    results.append(
                        _build_parsed_chapter(
                            current_title,
                            current_lines,
                            len(results) + 1,
                            fallback_language=fallback_language,
                        )
                    )
                current_lines = []
            current_title = _clean_heading(stripped)
            continue

        if _is_heading_line(stripped):
            if _has_content(current_lines):
                if _should_drop_leading_preamble(current_lines, results):
                    current_lines = []
                else:
                    results.append(
                        _build_parsed_chapter(
                            current_title,
                            current_lines,
                            len(results) + 1,
                            fallback_language=fallback_language,
                        )
                    )
                current_lines = []
            current_title = _clean_heading(stripped)
            continue

        current_lines.append(line)

    if _has_content(current_lines):
        results.append(
            _build_parsed_chapter(
                current_title,
                current_lines,
                len(results) + 1,
                fallback_language=fallback_language,
            )
        )

    if not results:
        return _fallback_split_without_headings(text, fallback_language=fallback_language)

    return results[:MAX_IMPORTED_CHAPTERS]


def _set_processing_state(
    book: Book,
    *,
    status_value: str,
    error_text: str,
    mark_processed: bool = False,
) -> None:
    book.upload_processing_status = status_value
    book.upload_processing_error = error_text[:2000]
    if mark_processed:
        book.upload_processed_at = timezone.now()
    book.save(
        update_fields=[
            "upload_processing_status",
            "upload_processing_error",
            "upload_processed_at",
            "updated_at",
        ]
    )


def _replace_draft_chapters(book: Book, parsed_chapters: list[ParsedChapter], *, fallback_text: str) -> None:
    removable_qs = book.chapters.filter(
        status=StatusChoices.DRAFT,
        is_submitted_for_review=False,
    )
    removable_qs.delete()

    next_order = (book.chapters.aggregate(max_order=Max("order")).get("max_order") or 0) + 1

    rows: list[Chapter] = []
    for index, chapter_data in enumerate(parsed_chapters, start=next_order):
        if len(rows) >= MAX_IMPORTED_CHAPTERS:
            break
        if not chapter_data.body_html.strip():
            continue
        rows.append(
            Chapter(
                book=book,
                title=chapter_data.title[:255],
                order=index,
                body=chapter_data.body_html,
            )
        )

    if not rows and fallback_text:
        rows.append(
            Chapter(
                book=book,
                title=build_default_chapter_title(next_order, book.content_language),
                order=next_order,
                body=_plain_text_to_html(fallback_text),
            )
        )

    if rows:
        Chapter.objects.bulk_create(rows, batch_size=100)


def _build_parsed_chapter(
    title: str,
    lines: list[str],
    fallback_order: int,
    *,
    fallback_language: str = "en",
) -> ParsedChapter:
    text_block = "\n".join(lines).strip()
    final_title = _resolve_title(
        title,
        text_block,
        fallback_order,
        fallback_language=fallback_language,
    )
    return ParsedChapter(
        title=final_title,
        body_html=_plain_text_to_html(text_block),
    )


def _resolve_title(
    title: str,
    text_block: str,
    fallback_order: int,
    *,
    fallback_language: str = "en",
) -> str:
    normalized_title = _clean_heading(title)
    if normalized_title and not _is_numeric_marker_title(normalized_title):
        return normalized_title
    return build_default_chapter_title(fallback_order, fallback_language)


def _normalize_text(value: str) -> str:
    text = _repair_common_mojibake(value or "")
    text = _normalize_dialog_markers(text)
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = text.replace("\x00", "")
    text = text.replace("\u00a0", " ")
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _is_heading_line(stripped_line: str) -> bool:
    if _is_separator_line(stripped_line):
        return True
    if len(stripped_line) < 2 or len(stripped_line) > 140:
        return False
    if any(pattern.match(stripped_line) for pattern in HEADING_PATTERNS):
        return not _is_probably_sentence(stripped_line)

    words = stripped_line.split()
    has_alpha = any(any(ch.isalpha() for ch in token) for token in words)
    if not has_alpha:
        return False

    if (
        _has_cased_letters(stripped_line)
        and _is_mostly_uppercase(stripped_line)
        and not _is_probably_sentence(stripped_line)
        and len(words) <= 10
        and len(stripped_line) <= 80
    ):
        return True
    return False


def _is_standalone_numeric_heading(
    stripped_line: str,
    previous_line: str,
    next_line: str,
    line_index: int,
) -> bool:
    if not _is_numeric_marker_title(stripped_line):
        return False

    prev_blank = not (previous_line or "").strip()
    next_blank = not (next_line or "").strip()

    # Chapter markers in many PDFs are rendered as standalone numeric lines
    # surrounded by spacing. Allow the opening marker right after title line.
    return next_blank and (prev_blank or line_index <= 1)


def _is_separator_line(value: str) -> bool:
    line = value.strip()
    if not line:
        return False
    if line in SEPARATOR_ONLY_TITLES:
        return True

    compact = re.sub(r"\s+", "", line)
    if not compact:
        return False

    if len(compact) == 1 and compact in SEPARATOR_CHARS:
        return True

    if len(compact) >= 3 and len(set(compact)) == 1 and compact[0] in SEPARATOR_CHARS:
        return True

    return False


def _is_probably_sentence(value: str) -> bool:
    line = value.strip()
    words = line.split()
    if len(words) < 7:
        return False
    if re.search(r"[.!?]\s*$", line):
        return True

    lower_initial_words = sum(
        1
        for word in words[1:]
        if word and word[0].isalpha() and word[0].islower()
    )
    return lower_initial_words >= max(4, len(words) // 2)


def _repair_common_mojibake(value: str) -> str:
    if not value:
        return value

    text = value
    for bad, fixed in MOJIBAKE_REPLACEMENTS.items():
        text = text.replace(bad, fixed)

    repaired_lines: list[str] = []
    for line in text.splitlines(keepends=True):
        if not _has_mojibake_markers(line):
            repaired_lines.append(line)
            continue
        candidate = line
        try:
            recoded = line.encode("cp1252").decode("utf-8")
            if _mojibake_score(recoded) < _mojibake_score(line):
                candidate = recoded
        except Exception:
            pass
        repaired_lines.append(candidate)

    return "".join(repaired_lines)


def _normalize_dialog_markers(value: str) -> str:
    if not value:
        return value

    # Some PDF extracts map "-" to Cyrillic "г"/"Г".
    # Normalize common marker forms while keeping real Cyrillic words untouched.
    text = value
    text = re.sub(r"(?<=[\u10A0-\u10FF])[ \t]*[\u0433\u0413](?=[ \t]*\n[ \t]*[\u10A0-\u10FF])", "-", text)
    text = re.sub(r"(?<=[\u10A0-\u10FF])[ \t]*[\u0433\u0413][ \t]*(?=[\u10A0-\u10FF])", "-", text)
    text = re.sub(r"(?m)^([ \t]*)[\u0433\u0413](?=\s)", r"\1-", text)
    text = re.sub(r"(?<=\s)[\u0433\u0413](?=\s)", "-", text)
    return text


def _has_mojibake_markers(value: str) -> bool:
    return any(token in value for token in ("Ã", "Â", "â", "\u009d", "\u008f"))


def _mojibake_score(value: str) -> int:
    return sum(value.count(token) for token in ("Ã", "Â", "â", "\u009d", "\u008f", "\ufffd"))


def _has_cased_letters(value: str) -> bool:
    for ch in value:
        if ch.isalpha() and ch.lower() != ch.upper():
            return True
    return False


def _is_mostly_uppercase(value: str) -> bool:
    cased = [ch for ch in value if ch.isalpha() and ch.lower() != ch.upper()]
    if not cased:
        return False
    uppercase = sum(1 for ch in cased if ch == ch.upper())
    return uppercase / len(cased) >= 0.8


def _clean_heading(value: str) -> str:
    line = (value or "").strip()
    line = re.sub(r"^#{1,6}\s*", "", line)
    line = re.sub(r"\s+", " ", line)
    return line[:255]


def _is_numeric_marker_title(value: str) -> bool:
    line = (value or "").strip()
    if not line:
        return False
    return bool(
        re.fullmatch(
            r"[\(\[\{]?\s*(?:\d{1,4}|[ivxlcdm]{1,12})\s*[\)\]\}]?\s*[:.\-–—]?\s*",
            line,
            flags=re.IGNORECASE,
        )
    )


def _has_content(lines: list[str]) -> bool:
    return any(part.strip() for part in lines)


def _should_drop_leading_preamble(lines: list[str], existing_results: list[ParsedChapter]) -> bool:
    if existing_results:
        return False
    non_empty = [line.strip() for line in lines if line.strip()]
    if not non_empty or len(non_empty) > 2:
        return False
    joined = " ".join(non_empty)
    if len(joined) > 120:
        return False
    if re.search(r"[.!?…]\s*$", joined):
        return False
    return len(joined.split()) <= 15


def _plain_text_to_html(text: str) -> str:
    if not text.strip():
        return ""
    paragraphs = [part.strip() for part in re.split(r"\n{2,}", text) if part.strip()]
    html_chunks = []
    for paragraph in paragraphs:
        escaped = html.escape(paragraph).replace("\n", "<br />")
        html_chunks.append(f"<p>{escaped}</p>")
    return "".join(html_chunks)


def _fallback_split_without_headings(text: str, *, fallback_language: str = "en") -> list[ParsedChapter]:
    if len(text) <= FALLBACK_CHAPTER_CHAR_TARGET:
        return [
            ParsedChapter(
                title=build_default_chapter_title(1, fallback_language),
                body_html=_plain_text_to_html(text),
            )
        ]

    paragraphs = [part.strip() for part in re.split(r"\n{2,}", text) if part.strip()]
    if not paragraphs:
        return []

    results: list[ParsedChapter] = []
    chunk: list[str] = []
    chunk_chars = 0

    for paragraph in paragraphs:
        addition = len(paragraph) + 2
        if chunk and chunk_chars + addition > FALLBACK_CHAPTER_CHAR_TARGET:
            chapter_index = len(results) + 1
            results.append(
                ParsedChapter(
                    title=build_default_chapter_title(chapter_index, fallback_language),
                    body_html=_plain_text_to_html("\n\n".join(chunk)),
                )
            )
            chunk = []
            chunk_chars = 0

        chunk.append(paragraph)
        chunk_chars += addition

    if chunk:
        chapter_index = len(results) + 1
        results.append(
            ParsedChapter(
                title=build_default_chapter_title(chapter_index, fallback_language),
                body_html=_plain_text_to_html("\n\n".join(chunk)),
            )
        )

    return results[:MAX_IMPORTED_CHAPTERS]
