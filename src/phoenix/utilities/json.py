import dataclasses
import datetime
from collections.abc import Mapping, Sequence
from enum import Enum
from io import StringIO
from pathlib import Path
from secrets import token_urlsafe
from typing import Any, TypedDict, Union, get_args, get_origin

import numpy as np
import pandas as pd
from pandas import Index
from strawberry import UNSET
from strawberry.types.base import StrawberryObjectDefinition


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


class DataFrameJSONPayload(TypedDict):
    index_names: dict[str, str]
    column_names: dict[str, str]
    records: str


def encode_df_as_json_payload(df: pd.DataFrame) -> DataFrameJSONPayload:
    df = df.copy()
    column_names = {f"{i}_{name}": name for i, name in enumerate(df.columns)}
    df.columns = Index(list(column_names.keys()))
    index_marker = token_urlsafe(8)  # to avoid conflict with existing column names
    index_names = {
        f"{i}_{index_marker}_{(name or '')}": name for i, name in enumerate(df.index.names)
    }
    df.index.names = list(index_names.keys())
    df = df.reset_index()
    records = df.to_json(orient="records", force_ascii=False)
    return {
        "index_names": index_names,
        "column_names": column_names,
        "records": records,
    }


def decode_df_from_json_payload(payload: DataFrameJSONPayload) -> pd.DataFrame:
    df = pd.read_json(StringIO(payload["records"]), orient="records", dtype=False)
    index_names = payload["index_names"]
    sorted_index_names = [""] * len(index_names)
    final_index_names = [""] * len(index_names)
    for index_name, final_index_name in index_names.items():
        i = int(index_name.split("_", 1)[0])
        sorted_index_names[i] = index_name
        final_index_names[i] = final_index_name
    column_names = payload["column_names"]
    if df.empty:
        index: "pd.Index[Any]"
        if len(final_index_names) == 1:
            index = pd.Index([], name=final_index_names[0], dtype=object)
        else:
            index = pd.MultiIndex.from_tuples([], names=final_index_names)
        sorted_column_names = [""] * len(column_names)
        final_column_names = [""] * len(column_names)
        for column_name, final_column_name in column_names.items():
            i = int(column_name.split("_", 1)[0])
            sorted_column_names[i] = column_name
            final_column_names[i] = final_column_name
        return pd.DataFrame([], columns=final_column_names, index=index)
    df = df.set_index(sorted_index_names, drop=True)
    df.index.names = final_index_names
    df = df.rename(columns=column_names)
    return df
