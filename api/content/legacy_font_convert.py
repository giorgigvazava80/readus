from __future__ import annotations

import re

# Legacy Georgian keyboard-layout mapping used by AcadNusx-style text.
# Source mapping follows the historical BPG converter table
# (LatinGeorgian_L_To_Unicode).
ACADNUSX_TO_UNICODE_MAP = {
    "a": "ა",
    "b": "ბ",
    "g": "გ",
    "d": "დ",
    "e": "ე",
    "v": "ვ",
    "z": "ზ",
    "T": "თ",
    "i": "ი",
    "k": "კ",
    "l": "ლ",
    "m": "მ",
    "n": "ნ",
    "o": "ო",
    "p": "პ",
    "J": "ჟ",
    "r": "რ",
    "s": "ს",
    "t": "ტ",
    "u": "უ",
    "f": "ფ",
    "q": "ქ",
    "R": "ღ",
    "y": "ყ",
    "S": "შ",
    "C": "ჩ",
    "c": "ც",
    "Z": "ძ",
    "w": "წ",
    "W": "ჭ",
    "x": "ხ",
    "j": "ჯ",
    "h": "ჰ",
}

ACADNUSX_TRANSLATION_TABLE = str.maketrans(ACADNUSX_TO_UNICODE_MAP)
ACADNUSX_SPECIAL_UPPER = frozenset("TJRSCZW")
ACADNUSX_WORD_RE = re.compile(r"[A-Za-z]{2,}")
ACADNUSX_INWORD_SPECIAL_RE = re.compile(r"[a-z][TJRSCZW][a-z]")
PDF_FONT_MARKERS = (
    b"acadnusx",
    b"litnusx",
    b"geonusx",
    b"nusx",
)

ENGLISH_STOPWORDS = frozenset(
    {
        "a",
        "an",
        "and",
        "are",
        "as",
        "at",
        "be",
        "by",
        "for",
        "from",
        "has",
        "have",
        "in",
        "is",
        "it",
        "its",
        "of",
        "on",
        "or",
        "that",
        "the",
        "their",
        "this",
        "to",
        "was",
        "were",
        "with",
        "you",
        "your",
    }
)


def detect_pdf_has_acadnusx_font(data: bytes) -> bool:
    if not data:
        return False
    lowered = data.lower()
    return any(marker in lowered for marker in PDF_FONT_MARKERS)


def looks_like_acadnusx_text(text: str) -> bool:
    if not text:
        return False

    # Already-unicode Georgian content does not need legacy conversion.
    if any("\u10A0" <= ch <= "\u10FF" for ch in text):
        return False

    words = ACADNUSX_WORD_RE.findall(text)
    if len(words) < 6:
        return False

    marker_words = sum(1 for word in words if ACADNUSX_INWORD_SPECIAL_RE.search(word))
    marker_chars = sum(1 for ch in text if ch in ACADNUSX_SPECIAL_UPPER)
    special_words = sum(
        1
        for word in words
        if any(ch in ACADNUSX_SPECIAL_UPPER for ch in word)
        or any(ch in "qwxjz" for ch in word.lower())
    )
    english_hits = sum(1 for word in words if word.lower() in ENGLISH_STOPWORDS)

    stopword_ratio = english_hits / len(words)
    special_ratio = special_words / len(words)

    if marker_words >= 2 and marker_chars >= 4 and stopword_ratio <= 0.18:
        return True

    if marker_chars >= 8 and special_ratio >= 0.25 and stopword_ratio <= 0.12:
        return True

    return False


def convert_acadnusx_to_unicode(text: str) -> str:
    if not text:
        return text
    return text.translate(ACADNUSX_TRANSLATION_TABLE)


def maybe_convert_acadnusx_to_unicode(text: str, *, force: bool = False) -> str:
    if not text:
        return text
    if force or looks_like_acadnusx_text(text):
        return convert_acadnusx_to_unicode(text)
    return text
