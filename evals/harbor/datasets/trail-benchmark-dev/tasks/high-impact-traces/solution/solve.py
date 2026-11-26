#!/usr/bin/env python3
"""Traces with at least one high-impact trail_error span annotation."""

from harbor_verifiers.phoenix_api import client, project_spans, write_answer

spans = project_spans("research-assistant")
trace_of = {span["context"]["span_id"]: span["context"]["trace_id"] for span in spans}
annotations = client().spans.get_span_annotations(
    spans=spans, project_identifier="research-assistant", include_annotation_names=["trail_error"]
)
traces = {
    trace_of[annotation["span_id"]]
    for annotation in annotations
    if (annotation.get("result") or {}).get("score") == 1.0
}
write_answer(f"{len(traces)} of {len(set(trace_of.values()))} traces")
