import logging
import os
import sys
import uuid
from typing import Any, Literal, Optional, Union

from pandas import DataFrame, Series, read_parquet

from phoenix.config import dataset_dir
from phoenix.utils import FilePath

from . import errors as err
from .schema import EmbeddingColumnNames, Schema
from .validation import validate_dataset_inputs

SUPPORTED_URL_FORMATS = sorted(["hdf", "csv"])

logger = logging.getLogger(__name__)
if hasattr(sys, "ps1"):
    # for python interactive mode
    log_handler = logging.StreamHandler(sys.stdout)
    log_handler.setLevel(logging.INFO)
    logger.addHandler(log_handler)
    logger.setLevel(logging.INFO)

ParquetEngine = Literal["auto", "fastparquet", "pyarrow"]


class Dataset:
    """
    A dataset represents data for a set of inferences. It is represented as a dataframe + schema
    """

    _data_file_name: str = "data.parquet"
    _schema_file_name: str = "schema.json"
    _is_persisted: bool = False

    def __init__(
        self,
        dataframe: DataFrame,
        schema: Schema,
        name: Optional[str] = None,
        persist_to_disc: bool = True,
    ):
        errors = validate_dataset_inputs(
            dataframe=dataframe,
            schema=schema,
        )
        if errors:
            for e in errors:
                logger.error(e)
            raise err.DatasetError(errors)
        parsed_dataframe = self._parse_dataframe(dataframe, schema)

        self.__dataframe: DataFrame = parsed_dataframe
        self.__schema: Schema = schema
        self.__name: str = name if name is not None else f"""dataset_{str(uuid.uuid4())}"""
        self.__directory: str = os.path.join(dataset_dir, self.name)

        # Sync the dataset to disc so that the server can pick up the data
        if persist_to_disc:
            self.to_disc()
        else:
            # Assume that the dataset is already persisted to disc
            self._is_persisted: bool = True

        self.to_disc()
        logger.info(f"""Dataset: {self.__name} initialized""")

    @property
    def dataframe(self) -> DataFrame:
        return self.__dataframe

    @property
    def schema(self) -> "Schema":
        return self.__schema

    @property
    def name(self) -> str:
        return self.__name

    @property
    def is_persisted(self) -> bool:
        return self._is_persisted

    @property
    def directory(self) -> str:
        """The directory under which the dataset metadata is stored"""
        return self.__directory

    def head(self, num_rows: Optional[int] = 5) -> DataFrame:
        num_rows = 5 if num_rows is None else num_rows
        return self.dataframe.head(num_rows)

    def get_column(self, col_name: str) -> "Union[Series[int], Series[float], Series[str]]":
        return self.dataframe[col_name]

    def sample(self, num: int) -> "Dataset":
        sampled_dataframe = self.dataframe.sample(n=num, ignore_index=True)
        return Dataset(sampled_dataframe, self.schema, f"""{self.name}_sample_{num}""")

    def get_prediction_label_column(
        self,
    ) -> "Series[str]":
        if self.schema.prediction_label_column_name is None:
            raise err.SchemaError(err.MissingField("prediction_label_column_name"))
        return self.dataframe[self.schema.prediction_label_column_name]

    def get_prediction_score_column(
        self,
    ) -> "Series[float]":
        if self.schema.prediction_score_column_name is None:
            raise err.SchemaError(err.MissingField("prediction_score_column_name"))
        return self.dataframe[self.schema.prediction_score_column_name]

    def get_actual_label_column(self) -> "Series[str]":
        if self.schema.actual_label_column_name is None:
            raise err.SchemaError(err.MissingField("actual_label_column_name"))
        return self.dataframe[self.schema.actual_label_column_name]

    def get_actual_score_column(self) -> "Union[Series[int], Series[float], Series[str]]":
        if self.schema.actual_score_column_name is None:
            raise err.SchemaError(err.MissingField("actual_score_column_name"))
        return self.dataframe[self.schema.actual_score_column_name]

    def _get_embedding_feature_column_names(
        self, embedding_feature_name: str
    ) -> EmbeddingColumnNames:
        if self.schema.embedding_feature_column_names is None:
            raise err.SchemaError(err.MissingField("embedding_feature_column_names"))
        embedding_feature_column_names = self.schema.embedding_feature_column_names
        if (
            embedding_feature_name not in embedding_feature_column_names
            or embedding_feature_column_names[embedding_feature_name] is None
        ):
            raise err.SchemaError(err.MissingEmbeddingFeatureColumnNames(embedding_feature_name))
        return embedding_feature_column_names[embedding_feature_name]

    # TODO(mikeldking): add strong vector type
    def get_embedding_vector_column(self, embedding_feature_name: str) -> "Series[Any]":
        column_names = self._get_embedding_feature_column_names(embedding_feature_name)
        if column_names.vector_column_name is None:
            raise err.SchemaError(
                err.MissingEmbeddingFeatureVectorColumnName(embedding_feature_name)
            )
        vector_column = self.dataframe[column_names.vector_column_name]
        return vector_column

    def get_embedding_raw_data_column(self, embedding_feature_name: str) -> "Series[str]":
        column_names = self._get_embedding_feature_column_names(embedding_feature_name)
        if column_names.raw_data_column_name is None:
            raise err.SchemaError(
                err.MissingEmbeddingFeatureRawDataColumnName(embedding_feature_name)
            )
        return self.dataframe[column_names.raw_data_column_name]

    def get_embedding_link_to_data_column(self, embedding_feature_name: str) -> "Series[str]":
        column_names = self._get_embedding_feature_column_names(embedding_feature_name)
        if column_names.link_to_data_column_name is None:
            raise err.SchemaError(
                err.MissingEmbeddingFeatureLinkToDataColumnName(embedding_feature_name)
            )
        return self.dataframe[column_names.link_to_data_column_name]

    @classmethod
    def from_dataframe(
        cls, dataframe: DataFrame, schema: Schema, name: Optional[str] = None
    ) -> "Dataset":
        return cls(dataframe, schema, name)

    @classmethod
    def from_parquet(
        cls,
        filepath: FilePath,
        schema: Schema,
        name: Optional[str] = None,
        engine: ParquetEngine = "pyarrow",
    ) -> "Dataset":
        return cls(read_parquet(filepath, engine=engine), schema, name)

    @classmethod
    def from_name(cls, name: str) -> "Dataset":
        """Retrieves a dataset by name from the file system"""
        directory = os.path.join(dataset_dir, name)
        df = read_parquet(os.path.join(directory, cls._data_file_name))
        with open(os.path.join(directory, cls._schema_file_name)) as schema_file:
            schema_json = schema_file.read()
        schema = Schema.from_json(schema_json)
        return cls(df, schema, name, persist_to_disc=False)

    @staticmethod
    def _parse_dataframe(dataframe: DataFrame, schema: Schema) -> DataFrame:
        schema_cols = [
            schema.timestamp_column_name,
            schema.prediction_label_column_name,
            schema.prediction_score_column_name,
            schema.actual_label_column_name,
            schema.actual_score_column_name,
        ]
        # Append the feature column names to the columns if present
        if schema.feature_column_names is not None:
            schema_cols += schema.feature_column_names

        if schema.embedding_feature_column_names is not None:
            for emb_feat_cols in schema.embedding_feature_column_names.values():
                schema_cols.append(emb_feat_cols.vector_column_name)
                if emb_feat_cols.raw_data_column_name:
                    schema_cols.append(emb_feat_cols.raw_data_column_name)
                if emb_feat_cols.link_to_data_column_name:
                    schema_cols.append(emb_feat_cols.link_to_data_column_name)

        drop_cols = [col for col in dataframe.columns if col not in schema_cols]
        return dataframe.drop(columns=drop_cols)

    def to_disc(self) -> None:
        """writes the data and schema to disc"""

        if self._is_persisted:
            logger.info("Dataset already persisted")
            return

        directory = self.directory
        if not os.path.isdir(directory):
            os.makedirs(directory)

        self.dataframe.to_parquet(os.path.join(directory, self._data_file_name))
        schema_json_data = self.schema.to_json()
        with open(os.path.join(directory, self._schema_file_name), "w+") as schema_file:
            schema_file.write(schema_json_data)

        # set the persisted flag so that we don't have to perform this operation again
        self._is_persisted = True
        logger.info(f"Dataset info written to '{directory}'")


def show_progress(block_num: int, block_size: int, total_size: int) -> None:
    progress = round(block_num * block_size / total_size * 100, 2)
    print("[" + int(progress) * "=" + (100 - int(progress)) * " " + f"] {progress}%", end="\r")
