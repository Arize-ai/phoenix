from abc import ABC, abstractmethod
from typing import Iterable, List, Union


class ValidationError(ABC):
    def __repr__(self) -> str:
        return self.__class__.__name__

    def __str__(self) -> str:
        return self.error_message()

    @abstractmethod
    def error_message(self) -> str:
        pass


class MissingVectorColumn(ValidationError):
    """An error raised when the dataset is missing an embedding vector column specified in the
    schema"""

    def __init__(self, col: str) -> None:
        self.missing_col = col

    def error_message(self) -> str:
        return (
            f"The embedding vector column {self.missing_col} is declared in the Schema "
            "but is not found in the data."
        )


class MissingColumns(ValidationError):
    """An error raised when the dataset is missing columns specified in the schema"""

    def __init__(self, cols: Iterable[str]) -> None:
        self.missing_cols = cols

    def error_message(self) -> str:
        return (
            "The following columns are declared in the Schema "
            "but are not found in the dataframe: "
            f"{', '.join(map(str, self.missing_cols))}."
        )


class DatasetError(Exception):
    """An error raised when the dataset is invalid or incomplete"""

    def __init__(self, errors: Union[ValidationError, List[ValidationError]]):
        self.errors = errors


class InvalidColumnType(ValidationError):
    """An error raised when the column type is invalid"""

    def __init__(self, error_msgs: Iterable[str]) -> None:
        self.error_msgs = error_msgs

    def error_message(self) -> str:
        return f"Invalid column types: {self.error_msgs}"


class MissingField(ValidationError):
    """An error raised when trying to access a field that is absent from the Schema"""

    def __init__(self, field: str) -> None:
        self.missing_field = field

    def error_message(self) -> str:
        return f"Schema is missing {self.missing_field}"


class MissingEmbeddingFeatureColumnNames(ValidationError):
    """An error raised when trying to access an EmbeddingColumnNames config that is absent
    from the schema"""

    def __init__(self, embedding_feature_name: str) -> None:
        self.embedding_feature_name = embedding_feature_name

    def error_message(self) -> str:
        return f"Schema is missing embedding_feature_column_names[{self.embedding_feature_name}]"


class MissingEmbeddingFeatureVectorColumnName(ValidationError):
    """An error raised when trying to access an EmbeddingColumnNames.vector_column_name
    that is absent from the schema"""

    def __init__(self, embedding_feature_name: str) -> None:
        self.embedding_feature_name = embedding_feature_name

    def error_message(self) -> str:
        return (
            f"Schema is missing vector_column_name of embedding_feature_column_names"
            f"[{self.embedding_feature_name}]"
        )


class MissingEmbeddingFeatureRawDataColumnName(ValidationError):
    """An error raised when trying to access an EmbeddingColumnNames.raw_data_column_name
    that is absent from the schema"""

    def __init__(self, embedding_feature_name: str) -> None:
        self.embedding_feature_name = embedding_feature_name

    def error_message(self) -> str:
        return (
            f"Schema is missing raw_data_column_name of embedding_feature_column_names"
            f"[{self.embedding_feature_name}]"
        )


class MissingEmbeddingFeatureLinkToDataColumnName(ValidationError):
    """An error raised when trying to access an EmbeddingColumnNames.link_to_data_column_name
    absent from the schema"""

    def __init__(self, embedding_feature_name: str) -> None:
        self.embedding_feature_name = embedding_feature_name

    def error_message(self) -> str:
        return (
            f"Schema is missing link_to_data_column_name of embedding_feature_column_names"
            f"[{self.embedding_feature_name}]"
        )


class SchemaError(Exception):
    """An error raised when the Schema is invalid or incomplete"""

    def __init__(self, errors: Union[ValidationError, List[ValidationError]]):
        self.errors = errors
