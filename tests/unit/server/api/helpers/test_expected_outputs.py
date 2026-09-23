from phoenix.server.api.helpers.expected_outputs import without_own_annotations

_HUMAN = {"label": "long", "score": 5.0, "annotator_kind": "HUMAN"}
_LLM = {"label": "short", "score": 1.0, "annotator_kind": "LLM"}


def test_removes_every_record_under_the_named_annotations() -> None:
    annotations = {"length": [_HUMAN, _LLM], "tone": [_HUMAN]}
    metadata = {"annotations": annotations, "source": "unit"}
    assert without_own_annotations(metadata, ["length"]) == {
        "annotations": {"tone": [_HUMAN]},
        "source": "unit",
    }
    # The input is left alone.
    assert annotations["length"] == [_HUMAN, _LLM]


def test_drops_every_named_annotation() -> None:
    metadata = {"annotations": {"length": [_HUMAN], "tone": [_LLM]}}
    assert without_own_annotations(metadata, ["length", "tone"]) == {"annotations": {}}


def test_is_the_identity_without_matching_names_or_annotations() -> None:
    metadata = {"annotations": {"tone": [_HUMAN]}, "source": "unit"}
    assert without_own_annotations(metadata, ["length"]) == metadata
    assert without_own_annotations({"source": "unit"}, ["length"]) == {"source": "unit"}
    # A malformed annotations value is passed through rather than guessed at.
    assert without_own_annotations({"annotations": [1, 2]}, ["length"]) == {"annotations": [1, 2]}


def test_removes_the_named_trace_annotations() -> None:
    metadata = {"trace_annotations": {"length": [_LLM], "tone": [_HUMAN]}, "events": []}
    assert without_own_annotations(metadata, ["length"]) == {
        "trace_annotations": {"tone": [_HUMAN]},
        "events": [],
    }
