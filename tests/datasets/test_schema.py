from phoenix.datasets import EmbeddingColumnNames, Schema


def test_json_serialization():
    schema = Schema(
        feature_column_names=["feature_1"],
        embedding_feature_column_names={
            "embedding_feature": EmbeddingColumnNames(vector_column_name="embedding_vector")
        },
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
    schema_from_json = Schema.from_json(schema.to_json())

    assert schema_from_json == schema
