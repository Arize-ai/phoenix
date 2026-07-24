from __future__ import annotations

from typing import Any

from evals.pxi.evaluators.links import evaluate_documentation_links
from evals.pxi.evaluators.tools import evaluate_documentation_tools_used


def _link_output(assistant_text: str | None) -> dict[str, Any]:
    return {"assistant_text": assistant_text}


def _expected(domain: str = "https://arize.com/docs/phoenix") -> dict[str, Any]:
    return {"tools": {"required": []}, "links": {"canonical_docs_domain": domain}}


class TestDocumentationLinksValid:
    def test_canonical_docs_markdown_link_passes(self) -> None:
        result = evaluate_documentation_links(
            output=_link_output(
                "Install Phoenix from the "
                "[local install guide](https://arize.com/docs/phoenix/self-hosting)."
            ),
            expected=_expected(),
        )
        assert result["score"] == 1.0
        assert result["label"] == "pass"

    def test_canonical_docs_link_with_root_relative_app_link_passes(self) -> None:
        result = evaluate_documentation_links(
            output=_link_output(
                "Configure auth from [settings](/settings/general) and review "
                "[authentication docs](https://arize.com/docs/phoenix/self-hosting/authentication)."
            ),
            expected=_expected(),
        )
        assert result["score"] == 1.0
        assert result["label"] == "pass"
        assert result["metadata"]["root_relative_hrefs"] == ["/settings/general"]

    def test_relative_markdown_docs_link_fails(self) -> None:
        result = evaluate_documentation_links(
            output=_link_output("See the [tracing docs](/tracing/llm-traces)."),
            expected=_expected(),
        )
        assert result["score"] == 0.0
        assert result["label"] == "fail"
        assert result["metadata"]["invalid_documentation_hrefs"] == ["/tracing/llm-traces"]

    def test_non_canonical_docs_domain_fails(self) -> None:
        result = evaluate_documentation_links(
            output=_link_output(
                "See the [tracing docs](https://arizeai-433a7140.mintlify.app/phoenix/tracing)."
            ),
            expected=_expected(),
        )
        assert result["label"] == "fail"
        assert result["metadata"]["invalid_documentation_hrefs"] == [
            "https://arizeai-433a7140.mintlify.app/phoenix/tracing"
        ]

    def test_bare_docs_url_fails(self) -> None:
        result = evaluate_documentation_links(
            output=_link_output("See https://arize.com/docs/phoenix/tracing/llm-traces."),
            expected=_expected(),
        )
        assert result["label"] == "fail"
        assert result["metadata"]["bare_urls"] == [
            "https://arize.com/docs/phoenix/tracing/llm-traces."
        ]

    def test_missing_assistant_text_fails(self) -> None:
        result = evaluate_documentation_links(output=_link_output(None), expected=_expected())
        assert result["score"] == 0.0
        assert result["label"] == "fail"
        assert result["metadata"]["canonical_docs_domain"] == "https://arize.com/docs/phoenix"


def _tool_output(*tool_names: str) -> dict[str, Any]:
    return {
        "messages": [
            {
                "kind": "response",
                "parts": [
                    {"part_kind": "tool-call", "tool_name": name, "args": {}} for name in tool_names
                ],
            }
        ]
    }


class TestDocumentationToolsUsed:
    def test_search_docs_tool_passes(self) -> None:
        result = evaluate_documentation_tools_used(
            output=_tool_output("search_phoenix"),
            expected=_expected(),
        )
        assert result["score"] == 1.0
        assert result["label"] == "pass"
        assert result["metadata"]["observed_documentation_tools"] == ["search_phoenix"]

    def test_docs_filesystem_tool_passes(self) -> None:
        result = evaluate_documentation_tools_used(
            output=_tool_output("query_docs_filesystem_phoenix"),
            expected=_expected(),
        )
        assert result["score"] == 1.0
        assert result["label"] == "pass"

    def test_missing_docs_tool_fails(self) -> None:
        result = evaluate_documentation_tools_used(
            output=_tool_output("set_spans_filter"),
            expected=_expected(),
        )
        assert result["score"] == 0.0
        assert result["label"] == "fail"
        assert result["metadata"]["observed_tools"] == ["set_spans_filter"]
