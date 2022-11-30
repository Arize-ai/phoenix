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
    def __init__(self, col: str) -> None:
        self.missing_col = col

    def error_message(self) -> str:
        return (
            f"The embedding vector column {self.missing_col} is declared in the schema "
            "but is not found in the dataframe."
        )


class MissingColumns(ValidationError):
    def __init__(self, cols: Iterable) -> None:
        self.missing_cols = cols

    def error_message(self) -> str:
        return (
            "The following columns are declared in the schema "
            "but are not found in the dataframe: "
            f"{', '.join(map(str, self.missing_cols))}."
        )


class DatasetError(Exception):
    """An error raised when the dataset is invalid or incomplete"""

    def __init__(self, errors: Union[ValidationError, List[ValidationError]]):
        self.errors = errors


class MissingField(ValidationError):
    def __init__(self, field: str) -> None:
        self.missing_field = field

    def error_message(self) -> str:
        return f"Schema is missing {self.missing_field}"


class MissingFields(ValidationError):
    def __init__(self, fields: Iterable[str]) -> None:
        self.missing_fields = fields

    def error_message(self) -> str:
        return (
            "Schema is missing the following fields: "
            f"{', '.join(map(str, self.missing_fields))}."
        )


class MissingEmbeddingFeatureColumnNames(ValidationError):
    def __init__(self, embedding_feature_name: str) -> None:
        self.embedding_feature_name = embedding_feature_name

    def error_message(self) -> str:
        return f"Schema is missing embedding_feature_column_names[{self.embedding_feature_name}]"


class MissingEmbeddingFeatureVectorColumnName(ValidationError):
    def __init__(self, embedding_feature_name: str) -> None:
        self.embedding_feature_name = embedding_feature_name

    def error_message(self) -> str:
        return (
            f"Schema is missing vector_column_name of embedding_feature_column_names"
            f"[{self.embedding_feature_name}]"
        )


class MissingEmbeddingFeatureRawDataColumnName(ValidationError):
    def __init__(self, embedding_feature_name: str) -> None:
        self.embedding_feature_name = embedding_feature_name

    def error_message(self) -> str:
        return (
            f"Schema is missing raw_data_column_name of embedding_feature_column_names"
            f"[{self.embedding_feature_name}]"
        )


class MissingEmbeddingFeatureLinkToDataColumnName(ValidationError):
    def __init__(self, embedding_feature_name: str) -> None:
        self.embedding_feature_name = embedding_feature_name

    def error_message(self) -> str:
        return (
            f"Schema is missing link_to_data_column_name of embedding_feature_column_names"
            f"[{self.embedding_feature_name}]"
        )


class SchemaError(Exception):
    """An error raised when the schema is invalid or incomplete"""

    def __init__(self, errors: Union[ValidationError, List[ValidationError]]):
        self.errors = errors
