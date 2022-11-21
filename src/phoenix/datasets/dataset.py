"""
A class that represents a set of data to be used for analysis
"""

from dataclasses import dataclass
from typing import Optional

from pandas import DataFrame, Series, read_csv

from .types import Schema


@dataclass
# A Dataset is class formed by a panda dataframe and a schema
class Dataset:
    "TBD"

    def __init__(self, dataframe: DataFrame, schema: Schema):
        parsed_dataframe = self._parse_dataframe(dataframe, schema)

        self.__dataframe = parsed_dataframe
        self.__schema = schema

    def head(self, num_rows: Optional[int] = 5) -> DataFrame:
        """
        > This function returns the first n rows for the object based on position. It is useful
        for quickly testing if your
        object has the right type of data in it

        :param num_rows: The number of rows to return, defaults to 5
        :type num_rows: Optional[int] (optional)
        :return: A DataFrame
        """
        # TODO(assign): Look at Pandas and create our own head method
        return self.__dataframe.head(num_rows)

    def get_column(self, col_name: str) -> Series:
        """
        This function takes in a dataframe and a column name and returns a series of the column

        :param col_name: The name of the column you want to get
        :type col_name: str
        :return: A Series object
        """
        return self.__dataframe[col_name]

    def get_embedding_vector_column(self, embedding_feature_name: str) -> Series:
        """
        > Given a feature name, return the embedding vector column from the dataframe

        :param embedding_feature_name: The name of the embedding feature
        :type embedding_feature_name: str
        :return: A series of the embedding vector column
        """
        if self.__schema.embedding_feature_column_names is None:
            raise NameError("Dataset schema is missing embedding feature column names")
        embedding_column = self.__schema.embedding_feature_column_names[embedding_feature_name]
        df_column_name = embedding_column.vector_column_name
        return self.__dataframe[df_column_name]

    def sample(self, num: Optional[int] = None) -> "Dataset":
        """
        > This function returns a new dataset with a random sample of the dataframe

        :param num: The number of rows to sample. If None, then a single row is sampled
        :type num: Optional[int]
        :return: A new Dataset object with the sampled dataframe and the same schema.
        """
        sampled_dataframe = self.__dataframe.sample(n=num, ignore_index=True)
        return Dataset(sampled_dataframe, self.__schema)

    def get_prediction_label_column(
        self,
    ) -> Series:
        """
        It returns a Series object that contains the values of the prediction label column
        :return: The prediction label column of the dataframe.
        """
        return self.__dataframe[self.__schema.prediction_label_column_name]

    def get_prediction_score_column(
        self,
    ) -> Series:
        """
        It returns a pandas Series object that contains the prediction score column from the
        dataframe
        :return: The prediction score column of the dataframe.
        """
        return self.__dataframe[self.__schema.prediction_score_column_name]

    def get_actual_label_column(self) -> Series:
        """
        > This function returns the actual label column of the dataframe.
        :return: The actual label column of the dataframe.
        """
        return self.__dataframe[self.__schema.actual_label_column_name]

    def get_actual_score_column(self) -> Series:
        """
        > This function returns the actual score column of the dataframe.
        :return: A series of the actual scores
        """
        return self.__dataframe[self.__schema.actual_score_column_name]

    def get_embedding_raw_text_column(self, embedding_feature: str) -> Series:
        """
        It returns the raw text column of the embedding feature.

        :param embedding_feature: str
        :type embedding_feature: str
        :return: The dataframe column that contains the raw text for the embedding feature.
        """
        return self.__dataframe[
            self.__schema.embedding_feature_column_names[embedding_feature].data_column_name
        ]

    def get_embedding_link_to_data_column(self, embedding_feature: str) -> Series:
        """
        > Given an embedding feature, return the column in the dataframe that links to the
        embedding feature

        :param embedding_feature: str
        :type embedding_feature: str
        :return: The link to the data column name.
        """
        return self.__dataframe[
            self.__schema.embedding_feature_column_names[embedding_feature].link_to_data_column_name
        ]

    @classmethod
    def from_dataframe(cls, dataframe: DataFrame, schema: Schema):
        """
        `from_dataframe` takes a `DataFrame` and a `Schema` and returns a `DataFrame` with the
        schema applied.

        :param cls: The class that we're creating
        :param dataframe: The dataframe to convert to a dataset
        :type dataframe: DataFrame
        :param schema: The schema of the dataframe
        :type schema: Schema
        :return: A DataFrame object
        """
        return cls(dataframe, schema)

    @classmethod
    def from_csv(cls, filepath: str, schema: Schema):
        """
        "Given a filepath and a schema, return a DataFrame object."

        The first line of the function is a docstring. It's a good idea to include docstrings in
        your functions. They're a
        great way to document your code

        :param cls: The class that we're creating an instance of
        :param filepath: The path to the CSV file
        :type filepath: str
        :param schema: The schema of the dataframe
        :type schema: Schema
        :return: A DataFrame object
        """
        return cls(read_csv(filepath), schema)

    @staticmethod
    def _parse_dataframe(dataframe: DataFrame, schema: Schema) -> DataFrame:
        """
        > It takes a dataframe and a schema, and returns a dataframe with only the columns that
        are in the schema

        :param dataframe: The dataframe to parse
        :type dataframe: DataFrame
        :param schema: The schema of the dataframe
        :type schema: Schema
        :return: A dataframe with the columns that are not in the schema dropped.
        """
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
