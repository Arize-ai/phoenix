from typing import Any, Dict, List

import pytest

from phoenix.evals.metrics import PrecisionRecallFScore


def _scores_by_name(scores: List[Any]) -> Dict[str, float]:
    return {s.name: s.score for s in scores}


@pytest.mark.parametrize(
    "description, kwargs, expected, output, expected_names, expected_scores, expects_exception",
    [
        pytest.param(
            "binary ints default positive=1",
            dict(beta=1.0),
            [0, 1, 1, 0, 1],
            [0, 1, 0, 0, 1],
            ["precision", "recall", "f1"],
            dict(precision=1.0, recall=2 / 3, f1=0.8),
            False,
            id="binary-default-positive",
        ),
        pytest.param(
            "binary strings with explicit positive label and beta=0.5",
            dict(beta=0.5, positive_label="spam"),
            ["spam", "ham", "spam", "ham"],
            ["spam", "spam", "ham", "ham"],
            ["precision", "recall", "f0_5"],
            dict(precision=0.5, recall=0.5, f0_5=0.5),
            False,
            id="binary-explicit-positive",
        ),
        pytest.param(
            "multiclass macro averaging (default names)",
            dict(beta=1.0, average="macro"),
            ["a", "b", "a", "c"],
            ["a", "a", "a", "c"],
            ["precision", "recall", "f1"],
            # Macro F1 averages per-class F1 (sklearn semantics), not F1 of the
            # aggregated P/R. Per class: a P=2/3 R=1 F1=0.8; b P=0 R=0 F1=0;
            # c P=1 R=1 F1=1 -> mean = (0.8 + 0 + 1) / 3 = 0.6.
            dict(precision=5 / 9, recall=2 / 3, f1=0.6),
            False,
            id="multiclass-macro",
        ),
        pytest.param(
            "multiclass micro averaging (suffix names)",
            dict(beta=1.0, average="micro"),
            ["a", "b", "a", "c"],
            ["a", "a", "a", "c"],
            ["precision_micro", "recall_micro", "f1_micro"],
            dict(precision_micro=0.75, recall_micro=0.75, f1_micro=0.75),
            False,
            id="multiclass-micro",
        ),
        pytest.param(
            "multiclass weighted averaging (suffix names)",
            dict(beta=1.0, average="weighted"),
            ["a", "b", "a", "c"],
            ["a", "a", "a", "c"],
            ["precision_weighted", "recall_weighted", "f1_weighted"],
            # Weighted F1 is the support-weighted mean of per-class F1 (sklearn
            # semantics). Supports a=2, b=1, c=1; per-class F1 0.8, 0, 1 ->
            # (0.8*2 + 0*1 + 1*1) / 4 = 0.65.
            dict(precision_weighted=7 / 12, recall_weighted=3 / 4, f1_weighted=0.65),
            False,
            id="multiclass-weighted",
        ),
        pytest.param(
            "zero_division set to 1.0 affects undefined precision",
            dict(beta=1.0, average="macro", zero_division=1.0),
            ["a", "b"],
            ["a", "a"],
            ["precision", "recall", "f1"],
            # For class 'b': precision undefined -> 1.0, recall = 0.0
            # Per-class precision: a: TP=1, FP=1 -> 1/(1+1)=0.5; b: 1.0
            # Macro P=(0.5+1.0)/2=0.75; Macro R=(1.0+0.0)/2=0.5.
            # Macro F1 averages per-class F1 (sklearn semantics):
            # a: F1=2*0.5*1/(0.5+1)=2/3; b: F1=0 (recall 0) -> mean=1/3.
            dict(precision=0.75, recall=0.5, f1=1 / 3),
            False,
            id="zero-division-custom",
        ),
        pytest.param(
            "beta=2 naming and values (micro)",
            dict(beta=2.0, average="micro"),
            ["x", "y", "z"],
            ["x", "y", "x"],
            ["precision_micro", "recall_micro", "f2_micro"],
            # accuracy = 2/3; precision_micro=recall_micro=2/3; f2 = (1+4)*(2/3)*(2/3)/(4*(2/3)+(2/3)) = 5*(4/9)/(10/3) = (20/9)*(3/10)=2/3
            dict(precision_micro=2 / 3, recall_micro=2 / 3, f2_micro=2 / 3),
            False,
            id="beta-2-micro-naming",
        ),
        # The following three cases lock in scikit-learn `average` semantics for
        # macro/weighted F: F is averaged per class, not derived from the
        # aggregated precision/recall. Expected values match
        # sklearn.metrics.precision_recall_fscore_support (verified offline; no
        # sklearn dependency is added to the test).
        pytest.param(
            "multiclass macro F matches sklearn (per-class F averaged)",
            dict(beta=1.0, average="macro"),
            ["cat", "dog", "cat", "bird"],
            ["cat", "cat", "cat", "bird"],
            ["precision", "recall", "f1"],
            # Per class: cat P=2/3 R=1 F1=0.8; dog P=0 R=0 F1=0; bird P=1 R=1 F1=1
            # macro P=5/9, R=2/3, F1=(0.8+0+1)/3=0.6 (sklearn: 0.6).
            dict(precision=5 / 9, recall=2 / 3, f1=0.6),
            False,
            id="multiclass-macro-sklearn-parity",
        ),
        pytest.param(
            "multiclass weighted F matches sklearn (support-weighted per-class F)",
            dict(beta=1.0, average="weighted"),
            ["cat", "dog", "cat", "bird"],
            ["cat", "cat", "cat", "bird"],
            ["precision_weighted", "recall_weighted", "f1_weighted"],
            # Supports cat=2, dog=1, bird=1; per-class F1 0.8, 0, 1
            # weighted F1=(0.8*2+0*1+1*1)/4=0.65 (sklearn: 0.65).
            dict(precision_weighted=7 / 12, recall_weighted=3 / 4, f1_weighted=0.65),
            False,
            id="multiclass-weighted-sklearn-parity",
        ),
        pytest.param(
            "multiclass macro F-beta (beta=2) matches sklearn",
            dict(beta=2.0, average="macro"),
            ["cat", "dog", "cat", "bird"],
            ["cat", "cat", "cat", "bird"],
            ["precision", "recall", "f2"],
            # Per-class F2: cat=(5*(2/3)*1)/(4*(2/3)+1)=10/11; dog=0; bird=1
            # macro F2=(10/11+0+1)/3=7/11 (sklearn: 0.6363636...).
            dict(precision=5 / 9, recall=2 / 3, f2=7 / 11),
            False,
            id="multiclass-macro-beta2-sklearn-parity",
        ),
        pytest.param(
            "0/1 labels with a non-macro average must not auto-detect a positive "
            "label; average must be honored instead",
            dict(beta=1.0, average="micro"),
            [0, 1, 1, 0, 1],
            [0, 1, 0, 0, 1],
            ["precision_micro", "recall_micro", "f1_micro"],
            # label0: TP=2,FP=1,FN=0; label1: TP=2,FP=0,FN=1. Pooled: TP=4,
            # FP=1,FN=1 -> precision=recall=f1=4/5=0.8. If auto-detection were
            # not gated on "macro", this would incorrectly use binary
            # positive_label=1 scoring (precision=1.0, recall=2/3) instead.
            dict(precision_micro=0.8, recall_micro=0.8, f1_micro=0.8),
            False,
            id="binary-labels-non-macro-average-not-auto-detected",
        ),
    ],
)
def test_precision_recall_fscore_success(
    description: str,
    kwargs: Dict[str, Any],
    expected: List[Any],
    output: List[Any],
    expected_names: List[str],
    expected_scores: Dict[str, float],
    expects_exception: bool,
) -> None:
    evaluator = PrecisionRecallFScore(**kwargs)
    scores = evaluator.evaluate({"expected": expected, "output": output})
    names = [s.name for s in scores]
    assert names == expected_names
    by_name = _scores_by_name(scores)
    for key, expected in expected_scores.items():
        assert by_name[key] == pytest.approx(expected, rel=1e-6, abs=1e-12)


@pytest.mark.parametrize(
    "description, kwargs, expected, output, expects_exception",
    [
        pytest.param(
            "single string input should error",
            dict(),
            "cat",
            ["cat"],
            True,
            id="error-single-string",
        ),
        pytest.param(
            "unhashable label should error",
            dict(),
            [[1], [0]],
            [[1], [1]],
            True,
            id="error-unhashable-label",
        ),
        pytest.param(
            "length mismatch",
            dict(),
            [1, 0, 1],
            [1, 0],
            True,
            id="error-length-mismatch",
        ),
        pytest.param(
            "empty inputs",
            dict(),
            [],
            [],
            True,
            id="error-empty",
        ),
        pytest.param(
            "positive_label not present",
            dict(positive_label="pos"),
            ["a", "a"],
            ["a", "a"],
            True,
            id="error-positive-not-present",
        ),
    ],
)
def test_precision_recall_fscore_errors(
    description: str,
    kwargs: Dict[str, Any],
    expected: Any,
    output: Any,
    expects_exception: bool,
) -> None:
    evaluator = PrecisionRecallFScore(**kwargs)
    # Evaluators now raise exceptions instead of returning an ERROR score
    with pytest.raises(ValueError):
        _ = evaluator.evaluate({"expected": expected, "output": output})
