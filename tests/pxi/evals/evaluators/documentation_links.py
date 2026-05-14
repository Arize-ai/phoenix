from __future__ import annotations

import re
from typing import Any

from phoenix.evals import create_evaluator

_MARKDOWN_LINK_RE = re.compile(r"\[(?P<text>[^\]]+)\]\((?P<url>[^)\s]+)\)")
_URL_RE = re.compile(r"https?://[^\s)\]]+")
_URL_TRAILING_PUNCT = ".,;:!?'\""


def _as_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _assistant_text(output: Any) -> str | None:
    text = _as_dict(output).get("assistant_text")
    return text if isinstance(text, str) else None


def _assistant_text_expectations(expected: Any) -> dict[str, Any] | None:
    expectations = _as_dict(expected).get("assistant_text")
    return expectations if isinstance(expectations, dict) else None


def _string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, str)]


def _extract_links(text: str) -> tuple[list[str], list[str]]:
    """Return ``(linked_urls, bare_urls)`` found in ``text``.

    Linked URLs are pulled from markdown link syntax ``[anchor](url)``. Bare
    URLs are any remaining ``https?://`` substrings after the markdown link
    occurrences are stripped. Trailing punctuation in
    ``_URL_TRAILING_PUNCT`` is stripped from bare URLs because it almost
    always belongs to the surrounding sentence rather than the URL.
    """
    linked = [match.group("url").strip() for match in _MARKDOWN_LINK_RE.finditer(text)]
    stripped = _MARKDOWN_LINK_RE.sub("", text)
    bare = [match.group(0).rstrip(_URL_TRAILING_PUNCT) for match in _URL_RE.finditer(stripped)]
    return linked, bare


def _failure(
    label: str,
    explanation: str,
    *,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "score": 0.0,
        "label": label,
        "explanation": explanation,
    }
    if metadata:
        payload["metadata"] = dict(metadata)
    return payload


def _success(label: str = "pass", *, metadata: dict[str, Any] | None = None) -> dict[str, Any]:
    payload: dict[str, Any] = {"score": 1.0, "label": label}
    if metadata:
        payload["metadata"] = dict(metadata)
    return payload


def evaluate_documentation_links(output: Any, expected: Any) -> dict[str, Any]:
    """Score documentation links in the assistant text against PXI link rules.

    Reads constraints from ``expected.assistant_text``:

    - ``required_url_prefix`` (str): at least one URL must start with this prefix.
    - ``markdown_link_required`` (bool, default False): no bare ``https?://``
      URLs allowed — every URL must appear inside markdown link syntax.
    - ``forbidden_url_substrings`` (list[str]): no URL may contain any of these.
    - ``expected_url_path_substrings`` (list[str]): at least one URL must
      contain at least one of these substrings.

    Returns one of the following labels:

    - ``pass``: all configured checks passed.
    - ``not_applicable``: ``expected.assistant_text`` was not provided, so
      the evaluator has nothing to score — safe to wire alongside other
      evaluators globally.
    - ``missing_assistant_text``: the agent produced no text output.
    - ``forbidden_url``: at least one URL contained a forbidden substring.
    - ``bare_url``: ``markdown_link_required`` is true and at least one URL
      appeared outside markdown link syntax.
    - ``missing_required_prefix``: no URL started with
      ``required_url_prefix``.
    - ``missing_expected_path``: no URL contained any of the
      ``expected_url_path_substrings``.

    Precedence (most actionable first): ``forbidden_url`` > ``bare_url`` >
    ``missing_required_prefix`` > ``missing_expected_path``.
    """
    expectations = _assistant_text_expectations(expected)
    if expectations is None:
        return _success(label="not_applicable")

    text = _assistant_text(output)
    if not text:
        return _failure("missing_assistant_text", "Assistant produced no text output")

    linked_urls, bare_urls = _extract_links(text)
    all_urls = linked_urls + bare_urls

    forbidden = _string_list(expectations.get("forbidden_url_substrings"))
    forbidden_hits = [url for url in all_urls if any(substring in url for substring in forbidden)]
    if forbidden_hits:
        return _failure(
            "forbidden_url",
            f"URLs contained forbidden substrings: {forbidden_hits}",
            metadata={"urls": all_urls, "forbidden": forbidden},
        )

    if bool(expectations.get("markdown_link_required", False)) and bare_urls:
        return _failure(
            "bare_url",
            f"Bare URLs emitted outside markdown link syntax: {bare_urls}",
            metadata={"linked_urls": linked_urls, "bare_urls": bare_urls},
        )

    required_prefix = expectations.get("required_url_prefix")
    if isinstance(required_prefix, str) and required_prefix:
        if not any(url.startswith(required_prefix) for url in all_urls):
            return _failure(
                "missing_required_prefix",
                f"No URL started with required prefix {required_prefix!r}",
                metadata={"urls": all_urls, "required_url_prefix": required_prefix},
            )

    path_substrings = _string_list(expectations.get("expected_url_path_substrings"))
    if path_substrings:
        if not any(substring in url for url in all_urls for substring in path_substrings):
            return _failure(
                "missing_expected_path",
                f"No URL contained any of expected path substrings: {path_substrings}",
                metadata={"urls": all_urls, "expected_url_path_substrings": path_substrings},
            )

    return _success(metadata={"urls": all_urls})


@create_evaluator(name="documentation_links", kind="code")
def documentation_links(output: Any, expected: Any) -> dict[str, Any]:
    """Phoenix evaluator entrypoint for documentation link correctness.

    Delegates to :func:`evaluate_documentation_links`; see that function for
    label semantics and precedence. Datasets that don't define
    ``expected.assistant_text`` receive a passing ``not_applicable`` result
    so this evaluator can be wired globally without affecting other suites.
    """
    return evaluate_documentation_links(output, expected)
