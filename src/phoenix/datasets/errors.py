from abc import abstractmethod
from typing import Any, Iterable, List, Union


class ValidationError(Exception):
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


class InvalidSchemaError(ValidationError):
    def __repr__(self) -> str:
        return self.__class__.__name__

    def __init__(self, invalid_props: Iterable[str]) -> None:
        self.invalid_props = invalid_props

    def error_message(self) -> str:
        errors_string = ", ".join(map(str, self.invalid_props))
        return f"The schema is invalid: {errors_string}."


class DatasetError(Exception):
    """An error raised when the dataset is invalid or incomplete"""

    def __init__(self, errors: Union[ValidationError, List[ValidationError]]):
        self.errors: List[ValidationError] = errors if isinstance(errors, list) else [errors]

    def __str__(self) -> str:
        return "\n".join(map(str, self.errors))


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


class EmbeddingVectorSizeMismatch(ValidationError):
    """An error raised when there is an embedding feature with multiple different
    vector lengths"""

    def __init__(
        self, embedding_feature_name: str, vector_column_name: str, vector_lengths: List[int]
    ) -> None:
        self.embedding_feature_name = embedding_feature_name
        self.vector_column_name = vector_column_name
        self.vector_lengths = vector_lengths

    def error_message(self) -> str:
        return (
            f"Embedding vectors for an embedding feature must be of same length. "
            f"Found vectors with lengths of {self.vector_lengths} "
            f"{self.embedding_feature_name}.vector = {self.vector_column_name}"
        )


class InvalidEmbeddingReservedName(ValidationError):
    """An error raised when there is an embedding feature with a name, i.e. dictionary key,
    that is reserved
    """

    def __init__(
        self,
        reserved_name: str,
        schema_field: str,
    ) -> None:
        self.reserved_name = reserved_name
        self.schema_field = schema_field

    def error_message(self) -> str:
        return (
            f"Embedding feature name '{self.reserved_name}' is reserved and cannot be used. "
            f"This is the case when '{self.schema_field}' is not None."
        )


class InvalidEmbeddingVectorSize(ValidationError):
    """An error raised when there is an embedding feature with an invalid vector length"""

    def __init__(
        self, embedding_feature_name: str, vector_column_name: str, vector_length: int
    ) -> None:
        self.embedding_feature_name = embedding_feature_name
        self.vector_column_name = vector_column_name
        self.vector_length = vector_length

    def error_message(self) -> str:
        return (
            f"Embedding vectors cannot be less than 2 in size. Found vector"
            f" with size of {self.vector_length}; {self.embedding_feature_name}.vector = "
            f"{self.vector_column_name}"
        )


class InvalidEmbeddingVectorDataType(ValidationError):
    """An error raised when there is an embedding feature with a vector of an unsupported
    data type"""

    def __init__(self, embedding_feature_name: str, vector_column_type: str) -> None:
        self.embedding_feature_name = embedding_feature_name
        self.vector_column_type = vector_column_type

    def error_message(self) -> str:
        return (
            f"Embedding feature {self.embedding_feature_name} has vector type "
            f"{self.vector_column_type}. Must be list, np.ndarray or pd.Series"
        )


class InvalidEmbeddingVectorValuesDataType(ValidationError):
    """An error raised when there is an embedding feature with a vector that has
    values of an unsupported data type"""

    def __init__(self, embedding_feature_name: str, vector_column_name: str, vector: Any) -> None:
        self.embedding_feature_name = embedding_feature_name
        self.vector_column_name = vector_column_name
        self.vector = vector

    def error_message(self) -> str:
        return (
            f"Embedding vector must be a vector of integers and/or floats. Got {self.vector}; "
            f"{self.embedding_feature_name}.vector = {self.vector_column_name}"
        )


class MissingTimestampColumnName(ValidationError):
    """
    An error raised when trying to access a timestamp column that is absent from
    the schema.
    """

    def error_message(self) -> str:
        return "Schema is missing timestamp_column_name."


class SchemaError(Exception):
    """An error raised when the Schema is invalid or incomplete"""

    def __init__(self, errors: Union[ValidationError, List[ValidationError]]):
        self.errors = errors
