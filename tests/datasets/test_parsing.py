import logging
from dataclasses import replace

import numpy as np
import pandas as pd
import pytest

from phoenix.datasets import EmbeddingColumnNames, Schema
from phoenix.datasets.parsing import exclude_columns_and_discover_features


def test_dataframe_columns_match_schema_columns_preserves_inputs(caplog):
    num_features = 5
    feature_column_names = [f"feature{index}" for index in range(num_features)]
    tag_column_names = [f"tag{index}" for index in range(num_features)]
    num_records = 5
    input_df = pd.DataFrame(
        {
            "prediction_id": list(range(num_records)),
            "ts": list(range(num_records)),
            "prediction_label": [f"label{index}" for index in range(num_records)],
            **{col: list(range(num_features)) for col in feature_column_names},
            **{col: ["tag" for _ in range(num_features)] for col in tag_column_names},
        }
    )
    input_schema = Schema(
        prediction_id_column_name="prediction_id",
        timestamp_column_name="ts",
        feature_column_names=feature_column_names,
        tag_column_names=tag_column_names,
        prediction_label_column_name="prediction_label",
        prediction_score_column_name=None,
        actual_label_column_name=None,
        actual_score_column_name=None,
    )
    output_df, output_schema = exclude_columns_and_discover_features(
        dataframe=input_df, schema=input_schema
    )

    assert output_df.equals(input_df)
    assert output_schema == input_schema
    assert output_schema is not input_schema  # Verify method returns a copy
    assert not _warning_logged(caplog)


def test_column_present_in_dataframe_but_missing_from_schema_is_dropped(caplog):
    num_features = 5
    feature_column_names = [f"feature{index}" for index in range(num_features)]
    tag_column_names = [f"tag{index}" for index in range(num_features)]
    num_records = 5
    input_df = pd.DataFrame(
        {
            "prediction_id": list(range(num_records)),
            "ts": list(range(num_records)),  # Included in dataframe but not in schema
            "prediction_label": [f"label{index}" for index in range(num_records)],
            **{col: list(range(num_features)) for col in feature_column_names},
            **{col: ["tag" for _ in range(num_features)] for col in tag_column_names},
        }
    )
    input_schema = Schema(
        prediction_id_column_name="prediction_id",
        timestamp_column_name=None,  # Included in dataframe but not in schema
        feature_column_names=feature_column_names,
        tag_column_names=tag_column_names,
        prediction_label_column_name="prediction_label",
        prediction_score_column_name=None,
        actual_label_column_name=None,
        actual_score_column_name=None,
    )
    expected_columns = [col for col in input_df.columns if col != "ts"]
    expected_schema = replace(input_schema, timestamp_column_name=None)
    output_df, output_schema = exclude_columns_and_discover_features(
        dataframe=input_df, schema=input_schema
    )

    assert output_df.equals(input_df[expected_columns])
    assert output_schema == expected_schema
    assert output_schema is not input_schema  # Verify method returns a copy
    assert not _warning_logged(caplog)


def test_features_as_none_and_no_excludes_discovers_features(caplog):
    num_features = 5
    tag_column_names = [f"tag{index}" for index in range(num_features)]
    num_records = 5
    input_df = pd.DataFrame(
        {
            "prediction_id": list(range(num_records)),
            "prediction_label": [f"label{index}" for index in range(num_records)],
            "feature0": np.random.rand(num_records),
            "feature1": np.random.rand(num_records),
            "feature2": np.random.rand(num_records),
        }
    )
    input_schema = Schema(
        prediction_id_column_name="prediction_id",
        timestamp_column_name=None,
        feature_column_names=None,  # Feature names should be discovered
        tag_column_names=tag_column_names,
        prediction_label_column_name="prediction_label",
        prediction_score_column_name=None,
        actual_label_column_name=None,
        actual_score_column_name=None,
        excludes=None,
    )
    expected_columns = list(input_df.columns)
    excepted_schema = replace(
        input_schema, feature_column_names=["feature0", "feature1", "feature2"]
    )
    output_df, output_schema = exclude_columns_and_discover_features(
        dataframe=input_df, schema=input_schema
    )

    assert output_df.equals(input_df[expected_columns])
    assert output_schema == excepted_schema
    assert output_schema is not input_schema  # Verify method returns a copy
    assert not _warning_logged(caplog)


def test_list_of_excludes_discovers_non_excluded_features(caplog):
    num_records = 5
    input_df = pd.DataFrame(
        {
            "prediction_id": list(range(num_records)),
            "prediction_label": [f"label{index}" for index in range(num_records)],
            "feature0": np.random.rand(num_records),
            "feature1": np.random.rand(num_records),
            "feature2": np.random.rand(num_records),
            "tag0": ["tag" for _ in range(num_records)],
            "tag1": ["tag" for _ in range(num_records)],
        }
    )
    excludes = ["prediction_label", "feature1", "tag0"]
    input_schema = Schema(
        prediction_id_column_name="prediction_id",
        timestamp_column_name=None,
        feature_column_names=None,  # Feature names should be discovered
        tag_column_names=["tag0", "tag1"],
        prediction_label_column_name="prediction_label",
        prediction_score_column_name=None,
        actual_label_column_name=None,
        actual_score_column_name=None,
        excludes=excludes,
    )
    excepted_columns = [col for col in input_df.columns if col not in excludes]
    expected_schema = replace(
        input_schema,
        prediction_label_column_name=None,  # Excluded scalar field removed
        feature_column_names=["feature0", "feature2"],  # Excluded features removed
        tag_column_names=["tag1"],  # Excluded tag removed
        excludes=None,  # Excludes discarded after parsing
    )
    output_df, output_schema = exclude_columns_and_discover_features(
        dataframe=input_df, schema=input_schema
    )

    assert output_df.equals(input_df[excepted_columns])
    assert output_schema == expected_schema
    assert output_schema is not input_schema  # Verify method returns a copy
    assert not _warning_logged(caplog)


def test_excluded_column_not_contained_in_dataframe_logs_warning(caplog):
    num_records = 5
    input_df = pd.DataFrame(
        {
            "prediction_id": list(range(num_records)),
            "prediction_label": [f"label{index}" for index in range(num_records)],
            "feature0": np.random.rand(num_records),
            "feature1": np.random.rand(num_records),
            "feature2": np.random.rand(num_records),
            "tag0": ["tag" for _ in range(num_records)],
            "tag1": ["tag" for _ in range(num_records)],
        }
    )
    excludes = ["column_not_in_dataframe"]
    input_schema = Schema(
        prediction_id_column_name="prediction_id",
        timestamp_column_name=None,
        feature_column_names=["feature0", "feature1", "feature2"],
        tag_column_names=["tag0", "tag1"],
        prediction_label_column_name="prediction_label",
        prediction_score_column_name=None,
        actual_label_column_name=None,
        actual_score_column_name=None,
        excludes=excludes,
    )
    expected_schema = replace(input_schema, excludes=None)
    output_df, output_schema = exclude_columns_and_discover_features(
        dataframe=input_df, schema=input_schema
    )

    assert output_df.equals(input_df)
    assert output_schema == expected_schema
    assert output_schema is not input_schema  # Verify method returns a copy
    assert _warning_logged(caplog)


def test_embedding_feature_all_embedding_columns_included_in_output_feature(caplog):
    num_records = 5
    input_df = pd.DataFrame(
        {
            "embedding_vector0": [np.zeros(7) for _ in range(num_records)],
            "link_to_data0": [f"some-link{index}" for index in range(num_records)],
            "raw_data_column0": [f"some-text{index}" for index in range(num_records)],
        }
    )
    input_schema = Schema(
        embedding_feature_column_names={
            "embedding_feature0": EmbeddingColumnNames(
                vector_column_name="embedding_vector0",
                link_to_data_column_name="link_to_data0",
                raw_data_column_name="raw_data_column0",
            ),
        }
    )
    expected_schema = input_schema
    output_df, output_schema = exclude_columns_and_discover_features(
        dataframe=input_df, schema=input_schema
    )

    assert output_df.equals(input_df)
    assert output_schema == expected_schema
    assert output_schema is not input_schema  # Verify method returns a copy
    assert not _warning_logged(caplog)


def test_excluded_embedding_feature_columns_are_removed(caplog):
    num_records = 5
    input_df = pd.DataFrame(
        {
            "embedding_vector0": [np.zeros(7) for _ in range(num_records)],
            "link_to_data0": [f"some-link{index}" for index in range(num_records)],
            "raw_data_column0": [f"some-text{index}" for index in range(num_records)],
            "embedding_vector1": [np.zeros(9) for _ in range(num_records)],
            "link_to_data1": [f"some-link{index}" for index in range(num_records)],
            "raw_data_column1": [f"some-text{index}" for index in range(num_records)],
        }
    )
    input_schema = Schema(
        embedding_feature_column_names={
            "embedding_feature0": EmbeddingColumnNames(
                vector_column_name="embedding_vector0",
                link_to_data_column_name="link_to_data0",
                raw_data_column_name="raw_data_column0",
            ),
            "embedding_feature1": EmbeddingColumnNames(
                vector_column_name="embedding_vector1",
                link_to_data_column_name="link_to_data1",
                raw_data_column_name="raw_data_column1",
            ),
        },
        excludes=["embedding_feature0"],
    )
    expected_schema = replace(
        input_schema,
        embedding_feature_column_names={
            "embedding_feature1": EmbeddingColumnNames(
                vector_column_name="embedding_vector1",
                link_to_data_column_name="link_to_data1",
                raw_data_column_name="raw_data_column1",
            )
        },
        excludes=None,
    )
    expected_columns = ["embedding_vector1", "link_to_data1", "raw_data_column1"]
    output_df, output_schema = exclude_columns_and_discover_features(
        dataframe=input_df, schema=input_schema
    )

    assert output_df.equals(input_df[expected_columns])
    assert output_schema == expected_schema
    assert output_schema is not input_schema  # Verify method returns a copy
    assert not _warning_logged(caplog)


def test_excluding_an_embedding_column_rather_than_the_embedding_feature_name_logs_warning(caplog):
    num_records = 5
    input_df = pd.DataFrame(
        {
            "embedding_vector0": [np.zeros(7) for _ in range(num_records)],
            "link_to_data0": [f"some-link{index}" for index in range(num_records)],
            "raw_data_column0": [f"some-text{index}" for index in range(num_records)],
        }
    )
    input_schema = Schema(
        embedding_feature_column_names={
            "embedding_feature0": EmbeddingColumnNames(
                vector_column_name="embedding_vector0",
                link_to_data_column_name="link_to_data0",
                raw_data_column_name="raw_data_column0",
            ),
        },
        excludes=["embedding_vector0"],  # Excludes embedding column rather than embedding name
    )
    expected_schema = replace(
        input_schema,
        excludes=None,
    )
    expected_columns = ["embedding_vector0", "link_to_data0", "raw_data_column0"]
    output_df, output_schema = exclude_columns_and_discover_features(
        dataframe=input_df, schema=input_schema
    )

    assert output_df.equals(input_df[expected_columns])
    assert output_schema == expected_schema
    assert output_schema is not input_schema  # Verify method returns a copy
    assert _warning_logged(caplog)


def test_excluding_embedding_feature_that_has_same_name_as_an_embedding_column_does_not_warn_user(
    caplog,
):
    num_records = 5
    input_df = pd.DataFrame(
        {
            "embedding0": [np.zeros(7) for _ in range(num_records)],
            "link_to_data0": [f"some-link{index}" for index in range(num_records)],
            "raw_data_column0": [f"some-text{index}" for index in range(num_records)],
        }
    )
    input_schema = Schema(
        embedding_feature_column_names={
            "embedding0": EmbeddingColumnNames(
                vector_column_name="embedding0",
                link_to_data_column_name="link_to_data0",
                raw_data_column_name="raw_data_column0",
            ),
        },
        excludes=["embedding0"],  # Excludes embedding column rather than embedding name
    )
    expected_schema = replace(
        input_schema,
        embedding_feature_column_names=None,
        excludes=None,
    )
    expected_columns = []
    output_df, output_schema = exclude_columns_and_discover_features(
        dataframe=input_df, schema=input_schema
    )

    assert output_df.equals(input_df[expected_columns])  # Expect empty dataframe
    assert output_schema == expected_schema
    assert output_schema is not input_schema  # Verify method returns a copy
    assert not _warning_logged(caplog)


def _warning_logged(caplog: pytest.LogCaptureFixture) -> bool:
    """
    Scans captured logs to check whether a warning is logged to the user
    """
    for record in caplog.records:
        if logging.WARNING == record.levelno:
            return True
    return False
