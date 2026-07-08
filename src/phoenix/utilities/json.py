import dataclasses
import datetime
from collections.abc import Mapping, Sequence
from enum import Enum
from io import StringIO
from pathlib import Path
from typing import Any, Union, cast, get_args, get_origin

import numpy as np
import pandas as pd
from pandas.io.json import build_table_schema
from pandas.io.json._table_schema import parse_table_schema  # type: ignore
from strawberry import UNSET
from strawberry.types.base import StrawberryObjectDefinition

try:
    from pandas.io.json import ujson_dumps  # type: ignore
except ImportError:
    # https://github.com/pandas-dev/pandas/pull/54581
    from pandas.io.json import dumps as ujson_dumps  # type: ignore


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
    is_strawberry_type = isinstance(
        getattr(obj, "__strawberry_definition__", None), StrawberryObjectDefinition
    )
    if is_strawberry_type:
        return {
            k: jsonify(v)
            for field in dataclasses.fields(obj)
            if (v := getattr(obj, (k := field.name))) is not UNSET
        }
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


def encode_df_as_json_string(df: pd.DataFrame) -> str:
    index_names = df.index.names
    n = len(index_names)
    primary_key = [f"{i}_{(x or '')}" for i, x in enumerate(index_names)]
    df = df.set_axis([f"{i}_{x}" for i, x in enumerate(df.columns, n)], axis=1)
    df = df.reset_index(names=primary_key)
    schema = build_table_schema(df, False, primary_key)  # type: ignore
    data = df.to_dict("records")
    return cast(
        str,
        ujson_dumps(
            {"schema": schema, "data": data},
            date_unit="ns",
            iso_dates=True,
            ensure_ascii=False,
        ),
    )


def decode_df_from_json_string(obj: str) -> pd.DataFrame:
    # Note: read_json converts an all null column to NaN
    df = cast(pd.DataFrame, parse_table_schema(StringIO(obj).read(), False))
    df.index.names = [x.split("_", 1)[1] or None for x in df.index.names]  # type: ignore
    return df.set_axis([x.split("_", 1)[1] for x in df.columns], axis=1)
