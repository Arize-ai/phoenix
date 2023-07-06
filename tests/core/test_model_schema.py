from itertools import chain
from random import random
from typing import Any, Iterable, Union

import numpy as np
import pandas as pd
import pytest
from pandas.testing import assert_series_equal
from phoenix.core.dataset_role import PRIMARY, REFERENCE, DatasetRole
from phoenix.core.dimension import Dimension
from phoenix.core.embedding import Embedding
from phoenix.core.invalid_role import InvalidRole
from phoenix.core.model_schema import ModelSchema
from phoenix.core.multi_dimensional_role import FEATURE, TAG, MultiDimensionalRole
from phoenix.core.singular_dimensional_role import (
    ACTUAL_LABEL,
    ACTUAL_SCORE,
    PREDICTION_ID,
    PREDICTION_LABEL,
    PREDICTION_SCORE,
    PROMPT,
    RESPONSE,
    TIMESTAMP,
    SingularDimensionalRole,
)

# Reverse the strings here for testing to make sure these values are not
# hardcoded internally.
prediction_id = "prediction id"[::-1]
timestamp = "timestamp"[::-1]
prediction_label = "prediction label"[::-1]
prediction_score = "prediction score"[::-1]
actual_label = "actual label"[::-1]
actual_score = "actual score"[::-1]
prompt = "prompt"[::-1]
response = "response"[::-1]


def test_role_precedence() -> None:
    schema = ModelSchema(prediction_id=prediction_id, features=[prediction_id])
    model = schema(pd.DataFrame())
    assert model[PREDICTION_ID].name == prediction_id
    assert len(list(model[FEATURE])) == 0
    schema = ModelSchema(features=[prediction_id], tags=[prediction_id])
    model = schema(pd.DataFrame())
    assert next(model[FEATURE]).name == prediction_id
    assert len(list(model[FEATURE])) == 1
    assert len(list(model[TAG])) == 0


def test_column_names_coerced_to_str():
    df = pd.DataFrame(columns=["0", 1, "2"])
    model = ModelSchema()(df)
    assert set(model[PRIMARY].columns) == set(map(str, model[PRIMARY].columns))
    assert tuple(df.columns) == ("0", 1, "2")
    assert 1 in set(df.columns) - set(model[PRIMARY].columns)


def test_df_padding():
    model = ModelSchema()(pd.DataFrame({"A": [1]}))
    ds_roles = iter(DatasetRole)
    assert not model[next(ds_roles)].empty
    for role in ds_roles:
        df = model[role]
        assert isinstance(df, pd.DataFrame)
        assert df.empty


def test_df_column_insertion():
    model = ModelSchema()(pd.DataFrame())
    for ds_role in DatasetRole:
        df = model[ds_role]
        assert model[TIMESTAMP].name in df.columns
        for dim_role in SingularDimensionalRole:
            was_inserted = model[dim_role].name in df.columns
            if dim_role in (PREDICTION_ID, TIMESTAMP):
                assert was_inserted
            else:
                assert not was_inserted


FULL_SCHEMA = ModelSchema(
    prediction_id="ID",
    timestamp="TS",
    prediction_label="A",
    prediction_score="AA",
    actual_label="B",
    actual_score="BB",
    prompt=Embedding("C", "CC"),
    response=Embedding("D", "DD", "DDD", "DDDD"),
    features=[
        "I",
        Embedding("E"),
        "J",
        Embedding("F", "FF"),
        Embedding("G", "GG", "GGG"),
        "K",
        "L",
        Embedding("H", "HH", "HHH", "HHHH"),
        "XYZ",
    ],
    tags=[
        "M",
        Embedding("R"),
        "N",
        Embedding("S", "SS"),
        Embedding("T", "TT", "TTT"),
        "OPQ",
        Embedding("U", "UU", "UUU", "UUUU"),
    ],
)


def test_iterable_column_names():
    assert set(iter(ModelSchema())) == set()
    desired_names = (
        set("ABCDEFGHIJKLMNRSTU")
        | {"ID", "TS"}
        | {"AA", "BB", "CC", "DD", "FF", "GG", "HH", "SS", "TT", "UU"}
        | {"DDD", "GGG", "HHH", "TTT", "UUU", "OPQ", "XYZ"}
    )
    assert desired_names == set(iter(FULL_SCHEMA))
    model = FULL_SCHEMA(pd.DataFrame())
    column_names = chain.from_iterable(model[Dimension])
    assert desired_names == set(column_names)


@pytest.mark.parametrize(
    "role,column_spec,display_name,series",
    [
        (PREDICTION_ID, prediction_id, "Prediction ID", pd.Series("ABCD")),
        (PREDICTION_LABEL, prediction_label, "Prediction Label", pd.Series(["10101"])),
        (PREDICTION_SCORE, prediction_score, "Prediction Score", pd.Series([0.2, 0.3, 0.1])),
        (ACTUAL_LABEL, actual_label, "Actual Label", pd.Series([False, True])),
        (ACTUAL_SCORE, actual_score, "Actual Score", pd.Series([0.1, np.nan, 0.2])),
        (
            TIMESTAMP,
            timestamp,
            "Timestamp",
            pd.to_datetime(
                ["2023-03-26 06:08:01+00:00", "2023-03-28 11:26:47+00:00", ""]
            ).to_series(),
        ),
        (
            PROMPT,
            Embedding(prompt, display_name="Prompt"),
            "Prompt",
            pd.Series([[0.1, 0.2], [0.3, 0.4]]),
        ),
        (
            RESPONSE,
            Embedding(response, display_name="Response"),
            "Response",
            pd.Series([[0.5, 0.6], [0.7, 0.8], [0.9, 1.0]]),
        ),
    ],
)
def test_singular_dimensional_role_one_df(
    role: SingularDimensionalRole,
    column_spec: Union[str, Embedding],
    display_name: str,
    series: "pd.Series[Any]",
) -> None:
    schema = ModelSchema(**{role.name.lower(): column_spec})
    for _, df in {
        "zero columns": pd.DataFrame(),
        "zero rows": pd.DataFrame({str(column_spec): pd.Series(dtype=series.dtype)}),
        "matching": pd.DataFrame({str(column_spec): series}),
        "no match": pd.DataFrame({hex(int(random() * 1e9)): series}),
    }.items():
        model = schema(df)
        for dim_role in SingularDimensionalRole:
            if dim_role is role:
                assert not model[dim_role].is_dummy
                assert model[role].display_name == display_name
                column_names_equal = 1 == len(set(map(str, (model[role], column_spec))))
                if role is TIMESTAMP and column_spec in df.columns:
                    # if the original column exists, TIME will add a new
                    # one with normalized values, so the original is not
                    # clobbered.
                    assert not column_names_equal
                else:
                    assert column_names_equal
            else:
                assert model[dim_role].is_dummy
            assert len(model[dim_role][PRIMARY]) == len(df)
            assert len(model[dim_role][REFERENCE]) == 0
        if df.empty:
            continue
        if column_spec in df.columns:
            assert_series_equal(
                model[role][PRIMARY],
                series.set_axis(
                    model[PRIMARY].index,
                    copy=False,
                ),
                check_names=False,
            )


@pytest.mark.parametrize(
    "schema,dataframes,expected_feature_names",
    [
        (ModelSchema(features="ABC"), (pd.DataFrame(),), ["ABC"]),
        (ModelSchema(features=np.array(list("ABCD"))), (pd.DataFrame(),), "ABCD"),
        (ModelSchema(features=np.array(range(5))), (pd.DataFrame(),), "01234"),
        (ModelSchema(features=pd.Index(list("ABC"))), (pd.DataFrame(),), "ABC"),
        (ModelSchema(features=pd.Index(range(3))), (pd.DataFrame(),), "012"),
        (ModelSchema(features=list("ABC")), (pd.DataFrame(),), "ABC"),
        (ModelSchema(features=list("ABC")), (pd.DataFrame({"D": []}),), "ABCD"),
        (ModelSchema(features=list("ABC")), (pd.DataFrame(), pd.DataFrame({"D": []})), "ABCD"),
        (ModelSchema(features=list("ABC")), (pd.DataFrame({"D": [], "E": []}),), "ABCDE"),
        (
            ModelSchema(features=list("ABC")),
            (pd.DataFrame({"E": []}), pd.DataFrame({"D": []})),
            "ABCDE",
        ),
        (ModelSchema(features=["A", Embedding(*"BC")]), (pd.DataFrame(),), "AB"),
        (
            ModelSchema(features=["A", Embedding(*"BC")]),
            (pd.DataFrame({"B": []}), pd.DataFrame({"C": []})),
            "AB",
        ),
        (
            ModelSchema(features=["A", Embedding(*"BD")]),
            (pd.DataFrame({"C": []}), pd.DataFrame({"D": []})),
            "ABC",
        ),
        (
            ModelSchema(features=["A", Embedding(*"BDE")]),
            (pd.DataFrame({"C": [], "E": []}), pd.DataFrame({"D": []})),
            "ABC",
        ),
        (
            ModelSchema(features=["A", Embedding(*"BDE")], tags=["C"]),
            (pd.DataFrame({"C": [], "E": []}), pd.DataFrame({"D": []})),
            "AB",
        ),
    ],
)
def test_feature_names(
    schema: ModelSchema,
    dataframes: Iterable[pd.DataFrame],
    expected_feature_names: Iterable[str],
) -> None:
    model = schema(*dataframes)
    assert sorted(map(str, model[FEATURE])) == sorted(expected_feature_names)


@pytest.mark.parametrize(
    "schema,dataframes,expected_tag_names",
    [
        (ModelSchema(tags="ABC"), (pd.DataFrame(),), ["ABC"]),
        (ModelSchema(tags=np.array(list("ABCD"))), (pd.DataFrame(),), "ABCD"),
        (ModelSchema(tags=np.array(range(5))), (pd.DataFrame(),), "01234"),
        (ModelSchema(tags=pd.Index(list("ABC"))), (pd.DataFrame(),), "ABC"),
        (ModelSchema(tags=pd.Index(range(3))), (pd.DataFrame(),), "012"),
        (ModelSchema(tags=list("ABC")), (pd.DataFrame(),), "ABC"),
        (ModelSchema(tags=list("ABC")), (pd.DataFrame({"D": []}),), "ABC"),
        (ModelSchema(tags=list("ABC")), (pd.DataFrame(), pd.DataFrame({"D": []})), "ABC"),
        (ModelSchema(tags=list("ABC")), (pd.DataFrame({"D": [], "E": []}),), "ABC"),
        (ModelSchema(tags=list("ABC")), (pd.DataFrame({"E": []}), pd.DataFrame({"D": []})), "ABC"),
        (ModelSchema(tags=["A", Embedding(*"BC")]), (pd.DataFrame(),), "AB"),
        (
            ModelSchema(tags=["A", Embedding(*"BC")]),
            (pd.DataFrame({"B": []}), pd.DataFrame({"C": []})),
            "AB",
        ),
        (
            ModelSchema(tags=["A", Embedding(*"BD")]),
            (pd.DataFrame({"C": []}), pd.DataFrame({"D": []})),
            "AB",
        ),
        (
            ModelSchema(tags=["A", Embedding(*"BDE")]),
            (pd.DataFrame({"C": [], "E": []}), pd.DataFrame({"D": []})),
            "AB",
        ),
    ],
)
def test_tag_names(
    schema: ModelSchema,
    dataframes: Iterable[pd.DataFrame],
    expected_tag_names: Iterable[str],
) -> None:
    model = schema(*dataframes)
    assert sorted(map(str, model[TAG])) == sorted(expected_tag_names)


@pytest.mark.parametrize(
    "schema,dataframes",
    [
        (ModelSchema(), ()),
        (ModelSchema(), [pd.DataFrame()] * (1 + len(DatasetRole))),
    ],
)
def test_wrong_number_of_df(
    schema: ModelSchema,
    dataframes: Iterable[pd.DataFrame],
) -> None:
    with pytest.raises(ValueError):
        schema(*dataframes)


def test_scalar_dimensions_extraction() -> None:
    assert dict(
        map(
            lambda dim: (str(dim), dim.role),
            ModelSchema(
                prediction_id="A",
                timestamp="B",
                features=["C", Embedding("E")],
                tags=[Embedding("F"), "D"],
                prompt=Embedding("G"),
                response=Embedding("H"),
            )(pd.DataFrame(columns=list("ABC"))).scalar_dimensions,
        )
    ) == {"C": FEATURE, "D": TAG}


def test_embedding_dimensions_extraction() -> None:
    assert dict(
        map(
            lambda dim: (str(dim), dim.role),
            ModelSchema(
                prediction_id="A",
                timestamp="B",
                features=["C", Embedding("E")],
                tags=[Embedding("F"), "D"],
                prompt=Embedding("G"),
            )(pd.DataFrame(columns=list("ABC"))).embedding_dimensions,
        )
    ) == {"E": FEATURE, "F": TAG, "G": PROMPT}


def test_raise_if_dim_role_is_unassigned():
    with pytest.raises(ValueError):
        _ = Dimension()
    for role in InvalidRole:
        with pytest.raises(ValueError):
            _ = Dimension(role=role)
    for role in SingularDimensionalRole:
        _ = Dimension(role=role)
    for role in MultiDimensionalRole:
        _ = Dimension(role=role)


@pytest.mark.parametrize(
    "schema",
    [
        ModelSchema(),
        ModelSchema(prediction_id="ID"),
        ModelSchema(timestamp="TS"),
        ModelSchema(prediction_label="A"),
        ModelSchema(prediction_score="AA"),
        ModelSchema(actual_label="B"),
        ModelSchema(actual_score="BB"),
        ModelSchema(prompt=Embedding("C")),
        ModelSchema(prompt=Embedding("C", "CC")),
        ModelSchema(prompt=Embedding("C", "CC", "CCC")),
        ModelSchema(prompt=Embedding("C", "CC", "CCC", "CCCC")),
        ModelSchema(response=Embedding("D")),
        ModelSchema(response=Embedding("D", "DD")),
        ModelSchema(response=Embedding("D", "DD", "DDD")),
        ModelSchema(response=Embedding("D", "DD", "DDD", "DDDD")),
        ModelSchema(features=FULL_SCHEMA.features),
        ModelSchema(tags=FULL_SCHEMA.tags),
        FULL_SCHEMA,
    ],
)
def test_schema_to_json(schema: ModelSchema):
    assert schema == ModelSchema.from_json(schema.to_json())
