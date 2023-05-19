import collections
import typing
from abc import ABC, abstractmethod
from dataclasses import dataclass, field, fields
from typing import TYPE_CHECKING, Any, Dict, Generic, Iterator, List, TypeVar, get_args

import strawberry

# workaround or type checker
# https://github.com/python/mypy/issues/5446#issuecomment-412043677
if TYPE_CHECKING:
    _BaseMapping = typing.Mapping[str, Any]
else:
    _BaseMapping = collections.abc.Mapping

_T = TypeVar("_T")


@dataclass
class Config(Generic[_T], _BaseMapping, ABC):
    def __getitem__(self, key: str) -> Any:
        return getattr(self, key)

    def __iter__(self) -> Iterator[str]:
        return (f.name for f in fields(self) if f.init and not f.name.startswith("_"))

    def __len__(self) -> int:
        return sum(1 for _ in self)

    @abstractmethod
    def __call__(self) -> _T:
        ...


@dataclass
class OneOf(Config[_T]):
    """An ad hoc, but not type-safe, workaround until OneOf Input Objects
    become generally available in GraphQL.
    See e.g. https://github.com/graphql/graphql-spec/pull/825
    """

    _the_chosen_one: strawberry.Private[Config[_T]] = field(init=False)

    def __post_init__(self) -> None:
        options: Dict[str, Config[_T]] = dict(**self)
        got = [
            f.name
            for f in fields(self)
            if f.name in options
            and isinstance(
                (t := options[f.name]),
                get_args(f.type),
            )
            and not isinstance(t, type(None))
        ]
        if (count := len(got)) != 1:
            name = _lower_first_letter(self.__class__.__name__)
            number = "only one" if count else "one (and only one)"
            params = _join(list(options.keys()), "or")
            raise ValueError(
                f"must specify {number} of the following "
                f"options for {name}: {params}; got"
                f"{f' {count}: {_join(got)}' if count else ' none'}"
            )
        self._the_chosen_one = options[got[0]]

    def __call__(self) -> _T:
        return self._the_chosen_one()


def _join(items: List[Any], connector: str = "and") -> str:
    if (count := len(items)) <= 1:
        return repr(items[0]) if count else ""
    return f"{', '.join(map(repr, items[:-1]))} {connector} {repr(items[-1])}"


def _lower_first_letter(name: str) -> str:
    if len(name) < 1:
        return name
    return name[0].lower() + name[1:]
