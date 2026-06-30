"""Parse a PDF into structured text chunks for downstream agents."""
from __future__ import annotations
from dataclasses import dataclass
from pathlib import Path
import fitz  # PyMuPDF


@dataclass
class PaperContent:
    title: str
    abstract: str
    sections: list[dict]   # [{"heading": str, "text": str}]
    references: list[str]  # raw reference strings
    full_text: str         # entire body text, for fallback prompts


def ingest_pdf(pdf_path: str | Path) -> PaperContent:
    doc = fitz.open(str(pdf_path))
    full_pages: list[str] = [page.get_text() for page in doc]
    full_text = "\n".join(full_pages)

    title = _extract_title(full_pages)
    abstract = _extract_abstract(full_text)
    sections = _extract_sections(full_text)
    references = _extract_references(full_text)

    return PaperContent(
        title=title,
        abstract=abstract,
        sections=sections,
        references=references,
        full_text=full_text,
    )


def _extract_title(pages: list[str]) -> str:
    # Title is almost always in the first page; take first non-empty line
    for line in pages[0].splitlines():
        line = line.strip()
        if len(line) > 10:
            return line
    return "Untitled"


def _extract_abstract(text: str) -> str:
    lower = text.lower()
    start = lower.find("abstract")
    if start == -1:
        return text[:800]
    end = lower.find("\n\n", start + 8)
    if end == -1 or end - start > 3000:
        end = start + 2000
    return text[start:end].strip()


def _extract_sections(text: str) -> list[dict]:
    import re
    # Match numbered section headings like "1 Introduction" or "2.1 Method"
    pattern = re.compile(r"\n(\d+(?:\.\d+)*\s+[A-Z][^\n]{3,60})\n")
    matches = list(pattern.finditer(text))
    sections: list[dict] = []
    for i, match in enumerate(matches):
        heading = match.group(1).strip()
        start = match.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        body = text[start:end].strip()
        if body:
            sections.append({"heading": heading, "text": body[:4000]})
    if not sections:
        # Fallback: split on double newlines into paragraphs
        paragraphs = [p.strip() for p in text.split("\n\n") if len(p.strip()) > 100]
        sections = [{"heading": f"Paragraph {i+1}", "text": p[:4000]}
                    for i, p in enumerate(paragraphs[:20])]
    return sections


def _extract_references(text: str) -> list[str]:
    import re
    lower = text.lower()
    ref_start = max(lower.rfind("\nreferences\n"), lower.rfind("\nbibliography\n"))
    if ref_start == -1:
        return []
    ref_text = text[ref_start:]
    # Split on numbered reference entries [1] Author...
    entries = re.split(r"\n\[\d+\]", ref_text)
    return [e.strip().replace("\n", " ") for e in entries[1:51]]  # cap at 50
