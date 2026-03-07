import io
import os
import re
import shutil
import subprocess
import tempfile
import zipfile
from xml.etree import ElementTree

from .legacy_font_convert import detect_pdf_has_acadnusx_font, maybe_convert_acadnusx_to_unicode


def _extract_text_from_txt(raw: bytes) -> str:
    for encoding in ("utf-8", "utf-16", "latin-1"):
        try:
            return raw.decode(encoding)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", errors="ignore")


def _extract_text_from_docx(data: bytes) -> str:
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        document_xml = archive.read("word/document.xml")

    root = ElementTree.fromstring(document_xml)
    lines = []
    for paragraph in root.iter():
        if paragraph.tag.endswith("}p"):
            parts = []
            for node in paragraph.iter():
                if node.tag.endswith("}t") and node.text:
                    parts.append(node.text)
            if parts:
                lines.append("".join(parts))

    return "\n\n".join(lines)


def _extract_text_from_pdf(data: bytes) -> str:
    try:
        from pypdf import PdfReader  # type: ignore
    except Exception:
        return ""

    try:
        reader = PdfReader(io.BytesIO(data))
    except Exception:
        return ""

    pages = []
    for page in reader.pages:
        try:
            pages.append(page.extract_text() or "")
        except Exception:
            pages.append("")
    text = "\n\n".join(pages)
    return maybe_convert_acadnusx_to_unicode(text, force=detect_pdf_has_acadnusx_font(data))


def _extract_text_from_doc_with_tool(data: bytes) -> str:
    tool = shutil.which("antiword") or shutil.which("catdoc")
    if not tool:
        return ""

    with tempfile.NamedTemporaryFile(delete=False, suffix=".doc") as tmp_file:
        tmp_file.write(data)
        tmp_path = tmp_file.name

    try:
        completed = subprocess.run(
            [tool, tmp_path],
            capture_output=True,
            check=False,
            timeout=25,
        )
        if completed.returncode != 0:
            return ""
        return completed.stdout.decode("utf-8", errors="ignore")
    except Exception:
        return ""
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass


def _extract_text_from_doc_binary(data: bytes) -> str:
    # Fallback parser for legacy .doc (best effort).
    ascii_chunks = [
        chunk.decode("latin-1", errors="ignore").strip()
        for chunk in re.findall(rb"(?:[ -~]{4,}(?:\r?\n)?)+", data)
    ]

    utf16_chunks = []
    for chunk in re.findall(rb"(?:(?:[\x20-\x7E]\x00){4,})", data):
        try:
            utf16_chunks.append(chunk.decode("utf-16-le", errors="ignore").strip())
        except Exception:
            continue

    combined = "\n".join([*ascii_chunks, *utf16_chunks])
    combined = re.sub(r"\n{3,}", "\n\n", combined)
    return combined.strip()


def extract_text_from_upload(upload_file) -> str:
    """
    Extract readable text from supported upload files.
    Supports TXT, DOCX, PDF, and best-effort DOC extraction.
    """
    if not upload_file:
        return ""

    name = getattr(upload_file, "name", "") or ""
    ext = os.path.splitext(name)[1].lower()

    try:
        if hasattr(upload_file, "open"):
            upload_file.open("rb")
        raw = upload_file.read()
    except Exception:
        return ""
    finally:
        try:
            upload_file.close()
        except Exception:
            pass

    if not raw:
        return ""

    if ext == ".txt":
        return maybe_convert_acadnusx_to_unicode(_extract_text_from_txt(raw))

    if ext == ".docx":
        try:
            return maybe_convert_acadnusx_to_unicode(_extract_text_from_docx(raw))
        except Exception:
            return ""

    if ext == ".pdf":
        try:
            return _extract_text_from_pdf(raw)
        except Exception:
            return ""

    if ext == ".doc":
        if raw[:2] == b"PK":
            # Some uploads are DOCX with wrong extension.
            try:
                return maybe_convert_acadnusx_to_unicode(_extract_text_from_docx(raw))
            except Exception:
                pass
        with_tool = _extract_text_from_doc_with_tool(raw)
        if with_tool:
            return maybe_convert_acadnusx_to_unicode(with_tool)
        return maybe_convert_acadnusx_to_unicode(_extract_text_from_doc_binary(raw))

    return ""
