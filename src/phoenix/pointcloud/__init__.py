import collections
import typing
from abc import ABC
from dataclasses import dataclass, fields
from typing import TYPE_CHECKING, Any, Iterator

# workaround for type checker
# https://github.com/python/mypy/issues/5446#issuecomment-412043677
if TYPE_CHECKING:
    _BaseMapping = typing.Mapping[str, Any]
else:
    _BaseMapping = collections.abc.Mapping


@dataclass(frozen=True)
class Parameters(_BaseMapping, ABC):
    def __getitem__(self, key: str) -> Any:
        return getattr(self, key)

    def __iter__(self) -> Iterator[str]:
        return (f.name for f in fields(self) if f.init and not f.name.startswith("_"))

    def __len__(self) -> int:
        return sum(1 for _ in self)
