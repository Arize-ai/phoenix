import logging
import os
import os.path
import pickle
import sys
import tempfile
import uuid
import warnings
from typing import Literal, Optional
from urllib import request

from numpy import fromstring
from pandas import DataFrame, Series, read_csv, read_hdf, read_parquet

import phoenix.datasets.errors as err
from phoenix.config import dataset_dir
from phoenix.datasets import EmbeddingColumnNames, Schema
from phoenix.datasets.validation import validate_dataset_inputs
from phoenix.utils import is_url, parse_file_format, parse_filename

SUPPORTED_URL_FORMATS = sorted(["hdf", "csv"])

logger = logging.getLogger(__name__)
if hasattr(sys, "ps1"):
    # for python interactive mode
    log_handler = logging.StreamHandler(sys.stdout)
    log_handler.setLevel(logging.INFO)
    logger.addHandler(log_handler)
    logger.setLevel(logging.INFO)

ParquetEngine = Literal["pyarrow", "fastparquet", "auto"]


class Dataset:
    """
    A dataset represents data for a set of inferences. It is represented as a dataframe + schema
    """

    _data_file_name: str = "data.parquet"
    _schema_file_name: str = "schema.json"

    def __init__(self, dataframe: DataFrame, schema: Schema, name: Optional[str] = None):
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

    def directory(self) -> str:
        """The directory under which the dataset metadata is stored"""
        return os.path.join(dataset_dir, self.name)

    def head(self, num_rows: Optional[int] = 5) -> DataFrame:
        num_rows = 5 if num_rows is None else num_rows
        return self.dataframe.head(num_rows)

    def get_column(self, col_name: str) -> Series:
        return self.dataframe[col_name]

    def sample(self, num: int) -> "Dataset":
        sampled_dataframe = self.dataframe.sample(n=num, ignore_index=True)
        return Dataset(sampled_dataframe, self.schema, f"""{self.name}_sample_{num}""")

    def get_prediction_label_column(
        self,
    ) -> Series:
        if self.schema.prediction_label_column_name is None:
            raise err.SchemaError(err.MissingField("prediction_label_column_name"))
        return self.dataframe[self.schema.prediction_label_column_name]

    def get_prediction_score_column(
        self,
    ) -> Series:
        if self.schema.prediction_score_column_name is None:
            raise err.SchemaError(err.MissingField("prediction_score_column_name"))
        return self.dataframe[self.schema.prediction_score_column_name]

    def get_actual_label_column(self) -> Series:
        if self.schema.actual_label_column_name is None:
            raise err.SchemaError(err.MissingField("actual_label_column_name"))
        return self.dataframe[self.schema.actual_label_column_name]

    def get_actual_score_column(self) -> Series:
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

    def get_embedding_vector_column(self, embedding_feature_name: str) -> Series:
        column_names = self._get_embedding_feature_column_names(embedding_feature_name)
        if column_names.vector_column_name is None:
            raise err.SchemaError(
                err.MissingEmbeddingFeatureVectorColumnName(embedding_feature_name)
            )
        vector_column = self.dataframe[column_names.vector_column_name]
        return vector_column

    def get_embedding_raw_data_column(self, embedding_feature_name: str) -> Series:
        column_names = self._get_embedding_feature_column_names(embedding_feature_name)
        if column_names.raw_data_column_name is None:
            raise err.SchemaError(
                err.MissingEmbeddingFeatureRawDataColumnName(embedding_feature_name)
            )
        return self.dataframe[column_names.raw_data_column_name]

    def get_embedding_link_to_data_column(self, embedding_feature_name: str) -> Series:
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
    def from_csv(cls, filepath: str, schema: Schema, name: Optional[str] = None) -> "Dataset":
        dataframe: DataFrame = read_csv(filepath)
        dataframe_columns = set(dataframe.columns)
        if schema.embedding_feature_column_names is not None:
            warnings.warn(
                "Reading embeddings from csv files can be slow. Consider using other "
                "formats such as parquet or hdf5.",
                stacklevel=2,
            )
            for emb_col_names in schema.embedding_feature_column_names.values():
                if emb_col_names.vector_column_name not in dataframe_columns:
                    e = err.MissingVectorColumn(emb_col_names.vector_column_name)
                    logger.error(e)
                    raise err.DatasetError(e)
                dataframe[emb_col_names.vector_column_name] = dataframe[
                    emb_col_names.vector_column_name
                ].map(lambda s: fromstring(s.strip("[]"), dtype=float, sep=" "))

        return cls(dataframe, schema, name)

    @classmethod
    def from_hdf(
        cls, filepath: str, schema: Schema, name: Optional[str], key: Optional[str] = None
    ) -> "Dataset":
        df = read_hdf(filepath, key)
        if not isinstance(df, DataFrame):
            raise TypeError("Reading from hdf must yield a dataframe")
        return cls(df, schema, name)

    @classmethod
    def from_url(cls, url_path: str, schema: Schema, hdf_key: Optional[str] = None) -> "Dataset":
        if not is_url(url_path):
            raise ValueError("Invalid url")
        file_format = parse_file_format(url_path)
        if file_format == ".csv":
            return cls.from_csv(url_path, schema)
        elif file_format == ".hdf5" or file_format == ".hdf":
            filename = parse_filename(url_path)
            with tempfile.TemporaryDirectory() as temp_dir:
                local_file_path = os.path.join(temp_dir, filename)
                print(f"Downloading file: {filename}")
                request.urlretrieve(url_path, local_file_path, show_progress)
                print("\n")
                return cls.from_hdf(local_file_path, schema, hdf_key)
        raise ValueError(
            f"File format {file_format} not supported. Currently supported "
            f"formats are: {', '.join(SUPPORTED_URL_FORMATS)}."
        )

    @classmethod
    def from_parquet(
        cls, filepath: str, schema: Schema, name: Optional[str], engine: ParquetEngine = "pyarrow"
    ) -> "Dataset":
        return cls(read_parquet(filepath, engine=engine), schema, name)

    @classmethod
    def from_name(cls, name: str) -> "Dataset":
        """Retrieves a dataset by name from the file system"""
        directory = os.path.join(dataset_dir, name)
        df = read_parquet(os.path.join(directory, cls._data_file_name))
        with open(os.path.join(directory, cls._schema_file_name), "rb") as schema_file:
            schema = pickle.load(schema_file)
            return cls(df, schema, name)

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
        """writes the data and schema to disc as an HDF5 file"""
        directory = self.directory
        if not os.path.isdir(directory):
            os.makedirs(directory)

        self.dataframe.to_parquet(os.path.join(directory, self._data_file_name))
        schema_json_data = self.schema.to_json()
        with open(os.path.join(directory, self._schema_file_name), "w+") as schema_file:
            schema_file.write(schema_json_data)
        logger.info(f"Dataset info written to '{directory}'")


def show_progress(block_num: int, block_size: int, total_size: int) -> None:
    progress = round(block_num * block_size / total_size * 100, 2)
    print("[" + int(progress) * "=" + (100 - int(progress)) * " " + f"] {progress}%", end="\r")
