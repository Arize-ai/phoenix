import logging
import sys
import warnings
from typing import Literal, Optional

from numpy import fromstring
from pandas import DataFrame, Series, read_csv, read_hdf, read_parquet

from ..validation import DatasetValidator
from ..validation import errors as err
from .types import Schema

logger = logging.getLogger(__name__)
if hasattr(sys, "ps1"):
    # for python interactive mode
    log_handler = logging.StreamHandler(sys.stdout)
    log_handler.setLevel(logging.INFO)
    logger.addHandler(log_handler)
    logger.setLevel(logging.INFO)

ParquetEngine = Literal["pyarrow", "fastparquet", "auto"]


class Dataset:
    def __init__(self, dataframe: DataFrame, schema: Schema):
        errors = DatasetValidator().validate_dataset_inputs(
            dataframe=dataframe,
            schema=schema,
        )
        if errors:
            for e in errors:
                logger.error(e)
            raise err.ValidationFailure(errors)
        parsed_dataframe = self._parse_dataframe(dataframe, schema)

        self.__dataframe: DataFrame = parsed_dataframe
        self.__schema: Schema = schema

    @property
    def dataframe(self):
        return self.__dataframe

    @property
    def schema(self):
        return self.__schema

    def head(self, num_rows: Optional[int] = 5) -> DataFrame:
        num_rows = 5 if num_rows is None else num_rows
        return self.dataframe.head(num_rows)

    def get_column(self, col_name: str) -> Series:
        return self.dataframe[col_name]

    def get_embedding_vector_column(self, embedding_feature_name: str) -> Series:
        if self.schema.embedding_feature_column_names is None:
            raise NameError("Dataset schema is missing embedding feature column names")
        embedding_column = self.schema.embedding_feature_column_names[embedding_feature_name]
        df_column_name = embedding_column.vector_column_name
        vector_column = self.dataframe[df_column_name]
        return vector_column

    def sample(self, num: Optional[int] = None) -> "Dataset":
        sampled_dataframe = self.dataframe.sample(n=num, ignore_index=True)
        return Dataset(sampled_dataframe, self.schema)

    def get_prediction_label_column(
        self,
    ) -> Series:
        if self.schema.prediction_label_column_name is None:
            raise err.SchemaError("Schema is missing prediction_label_column_name")
        return self.dataframe[self.schema.prediction_label_column_name]

    def get_prediction_score_column(
        self,
    ) -> Series:
        if self.schema.prediction_score_column_name is None:
            raise err.SchemaError("Schema is missing prediction_score_column_name")
        return self.dataframe[self.schema.prediction_score_column_name]

    def get_actual_label_column(self) -> Series:
        if self.schema.actual_label_column_name is None:
            raise err.SchemaError("Schema is missing actual_label_column_name")
        return self.dataframe[self.schema.actual_label_column_name]

    def get_actual_score_column(self) -> Series:
        if self.schema.actual_score_column_name is None:
            raise err.SchemaError("Schema is missing actual_score_column_name")
        return self.dataframe[self.schema.actual_score_column_name]

    def _get_embedding_feature_column_names(self, embedding_feature: str):
        if self.schema.embedding_feature_column_names is None:
            raise err.SchemaError("Schema is missing embedding_feature_column_names")
        embedding_feature_column_names = self.schema.embedding_feature_column_names
        if embedding_feature_column_names[embedding_feature] is None:
            raise err.SchemaError(
                f"""Schema is missing embedding_feature_column_names[{embedding_feature}]"""
            )
        return embedding_feature_column_names[embedding_feature]

    def get_embedding_raw_text_column(self, embedding_feature: str) -> Series:
        column_names = self._get_embedding_feature_column_names(embedding_feature)
        if column_names.data_column_name is None:
            raise err.SchemaError(f"""Missing data_column_name for {embedding_feature}""")
        return self.dataframe[column_names.data_column_name]

    def get_embedding_link_to_data_column(self, embedding_feature: str) -> Series:
        column_names = self._get_embedding_feature_column_names(embedding_feature)
        if column_names.link_to_data_column_name is None:
            raise err.SchemaError(f"""Missing link_to_data_column_name for {embedding_feature}""")
        return self.dataframe[column_names.link_to_data_column_name]

    @classmethod
    def from_dataframe(cls, dataframe: DataFrame, schema: Schema):
        return cls(dataframe, schema)

    @classmethod
    def from_csv(cls, filepath: str, schema: Schema):
        dataframe: DataFrame = read_csv(filepath)
        dataframe_columns = set(dataframe.columns)
        if schema.embedding_feature_column_names is not None:
            warnings.warn(
                "Reading embeddings from csv files can be slow. Consider using other "
                "formats such as hdf5. Learn more [here]()",
                stacklevel=2,
            )
            for emb_col_names in schema.embedding_feature_column_names.values():
                if emb_col_names.vector_column_name not in dataframe_columns:
                    e = err.MissingVectorColumn(emb_col_names.vector_column_name)
                    logger.error(e)
                    raise err.ValidationFailure(e)
                dataframe[emb_col_names.vector_column_name] = dataframe[
                    emb_col_names.vector_column_name
                ].map(lambda s: fromstring(s.strip("[]"), dtype=float, sep=" "))

        return cls(dataframe, schema)

    @classmethod
    def from_hdf(cls, filepath: str, schema: Schema, key: Optional[str] = None):
        df = read_hdf(filepath, key)
        if not isinstance(df, DataFrame):
            raise TypeError("Reading from hdf yielded an invalid dataframe")
        return cls(df, schema)

    @classmethod
    def from_parquet(cls, filepath: str, schema: Schema, engine: ParquetEngine = "pyarrow"):
        return cls(read_parquet(filepath, engine=engine), schema)

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
                if emb_feat_cols.data_column_name:
                    schema_cols.append(emb_feat_cols.data_column_name)
                if emb_feat_cols.link_to_data_column_name:
                    schema_cols.append(emb_feat_cols.link_to_data_column_name)

        drop_cols = [col for col in dataframe.columns if col not in schema_cols]
        return dataframe.drop(columns=drop_cols)
