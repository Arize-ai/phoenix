from __future__ import annotations

import dataclasses
import datetime
from copy import deepcopy
from enum import Enum
from functools import singledispatch
from pathlib import Path
from typing import (
    Any,
    Dict,
    Iterable,
    List,
    Mapping,
    Optional,
    Sequence,
    SupportsFloat,
    Tuple,
    Union,
    get_args,
    get_origin,
)

import numpy as np


def jsonify(obj: Any) -> Any:
    """
    Coerce object to be json serializable.
    """
    if isinstance(obj, Enum):
        return jsonify(obj.value)
    if isinstance(obj, (str, int, float, bool)) or obj is None:
        return obj
    if isinstance(obj, np.ndarray):
        return [jsonify(v) for v in obj]
    if isinstance(obj, SupportsFloat):
        return float(obj)
    if dataclasses.is_dataclass(obj):
        return {
            k: jsonify(v)
            for field in dataclasses.fields(obj)
            if not (
                (v := getattr(obj, (k := field.name))) is None
                and get_origin(field) is Union
                and type(None) in get_args(field)
            )
        }
    if isinstance(obj, (Sequence, set, frozenset)):
        return [jsonify(v) for v in obj]
    if isinstance(obj, Mapping):
        return {jsonify(k): jsonify(v) for k, v in obj.items()}
    if isinstance(obj, (datetime.date, datetime.datetime, datetime.time)):
        return obj.isoformat()
    if isinstance(obj, datetime.timedelta):
        return obj.total_seconds()
    if isinstance(obj, Path):
        return str(obj)
    if isinstance(obj, BaseException):
        return str(obj)
    if hasattr(obj, "model_dump") and callable(obj.model_dump):
        # pydantic v2
        try:
            assert isinstance(d := obj.model_dump(), dict)
        except BaseException:
            pass
        else:
            return jsonify(d)
    if hasattr(obj, "dict") and callable(obj.dict):
        # pydantic v1
        try:
            assert isinstance(d := obj.dict(), dict)
        except BaseException:
            pass
        else:
            return jsonify(d)
    cls = obj.__class__
    return f"<{cls.__module__}.{cls.__name__} object>"


class ReadOnlyDict(Dict[str, Any]):
    def __init__(
        self,
        obj: Optional[Union[Mapping[str, Any], Iterable[Tuple[str, Any]]]] = None,
    ) -> None:
        super().__init__(_iterate(obj.items() if isinstance(obj, Mapping) else obj))

    def __deepcopy__(self, memo: Any) -> Dict[str, Any]:
        return {k: list(v) if isinstance(v, tuple) else deepcopy(v) for k, v in self.items()}

    def __setitem__(self, *args: Any, **kwargs: Any) -> None:
        raise RuntimeError("Object is read-only")

    def __delitem__(self, *args: Any, **kwargs: Any) -> None:
        raise RuntimeError("Object is read-only")

    def pop(self, *args: Any, **kwargs: Any) -> None:
        raise RuntimeError("Object is read-only")


def _iterate(kv: Optional[Iterable[Tuple[str, Any]]] = None) -> Iterable[Tuple[str, Any]]:
    return ((k, _read_only(v)) for k, v in (kv or ()))


@singledispatch
def _read_only(obj: Any) -> Any:
    return obj


@_read_only.register(list)
def _(obj: List[Any]) -> Tuple[Any, ...]:
    return tuple(_read_only(v) for v in obj)


@_read_only.register(dict)
def _(obj: Dict[str, Any]) -> Mapping[str, Any]:
    return ReadOnlyDict(obj)
