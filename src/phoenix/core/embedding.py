from dataclasses import dataclass
from typing import Iterator, Optional

from phoenix.core.composite_dimension_spec import CompositeDimensionSpec


@dataclass(frozen=True)
class Embedding(CompositeDimensionSpec):
    vector: str
    """The column name of the vector values."""
    raw_data: Optional[str] = None
    link_to_data: Optional[str] = None
    display_name: Optional[str] = None

    def __str__(self) -> str:
        return self.vector

    def __iter__(self) -> Iterator[str]:
        for value in (self.vector, self.raw_data, self.link_to_data):
            if isinstance(value, str) and value:
                yield value
