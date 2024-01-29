import json
from itertools import chain, combinations
from random import random
from uuid import uuid4

import pandas as pd
import pyarrow
import pytest
from pandas.testing import assert_frame_equal
from phoenix.trace import DocumentEvaluations, Evaluations, SpanEvaluations
from phoenix.trace.span_evaluations import (
    EVAL_NAME_COLUMN_PREFIX,
    InvalidParquetMetadataError,
    _parse_schema_metadata,
)
from pyarrow import parquet


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


def test_span_evaluations_save_and_load_preserves_data(tmp_path):
    num_records = 5
    span_ids = [f"span_{index}" for index in range(num_records)]
    dataframe = pd.DataFrame(
        {
            "context.span_id": span_ids,
            "label": [str(index) for index in range(num_records)],
            "score": [index for index in range(num_records)],
        }
    ).set_index("context.span_id")
    evals = SpanEvaluations(
        eval_name="eval-name",
        dataframe=dataframe,
    )
    eval_id = evals.save(tmp_path)
    table = parquet.read_table(tmp_path / f"evaluations-{eval_id}.parquet")
    arize_metadata = json.loads(table.schema.metadata[b"arize"])

    assert_frame_equal(table.to_pandas(), evals.dataframe)
    assert set(arize_metadata.keys()) == {"eval_id", "eval_name", "eval_type"}
    assert arize_metadata["eval_name"] == "eval-name"
    assert arize_metadata["eval_type"] == "SpanEvaluations"
    assert arize_metadata["eval_id"] == str(evals.id)

    read_evals = Evaluations.load(eval_id, tmp_path)
    assert isinstance(read_evals, SpanEvaluations)
    assert_frame_equal(read_evals.dataframe, dataframe)
    assert read_evals.eval_name == "eval-name"
    assert read_evals.id == evals.id


def test_document_evaluations_save_and_load_preserves_data(tmp_path):
    dataframe = pd.DataFrame(
        {
            "context.span_id": ["span_1", "span_1", "span_2"],
            "document_position": [0, 1, 0],
            "score": [1, 1, 0],
            "label": ["relevant", "relevant", "irrelevant"],
            "explanation": ["it's apropos", "it's germane", "it's rubbish"],
        }
    ).set_index(["context.span_id", "document_position"])
    evals = DocumentEvaluations(
        eval_name="eval-name",
        dataframe=dataframe,
    )
    eval_id = evals.save(tmp_path)
    table = parquet.read_table(tmp_path / f"evaluations-{eval_id}.parquet")
    arize_metadata = json.loads(table.schema.metadata[b"arize"])

    assert_frame_equal(table.to_pandas(), evals.dataframe)
    assert arize_metadata["eval_name"] == "eval-name"
    assert arize_metadata["eval_type"] == "DocumentEvaluations"
    assert arize_metadata["eval_id"] == str(evals.id)

    read_evals = Evaluations.load(eval_id, tmp_path)
    assert isinstance(read_evals, DocumentEvaluations)
    assert_frame_equal(read_evals.dataframe, dataframe)
    assert read_evals.eval_name == "eval-name"
    assert read_evals.id == evals.id


def test_evaluations_load_raises_error_when_input_id_does_not_match_metadata(tmp_path):
    num_records = 5
    span_ids = [f"span_{index}" for index in range(num_records)]
    dataframe = pd.DataFrame(
        {
            "context.span_id": span_ids,
            "label": [str(index) for index in range(num_records)],
            "score": [index for index in range(num_records)],
        }
    ).set_index("context.span_id")
    evals = SpanEvaluations(
        eval_name="eval-name",
        dataframe=dataframe,
    )
    eval_id = evals.save(tmp_path)
    updated_id = uuid4()
    (tmp_path / f"evaluations-{eval_id}.parquet").rename(
        tmp_path / f"evaluations-{updated_id}.parquet"
    )  # move the file so the metadata id no longer matches the file name

    with pytest.raises(InvalidParquetMetadataError):
        Evaluations.load(updated_id, tmp_path)


def test_parse_schema_metadata_raise_error_on_invalid_metadata():
    schema = pyarrow.schema(
        [
            pyarrow.field("label", pyarrow.string()),
        ],
    ).with_metadata(
        {
            b"arize": json.dumps(
                {
                    "eval_id": "2956d001-e2e1-4f22-8e32-1b4930510803",
                    "eval_name": "eval-name",
                    "eval_type": "NonExistentType",
                }
            )
        }
    )
    with pytest.raises(InvalidParquetMetadataError):
        _parse_schema_metadata(schema)
