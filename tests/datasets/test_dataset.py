"""
Test dataset
"""

import random
import uuid
from functools import partial

import numpy as np
import pandas as pd
import pytest
from numpy.testing import assert_array_almost_equal
from pytest_lazyfixture import lazy_fixture

from phoenix.datasets.dataset import Dataset, EmbeddingColumnNames, Schema
from phoenix.datasets.errors import DatasetError

import logging
from dataclasses import replace

import numpy as np
from pandas import DataFrame
from pytest import LogCaptureFixture

from phoenix.datasets import EmbeddingColumnNames, Schema
from phoenix.datasets.dataset import _parse_dataframe_and_schema


class TestParseDataFrameAndSchema:
    """
    Tests for `_parse_dataframe_and_schema`
    """

    _NUM_RECORDS = 5
    _EMBEDDING_DIMENSION = 7

    def test_schema_contains_all_dataframe_columns_results_in_unchanged_output(self, caplog):
        input_dataframe = DataFrame(
            {
                "prediction_id": list(range(self.num_records)),
                "ts": list(range(self.num_records)),
                "prediction_label": [f"label{index}" for index in range(self.num_records)],
                "feature0": np.zeros(self.num_records),
                "feature1": np.ones(self.num_records),
                "tag0": ["tag" for _ in range(self.num_records)],
            }
        )
        input_schema = Schema(
            prediction_id_column_name="prediction_id",
            timestamp_column_name="ts",
            feature_column_names=["feature0", "feature1"],
            tag_column_names=["tag0"],
            prediction_label_column_name="prediction_label",
            prediction_score_column_name=None,
            actual_label_column_name=None,
            actual_score_column_name=None,
        )
        self._run_function_and_check_output(
            input_dataframe=input_dataframe,
            input_schema=input_schema,
            expected_parsed_dataframe=input_dataframe,
            expected_parsed_schema=input_schema,
            should_log_warning_to_user=False,
            caplog=caplog,
        )

    def test_column_present_in_dataframe_but_missing_from_schema_is_dropped(self, caplog):
        input_dataframe = DataFrame(
            {
                "prediction_id": list(range(self.num_records)),
                "ts": list(range(self.num_records)),
                "prediction_label": [f"label{index}" for index in range(self.num_records)],
                "feature0": np.zeros(self.num_records),
                "feature1": np.ones(self.num_records),
                "tag0": ["tag" for _ in range(self.num_records)],
            }
        )
        input_schema = Schema(
            prediction_id_column_name="prediction_id",
            feature_column_names=["feature0", "feature1"],
            tag_column_names=["tag0"],
            prediction_label_column_name="prediction_label",
        )
        self._run_function_and_check_output(
            input_dataframe=input_dataframe,
            input_schema=input_schema,
            expected_parsed_dataframe=input_dataframe[
                [col for col in input_dataframe.columns if col != "ts"]
            ],
            expected_parsed_schema=replace(input_schema, timestamp_column_name=None),
            should_log_warning_to_user=False,
            caplog=caplog,
        )

    def test_some_features_excluded_removes_excluded_features_columns_and_keeps_the_rest(
        self, caplog
    ):
        input_dataframe = DataFrame(
            {
                "prediction_id": list(range(self.num_records)),
                "prediction_label": [f"label{index}" for index in range(self.num_records)],
                "feature0": np.zeros(self.num_records),
                "feature1": np.ones(self.num_records),
                "tag0": ["tag" for _ in range(self.num_records)],
            }
        )
        input_schema = Schema(
            prediction_id_column_name="prediction_id",
            feature_column_names=["feature0", "feature1"],
            tag_column_names=["tag0"],
            prediction_label_column_name="prediction_label",
            excludes=["feature1"],
        )
        self._run_function_and_check_output(
            input_dataframe=input_dataframe,
            input_schema=input_schema,
            expected_parsed_dataframe=input_dataframe[
                ["prediction_id", "prediction_label", "feature0", "tag0"]
            ],
            expected_parsed_schema=replace(
                input_schema,
                prediction_label_column_name="prediction_label",
                feature_column_names=["feature0"],
                tag_column_names=["tag0"],
                excludes=None,
            ),
            should_log_warning_to_user=False,
            caplog=caplog,
        )

    def test_all_features_and_tags_excluded_sets_schema_features_and_tags_fields_to_none(
        self, caplog
    ):
        input_dataframe = DataFrame(
            {
                "prediction_id": list(range(self.num_records)),
                "prediction_label": [f"label{index}" for index in range(self.num_records)],
                "feature0": np.zeros(self.num_records),
                "feature1": np.ones(self.num_records),
                "tag0": ["tag" for _ in range(self.num_records)],
            }
        )
        excludes = ["feature0", "feature1", "tag0"]
        input_schema = Schema(
            prediction_id_column_name="prediction_id",
            feature_column_names=["feature0", "feature1"],
            tag_column_names=["tag0"],
            prediction_label_column_name="prediction_label",
            excludes=excludes,
        )
        self._run_function_and_check_output(
            input_dataframe=input_dataframe,
            input_schema=input_schema,
            expected_parsed_dataframe=input_dataframe[["prediction_id", "prediction_label"]],
            expected_parsed_schema=replace(
                input_schema,
                prediction_label_column_name="prediction_label",
                feature_column_names=None,
                tag_column_names=None,
                excludes=None,
            ),
            should_log_warning_to_user=False,
            caplog=caplog,
        )

    def test_excluded_single_column_schema_fields_set_to_none(self, caplog):
        input_dataframe = DataFrame(
            {
                "prediction_id": list(range(self.num_records)),
                "ts": list(range(self.num_records)),
                "prediction_label": [f"label{index}" for index in range(self.num_records)],
                "feature0": np.zeros(self.num_records),
                "feature1": np.ones(self.num_records),
            }
        )
        input_schema = Schema(
            prediction_id_column_name="prediction_id",
            timestamp_column_name="ts",
            prediction_label_column_name="prediction_label",
            feature_column_names=["feature0", "feature1"],
            excludes=["prediction_label", "ts"],
        )
        self._run_function_and_check_output(
            input_dataframe=input_dataframe,
            input_schema=input_schema,
            expected_parsed_dataframe=input_dataframe[["prediction_id", "feature0", "feature1"]],
            expected_parsed_schema=replace(
                input_schema,
                prediction_label_column_name=None,
                timestamp_column_name=None,
                excludes=None,
            ),
            should_log_warning_to_user=False,
            caplog=caplog,
        )

    def test_no_input_schema_features_and_no_excludes_discovers_features(self, caplog):
        input_dataframe = DataFrame(
            {
                "prediction_id": list(range(self.num_records)),
                "prediction_label": [f"label{index}" for index in range(self.num_records)],
                "feature0": np.zeros(self.num_records),
                "feature1": np.ones(self.num_records),
                "feature2": np.ones(self.num_records) + 1,
            }
        )
        input_schema = Schema(
            prediction_id_column_name="prediction_id",
            prediction_label_column_name="prediction_label",
        )
        self._run_function_and_check_output(
            input_dataframe=input_dataframe,
            input_schema=input_schema,
            expected_parsed_dataframe=input_dataframe,
            expected_parsed_schema=replace(
                input_schema, feature_column_names=["feature0", "feature1", "feature2"]
            ),
            should_log_warning_to_user=False,
            caplog=caplog,
        )

    def test_no_input_schema_features_and_list_of_excludes_discovers_non_excluded_features(
        self, caplog
    ):
        input_dataframe = DataFrame(
            {
                "prediction_id": list(range(self.num_records)),
                "prediction_label": [f"label{index}" for index in range(self.num_records)],
                "feature0": np.zeros(self.num_records),
                "feature1": np.ones(self.num_records),
                "feature2": np.ones(self.num_records) + 1,
                "tag0": ["tag0" for _ in range(self.num_records)],
                "tag1": ["tag1" for _ in range(self.num_records)],
            }
        )
        excludes = ["prediction_label", "feature1", "tag0"]
        input_schema = Schema(
            prediction_id_column_name="prediction_id",
            tag_column_names=["tag0", "tag1"],
            prediction_label_column_name="prediction_label",
            excludes=excludes,
        )
        self._run_function_and_check_output(
            input_dataframe=input_dataframe,
            input_schema=input_schema,
            expected_parsed_dataframe=input_dataframe[
                ["prediction_id", "feature0", "feature2", "tag1"]
            ],
            expected_parsed_schema=replace(
                input_schema,
                prediction_label_column_name=None,
                feature_column_names=["feature0", "feature2"],
                tag_column_names=["tag1"],
                excludes=None,
            ),
            should_log_warning_to_user=False,
            caplog=caplog,
        )

    def test_excluded_column_not_contained_in_dataframe_logs_warning(self, caplog):
        input_dataframe = DataFrame(
            {
                "prediction_id": list(range(self.num_records)),
                "prediction_label": [f"label{index}" for index in range(self.num_records)],
                "feature0": np.zeros(self.num_records),
                "feature1": np.ones(self.num_records),
                "feature2": np.ones(self.num_records) + 1,
                "tag0": ["tag0" for _ in range(self.num_records)],
                "tag1": ["tag1" for _ in range(self.num_records)],
            }
        )
        excludes = ["prediction_label", "column_not_in_dataframe"]
        input_schema = Schema(
            prediction_id_column_name="prediction_id",
            feature_column_names=["feature0", "feature1", "feature2"],
            tag_column_names=["tag0", "tag1"],
            prediction_label_column_name="prediction_label",
            excludes=excludes,
        )
        self._run_function_and_check_output(
            input_dataframe=input_dataframe,
            input_schema=input_schema,
            expected_parsed_dataframe=input_dataframe[
                ["prediction_id", "feature0", "feature1", "feature2", "tag0", "tag1"]
            ],
            expected_parsed_schema=replace(
                input_schema, prediction_label_column_name=None, excludes=None
            ),
            should_log_warning_to_user=True,
            caplog=caplog,
        )

    def test_schema_includes_embedding_feature_has_all_embedding_columns_included(self, caplog):
        input_dataframe = DataFrame(
            {
                "embedding_vector0": [
                    np.zeros(self.embedding_dimension) for _ in range(self.num_records)
                ],
                "link_to_data0": [f"some-link{index}" for index in range(self.num_records)],
                "raw_data_column0": [f"some-text{index}" for index in range(self.num_records)],
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
        self._run_function_and_check_output(
            input_dataframe=input_dataframe,
            input_schema=input_schema,
            expected_parsed_dataframe=input_dataframe,
            expected_parsed_schema=input_schema,
            should_log_warning_to_user=False,
            caplog=caplog,
        )

    def test_embedding_columns_of_excluded_embedding_feature_are_removed(self, caplog):
        input_dataframe = DataFrame(
            {
                "embedding_vector0": [
                    np.zeros(self.embedding_dimension) for _ in range(self.num_records)
                ],
                "link_to_data0": [f"some-link{index}" for index in range(self.num_records)],
                "raw_data_column0": [f"some-text{index}" for index in range(self.num_records)],
                "embedding_vector1": [np.zeros(9) for _ in range(self.num_records)],
                "link_to_data1": [f"some-link{index}" for index in range(self.num_records)],
                "raw_data_column1": [f"some-text{index}" for index in range(self.num_records)],
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
        self._run_function_and_check_output(
            input_dataframe=input_dataframe,
            input_schema=input_schema,
            expected_parsed_dataframe=input_dataframe[
                ["embedding_vector1", "link_to_data1", "raw_data_column1"]
            ],
            expected_parsed_schema=replace(
                input_schema,
                embedding_feature_column_names={
                    "embedding_feature1": EmbeddingColumnNames(
                        vector_column_name="embedding_vector1",
                        link_to_data_column_name="link_to_data1",
                        raw_data_column_name="raw_data_column1",
                    )
                },
                excludes=None,
            ),
            should_log_warning_to_user=False,
            caplog=caplog,
        )

    def test_excluding_all_embedding_features_sets_schema_embedding_field_to_none(self, caplog):
        input_dataframe = DataFrame(
            {
                "embedding_vector0": [
                    np.zeros(self.embedding_dimension) for _ in range(self.num_records)
                ],
                "link_to_data0": [f"some-link{index}" for index in range(self.num_records)],
                "raw_data_column0": [f"some-text{index}" for index in range(self.num_records)],
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
            excludes=["embedding_feature0"],
        )
        self._run_function_and_check_output(
            input_dataframe=input_dataframe,
            input_schema=input_schema,
            expected_parsed_dataframe=input_dataframe[[]],
            expected_parsed_schema=replace(
                input_schema,
                embedding_feature_column_names=None,
                excludes=None,
            ),
            should_log_warning_to_user=False,
            caplog=caplog,
        )

    def test_excluding_an_embedding_column_rather_than_the_embedding_feature_name_logs_warning(
        self, caplog
    ):
        input_dataframe = DataFrame(
            {
                "embedding_vector0": [
                    np.zeros(self.embedding_dimension) for _ in range(self.num_records)
                ],
                "link_to_data0": [f"some-link{index}" for index in range(self.num_records)],
                "raw_data_column0": [f"some-text{index}" for index in range(self.num_records)],
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
            excludes=["embedding_vector0"],
        )
        self._run_function_and_check_output(
            input_dataframe=input_dataframe,
            input_schema=input_schema,
            expected_parsed_dataframe=input_dataframe,
            expected_parsed_schema=replace(
                input_schema,
                excludes=None,
            ),
            should_log_warning_to_user=True,
            caplog=caplog,
        )

    def test_excluding_embedding_feature_with_same_name_as_embedding_column_does_not_warn_user(
        self,
        caplog,
    ):
        input_dataframe = DataFrame(
            {
                "embedding0": [np.zeros(self.embedding_dimension) for _ in range(self.num_records)],
                "link_to_data0": [f"some-link{index}" for index in range(self.num_records)],
                "raw_data_column0": [f"some-text{index}" for index in range(self.num_records)],
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
            excludes=["embedding0"],
        )
        self._run_function_and_check_output(
            input_dataframe=input_dataframe,
            input_schema=input_schema,
            expected_parsed_dataframe=input_dataframe[[]],
            expected_parsed_schema=replace(
                input_schema,
                embedding_feature_column_names=None,
                excludes=None,
            ),
            should_log_warning_to_user=False,
            caplog=caplog,
        )

    def _run_function_and_check_output(
        self,
        input_dataframe: DataFrame,
        input_schema: Schema,
        expected_parsed_dataframe: DataFrame,
        expected_parsed_schema: Schema,
        should_log_warning_to_user: bool,
        caplog: LogCaptureFixture,
    ) -> None:
        parsed_dataframe, parsed_schema = _parse_dataframe_and_schema(
            dataframe=input_dataframe, schema=input_schema
        )
        assert parsed_dataframe.equals(expected_parsed_dataframe)
        assert parsed_schema == expected_parsed_schema
        assert self._warning_logged(caplog) is should_log_warning_to_user

    @staticmethod
    def _warning_logged(caplog: LogCaptureFixture) -> bool:
        """
        Scans captured logs to check whether a warning is logged to the user
        """
        for record in caplog.records:
            if logging.WARNING == record.levelno:
                return True
        return False

    @property
    def num_records(self):
        return self._NUM_RECORDS

    @property
    def embedding_dimension(self):
        return self._EMBEDDING_DIMENSION


  num_samples = 9


  @pytest.fixture
  def random_seed():
      np.random.seed(0)
      random.seed(0)


  @pytest.fixture
  def include_embeddings(request):
      return request.param


  def random_uuids():
      return [str(uuid.uuid4()) for _ in range(num_samples)]


  @pytest.mark.parametrize(
    "input_df, input_schema",
    [
        (
            {
                "timestamp": np.full(
                    shape=num_samples, fill_value=pd.Timestamp.utcnow(), dtype=pd.Timestamp
                ),
                "prediction_id": random_uuids(),
            },
            {"timestamp_column_name": "timestamp", "prediction_id_column_name": "prediction_id"},
        ),
        (
            {
                "timestamp": np.full(
                    shape=num_samples, fill_value=pd.Timestamp.utcnow().timestamp(), dtype=int
                ),
                "prediction_id": random_uuids(),
            },
            {"timestamp_column_name": "timestamp", "prediction_id_column_name": "prediction_id"},
        ),
        (
            {
                "timestamp": np.full(
                    shape=num_samples, fill_value=pd.Timestamp.utcnow(), dtype=pd.Timestamp
                ),
                "prediction_id": range(num_samples),
            },
            {"timestamp_column_name": "timestamp", "prediction_id_column_name": "prediction_id"},
        ),
        (
            {
                "prediction_id": random_uuids(),
            },
            {"prediction_id_column_name": "prediction_id"},
        ),
        (
            {
                "timestamp": np.full(
                    shape=num_samples, fill_value=pd.Timestamp.utcnow(), dtype=pd.Timestamp
                ),
            },
            {"timestamp_column_name": "timestamp"},
        ),
        (
            dict(),
            dict(),
        ),
    ],
    ids=[
        "test_dataset_normalization_columns_already_normalized",
        "test_dataset_normalization_timestamp_integer_to_datetime",
        "test_dataset_normalization_prediction_id_integer_to_string",
        "test_dataset_normalization_add_missing_timestamp",
        "test_dataset_normalization_add_missing_prediction_id",
        "test_dataset_normalization_add_missing_timestamp_and_prediction_id",
    ],
    indirect=True,
)


def test_dataset_normalization(input_df, input_schema) -> None:
    dataset = Dataset(dataframe=input_df, schema=input_schema)

    # Ensure existing data
    for column_name in input_df:
        assert column_name in dataset.dataframe.columns
        actual_column = dataset.dataframe[column_name]
        expected_column = input_df[column_name]
        assert_column(column_name, actual_column, expected_column)

    # Ensure normalized columns exist if they did not exist in the initial normalization_df
    assert "timestamp" in dataset.dataframe
    assert dataset.dataframe.dtypes["timestamp"], "datetime[nz]"
    assert "prediction_id" in dataset.dataframe
    assert dataset.dataframe.dtypes["prediction_id"], "string"


@pytest.mark.parametrize(
    "input_df, input_schema",
    [
        (
            {
                "prediction_id": np.full(
                    shape=num_samples, fill_value=pd.Timestamp.utcnow(), dtype=pd.Timestamp
                ),
            },
            {"prediction_id_column_name": "prediction_id"},
        ),
        (
            {
                "timestamp": random_uuids(),
            },
            {"timestamp_column_name": "timestamp"},
        ),
    ],
    indirect=True,
)
def test_dataset_validation(input_df, input_schema) -> None:
    with pytest.raises(DatasetError):
        Dataset(dataframe=input_df, schema=input_schema)


@pytest.fixture
def input_df(request):
    """
    Provides a dataframe fixture with a base set of columns and an optional configurable
    set of additional columns.
    :param request: params contains the additional columns to add to the dataframe
    :return: pd.DataFrame
    """
    data = {
        "feature": range(num_samples),
        "predicted_score": range(num_samples),
    }
    data.update(request.param)
    return pd.DataFrame.from_dict(data)


@pytest.fixture
def input_schema(request):
    """
    Provides a phoneix Schema fixture with a base set of columns and an optional configurable
    set of additional columns
    :param request: params contains the additional columns to add to the Schema
    :return: Schema
    """
    schema = {
        "feature_column_names": ["feature"],
        "prediction_score_column_name": "predicted_score",
    }
    schema.update(request.param)
    return Schema(**schema)
    