import io
import os
import zipfile
from xml.etree import ElementTree


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
    return "\n\n".join(pages)


def extract_text_from_upload(upload_file) -> str:
    """
    Extract readable text from supported upload files.
    DOC extraction is intentionally skipped because legacy .doc requires external tools.
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
        return _extract_text_from_txt(raw)

    if ext == ".docx":
        try:
            return _extract_text_from_docx(raw)
        except Exception:
            return ""

    if ext == ".pdf":
        try:
            return _extract_text_from_pdf(raw)
        except Exception:
            return ""

    # .doc is intentionally unsupported for extraction without external tooling.
    return ""
