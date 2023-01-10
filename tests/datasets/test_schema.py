#                  Copyright 2023 Arize AI and contributors.
#                   Licensed under the Elastic License 2.0;
# you may not use this file except in compliance with the Elastic License 2.0.

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
