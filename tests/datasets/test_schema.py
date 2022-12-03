import pickle

from phoenix.datasets.schema import EmbeddingColumnNames, Schema


def test_pickle_serialization():
    s = Schema(
        feature_column_names=["feature_1"],
        embedding_feature_column_names={
            "embedding_feature": EmbeddingColumnNames(vector_column_name="embedding_vector")
        },
    )

    # Pickle and unpickle.
    p = pickle.dumps(s)
    s2 = pickle.loads(p)

    assert s == s2
    assert s.feature_column_names == s2.feature_column_names
    assert s.embedding_feature_column_names is not None
    assert s.embedding_feature_column_names["embedding_feature"] is not None
    assert (
        s.embedding_feature_column_names["embedding_feature"].vector_column_name
        == "embedding_vector"
    )
