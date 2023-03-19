import pytest
from pandas import DataFrame
from phoenix.datasets import EmbeddingColumnNames, Schema


def test_json_serialization():
    s = Schema(
        feature_column_names=["feature_1"],
        embedding_feature_column_names={
            "embedding_feature": EmbeddingColumnNames(vector_column_name="embedding_vector")
        },
    )

    # serialize and deserialize.
    p = s.to_json()
    schema_from_json = Schema.from_json(p)

    assert schema_from_json.embedding_feature_column_names is not None
    assert schema_from_json.embedding_feature_column_names["embedding_feature"] is not None
    assert (
        schema_from_json.embedding_feature_column_names["embedding_feature"].vector_column_name
        == "embedding_vector"
    )


@pytest.mark.parametrize(
    "viewable_repr",
    [
        pytest.param(
            """Schema(
    prediction_id_column_name='prediction_id',
    timestamp_column_name='timestamp',
    feature_column_names=[
        'feature_1',
        'feature_2',
    ],
    embedding_feature_column_names={
        'embedding_feature': EmbeddingColumnNames(
            vector_column_name='embedding_vector',
            raw_data_column_name='raw_data',
        ),
    },
)""",
            id="schema_string_with_all_value_types",
        ),
        pytest.param("Schema()", id="empty_schema_string"),
        pytest.param(
            """EmbeddingColumnNames(
    vector_column_name='embedding_vector',
)""",
            id="single_argument_emb_column_names_string",
        ),
        pytest.param(
            """EmbeddingColumnNames(
    vector_column_name='embedding_vector',
    raw_data_column_name='raw_data',
)""",
            id="multi_argument_emb_column_names_string",
        ),
    ],
)
def test_repr_produces_valid_code_to_instantiate_dataclass(viewable_repr) -> None:
    viewable = eval(viewable_repr)
    assert repr(viewable) == viewable_repr


@pytest.mark.parametrize(
    "viewable,expected_repr",
    [
        pytest.param(
            Schema(prediction_id_column_name=1),
            """Schema(
    prediction_id_column_name=1,
)""",
            id="schema_with_int_value",
        ),
        pytest.param(
            Schema(feature_column_names=[1, "a"]),
            """Schema(
    feature_column_names=[1, 'a'],
)""",
            id="schema_with_list_value_containing_int",
        ),
        pytest.param(
            Schema(embedding_feature_column_names={"a": 1}),
            """Schema(
    embedding_feature_column_names={'a': 1},
)""",
            id="schema_with_dict_value_without_emb_column_names",
        ),
        pytest.param(
            Schema(
                feature_column_names=DataFrame({"A": [1, 5, 3], "B": [7, 2, 8]}),
            ),
            """Schema(
    feature_column_names=   A  B
                         0  1  7
                         1  5  2
                         2  3  8,
)""",
            id="schema_with_dataframe_value",
        ),
    ],
)
def test_viewable_repr_produces_understandable_output_for_invalid_values(
    viewable, expected_repr
) -> None:
    assert repr(viewable) == expected_repr
