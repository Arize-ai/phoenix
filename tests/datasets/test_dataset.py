"""
Test dataset
"""

import logging
import uuid
from dataclasses import replace

import numpy as np
import pandas as pd
from pandas import DataFrame, to_datetime
from pytest import LogCaptureFixture, raises

from phoenix.core.datasets.dataset import (
    Dataset,
    EmbeddingColumnNames,
    Schema,
    _parse_dataframe_and_schema,
)
from phoenix.core.datasets.errors import DatasetError


class TestParseDataFrameAndSchema:
    """
    Tests for `_parse_dataframe_and_schema`
    """

    _NUM_RECORDS = 5
    _EMBEDDING_DIMENSION = 7

    def test_schema_contains_all_dataframe_columns_results_in_unchanged_output(self, caplog):
        input_dataframe = DataFrame(
            {
                "prediction_id": [str(x) for x in range(self.num_records)],
                "timestamp": [pd.Timestamp.now() for x in range(self.num_records)],
                "prediction_label": [f"label{index}" for index in range(self.num_records)],
                "feature0": np.zeros(self.num_records),
                "feature1": np.ones(self.num_records),
                "tag0": ["tag" for _ in range(self.num_records)],
            }
        )
        input_schema = Schema(
            prediction_id_column_name="prediction_id",
            timestamp_column_name="timestamp",
            feature_column_names=["feature0", "feature1"],
            tag_column_names=["tag0"],
            prediction_label_column_name="prediction_label",
            prediction_score_column_name=None,
            actual_label_column_name=None,
            actual_score_column_name=None,
        )
        self._parse_dataframe_and_schema_and_check_output(
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
                "prediction_id": [str(x) for x in range(self.num_records)],
                "timestamp": [pd.Timestamp.now() for x in range(self.num_records)],
                "prediction_label": [f"label{index}" for index in range(self.num_records)],
                "feature0": np.zeros(self.num_records),
                "feature1": np.ones(self.num_records),
                "tag0": ["tag" for _ in range(self.num_records)],
            }
        )
        input_schema = Schema(
            prediction_id_column_name="prediction_id",
            timestamp_column_name="timestamp",
            feature_column_names=["feature0", "feature1"],
            prediction_label_column_name="prediction_label",
        )
        self._parse_dataframe_and_schema_and_check_output(
            input_dataframe=input_dataframe,
            input_schema=input_schema,
            expected_parsed_dataframe=input_dataframe[
                [col for col in input_dataframe.columns if col != "tag0"]
            ],
            expected_parsed_schema=replace(input_schema, tag_column_names=None),
            should_log_warning_to_user=False,
            caplog=caplog,
        )

    def test_some_features_excluded_removes_excluded_features_columns_and_keeps_the_rest(
        self, caplog
    ):
        input_dataframe = DataFrame(
            {
                "prediction_id": [str(x) for x in range(self.num_records)],
                "timestamp": [pd.Timestamp.now() for x in range(self.num_records)],
                "prediction_label": [f"label{index}" for index in range(self.num_records)],
                "feature0": np.zeros(self.num_records),
                "feature1": np.ones(self.num_records),
                "tag0": ["tag" for _ in range(self.num_records)],
            }
        )
        input_schema = Schema(
            prediction_id_column_name="prediction_id",
            timestamp_column_name="timestamp",
            feature_column_names=["feature0", "feature1"],
            tag_column_names=["tag0"],
            prediction_label_column_name="prediction_label",
            excludes=["feature1"],
        )
        self._parse_dataframe_and_schema_and_check_output(
            input_dataframe=input_dataframe,
            input_schema=input_schema,
            expected_parsed_dataframe=input_dataframe[
                ["prediction_id", "timestamp", "prediction_label", "feature0", "tag0"]
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
                "prediction_id": [str(x) for x in range(self.num_records)],
                "timestamp": [pd.Timestamp.now() for x in range(self.num_records)],
                "prediction_label": [f"label{index}" for index in range(self.num_records)],
                "feature0": np.zeros(self.num_records),
                "feature1": np.ones(self.num_records),
                "tag0": ["tag" for _ in range(self.num_records)],
            }
        )
        excludes = ["feature0", "feature1", "tag0"]
        input_schema = Schema(
            prediction_id_column_name="prediction_id",
            timestamp_column_name="timestamp",
            feature_column_names=["feature0", "feature1"],
            tag_column_names=["tag0"],
            prediction_label_column_name="prediction_label",
            excludes=excludes,
        )
        self._parse_dataframe_and_schema_and_check_output(
            input_dataframe=input_dataframe,
            input_schema=input_schema,
            expected_parsed_dataframe=input_dataframe[
                ["prediction_id", "timestamp", "prediction_label"]
            ],
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
                "prediction_id": [str(x) for x in range(self.num_records)],
                "timestamp": [pd.Timestamp.now() for x in range(self.num_records)],
                "prediction_label": [f"label{index}" for index in range(self.num_records)],
                "feature0": np.zeros(self.num_records),
                "feature1": np.ones(self.num_records),
            }
        )
        input_schema = Schema(
            prediction_id_column_name="prediction_id",
            timestamp_column_name="timestamp",
            prediction_label_column_name="prediction_label",
            feature_column_names=["feature0", "feature1"],
            excludes=["prediction_label"],
        )
        self._parse_dataframe_and_schema_and_check_output(
            input_dataframe=input_dataframe,
            input_schema=input_schema,
            expected_parsed_dataframe=input_dataframe[
                ["prediction_id", "timestamp", "feature0", "feature1"]
            ],
            expected_parsed_schema=replace(
                input_schema,
                prediction_label_column_name=None,
                excludes=None,
            ),
            should_log_warning_to_user=False,
            caplog=caplog,
        )

    def test_no_input_schema_features_and_no_excludes_discovers_features(self, caplog):
        input_dataframe = DataFrame(
            {
                "prediction_id": [str(x) for x in range(self.num_records)],
                "timestamp": [pd.Timestamp.now() for x in range(self.num_records)],
                "prediction_label": [f"label{index}" for index in range(self.num_records)],
                "feature0": np.zeros(self.num_records),
                "feature1": np.ones(self.num_records),
                "feature2": np.ones(self.num_records) + 1,
            }
        )
        input_schema = Schema(
            prediction_id_column_name="prediction_id",
            prediction_label_column_name="prediction_label",
            timestamp_column_name="timestamp",
        )
        self._parse_dataframe_and_schema_and_check_output(
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
                "prediction_id": [str(x) for x in range(self.num_records)],
                "timestamp": [pd.Timestamp.now() for x in range(self.num_records)],
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
            timestamp_column_name="timestamp",
            tag_column_names=["tag0", "tag1"],
            prediction_label_column_name="prediction_label",
            excludes=excludes,
        )
        self._parse_dataframe_and_schema_and_check_output(
            input_dataframe=input_dataframe,
            input_schema=input_schema,
            expected_parsed_dataframe=input_dataframe[
                ["prediction_id", "timestamp", "feature0", "feature2", "tag1"]
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
                "prediction_id": [str(x) for x in range(self.num_records)],
                "timestamp": [pd.Timestamp.now() for x in range(self.num_records)],
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
            timestamp_column_name="timestamp",
            feature_column_names=["feature0", "feature1", "feature2"],
            tag_column_names=["tag0", "tag1"],
            prediction_label_column_name="prediction_label",
            excludes=excludes,
        )
        self._parse_dataframe_and_schema_and_check_output(
            input_dataframe=input_dataframe,
            input_schema=input_schema,
            expected_parsed_dataframe=input_dataframe[
                ["prediction_id", "timestamp", "feature0", "feature1", "feature2", "tag0", "tag1"]
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
                "prediction_id": [str(x) for x in range(self.num_records)],
                "timestamp": [pd.Timestamp.now() for x in range(self.num_records)],
                "embedding_vector0": [
                    np.zeros(self.embedding_dimension) for _ in range(self.num_records)
                ],
                "link_to_data0": [f"some-link{index}" for index in range(self.num_records)],
                "raw_data_column0": [f"some-text{index}" for index in range(self.num_records)],
            }
        )
        input_schema = Schema(
            prediction_id_column_name="prediction_id",
            timestamp_column_name="timestamp",
            embedding_feature_column_names={
                "embedding_feature0": EmbeddingColumnNames(
                    vector_column_name="embedding_vector0",
                    link_to_data_column_name="link_to_data0",
                    raw_data_column_name="raw_data_column0",
                ),
            },
        )
        self._parse_dataframe_and_schema_and_check_output(
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
                "prediction_id": [str(x) for x in range(self.num_records)],
                "timestamp": [pd.Timestamp.now() for x in range(self.num_records)],
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
            prediction_id_column_name="prediction_id",
            timestamp_column_name="timestamp",
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
        self._parse_dataframe_and_schema_and_check_output(
            input_dataframe=input_dataframe,
            input_schema=input_schema,
            expected_parsed_dataframe=input_dataframe[
                [
                    "prediction_id",
                    "timestamp",
                    "embedding_vector1",
                    "link_to_data1",
                    "raw_data_column1",
                ]
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
                "prediction_id": [str(x) for x in range(self.num_records)],
                "timestamp": [pd.Timestamp.now() for x in range(self.num_records)],
                "embedding_vector0": [
                    np.zeros(self.embedding_dimension) for _ in range(self.num_records)
                ],
                "link_to_data0": [f"some-link{index}" for index in range(self.num_records)],
                "raw_data_column0": [f"some-text{index}" for index in range(self.num_records)],
            }
        )
        input_schema = Schema(
            prediction_id_column_name="prediction_id",
            timestamp_column_name="timestamp",
            embedding_feature_column_names={
                "embedding_feature0": EmbeddingColumnNames(
                    vector_column_name="embedding_vector0",
                    link_to_data_column_name="link_to_data0",
                    raw_data_column_name="raw_data_column0",
                ),
            },
            excludes=["embedding_feature0"],
        )
        self._parse_dataframe_and_schema_and_check_output(
            input_dataframe=input_dataframe,
            input_schema=input_schema,
            expected_parsed_dataframe=input_dataframe[["prediction_id", "timestamp"]],
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
                "prediction_id": [str(x) for x in range(self.num_records)],
                "timestamp": [pd.Timestamp.now() for x in range(self.num_records)],
                "embedding_vector0": [
                    np.zeros(self.embedding_dimension) for _ in range(self.num_records)
                ],
                "link_to_data0": [f"some-link{index}" for index in range(self.num_records)],
                "raw_data_column0": [f"some-text{index}" for index in range(self.num_records)],
            }
        )
        input_schema = Schema(
            prediction_id_column_name="prediction_id",
            timestamp_column_name="timestamp",
            embedding_feature_column_names={
                "embedding_feature0": EmbeddingColumnNames(
                    vector_column_name="embedding_vector0",
                    link_to_data_column_name="link_to_data0",
                    raw_data_column_name="raw_data_column0",
                ),
            },
            excludes=["embedding_vector0"],
        )
        self._parse_dataframe_and_schema_and_check_output(
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
                "prediction_id": [str(x) for x in range(self.num_records)],
                "timestamp": [pd.Timestamp.now() for x in range(self.num_records)],
                "embedding0": [np.zeros(self.embedding_dimension) for _ in range(self.num_records)],
                "link_to_data0": [f"some-link{index}" for index in range(self.num_records)],
                "raw_data_column0": [f"some-text{index}" for index in range(self.num_records)],
            }
        )
        input_schema = Schema(
            prediction_id_column_name="prediction_id",
            timestamp_column_name="timestamp",
            embedding_feature_column_names={
                "embedding0": EmbeddingColumnNames(
                    vector_column_name="embedding0",
                    link_to_data_column_name="link_to_data0",
                    raw_data_column_name="raw_data_column0",
                ),
            },
            excludes=["embedding0"],
        )
        self._parse_dataframe_and_schema_and_check_output(
            input_dataframe=input_dataframe,
            input_schema=input_schema,
            expected_parsed_dataframe=input_dataframe[["prediction_id", "timestamp"]],
            expected_parsed_schema=replace(
                input_schema,
                embedding_feature_column_names=None,
                excludes=None,
            ),
            should_log_warning_to_user=False,
            caplog=caplog,
        )

    def _parse_dataframe_and_schema_and_check_output(
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

    def test_dataset_normalization_columns_already_normalized(self):
        input_dataframe = DataFrame(
            {
                "prediction_label": [f"label{index}" for index in range(self.num_records)],
                "feature0": np.zeros(self.num_records),
                "timestamp": np.full(
                    shape=self.num_records, fill_value=pd.Timestamp.utcnow(), dtype=pd.Timestamp
                ),
                "prediction_id": random_uuids(self.num_records),
            }
        )

        input_schema = Schema(
            prediction_id_column_name="prediction_id",
            timestamp_column_name="timestamp",
            feature_column_names=["feature0"],
            prediction_label_column_name="prediction_label",
        )

        output_dataframe, _ = _parse_dataframe_and_schema(
            dataframe=input_dataframe, schema=input_schema
        )

        assert output_dataframe.equals(input_dataframe)

    def test_dataset_normalization_timestamp_integer_to_datetime(self):
        input_dataframe = DataFrame(
            {
                "prediction_label": [f"label{index}" for index in range(self.num_records)],
                "feature0": np.zeros(self.num_records),
                "timestamp": np.full(
                    shape=self.num_records, fill_value=pd.Timestamp.utcnow().timestamp(), dtype=int
                ),
                "prediction_id": random_uuids(self.num_records),
            }
        )
        input_schema = Schema(
            prediction_id_column_name="prediction_id",
            timestamp_column_name="timestamp",
            feature_column_names=["feature0"],
            prediction_label_column_name="prediction_label",
        )

        output_dataframe, _ = _parse_dataframe_and_schema(
            dataframe=input_dataframe, schema=input_schema
        )

        expected_dataframe = input_dataframe
        expected_dataframe["timestamp"] = expected_dataframe["timestamp"].apply(
            lambda x: to_datetime(x, unit="ms")
        )
        assert output_dataframe.equals(expected_dataframe)

    def test_dataset_normalization_prediction_id_integer_to_string(self):
        input_dataframe = DataFrame(
            {
                "prediction_label": [f"label{index}" for index in range(self.num_records)],
                "feature0": np.zeros(self.num_records),
                "timestamp": np.full(
                    shape=self.num_records, fill_value=pd.Timestamp.utcnow(), dtype=pd.Timestamp
                ),
                "prediction_id": range(self.num_records),
            }
        )
        input_schema = Schema(
            prediction_id_column_name="prediction_id",
            timestamp_column_name="timestamp",
            feature_column_names=["feature0"],
            prediction_label_column_name="prediction_label",
        )

        output_dataframe, _ = _parse_dataframe_and_schema(
            dataframe=input_dataframe, schema=input_schema
        )

        expected_dataframe = input_dataframe
        expected_dataframe["prediction_id"] = expected_dataframe["prediction_id"].astype(str)
        assert output_dataframe.equals(expected_dataframe)

    def test_dataset_normalization_columns_add_missing_prediction_id(self):
        input_dataframe = DataFrame(
            {
                "prediction_label": [f"label{index}" for index in range(self.num_records)],
                "feature0": np.zeros(self.num_records),
                "timestamp": np.full(
                    shape=self.num_records, fill_value=pd.Timestamp.utcnow(), dtype=pd.Timestamp
                ),
            }
        )

        input_schema = Schema(
            timestamp_column_name="timestamp",
            feature_column_names=["feature0"],
            prediction_label_column_name="prediction_label",
        )

        output_dataframe, _ = _parse_dataframe_and_schema(
            dataframe=input_dataframe, schema=input_schema
        )

        assert len(output_dataframe.columns) == 4
        assert output_dataframe[["prediction_label", "feature0", "timestamp"]].equals(
            input_dataframe
        )
        assert "prediction_id" in output_dataframe
        assert output_dataframe.dtypes["prediction_id"], "string"

    def test_dataset_normalization_columns_add_missing_timestamp(self):
        input_dataframe = DataFrame(
            {
                "prediction_label": [f"label{index}" for index in range(self.num_records)],
                "feature0": np.zeros(self.num_records),
                "prediction_id": random_uuids(self.num_records),
            }
        )

        input_schema = Schema(
            prediction_id_column_name="prediction_id",
            feature_column_names=["feature0"],
            prediction_label_column_name="prediction_label",
        )

        output_dataframe, _ = _parse_dataframe_and_schema(
            dataframe=input_dataframe, schema=input_schema
        )

        assert len(output_dataframe.columns) == 4
        assert output_dataframe[["prediction_label", "feature0", "prediction_id"]].equals(
            input_dataframe
        )
        assert "timestamp" in output_dataframe
        assert output_dataframe.dtypes["timestamp"], "datetime[nz]"

    def test_dataset_normalization_columns_missing_prediction_id_and_timestamp(self):
        input_dataframe = DataFrame(
            {
                "prediction_label": [f"label{index}" for index in range(self.num_records)],
                "feature0": np.zeros(self.num_records),
            }
        )

        input_schema = Schema(
            feature_column_names=["feature0"],
            prediction_label_column_name="prediction_label",
        )

        output_dataframe, _ = _parse_dataframe_and_schema(
            dataframe=input_dataframe, schema=input_schema
        )

        assert len(output_dataframe.columns) == 4
        assert output_dataframe[["prediction_label", "feature0"]].equals(input_dataframe)
        assert "prediction_id" in output_dataframe
        assert output_dataframe.dtypes["prediction_id"], "string"
        assert "timestamp" in output_dataframe
        assert output_dataframe.dtypes["timestamp"], "datetime[nz]"

    @property
    def num_records(self):
        return self._NUM_RECORDS

    @property
    def embedding_dimension(self):
        return self._EMBEDDING_DIMENSION


class TestDataset:
    _NUM_RECORDS = 9

    def test_dataset_normalization_columns_already_normalized(self):
        input_dataframe = DataFrame(
            {
                "prediction_label": [f"label{index}" for index in range(self.num_records)],
                "feature0": np.zeros(self._NUM_RECORDS),
                "timestamp": np.full(
                    shape=self._NUM_RECORDS, fill_value=pd.Timestamp.utcnow(), dtype=pd.Timestamp
                ),
                "prediction_id": random_uuids(self.num_records),
            }
        )

        input_schema = Schema(
            prediction_id_column_name="prediction_id",
            timestamp_column_name="timestamp",
            feature_column_names=["feature0"],
            prediction_label_column_name="prediction_label",
        )

        dataset = Dataset(dataframe=input_dataframe, schema=input_schema)
        output_dataframe = dataset.dataframe
        output_schema = dataset.schema

        assert output_dataframe.equals(input_dataframe)
        assert output_schema == input_schema

    # TODO: Move validation tests to validation module; keep one validation integration test
    def test_dataset_validate_invalid_prediction_id_datatype(self) -> None:
        input_df = DataFrame(
            {
                "prediction_label": [f"label{index}" for index in range(self.num_records)],
                "feature0": np.zeros(self.num_records),
                "prediction_id": np.full(
                    shape=self.num_records, fill_value=pd.Timestamp.utcnow(), dtype=pd.Timestamp
                ),
            }
        )

        input_schema = Schema(
            prediction_id_column_name="prediction_id",
            feature_column_names=["feature0"],
            prediction_label_column_name="prediction_label",
        )

        with raises(DatasetError):
            Dataset(dataframe=input_df, schema=input_schema)

    def test_dataset_validate_invalid_timestamp_datatype(self) -> None:
        input_df = DataFrame(
            {
                "prediction_label": [f"label{index}" for index in range(self.num_records)],
                "feature0": np.zeros(self.num_records),
                "timestamp": random_uuids(self.num_records),
            },
        )

        input_schema = Schema(
            timestamp_column_name="timestamp",
            feature_column_names=["feature0"],
            prediction_label_column_name="prediction_label",
        )

        with raises(DatasetError):
            Dataset(dataframe=input_df, schema=input_schema)

    def test_dataset_validate_invalid_schema_excludes_timestamp(self) -> None:
        input_df = DataFrame(
            {
                "prediction_label": [f"label{index}" for index in range(self.num_records)],
                "feature0": np.zeros(self.num_records),
                "timestamp": random_uuids(self.num_records),
            },
        )

        input_schema = Schema(
            timestamp_column_name="timestamp",
            feature_column_names=["feature0"],
            prediction_label_column_name="prediction_label",
            excludes=["timestamp"],
        )

        with raises(DatasetError):
            Dataset(dataframe=input_df, schema=input_schema)

    def test_dataset_validate_invalid_schema_excludes_prediction_id(self) -> None:
        input_df = DataFrame(
            {
                "prediction_id": [str(x) for x in range(self.num_records)],
                "prediction_label": [f"label{index}" for index in range(self.num_records)],
                "feature0": np.zeros(self.num_records),
                "timestamp": random_uuids(self.num_records),
            },
        )

        input_schema = Schema(
            prediction_id_column_name="prediction_id",
            feature_column_names=["feature0"],
            prediction_label_column_name="prediction_label",
            excludes=["prediction_id"],
        )

        with raises(DatasetError):
            Dataset(dataframe=input_df, schema=input_schema)

    @property
    def num_records(self):
        return self._NUM_RECORDS


def random_uuids(num_records: int):
    return [str(uuid.uuid4()) for _ in range(num_records)]
