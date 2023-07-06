from dataclasses import dataclass, field, replace
from typing import Any, Iterator

from phoenix.core.column import Column
from phoenix.core.dimension import Dimension
from phoenix.core.embedding import Embedding
from phoenix.core.helpers import coerce_to_string


@dataclass(frozen=True)
class EmbeddingDimension(Dimension):
    link_to_data: Column = field(default_factory=Column)
    raw_data: Column = field(default_factory=Column)
    display_name: str = ""

    def __post_init__(self) -> None:
        super().__post_init__()
        if not self.display_name:
            object.__setattr__(self, "display_name", self.name)
        # optimization: share the default series factory
        object.__setattr__(
            self,
            "link_to_data",
            replace(self.link_to_data, _default=self._default),
        )
        # optimization: share the default series factory
        object.__setattr__(
            self,
            "raw_data",
            replace(self.raw_data, _default=self._default),
        )

    @classmethod
    def from_embedding(cls, emb: Embedding, **kwargs: Any) -> "EmbeddingDimension":
        # Use `from_embedding` instead of `__init__` because the latter is
        # needed by replace() and we don't want to clobber the generated
        # version.
        return cls(
            coerce_to_string(emb.vector),
            link_to_data=Column(coerce_to_string(emb.link_to_data)),
            raw_data=Column(coerce_to_string(emb.raw_data)),
            display_name=coerce_to_string(emb.display_name),
            **kwargs,
        )

    def __iter__(self) -> Iterator[str]:
        """This is to partake in the iteration of column names by a
        larger data structure of which this object is a member.
        """
        yield from super().__iter__()
        if not self.raw_data.is_dummy:
            yield from self.raw_data
        if not self.link_to_data.is_dummy:
            yield from self.link_to_data
