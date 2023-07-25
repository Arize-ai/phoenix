from phoenix.datasets.schema import (
    EmbeddingColumnNames,
    RetrievalEmbeddingColumnNames,
    Schema,
)


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


def test_json_serialization_with_relationships():
    s = Schema(
        prompt_column_names=RetrievalEmbeddingColumnNames(
            vector_column_name="vec_1",
            context_retrieval_ids_column_name="ids_1",
        ),
    )

    # serialize and deserialize.
    p = s.to_json()
    schema_from_json = Schema.from_json(p)

    assert schema_from_json.prompt_column_names is not None
    assert schema_from_json.prompt_column_names.context_retrieval_ids_column_name == "ids_1"


def test_corpus_schema_normalization():
    s = Schema(
        id_column_name="id_1",
        document_column_names=EmbeddingColumnNames(
            vector_column_name="vec_1",
            raw_data_column_name="raw_1",
        ),
    )

    # In the post-init, the document should be re-mapped to the prompt
    assert s.document_column_names is None
    assert s.prompt_column_names is not None
    assert s.prompt_column_names.vector_column_name == "vec_1"
    assert s.prompt_column_names.raw_data_column_name == "raw_1"

    # The id column should be re-mapped to the prediction_id_column_name
    assert s.id_column_name is None
    assert s.prediction_id_column_name == "id_1"
