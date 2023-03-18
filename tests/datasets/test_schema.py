import pytest
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


class TestViewable:
    SCHEMA_STRING_WITH_ALL_VALUE_TYPES = """Schema(
    prediction_id_column_name="prediction_id",
    timestamp_column_name="timestamp",
    feature_column_names=[
        "feature_1",
        "feature_2",
    ],
    embedding_feature_column_names={
        "embedding_feature": EmbeddingColumnNames(
            vector_column_name="embedding_vector",
            raw_data_column_name="raw_data",
        ),
    },
)"""
    SINGLE_ARGUMENT_EMB_COLUMN_NAMES_STRING = """EmbeddingColumnNames(
    vector_column_name="embedding_vector",
)"""
    MULTI_ARGUMENT_EMB_COLUMN_NAMES_STRING = """EmbeddingColumnNames(
    vector_column_name="embedding_vector",
    raw_data_column_name="raw_data",
)"""

    @pytest.mark.parametrize(
        "viewable_repr",
        [
            pytest.param(
                SCHEMA_STRING_WITH_ALL_VALUE_TYPES, id="schema_string_with_all_value_types"
            ),
            pytest.param("Schema()", id="empty_schema_string"),
            pytest.param(
                SINGLE_ARGUMENT_EMB_COLUMN_NAMES_STRING,
                id="single_argument_emb_column_names_string",
            ),
            pytest.param(
                MULTI_ARGUMENT_EMB_COLUMN_NAMES_STRING, id="multi_argument_emb_column_names_string"
            ),
        ],
    )
    def test_viewable_repr_produces_valid_code_to_instantiate_dataclass(
        self, viewable_repr
    ) -> None:
        viewable = eval(viewable_repr)
        assert repr(viewable) == viewable_repr
