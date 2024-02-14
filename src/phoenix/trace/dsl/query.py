import json
from collections import defaultdict
from dataclasses import dataclass, field, fields, replace
from functools import cached_property, partial
from types import MappingProxyType
from typing import (
    Any,
    Callable,
    ClassVar,
    Dict,
    Iterable,
    Iterator,
    List,
    Mapping,
    Optional,
    Sequence,
    Tuple,
    cast,
)

import pandas as pd
from openinference.semconv.trace import SpanAttributes

from phoenix.trace.dsl import SpanFilter
from phoenix.trace.dsl.filter import SupportsGetSpanEvaluation
from phoenix.trace.schemas import ATTRIBUTE_PREFIX, CONTEXT_PREFIX, Span
from phoenix.trace.span_json_encoder import span_to_json

RETRIEVAL_DOCUMENTS = SpanAttributes.RETRIEVAL_DOCUMENTS

_SPAN_ID = "context.span_id"
_PRESCRIBED_POSITION_PREFIXES = {
    RETRIEVAL_DOCUMENTS: "document_",
    ATTRIBUTE_PREFIX + RETRIEVAL_DOCUMENTS: "document_",
}
_ALIASES = {
    "span_id": "context.span_id",
    "trace_id": "context.trace_id",
}

# Because UUIDs is not convertible to Parquet,
# they need to be converted to string.
_CONVERT_TO_STRING = (
    "context.span_id",
    "context.trace_id",
    "parent_id",
)


def _unalias(key: str) -> str:
    return _ALIASES.get(key, key)


@dataclass(frozen=True)
class Projection:
    key: str = ""
    value: Callable[[Span], Any] = field(init=False, repr=False)
    span_fields: ClassVar[Tuple[str, ...]] = tuple(f.name for f in fields(Span))

    def __bool__(self) -> bool:
        return bool(self.key)

    def __post_init__(self) -> None:
        key = _unalias(self.key)
        object.__setattr__(self, "key", key)
        if key.startswith(CONTEXT_PREFIX):
            key = key[len(CONTEXT_PREFIX) :]
            value = partial(self._from_context, key=key)
        elif key.startswith(ATTRIBUTE_PREFIX):
            key = self.key[len(ATTRIBUTE_PREFIX) :]
            value = partial(self._from_attributes, key=key)
        elif key in self.span_fields:
            value = partial(self._from_span, key=key)
        else:
            value = partial(self._from_attributes, key=key)
        if self.key in _CONVERT_TO_STRING:
            object.__setattr__(
                self,
                "value",
                lambda span: None if (v := value(span)) is None else str(v),
            )
        else:
            object.__setattr__(self, "value", value)

    def __call__(self, span: Span) -> Any:
        return self.value(span)

    @staticmethod
    def _from_attributes(span: Span, key: str) -> Any:
        return span.attributes.get(key)

    @staticmethod
    def _from_context(span: Span, key: str) -> Any:
        return getattr(span.context, key, None)

    @staticmethod
    def _from_span(span: Span, key: str) -> Any:
        return getattr(span, key, None)

    def to_dict(self) -> Dict[str, Any]:
        return {"key": self.key}

    @classmethod
    def from_dict(cls, obj: Mapping[str, Any]) -> "Projection":
        return cls(
            **({"key": cast(str, key)} if (key := obj.get("key")) else {}),
        )


@dataclass(frozen=True)
class Explosion(Projection):
    kwargs: Mapping[str, str] = field(default_factory=lambda: MappingProxyType({}))
    primary_index_key: str = "context.span_id"

    position_prefix: str = field(init=False, repr=False)
    primary_index: Projection = field(init=False, repr=False)

    def __post_init__(self) -> None:
        super().__post_init__()
        position_prefix = _PRESCRIBED_POSITION_PREFIXES.get(self.key, "")
        object.__setattr__(self, "position_prefix", position_prefix)
        object.__setattr__(self, "primary_index", Projection(self.primary_index_key))

    @cached_property
    def index_keys(self) -> Tuple[str, str]:
        return (self.primary_index.key, f"{self.position_prefix}position")

    def with_primary_index_key(self, primary_index_key: str) -> "Explosion":
        return replace(self, primary_index_key=primary_index_key)

    def __call__(self, span: Span) -> Iterator[Dict[str, Any]]:
        if not isinstance(seq := self.value(span), Sequence):
            return
        has_mapping = False
        for item in seq:
            if isinstance(item, Mapping):
                has_mapping = True
                break
        if not has_mapping:
            for i, item in enumerate(seq):
                if item is not None:
                    yield {
                        self.key: item,
                        self.primary_index.key: self.primary_index(span),
                        f"{self.position_prefix}position": i,
                    }
            return
        for i, item in enumerate(seq):
            if not isinstance(item, Mapping):
                continue
            record = (
                {name: item.get(key) for name, key in self.kwargs.items()}
                if self.kwargs
                else dict(item)
            )
            for v in record.values():
                if v is not None:
                    break
            else:
                record = {}
            if not record:
                continue
            record[self.primary_index.key] = self.primary_index(span)
            record[f"{self.position_prefix}position"] = i
            yield record

    def to_dict(self) -> Dict[str, Any]:
        return {
            **super().to_dict(),
            **({"kwargs": dict(self.kwargs)} if self.kwargs else {}),
            "primary_index_key": self.primary_index_key,
        }

    @classmethod
    def from_dict(cls, obj: Mapping[str, Any]) -> "Explosion":
        return cls(
            **({"key": cast(str, key)} if (key := obj.get("key")) else {}),  # type: ignore
            **(
                {"kwargs": MappingProxyType(dict(cast(Mapping[str, str], kwargs)))}  # type: ignore
                if (kwargs := obj.get("kwargs"))
                else {}
            ),
            **(
                {"primary_index_key": cast(str, primary_index_key)}  # type: ignore
                if (primary_index_key := obj.get("primary_index_key"))
                else {}
            ),
        )


@dataclass(frozen=True)
class Concatenation(Projection):
    kwargs: Mapping[str, str] = field(default_factory=lambda: MappingProxyType({}))
    separator: str = "\n\n"

    def with_separator(self, separator: str = "\n\n") -> "Concatenation":
        return replace(self, separator=separator)

    def __call__(self, span: Span) -> Iterator[Tuple[str, str]]:
        if not isinstance(seq := self.value(span), Sequence):
            return
        if not self.kwargs:
            yield self.key, self.separator.join(map(str, seq))
        record = defaultdict(list)
        for item in seq:
            if not isinstance(item, Mapping):
                continue
            for k, v in self.kwargs.items():
                if value := item.get(v):
                    record[k].append(value)
        for name, values in record.items():
            yield name, self.separator.join(map(str, values))

    def to_dict(self) -> Dict[str, Any]:
        return {
            **super().to_dict(),
            **({"kwargs": dict(self.kwargs)} if self.kwargs else {}),
            "separator": self.separator,
        }

    @classmethod
    def from_dict(cls, obj: Mapping[str, Any]) -> "Concatenation":
        return cls(
            **({"key": cast(str, key)} if (key := obj.get("key")) else {}),  # type: ignore
            **(
                {"kwargs": MappingProxyType(dict(cast(Mapping[str, str], kwargs)))}  # type: ignore
                if (kwargs := obj.get("kwargs"))
                else {}
            ),
            **(
                {"separator": cast(str, separator)}  # type: ignore
                if (separator := obj.get("separator"))
                else {}
            ),
        )


@dataclass(frozen=True)
class SpanQuery:
    _select: Mapping[str, Projection] = field(default_factory=lambda: MappingProxyType({}))
    _concat: Concatenation = field(default_factory=Concatenation)
    _explode: Explosion = field(default_factory=Explosion)
    _filter: SpanFilter = field(default_factory=SpanFilter)
    _rename: Mapping[str, str] = field(default_factory=lambda: MappingProxyType({}))
    _index: Projection = field(default_factory=lambda: Projection("context.span_id"))

    def __bool__(self) -> bool:
        return bool(self._select) or bool(self._filter) or bool(self._explode) or bool(self._concat)

    def select(self, *args: str, **kwargs: str) -> "SpanQuery":
        _select = {
            _unalias(name): Projection(key) for name, key in (*zip(args, args), *kwargs.items())
        }
        return replace(self, _select=MappingProxyType(_select))

    def where(self, condition: str) -> "SpanQuery":
        _filter = SpanFilter(condition)
        return replace(self, _filter=_filter)

    def explode(self, key: str, **kwargs: str) -> "SpanQuery":
        _explode = Explosion(key=key, kwargs=kwargs, primary_index_key=self._index.key)
        return replace(self, _explode=_explode)

    def concat(self, key: str, **kwargs: str) -> "SpanQuery":
        _concat = Concatenation(key=key, kwargs=kwargs)
        return replace(self, _concat=_concat)

    def rename(self, **kwargs: str) -> "SpanQuery":
        _rename = MappingProxyType(kwargs)
        return replace(self, _rename=_rename)

    def with_index(self, key: str = "context.span_id") -> "SpanQuery":
        _index = Projection(key=key)
        return replace(self, _index=_index)

    def with_concat_separator(self, separator: str = "\n\n") -> "SpanQuery":
        _concat = self._concat.with_separator(separator)
        return replace(self, _concat=_concat)

    def with_explode_primary_index_key(self, primary_index_key: str) -> "SpanQuery":
        _explode = self._explode.with_primary_index_key(primary_index_key)
        return replace(self, _explode=_explode)

    def __call__(self, spans: Iterable[Span]) -> pd.DataFrame:
        if self._filter:
            spans = filter(self._filter, spans)
        if self._explode:
            spans = filter(
                lambda span: (isinstance(seq := self._explode.value(span), Sequence) and len(seq)),
                spans,
            )
        if self._concat:
            spans = filter(
                lambda span: (isinstance(seq := self._concat.value(span), Sequence) and len(seq)),
                spans,
            )
        if not (self._select or self._explode or self._concat):
            if not (data := [json.loads(span_to_json(span)) for span in spans]):
                return pd.DataFrame()
            return (
                pd.json_normalize(data, max_level=1)
                .rename(self._rename, axis=1, errors="ignore")
                .set_index("context.span_id", drop=False)
            )
        _selected: List[Dict[str, Any]] = []
        _exploded: List[Dict[str, Any]] = []
        for span in spans:
            if self._select:
                record = {name: proj(span) for name, proj in self._select.items()}
                for v in record.values():
                    if v is not None:
                        break
                else:
                    record = {}
                if self._concat:
                    record.update(self._concat(span))
                if record:
                    if self._index.key not in record:
                        record[self._index.key] = self._index(span)
                    _selected.append(record)
            elif self._concat:
                record = {self._index.key: self._index(span)}
                record.update(self._concat(span))
                if record:
                    _selected.append(record)
            if self._explode:
                _exploded.extend(self._explode(span))
        if _selected:
            select_df = pd.DataFrame(_selected)
        else:
            select_df = pd.DataFrame(columns=[self._index.key])
        select_df = select_df.set_index(self._index.key)
        if self._explode:
            if _exploded:
                explode_df = pd.DataFrame(_exploded)
            else:
                explode_df = pd.DataFrame(columns=self._explode.index_keys)
            explode_df = explode_df.set_index(list(self._explode.index_keys))
            if not self._select:
                return explode_df.rename(self._rename, axis=1, errors="ignore")
            select_df = select_df.join(explode_df, how="outer")
        return select_df.rename(self._rename, axis=1, errors="ignore")

    def to_dict(self) -> Dict[str, Any]:
        return {
            **(
                {"select": {name: proj.to_dict() for name, proj in self._select.items()}}
                if self._select
                else {}
            ),
            "filter": self._filter.to_dict(),
            "explode": self._explode.to_dict(),
            "concat": self._concat.to_dict(),
            **({"rename": dict(self._rename)} if self._rename else {}),
            "index": self._index.to_dict(),
        }

    @classmethod
    def from_dict(
        cls,
        obj: Mapping[str, Any],
        evals: Optional[SupportsGetSpanEvaluation] = None,
        valid_eval_names: Optional[Sequence[str]] = None,
    ) -> "SpanQuery":
        return cls(
            **(
                {
                    "_select": MappingProxyType(
                        {
                            name: Projection.from_dict(proj)
                            for name, proj in cast(Mapping[str, Any], select).items()
                        }
                    )
                }  # type: ignore
                if (select := obj.get("select"))
                else {}
            ),
            **(
                {
                    "_filter": SpanFilter.from_dict(
                        cast(Mapping[str, Any], filter),
                        evals=evals,
                        valid_eval_names=valid_eval_names,
                    )
                }  # type: ignore
                if (filter := obj.get("filter"))
                else {}
            ),
            **(
                {"_explode": Explosion.from_dict(cast(Mapping[str, Any], explode))}  # type: ignore
                if (explode := obj.get("explode"))
                else {}
            ),
            **(
                {"_concat": Concatenation.from_dict(cast(Mapping[str, Any], concat))}  # type: ignore
                if (concat := obj.get("concat"))
                else {}
            ),
            **(
                {"_rename": MappingProxyType(dict(cast(Mapping[str, str], rename)))}  # type: ignore
                if (rename := obj.get("rename"))
                else {}
            ),
            **(
                {"_index": Projection.from_dict(cast(Mapping[str, Any], index))}  # type: ignore
                if (index := obj.get("index"))
                else {}
            ),
        )
