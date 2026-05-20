from __future__ import annotations

import re
from typing import Any
from urllib.parse import urlparse

from phoenix.evals import create_evaluator

_MARKDOWN_LINK_RE = re.compile(r"\[[^\]]+\]\(([^)\s]+)\)")
_BARE_URL_RE = re.compile(r"https?://[^\s)]+")
_LOCAL_APP_HOSTS = {"localhost", "127.0.0.1", "::1"}


def _as_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _assistant_text(output: Any) -> str | None:
    text = _as_dict(output).get("assistant_text")
    return text if isinstance(text, str) and text.strip() else None


def _expected_links(expected: Any) -> dict[str, Any]:
    return _as_dict(_as_dict(expected).get("links", {}))


def _required_in_app_links(expected: Any) -> list[str]:
    required = _expected_links(expected).get("required_in_app", [])
    return [link for link in required if isinstance(link, str)]


def _markdown_href_spans(text: str) -> tuple[list[str], list[tuple[int, int]]]:
    hrefs: list[str] = []
    spans: list[tuple[int, int]] = []
    for match in _MARKDOWN_LINK_RE.finditer(text):
        hrefs.append(match.group(1))
        spans.append(match.span(1))
    return hrefs, spans


def _bare_urls(text: str, markdown_href_spans: list[tuple[int, int]]) -> list[str]:
    urls: list[str] = []
    for match in _BARE_URL_RE.finditer(text):
        start, end = match.span()
        if any(
            span_start <= start and end <= span_end for span_start, span_end in markdown_href_spans
        ):
            continue
        urls.append(match.group(0))
    return urls


def _absolute_app_link_reason(href: str, required_paths: list[str]) -> str | None:
    parsed = urlparse(href)
    if parsed.scheme not in {"http", "https"}:
        return None
    if parsed.hostname not in _LOCAL_APP_HOSTS:
        return None
    if parsed.path in required_paths:
        return "absolute app link"
    return None


def _invalid_in_app_hrefs(hrefs: list[str], required_paths: list[str]) -> list[str]:
    invalid: list[str] = []
    for href in hrefs:
        if _absolute_app_link_reason(href, required_paths):
            invalid.append(href)
    return invalid


def _failure(explanation: str, metadata: dict[str, Any]) -> dict[str, Any]:
    return {
        "score": 0.0,
        "label": "fail",
        "explanation": explanation,
        "metadata": metadata,
    }


def evaluate_in_app_links(output: Any, expected: Any) -> dict[str, Any]:
    """Evaluate PXI answer links against root-relative in-app link expectations."""
    text = _assistant_text(output)
    required = _required_in_app_links(expected)
    if text is None:
        return _failure(
            "Assistant output did not include text.",
            {
                "required_in_app": required,
                "observed_markdown_hrefs": [],
            },
        )

    hrefs, href_spans = _markdown_href_spans(text)
    bare_urls = _bare_urls(text, href_spans)
    missing = [path for path in required if path not in hrefs]
    invalid_in_app = _invalid_in_app_hrefs(hrefs, required)
    metadata = {
        "required_in_app": required,
        "observed_markdown_hrefs": hrefs,
        "missing_required_in_app": missing,
        "invalid_in_app_hrefs": invalid_in_app,
        "bare_urls": bare_urls,
    }

    if not hrefs:
        return _failure("Assistant output did not include markdown links.", metadata)
    if bare_urls:
        return _failure("Assistant output included bare URLs.", metadata)
    if missing:
        return _failure("Assistant output missed required in-app links.", metadata)
    if invalid_in_app:
        return _failure("Assistant output included non-root-relative app links.", metadata)

    return {
        "score": 1.0,
        "label": "pass",
        "explanation": "All required in-app links were emitted as root-relative markdown links.",
        "metadata": metadata,
    }


@create_evaluator(name="in_app_links_valid", kind="code")
def in_app_links_valid(output: Any, expected: Any) -> dict[str, Any]:
    return evaluate_in_app_links(output, expected)
