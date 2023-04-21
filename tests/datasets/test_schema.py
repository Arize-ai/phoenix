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


def test_json_serialization_with_LLM():
    s = Schema(
        feature_column_names=["feature_1"],
        prompt_column_names=EmbeddingColumnNames(
            vector_column_name="prompt_vector",
            raw_data_column_name="prompt_text",
        ),
        response_column_names=EmbeddingColumnNames(
            vector_column_name="response_vector",
            raw_data_column_name="response_text",
        ),
    )

    # serialize and deserialize.
    p = s.to_json()
    schema_from_json = Schema.from_json(p)

    assert schema_from_json.prompt_column_names is not None
    assert schema_from_json.prompt_column_names.vector_column_name == "prompt_vector"
    assert schema_from_json.response_column_names is not None
    assert schema_from_json.response_column_names.vector_column_name == "response_vector"
