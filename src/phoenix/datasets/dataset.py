from dataclasses import dataclass
from typing import Optional

from pandas import DataFrame, Series, read_csv

from .types import Schema


@dataclass
class Dataset:
    def __init__(self, dataframe: DataFrame, schema: Schema):
        parsed_dataframe = self._parse_dataframe(dataframe, schema)

        self.__dataframe = parsed_dataframe
        self.__schema = schema

    def head(self, num_rows: Optional[int] = 5) -> DataFrame:
        # TODO(assign): Look at Pandas and create our own head method
        return self.__dataframe.head(num_rows)

    def get_column(self, col_name: str) -> Series:
        return self.__dataframe[col_name]

    def get_embedding_vector_column(self, embedding_feature_name: str) -> Series:
        embedding_column = self.__schema.embedding_feature_column_names[
            embedding_feature_name
        ]
        df_column_name = embedding_column.vector_column_name
        return self.__dataframe[df_column_name]

    def sample(self, num: Optional[int] = None) -> "Dataset":
        sampled_dataframe = self.__dataframe.sample(n=num, ignore_index=True)
        return Dataset(sampled_dataframe, self.__schema)

    def get_prediction_label_column(self) -> Series:
        return self.__dataframe[self.__schema.prediction_label_column_name]

    def get_prediction_score_column(self) -> Series:
        return self.__dataframe[self.__schema.prediction_score_column_name]

    def get_actual_label_column(self) -> Series:
        return self.__dataframe[self.__schema.actual_label_column_name]

    def get_actual_score_column(self) -> Series:
        return self.__dataframe[self.__schema.actual_score_column_name]

    def get_embedding_raw_text_column(self, embedding_feature: str) -> Series:
        return self.__dataframe[
            self.__schema.embedding_feature_column_names[
                embedding_feature
            ].data_column_name
        ]

    def get_embedding_link_to_data_column(self, embedding_feature: str) -> Series:
        return self.__dataframe[
            self.__schema.embedding_feature_column_names[
                embedding_feature
            ].link_to_data_column_name
        ]

    @classmethod
    def from_dataframe(cls, dataframe: DataFrame, schema: Schema):
        return cls(dataframe, schema)

    @classmethod
    def from_csv(cls, filepath: str, schema: Schema):
        return cls(read_csv(filepath), schema)

    @staticmethod
    def _parse_dataframe(dataframe: DataFrame, schema: Schema) -> DataFrame:
        schema_cols = [
            schema.timestamp_column_name,
            schema.prediction_label_column_name,
            schema.prediction_score_column_name,
            schema.actual_label_column_name,
            schema.actual_score_column_name,
        ]
        schema_cols += schema.feature_column_names

        for emb_feat_cols in schema.embedding_feature_column_names.values():
            schema_cols.append(emb_feat_cols.vector_column_name)
            if emb_feat_cols.data_column_name:
                schema_cols.append(emb_feat_cols.data_column_name)
            if emb_feat_cols.link_to_data_column_name:
                schema_cols.append(emb_feat_cols.link_to_data_column_name)

        drop_cols = [col for col in dataframe.columns if col not in schema_cols]
        return dataframe.drop(columns=drop_cols)
