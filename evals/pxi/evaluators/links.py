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


def _expects_route_info_before_in_app_links(expected: Any) -> bool:
    return bool(_expected_links(expected).get("route_info_before_in_app_links", False))


def _required_in_app_links(expected: Any) -> list[str]:
    required = _expected_links(expected).get("required_in_app", [])
    return [link for link in required if isinstance(link, str)]


def _canonical_docs_domain(expected: Any) -> str:
    domain = _expected_links(expected).get("canonical_docs_domain")
    if isinstance(domain, str) and domain.strip():
        return domain.rstrip("/")
    return "https://arize.com/docs/phoenix"


def _is_canonical_docs_href(href: str, domain: str) -> bool:
    return href == domain or href.startswith(f"{domain}/")


def _is_root_relative_href(href: str) -> bool:
    return href.startswith("/") and not href.startswith("//")


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


def _is_root_relative_app_href(href: str) -> bool:
    return href.startswith("/") and not href.startswith("//")


def _in_app_hrefs_before_tool(output: Any, tool_name: str) -> list[str]:
    messages = _as_dict(output).get("messages", [])
    if not isinstance(messages, list):
        return []
    hrefs_before_tool: list[str] = []
    for message in messages:
        if not isinstance(message, dict):
            continue
        parts = message.get("parts", [])
        if not isinstance(parts, list):
            continue
        for part in parts:
            if not isinstance(part, dict):
                continue
            if part.get("part_kind") == "tool-call" and part.get("tool_name") == tool_name:
                return hrefs_before_tool
            if part.get("part_kind") != "text":
                continue
            content = part.get("content")
            if not isinstance(content, str):
                continue
            hrefs, _ = _markdown_href_spans(content)
            hrefs_before_tool.extend(href for href in hrefs if _is_root_relative_app_href(href))
    return hrefs_before_tool


def _failure(explanation: str, metadata: dict[str, Any]) -> dict[str, Any]:
    return {
        "score": 0.0,
        "label": "fail",
        "explanation": explanation,
        "metadata": metadata,
    }


def _success(explanation: str, metadata: dict[str, Any]) -> dict[str, Any]:
    return {
        "score": 1.0,
        "label": "pass",
        "explanation": explanation,
        "metadata": metadata,
    }


def evaluate_in_app_links(output: Any, expected: Any) -> dict[str, Any]:
    """Evaluate PXI answer links against root-relative in-app link expectations."""
    route_info_before_links = _expects_route_info_before_in_app_links(expected)
    required = _required_in_app_links(expected)
    if route_info_before_links:
        pre_tool_hrefs = _in_app_hrefs_before_tool(output, "get_route_info")
        if pre_tool_hrefs:
            return _failure(
                "Assistant output included in-app links before calling get_route_info.",
                {
                    "observed_in_app_hrefs_before_get_route_info": pre_tool_hrefs,
                },
            )
        if not required:
            return _success(
                "Assistant output did not include in-app links before get_route_info.",
                {"observed_in_app_hrefs_before_get_route_info": []},
            )

    if not required:
        return _success(
            "No in-app link expectations were configured for this example.",
            {"required_in_app": []},
        )

    text = _assistant_text(output)
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

    return _success(
        "All required in-app links were emitted as root-relative markdown links.",
        metadata,
    )


def evaluate_documentation_links(output: Any, expected: Any) -> dict[str, Any]:
    """Evaluate PXI answer links against canonical Phoenix docs markdown-link expectations."""
    text = _assistant_text(output)
    domain = _canonical_docs_domain(expected)
    if text is None:
        return _failure(
            "Assistant output did not include text.",
            {
                "canonical_docs_domain": domain,
                "observed_markdown_hrefs": [],
                "canonical_documentation_hrefs": [],
                "invalid_documentation_hrefs": [],
                "bare_urls": [],
            },
        )

    hrefs, href_spans = _markdown_href_spans(text)
    bare_urls = _bare_urls(text, href_spans)
    canonical = [href for href in hrefs if _is_canonical_docs_href(href, domain)]
    root_relative = [href for href in hrefs if _is_root_relative_href(href)]
    invalid = [
        href
        for href in hrefs
        if not _is_canonical_docs_href(href, domain) and not _is_root_relative_href(href)
    ]
    if not canonical:
        invalid.extend(root_relative)
    metadata = {
        "canonical_docs_domain": domain,
        "observed_markdown_hrefs": hrefs,
        "canonical_documentation_hrefs": canonical,
        "root_relative_hrefs": root_relative,
        "invalid_documentation_hrefs": invalid,
        "bare_urls": bare_urls,
    }

    if bare_urls:
        return _failure("Assistant output included bare URLs.", metadata)
    if invalid:
        return _failure(
            "Assistant output included documentation links outside the canonical docs domain.",
            metadata,
        )
    if not canonical:
        return _failure("Assistant output did not include canonical documentation links.", metadata)

    return {
        "score": 1.0,
        "label": "pass",
        "explanation": "All documentation links used canonical Phoenix docs markdown URLs.",
        "metadata": metadata,
    }


@create_evaluator(name="in_app_links_valid", kind="code")
def in_app_links_valid(output: Any, expected: Any) -> dict[str, Any]:
    return evaluate_in_app_links(output, expected)


@create_evaluator(name="documentation_links_valid", kind="code")
def documentation_links_valid(output: Any, expected: Any) -> dict[str, Any]:
    return evaluate_documentation_links(output, expected)
