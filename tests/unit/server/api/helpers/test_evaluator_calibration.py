from phoenix.server.api.helpers.evaluator_calibration import without_expected_outputs

_HUMAN = {"label": "long", "score": 5.0, "annotator_kind": "HUMAN"}
_LLM = {"label": "short", "score": 1.0, "annotator_kind": "LLM"}


def test_removes_only_the_named_human_expected_outputs() -> None:
    metadata = {
        "annotations": {"length": [_HUMAN, _LLM], "tone": [_HUMAN]},
        "source": "unit",
    }
    assert without_expected_outputs(metadata, ["length"]) == {
        "annotations": {"length": [_LLM], "tone": [_HUMAN]},
        "source": "unit",
    }
    # The input is left alone.
    assert metadata["annotations"]["length"] == [_HUMAN, _LLM]


def test_drops_a_name_whose_only_records_were_expected_outputs() -> None:
    metadata = {"annotations": {"length": [_HUMAN], "tone": [_LLM]}}
    assert without_expected_outputs(metadata, ["length", "tone"]) == {
        "annotations": {"tone": [_LLM]}
    }


def test_is_the_identity_without_matching_names_or_annotations() -> None:
    metadata = {"annotations": {"tone": [_HUMAN]}, "source": "unit"}
    assert without_expected_outputs(metadata, ["length"]) == metadata
    assert without_expected_outputs({"source": "unit"}, ["length"]) == {"source": "unit"}
    # A malformed annotations value is passed through rather than guessed at.
    assert without_expected_outputs({"annotations": [1, 2]}, ["length"]) == {"annotations": [1, 2]}
