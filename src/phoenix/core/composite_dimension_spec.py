from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Iterator

from phoenix.core.schema_spec import SchemaSpec


@dataclass(frozen=True)
class CompositeDimensionSpec(SchemaSpec, ABC):
    """A dimension referencing multiple columns (besides its primary column).
    E.x. Embedding can point to 3 columns
    """

    @abstractmethod
    def __str__(self) -> str:
        """This lets the spec behave like a string in some situations,
        because it's basically a column name, but with extra stuff.
        """
        ...

    @abstractmethod
    def __iter__(self) -> Iterator[str]:
        ...
