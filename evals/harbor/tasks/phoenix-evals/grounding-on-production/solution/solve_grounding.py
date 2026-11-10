#!/usr/bin/env python3
"""Reference solution: one grounding label per LLM span, from the planted defects.

The oracle makes no model calls; it labels the planted traces as a stand-in for a judge.
"""

from __future__ import annotations

from harbor_verifiers.phoenix_api import client, project_spans

PROJECT = "mobile-review-queue"
UNGROUNDED = {
    "530665444fbec6b047139a9b506f8859",
    "66074030e122d91dcb2ef3a3111e37fb",
    "8b3f5b1f7b0fac4b6a24eb131210b072",
    "825243c374db874efe4f16cd94cafd19",
}


def main() -> None:
    llm_spans = [s for s in project_spans(PROJECT) if s["span_kind"].upper() == "LLM"]
    client().spans.log_span_annotations(
        span_annotations=[
            {
                "span_id": span["context"]["span_id"],
                "name": "unsupported_claims",
                "annotator_kind": "LLM",
                "result": {
                    "label": "unsupported"
                    if span["context"]["trace_id"] in UNGROUNDED
                    else "supported",
                    "explanation": "Stand-in judgment from the planted defects.",
                },
            }
            for span in llm_spans
        ],
        sync=True,
    )


if __name__ == "__main__":
    main()
