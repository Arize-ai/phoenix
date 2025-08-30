from collections.abc import Mapping
from typing import Any

from phoenix.client.__generated__ import v1

from .constants import VALID_ANNOTATOR_KINDS


def _coerce_span_annotation(data: Mapping[str, Any]) -> v1.SpanAnnotationData:
    """Takes a un-typed data mapping and coerces it to a span annotation input"""
    name = data.get("name") or data.get("annotation_name")
    if not name:
        raise ValueError("an annotation must have a name")
    if not isinstance(name, str):
        raise ValueError("An annotation's name must ba a string")
    span_id = data.get("span_id")
    if not span_id:
        raise ValueError("A span annotation must have a span_id")
    if not isinstance(span_id, str):
        raise ValueError("A span id must be a string")
    annotator_kind = data.get("annotator_kind") or data.get("kind") or "HUMAN"
    annotator_kind = annotator_kind.upper()
    if annotator_kind not in ("LLM", "CODE", "HUMAN"):
        raise ValueError(
            f"annotator kind is invalid. Got {annotator_kind}."
            f" Must be {', '.join(VALID_ANNOTATOR_KINDS)}"
        )

    return v1.SpanAnnotationData(name=name, span_id=span_id, annotator_kind=annotator_kind)
