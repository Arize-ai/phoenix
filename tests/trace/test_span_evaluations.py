from itertools import chain, combinations
from random import random

import pandas as pd
import pytest
from pandas.testing import assert_frame_equal
from phoenix.trace.span_evaluations import (
    EVAL_NAME_COLUMN_PREFIX,
    DocumentEvaluations,
    SpanEvaluations,
)


def test_span_evaluations_construction():
    num_records = 5
    span_ids = [f"span_{index}" for index in range(num_records)]

    eval_ds = SpanEvaluations(
        eval_name="my_eval",
        dataframe=pd.DataFrame(
            {
                "context.span_id": span_ids,
                "label": [str(index) for index in range(num_records)],
                "score": [index for index in range(num_records)],
                "random_column": [index for index in range(num_records)],
            }
        ).set_index("context.span_id"),
    )

    # make sure the dataframe only has the needed values
    assert "context.span_id" not in eval_ds.dataframe.columns
    assert "random_column" not in eval_ds.dataframe.columns
    assert "score" in eval_ds.dataframe.columns


def power_set(s):
    for result in chain.from_iterable(combinations(s, r) for r in range(len(s) + 1)):
        yield dict(result)


RESULTS = list(power_set(list({"score": 0, "label": "1", "explanation": "2"}.items())))
BAD_RESULTS = list(power_set(list({"score": "0", "label": 1, "explanation": 2}.items())))


@pytest.mark.parametrize("span_id", [None, "span_id", "context.span_id"])
@pytest.mark.parametrize("position", [None, "position", "document_position"])
@pytest.mark.parametrize("result", RESULTS)
def test_document_evaluations_construction(span_id, position, result):
    eval_name = "my_eval"
    rand1, rand2 = random(), random()
    df = pd.DataFrame([{**result, **{span_id: "x", position: 0, rand1: rand1, rand2: rand2}}])
    if not result or not span_id or not position:
        with pytest.raises(ValueError):
            DocumentEvaluations(eval_name=eval_name, dataframe=df)
        return
    desired = (
        df.drop([rand1, rand2], axis=1, errors="ignore")
        .set_index([span_id, position])
        .rename_axis(["context.span_id", "document_position"])
        .add_prefix(f"{EVAL_NAME_COLUMN_PREFIX}{eval_name}.")
    )
    for idx in (
        [],
        [rand1],
        [span_id],
        [position],
        [span_id, position],
        [position, span_id],
        [span_id, position, rand1],
    ):
        doc_evals = DocumentEvaluations(
            eval_name=eval_name,
            dataframe=df.set_index(idx, drop=False) if idx else df,
        )
        assert bool(doc_evals)
        assert doc_evals.eval_name == eval_name
        actual = doc_evals.get_dataframe(prefix_columns_with_name=True)
        assert_frame_equal(actual, desired)


@pytest.mark.parametrize("result", BAD_RESULTS)
def test_document_evaluations_bad_results(result):
    eval_name = "my_eval"
    df = pd.DataFrame([{**result, **{"span_id": "x", "position": 0}}])
    with pytest.raises(ValueError):
        DocumentEvaluations(eval_name=eval_name, dataframe=df)


def test_document_evaluations_edge_cases():
    eval_name = "my_eval"
    # empty should be fine
    df = pd.DataFrame()
    doc_evals = DocumentEvaluations(eval_name=eval_name, dataframe=df)
    assert not bool(doc_evals)
    assert doc_evals.eval_name == eval_name
    actual = doc_evals.get_dataframe()
    assert actual.shape == (0, 0)
