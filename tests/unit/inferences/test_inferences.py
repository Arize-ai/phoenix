"""
Test inferences
"""

import logging
import math
import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import replace
from datetime import datetime

import numpy as np
import pandas as pd
import pytest
import pytz
from pandas import DataFrame, Series, Timestamp
from pytest import LogCaptureFixture, raises

import phoenix.inferences.errors as err
from phoenix.inferences.errors import DatasetError
from phoenix.inferences.inferences import (
    Inferences,
    _normalize_timestamps,
    _parse_dataframe_and_schema,
)
from phoenix.inferences.schema import (
    EmbeddingColumnNames,
    RetrievalEmbeddingColumnNames,
    Schema,
)


class TestParseDataFrameAndSchema:
    """
    Tests for `_parse_dataframe_and_schema`
    """

    _NUM_RECORDS = 5
    _EMBEDDING_DIMENSION = 7

    def test_schema_contains_all_dataframe_columns_results_in_unchanged_output(
        self,
        caplog: LogCaptureFixture,
    ) -> None:
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

    def test_column_present_in_dataframe_but_missing_from_schema_is_dropped(
        self,
        caplog: LogCaptureFixture,
    ) -> None:
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
        self,
        caplog: LogCaptureFixture,
    ) -> None:
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
            excluded_column_names=["feature1"],
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
                excluded_column_names=None,
            ),
            should_log_warning_to_user=False,
            caplog=caplog,
        )

    def test_all_features_and_tags_excluded_sets_schema_features_and_tags_fields_to_none(
        self,
        caplog: LogCaptureFixture,
    ) -> None:
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
        excluded_column_names = ["feature0", "feature1", "tag0"]
        input_schema = Schema(
            prediction_id_column_name="prediction_id",
            timestamp_column_name="timestamp",
            feature_column_names=["feature0", "feature1"],
            tag_column_names=["tag0"],
            prediction_label_column_name="prediction_label",
            excluded_column_names=excluded_column_names,
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
                excluded_column_names=None,
            ),
            should_log_warning_to_user=False,
            caplog=caplog,
        )

    def test_excluded_single_column_schema_fields_set_to_none(
        self,
        caplog: LogCaptureFixture,
    ) -> None:
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
            excluded_column_names=["prediction_label"],
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
                excluded_column_names=None,
            ),
            should_log_warning_to_user=False,
            caplog=caplog,
        )

    def test_no_input_schema_features_and_no_excluded_column_names_discovers_features(
        self,
        caplog: LogCaptureFixture,
    ) -> None:
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

    def test_no_input_schema_features_and_nonempty_excluded_column_names_discovers_features(
        self,
        caplog: LogCaptureFixture,
    ) -> None:
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
        excluded_column_names = ["prediction_label", "feature1", "tag0"]
        input_schema = Schema(
            prediction_id_column_name="prediction_id",
            timestamp_column_name="timestamp",
            tag_column_names=["tag0", "tag1"],
            prediction_label_column_name="prediction_label",
            excluded_column_names=excluded_column_names,
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
                excluded_column_names=None,
            ),
            should_log_warning_to_user=False,
            caplog=caplog,
        )

    def test_excluded_column_not_contained_in_dataframe_logs_warning(
        self,
        caplog: LogCaptureFixture,
    ) -> None:
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
        excluded_column_names = ["prediction_label", "column_not_in_dataframe"]
        input_schema = Schema(
            prediction_id_column_name="prediction_id",
            timestamp_column_name="timestamp",
            feature_column_names=["feature0", "feature1", "feature2"],
            tag_column_names=["tag0", "tag1"],
            prediction_label_column_name="prediction_label",
            excluded_column_names=excluded_column_names,
        )
        self._parse_dataframe_and_schema_and_check_output(
            input_dataframe=input_dataframe,
            input_schema=input_schema,
            expected_parsed_dataframe=input_dataframe[
                ["prediction_id", "timestamp", "feature0", "feature1", "feature2", "tag0", "tag1"]
            ],
            expected_parsed_schema=replace(
                input_schema, prediction_label_column_name=None, excluded_column_names=None
            ),
            should_log_warning_to_user=True,
            caplog=caplog,
        )

    def test_schema_includes_embedding_feature_has_all_embedding_columns_included(
        self,
        caplog: LogCaptureFixture,
    ) -> None:
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

    def test_schema_includes_relationships(
        self,
        caplog: LogCaptureFixture,
    ) -> None:
        input_dataframe = DataFrame(
            {
                "prediction_id": [str(x) for x in range(self.num_records)],
                "timestamp": [pd.Timestamp.now() for x in range(self.num_records)],
                "embedding": [[1, 2, 3, 4, 5] for _ in range(self.num_records)],
                "document_ids": [["doc_id_1", "doc_id_4"] for _ in range(self.num_records)],
            }
        )
        input_schema = Schema(
            prediction_id_column_name="prediction_id",
            timestamp_column_name="timestamp",
            prompt_column_names=RetrievalEmbeddingColumnNames(
                vector_column_name="embedding",
                context_retrieval_ids_column_name="document_ids",
            ),
        )
        self._parse_dataframe_and_schema_and_check_output(
            input_dataframe=input_dataframe,
            input_schema=input_schema,
            expected_parsed_dataframe=input_dataframe,
            expected_parsed_schema=input_schema,
            should_log_warning_to_user=False,
            caplog=caplog,
        )

    def test_embedding_columns_of_excluded_embedding_feature_are_removed(
        self,
        caplog: LogCaptureFixture,
    ) -> None:
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
            excluded_column_names=["embedding_feature0"],
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
                excluded_column_names=None,
            ),
            should_log_warning_to_user=False,
            caplog=caplog,
        )

    def test_excluding_all_embedding_features_sets_schema_embedding_field_to_none(
        self,
        caplog: LogCaptureFixture,
    ) -> None:
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
            excluded_column_names=["embedding_feature0"],
        )
        self._parse_dataframe_and_schema_and_check_output(
            input_dataframe=input_dataframe,
            input_schema=input_schema,
            expected_parsed_dataframe=input_dataframe[["prediction_id", "timestamp"]],
            expected_parsed_schema=replace(
                input_schema,
                embedding_feature_column_names=None,
                excluded_column_names=None,
            ),
            should_log_warning_to_user=False,
            caplog=caplog,
        )

    def test_excluding_an_embedding_column_rather_than_the_embedding_feature_name_logs_warning(
        self,
        caplog: LogCaptureFixture,
    ) -> None:
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
            excluded_column_names=["embedding_vector0"],
        )
        self._parse_dataframe_and_schema_and_check_output(
            input_dataframe=input_dataframe,
            input_schema=input_schema,
            expected_parsed_dataframe=input_dataframe,
            expected_parsed_schema=replace(
                input_schema,
                excluded_column_names=None,
            ),
            should_log_warning_to_user=True,
            caplog=caplog,
        )

    def test_excluding_embedding_feature_with_same_name_as_embedding_column_does_not_warn_user(
        self,
        caplog: LogCaptureFixture,
    ) -> None:
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
            excluded_column_names=["embedding0"],
        )
        self._parse_dataframe_and_schema_and_check_output(
            input_dataframe=input_dataframe,
            input_schema=input_schema,
            expected_parsed_dataframe=input_dataframe[["prediction_id", "timestamp"]],
            expected_parsed_schema=replace(
                input_schema,
                embedding_feature_column_names=None,
                excluded_column_names=None,
            ),
            should_log_warning_to_user=False,
            caplog=caplog,
        )

    def test_inferences_coerce_vectors_from_lists_to_arrays(
        self,
        caplog: LogCaptureFixture,
    ) -> None:
        vec = np.random.random(10)
        input_dataframe = DataFrame(
            {
                "embedding0": [tuple(vec), np.nan] * 20,
                "embedding1": [list(vec), None] * 20,
                "embedding2": [list(vec), None, tuple(vec), np.nan] * 10,
            }
        )
        assert 0 < input_dataframe.isna().sum().sum() < input_dataframe.size
        emb0 = EmbeddingColumnNames(vector_column_name="embedding0")
        emb1 = EmbeddingColumnNames(vector_column_name="embedding1")
        emb2 = EmbeddingColumnNames(vector_column_name="embedding2")
        input_schema = Schema(
            embedding_feature_column_names={"embedding0": emb0},
            prompt_column_names=emb1,
            response_column_names=emb2,
        )
        parsed_dataframe, _ = _parse_dataframe_and_schema(
            dataframe=input_dataframe,
            schema=input_schema,
        )
        assert len(parsed_dataframe) == len(input_dataframe)
        for name in ("embedding0", "embedding1", "embedding2"):
            for parsed, original in zip(
                parsed_dataframe.loc[:, name],
                input_dataframe.loc[:, name],
            ):
                assert (
                    parsed is None
                    and original is None
                    or (isinstance(parsed, float) and math.isnan(parsed))
                    and (isinstance(original, float) and math.isnan(original))
                    or isinstance(parsed, np.ndarray)
                    and not isinstance(original, np.ndarray)
                    and list(parsed) == list(original)
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

    def test_inferences_normalization_columns_already_normalized(self) -> None:
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

    def test_inferences_normalization_prediction_id_integer_to_string(self) -> None:
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

    def test_inferences_normalization_columns_add_missing_prediction_id(self) -> None:
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

    @property
    def num_records(self) -> int:
        return self._NUM_RECORDS

    @property
    def embedding_dimension(self) -> int:
        return self._EMBEDDING_DIMENSION


class TestDataset:
    _NUM_RECORDS = 9

    def test_inferences_normalization_columns_already_normalized(self) -> None:
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

        inferences = Inferences(dataframe=input_dataframe, schema=input_schema)
        output_dataframe = inferences.dataframe
        output_schema = inferences.schema

        assert output_dataframe.equals(
            input_dataframe.set_index("timestamp", drop=False).sort_index()
        )
        assert output_schema == input_schema

    # TODO: Move validation tests to validation module; keep one validation integration test
    def test_inferences_validate_invalid_prediction_id_datatype(self) -> None:
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

        with raises_inferences_error(
            err.InvalidColumnType,
            "Invalid column types: ['prediction_id should be a string or numeric type']",
        ):
            Inferences(dataframe=input_df, schema=input_schema)

    def test_inferences_validate_invalid_schema_excludes_timestamp(self) -> None:
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
            excluded_column_names=["timestamp"],
        )

        with raises_inferences_error(
            err.InvalidSchemaError,
            "The schema is invalid: timestamp cannot be excluded "
            "because it is already being used as the timestamp column.",
        ):
            Inferences(dataframe=input_df, schema=input_schema)

    def test_inferences_validate_invalid_schema_excludes_prediction_id(self) -> None:
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
            excluded_column_names=["prediction_id"],
        )

        with raises_inferences_error(
            err.InvalidSchemaError,
            "The schema is invalid: prediction_id cannot be excluded because it is "
            "already being used as the prediction id column.",
        ):
            Inferences(dataframe=input_df, schema=input_schema)

    def test_inferences_validate_invalid_schema_missing_column(self) -> None:
        input_df = DataFrame(
            {
                "prediction_label": [f"label{index}" for index in range(self.num_records)],
                "feature0": np.zeros(self.num_records),
                "timestamp": random_uuids(self.num_records),
            },
        )

        input_schema = Schema(
            prediction_id_column_name="prediction_id",
            feature_column_names=["feature0"],
            prediction_label_column_name="prediction_label",
        )

        with raises_inferences_error(
            err.MissingColumns,
            "The following columns are declared in the Schema "
            "but are not found in the dataframe: prediction_id.",
        ):
            Inferences(dataframe=input_df, schema=input_schema)

    @property
    def num_records(self) -> int:
        return self._NUM_RECORDS


@contextmanager
def raises_inferences_error(
    validation_error_type: type[BaseException],
    message: str,
) -> Iterator[None]:
    with raises(DatasetError) as exc_info:
        yield
    assert [type(error) for error in exc_info.value.errors] == [validation_error_type]
    [error] = exc_info.value.errors
    assert str(error) == str(exc_info.value) == message


def random_uuids(num_records: int) -> list[str]:
    return [str(uuid.uuid4()) for _ in range(num_records)]


@pytest.mark.parametrize(
    "input_dataframe, input_schema, default_timestamp, expected_dataframe, expected_schema",
    [
        pytest.param(
            DataFrame(
                {
                    "prediction_id": [1, 2, 3],
                }
            ),
            Schema(prediction_id_column_name="prediction_id"),
            Timestamp(year=2022, month=1, day=1, hour=0, minute=0, second=0, tzinfo=pytz.utc),
            DataFrame(
                {
                    "prediction_id": [1, 2, 3],
                    "timestamp": Series(
                        [
                            Timestamp(
                                year=2022,
                                month=1,
                                day=1,
                                hour=0,
                                minute=0,
                                second=0,
                            )
                        ]
                        * 3
                    ).dt.tz_localize(pytz.utc),
                }
            ),
            Schema(timestamp_column_name="timestamp", prediction_id_column_name="prediction_id"),
            id="missing_timestamp_updates_schema_and_adds_default_timestamp_column_to_dataframe",
        ),
        pytest.param(
            DataFrame(
                {
                    "timestamp": [
                        Timestamp(year=2022, month=1, day=1, hour=0, minute=0, second=0),
                        Timestamp(year=2022, month=1, day=2, hour=0, minute=0, second=0),
                        Timestamp(year=2022, month=1, day=3, hour=0, minute=0, second=0),
                    ],
                    "prediction_id": [1, 2, 3],
                }
            ),
            Schema(timestamp_column_name="timestamp", prediction_id_column_name="prediction_id"),
            None,
            DataFrame(
                {
                    "timestamp": Series(
                        [
                            Timestamp(
                                year=2022,
                                month=1,
                                day=1,
                                hour=0,
                                minute=0,
                                second=0,
                            ),
                            Timestamp(
                                year=2022,
                                month=1,
                                day=2,
                                hour=0,
                                minute=0,
                                second=0,
                            ),
                            Timestamp(
                                year=2022,
                                month=1,
                                day=3,
                                hour=0,
                                minute=0,
                                second=0,
                            ),
                        ]
                    )
                    .dt.tz_localize(datetime.now().astimezone().tzinfo)
                    .dt.tz_convert(pytz.utc),
                    "prediction_id": [1, 2, 3],
                }
            ),
            Schema(timestamp_column_name="timestamp", prediction_id_column_name="prediction_id"),
            id="tz_naive_timestamps_localized_to_local_time_zone_converted_to_utc",
        ),
        pytest.param(
            DataFrame(
                {
                    "timestamp": Series(
                        [
                            Timestamp(
                                year=2022,
                                month=1,
                                day=1,
                                hour=0,
                                minute=0,
                                second=0,
                            ),
                            Timestamp(
                                year=2022,
                                month=1,
                                day=2,
                                hour=1,
                                minute=0,
                                second=0,
                            ),
                            Timestamp(
                                year=2022,
                                month=1,
                                day=3,
                                hour=2,
                                minute=0,
                                second=0,
                            ),
                        ]
                    ).dt.tz_localize(pytz.utc),
                    "prediction_id": [1, 2, 3],
                }
            ),
            Schema(timestamp_column_name="timestamp", prediction_id_column_name="prediction_id"),
            None,
            DataFrame(
                {
                    "timestamp": Series(
                        [
                            Timestamp(
                                year=2022,
                                month=1,
                                day=1,
                                hour=0,
                                minute=0,
                                second=0,
                            ),
                            Timestamp(
                                year=2022,
                                month=1,
                                day=2,
                                hour=1,
                                minute=0,
                                second=0,
                            ),
                            Timestamp(
                                year=2022,
                                month=1,
                                day=3,
                                hour=2,
                                minute=0,
                                second=0,
                            ),
                        ]
                    ).dt.tz_localize(pytz.utc),
                    "prediction_id": [1, 2, 3],
                }
            ),
            Schema(timestamp_column_name="timestamp", prediction_id_column_name="prediction_id"),
            id="utc_timestamps_remain_unchanged",
        ),
        pytest.param(
            DataFrame(
                {
                    "timestamp": Series(
                        [
                            Timestamp(
                                year=2022,
                                month=1,
                                day=1,
                                hour=0,
                                minute=0,
                                second=0,
                            ),
                            Timestamp(
                                year=2022,
                                month=1,
                                day=2,
                                hour=1,
                                minute=0,
                                second=0,
                            ),
                            Timestamp(
                                year=2022,
                                month=1,
                                day=3,
                                hour=2,
                                minute=0,
                                second=0,
                            ),
                        ]
                    )
                    .dt.tz_localize(pytz.utc)
                    .apply(lambda dt: float(dt.timestamp())),
                    "prediction_id": [1, 2, 3],
                }
            ),
            Schema(timestamp_column_name="timestamp", prediction_id_column_name="prediction_id"),
            None,
            DataFrame(
                {
                    "timestamp": Series(
                        [
                            Timestamp(
                                year=2022,
                                month=1,
                                day=1,
                                hour=0,
                                minute=0,
                                second=0,
                            ),
                            Timestamp(
                                year=2022,
                                month=1,
                                day=2,
                                hour=1,
                                minute=0,
                                second=0,
                            ),
                            Timestamp(
                                year=2022,
                                month=1,
                                day=3,
                                hour=2,
                                minute=0,
                                second=0,
                            ),
                        ]
                    ).dt.tz_localize(pytz.utc),
                    "prediction_id": [1, 2, 3],
                }
            ),
            Schema(timestamp_column_name="timestamp", prediction_id_column_name="prediction_id"),
            id="unix_timestamps_converted_to_utc_timestamps",
        ),
        pytest.param(
            DataFrame(
                {
                    "timestamp": Series(
                        [
                            Timestamp(
                                year=2022,
                                month=1,
                                day=1,
                                hour=0,
                                minute=0,
                                second=0,
                            ),
                            Timestamp(
                                year=2022,
                                month=1,
                                day=2,
                                hour=1,
                                minute=0,
                                second=0,
                            ),
                            Timestamp(
                                year=2022,
                                month=1,
                                day=3,
                                hour=2,
                                minute=0,
                                second=0,
                            ),
                        ]
                    ).dt.tz_localize(pytz.timezone("US/Pacific")),
                    "prediction_id": [1, 2, 3],
                }
            ),
            Schema(timestamp_column_name="timestamp", prediction_id_column_name="prediction_id"),
            None,
            DataFrame(
                {
                    "timestamp": Series(
                        [
                            Timestamp(
                                year=2022,
                                month=1,
                                day=1,
                                hour=8,
                                minute=0,
                                second=0,
                            ),
                            Timestamp(
                                year=2022,
                                month=1,
                                day=2,
                                hour=9,
                                minute=0,
                                second=0,
                            ),
                            Timestamp(
                                year=2022,
                                month=1,
                                day=3,
                                hour=10,
                                minute=0,
                                second=0,
                            ),
                        ]
                    ).dt.tz_localize(pytz.utc),
                    "prediction_id": [1, 2, 3],
                }
            ),
            Schema(timestamp_column_name="timestamp", prediction_id_column_name="prediction_id"),
            id="us_pacific_timestamps_converted_to_utc",
        ),
        pytest.param(
            DataFrame(
                {
                    "timestamp": [
                        "2022-01-01T00:00:00Z",
                        "2022-01-02T01:00:00Z",
                        "2022-01-03T02:00:00Z",
                    ],
                    "prediction_id": [1, 2, 3],
                }
            ),
            Schema(timestamp_column_name="timestamp", prediction_id_column_name="prediction_id"),
            None,
            DataFrame(
                {
                    "timestamp": Series(
                        [
                            Timestamp(
                                year=2022,
                                month=1,
                                day=1,
                                hour=0,
                                minute=0,
                                second=0,
                            ),
                            Timestamp(
                                year=2022,
                                month=1,
                                day=2,
                                hour=1,
                                minute=0,
                                second=0,
                            ),
                            Timestamp(
                                year=2022,
                                month=1,
                                day=3,
                                hour=2,
                                minute=0,
                                second=0,
                            ),
                        ]
                    ).dt.tz_localize(pytz.utc),
                    "prediction_id": [1, 2, 3],
                }
            ),
            Schema(timestamp_column_name="timestamp", prediction_id_column_name="prediction_id"),
            id="iso8601_utc_tz_aware_strings_converted_to_utc_timestamps",
        ),
        pytest.param(
            DataFrame(
                {
                    "timestamp": [
                        "2022-01-01T00:00:00",
                        "2022-01-02T01:00:00",
                        "2022-01-03T02:00:00",
                    ],
                    "prediction_id": [1, 2, 3],
                }
            ),
            Schema(timestamp_column_name="timestamp", prediction_id_column_name="prediction_id"),
            None,
            DataFrame(
                {
                    "timestamp": Series(
                        [
                            Timestamp(
                                year=2022,
                                month=1,
                                day=1,
                                hour=0,
                                minute=0,
                                second=0,
                            ),
                            Timestamp(
                                year=2022,
                                month=1,
                                day=2,
                                hour=1,
                                minute=0,
                                second=0,
                            ),
                            Timestamp(
                                year=2022,
                                month=1,
                                day=3,
                                hour=2,
                                minute=0,
                                second=0,
                            ),
                        ]
                    )
                    .dt.tz_localize(datetime.now().astimezone().tzinfo)
                    .dt.tz_convert(pytz.utc),
                    "prediction_id": [1, 2, 3],
                }
            ),
            Schema(timestamp_column_name="timestamp", prediction_id_column_name="prediction_id"),
            id="iso8601_tz_naive_strings_localized_to_localTZ_converted_to_utc_timestamps",
        ),
        pytest.param(
            DataFrame(
                {
                    "timestamp": [
                        "2022-01-01T00:00:00-08:00",
                        "2022-01-02T01:00:00-08:00",
                        "2022-01-03T02:00:00-08:00",
                    ],
                    "prediction_id": [1, 2, 3],
                }
            ),
            Schema(timestamp_column_name="timestamp", prediction_id_column_name="prediction_id"),
            None,
            DataFrame(
                {
                    "timestamp": Series(
                        [
                            Timestamp(
                                year=2022,
                                month=1,
                                day=1,
                                hour=8,
                                minute=0,
                                second=0,
                            ),
                            Timestamp(
                                year=2022,
                                month=1,
                                day=2,
                                hour=9,
                                minute=0,
                                second=0,
                            ),
                            Timestamp(
                                year=2022,
                                month=1,
                                day=3,
                                hour=10,
                                minute=0,
                                second=0,
                            ),
                        ]
                    ).dt.tz_localize(pytz.utc),
                    "prediction_id": [1, 2, 3],
                }
            ),
            Schema(timestamp_column_name="timestamp", prediction_id_column_name="prediction_id"),
            id="iso8601_us_pacific_strings_converted_to_utc_timestamps",
        ),
    ],
)
def test_normalize_timestamps_produces_expected_output_for_valid_input(
    input_dataframe: DataFrame,
    input_schema: Schema,
    default_timestamp: Timestamp,
    expected_dataframe: DataFrame,
    expected_schema: Schema,
) -> None:
    output_dataframe, output_schema = _normalize_timestamps(
        dataframe=input_dataframe, schema=input_schema, default_timestamp=default_timestamp
    )
    assert output_schema == expected_schema
    assert output_dataframe.equals(expected_dataframe)


def test_normalize_timestamps_raises_value_error_for_invalid_input() -> None:
    with pytest.raises(ValueError):
        _normalize_timestamps(
            dataframe=DataFrame(
                {
                    "timestamp": [
                        "24-03-2023 invalidCharacter 14:15:00",
                        "24-03-2023 invalidCharacter 10:30:00",
                        "24-03-2023 invalidCharacter 18:45:00",
                    ],
                    "prediction_id": [1, 2, 3],
                }
            ),
            schema=Schema(
                timestamp_column_name="timestamp", prediction_id_column_name="prediction_id"
            ),
            default_timestamp=Timestamp.utcnow(),
        )


def test_inferences_with_arize_schema() -> None:
    from arize.utils.types import (  # type: ignore[import-untyped]
        EmbeddingColumnNames as ArizeEmbeddingColumnNames,
    )
    from arize.utils.types import Schema as ArizeSchema

    input_df = DataFrame(
        {
            "prediction_label": ["apple", "orange", "grape"],
            "prediction_id": ["1", "2", "3"],
            "timestamp": [
                pd.Timestamp(year=2023, month=1, day=1, hour=2, second=30),
                pd.Timestamp(year=2023, month=1, day=10, hour=6, second=20),
                pd.Timestamp(year=2023, month=1, day=5, hour=4, second=25),
            ],
            "embedding": [[1, 2, 3], [4, 5, 6], [7, 8, 9]],
            "url": [
                "https://www.phoenix.com/apple.png",
                "https://www.phoenix.com/apple.png",
                "https://www.phoenix.com/apple.png",
            ],
        }
    )

    input_schema = ArizeSchema(
        prediction_id_column_name="prediction_id",
        prediction_label_column_name="prediction_label",
        timestamp_column_name="timestamp",
        embedding_feature_column_names={
            "embedding": ArizeEmbeddingColumnNames(
                vector_column_name="embedding",
                link_to_data_column_name="url",
            )
        },
    )
    inferences = Inferences(dataframe=input_df, schema=input_schema)
    assert isinstance(inferences.schema, Schema)
    assert inferences.schema.prediction_id_column_name == "prediction_id"
    assert (inferences.schema.embedding_feature_column_names or {})[
        "embedding"
    ].vector_column_name == "embedding"
