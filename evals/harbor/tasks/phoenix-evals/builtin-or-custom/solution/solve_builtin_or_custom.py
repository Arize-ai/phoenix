#!/usr/bin/env python3
"""Reference solution: a code check for unsupported dollar amounts and a friction label.

The oracle makes no model calls; the friction labels stand in for the built-in judge.
"""

from __future__ import annotations

import re

from harbor_verifiers.phoenix_api import client, project_spans

PROJECT = "mobile-review-queue"
DOLLARS = re.compile(r"\$\s?\d")


def main() -> None:
    llm_spans = [s for s in project_spans(PROJECT) if s["span_kind"].upper() == "LLM"]
    annotations = []
    for span in llm_spans:
        output = str((span.get("attributes") or {}).get("output.value", ""))
        span_id = span["context"]["span_id"]
        annotations.append(
            {
                "span_id": span_id,
                "name": "unsupported_dollar_amount",
                "annotator_kind": "CODE",
                "result": {"label": "yes" if DOLLARS.search(output) else "no"},
            }
        )
        annotations.append(
            {
                "span_id": span_id,
                "name": "user_friction",
                "annotator_kind": "LLM",
                "result": {"label": "no_friction", "explanation": "Stand-in judgment."},
            }
        )
    client().spans.log_span_annotations(span_annotations=annotations, sync=True)


if __name__ == "__main__":
    main()
