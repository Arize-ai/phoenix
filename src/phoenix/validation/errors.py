from abc import ABC, abstractmethod
from typing import Iterable, List


class ValidationError(ABC):
    def __repr__(self) -> str:
        return self.__class__.__name__

    def __str__(self) -> str:
        return self.error_message()

    @abstractmethod
    def error_message(self) -> str:
        pass


class ValidationFailure(Exception):
    def __init__(self, errors: List[ValidationError]):
        self.errors = errors


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


class SchemaError(Exception):
    """An error raised when the schema is invalid or incomplete"""

    pass


class DatasetError(Exception):
    """An error raised when the dataset is invalid or incomplete"""

    pass
