"""Turn an uploaded file into plain text for the ingest pipeline.

Every supported format lands here first, then flows through the same
chunk_text → embed_texts → INSERT path as pasted text (see ingest.py). Adding
a format means adding a case here — nothing downstream changes.
"""

from __future__ import annotations

from pathlib import Path

TEXT_EXTENSIONS = {".txt", ".md", ".markdown"}


class ExtractionError(ValueError):
    """Raised when a file's text can't be extracted (bad format, empty, etc.)."""


def extract_text(filename: str, data: bytes) -> str:
    """Return plain text for a file's bytes, based on its extension."""
    ext = Path(filename).suffix.lower()

    if ext == ".pdf":
        return _extract_pdf(data)
    if ext in TEXT_EXTENSIONS or ext == "":
        return _extract_plain(data)

    raise ExtractionError(
        f"Unsupported file type {ext or '(none)'!r}. "
        f"Supported: .pdf, {', '.join(sorted(TEXT_EXTENSIONS))}"
    )


def _extract_plain(data: bytes) -> str:
    try:
        return data.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise ExtractionError("File is not valid UTF-8 text") from exc


def _extract_pdf(data: bytes) -> str:
    from io import BytesIO

    from pypdf import PdfReader
    from pypdf.errors import PdfReadError

    try:
        reader = PdfReader(BytesIO(data))
    except PdfReadError as exc:
        raise ExtractionError(f"Could not read PDF: {exc}") from exc

    if reader.is_encrypted:
        # Try an empty password — some PDFs are "encrypted" only to block
        # editing and open fine with none. Anything else, we bail rather
        # than guess a password.
        try:
            reader.decrypt("")
        except Exception as exc:
            raise ExtractionError("PDF is password-protected") from exc

    pages = [page.extract_text() or "" for page in reader.pages]
    text = "\n\n".join(p.strip() for p in pages if p.strip())
    if not text.strip():
        raise ExtractionError(
            "No extractable text in PDF (it may be a scanned image with no text layer)"
        )
    return text
