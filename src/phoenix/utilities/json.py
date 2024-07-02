import dataclasses
import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Mapping, Sequence, Union, get_args, get_origin

import numpy as np


def jsonify(obj: Any) -> Any:
    """
    Coerce object to be json serializable.
    """
    if isinstance(obj, Enum):
        return jsonify(obj.value)
    if isinstance(obj, (str, int, float, bool)) or obj is None:
        return obj
    if isinstance(obj, (list, set, frozenset, Sequence)):
        return [jsonify(v) for v in obj]
    if isinstance(obj, (dict, Mapping)):
        return {jsonify(k): jsonify(v) for k, v in obj.items()}
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
    if isinstance(obj, (datetime.date, datetime.datetime, datetime.time)):
        return obj.isoformat()
    if isinstance(obj, datetime.timedelta):
        return obj.total_seconds()
    if isinstance(obj, Path):
        return str(obj)
    if isinstance(obj, BaseException):
        return str(obj)
    if isinstance(obj, np.ndarray):
        return [jsonify(v) for v in obj]
    if hasattr(obj, "__float__"):
        return float(obj)
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
