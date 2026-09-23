"""Human expected outputs stored on a dataset example.

An expected output is stored the way the span→example converter stores span
annotations: under ``metadata["annotations"][<annotation name>]`` as a list of
annotation records. A human expected output is the record in that list whose
``annotator_kind`` is ``HUMAN``, so an example graded in the evaluator
playground and an example built from an annotated span share one shape.
"""

from typing import Any, Iterable, Mapping, Optional

from phoenix.server.api.helpers.dataset_helpers import build_annotation_record

ANNOTATIONS_METADATA_KEY = "annotations"
TRACE_ANNOTATIONS_METADATA_KEY = "trace_annotations"
HUMAN_ANNOTATOR_KIND = "HUMAN"


def _is_expected_output(record: Any) -> bool:
    """A human annotation record that carries a label or a numeric score."""
    if not isinstance(record, Mapping):
        return False
    if record.get("annotator_kind") != HUMAN_ANNOTATOR_KIND:
        return False
    label, score = record.get("label"), record.get("score")
    has_label = isinstance(label, str)
    has_score = isinstance(score, (int, float)) and not isinstance(score, bool)
    return has_label or has_score


def get_expected_outputs(metadata: Mapping[str, Any]) -> dict[str, dict[str, Any]]:
    """The human expected output per annotation name, if the example has one.

    The last human record for a name wins, so a list that accumulated several
    human entries (for example from repeated span exports) reads as the most
    recent judgment.
    """
    annotations = metadata.get(ANNOTATIONS_METADATA_KEY)
    if not isinstance(annotations, Mapping):
        return {}
    expected: dict[str, dict[str, Any]] = {}
    for name, records in annotations.items():
        if not isinstance(name, str) or not isinstance(records, list):
            continue
        for record in records:
            if _is_expected_output(record):
                expected[name] = dict(record)
    return expected


def without_own_annotations(
    metadata: Mapping[str, Any], annotation_names: Iterable[str]
) -> dict[str, Any]:
    """Return a copy of ``metadata`` with every record under the given annotation names removed.

    An evaluator binds the whole ``metadata``, so a record under a name it is about to
    write would reach it as context: a human's expected output, or its own verdict from
    an earlier evaluation of the same example or trace.
    """
    names = set(annotation_names)
    masked = dict(metadata)
    for key in (ANNOTATIONS_METADATA_KEY, TRACE_ANNOTATIONS_METADATA_KEY):
        annotations = metadata.get(key)
        if isinstance(annotations, Mapping) and names & set(annotations):
            masked[key] = {
                name: records for name, records in annotations.items() if name not in names
            }
    return masked


def set_expected_output(
    metadata: Mapping[str, Any],
    *,
    annotation_name: str,
    label: Optional[str],
    score: Optional[float],
    explanation: Optional[str],
    user_id: Optional[str],
    username: Optional[str],
    email: Optional[str],
) -> dict[str, Any]:
    """Return a copy of ``metadata`` with the human expected output for
    ``annotation_name`` replaced, or removed when no value is given.

    Records from other annotators under the same name (an online evaluator's
    output, say) are kept untouched; only the human record is replaced.
    """
    annotations = metadata.get(ANNOTATIONS_METADATA_KEY, {})
    if not isinstance(annotations, Mapping):
        raise ValueError("Example metadata 'annotations' must be an object.")
    existing = annotations.get(annotation_name, [])
    if not isinstance(existing, list):
        raise ValueError(f"Example metadata 'annotations.{annotation_name}' must be a list.")
    records = [record for record in existing if not _is_expected_output(record)]
    if label is not None or score is not None or explanation is not None:
        records.append(
            build_annotation_record(
                label=label,
                score=score,
                explanation=explanation,
                metadata={},
                annotator_kind=HUMAN_ANNOTATOR_KIND,
                user_id=user_id,
                username=username,
                email=email,
            )
        )
    next_annotations = {**annotations}
    if records:
        next_annotations[annotation_name] = records
    else:
        next_annotations.pop(annotation_name, None)
    next_metadata = {**metadata}
    if next_annotations or ANNOTATIONS_METADATA_KEY in metadata:
        next_metadata[ANNOTATIONS_METADATA_KEY] = next_annotations
    return next_metadata
