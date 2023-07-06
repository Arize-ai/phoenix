from typing import Any, List, Sequence, Tuple, Type, Union

import pandas as pd
from typing_extensions import TypeAlias, TypeGuard

from phoenix.core.column import Column
from phoenix.core.dimension import Dimension
from phoenix.core.dimension_role import DimensionRole
from phoenix.core.embedding_dimension import EmbeddingDimension
from phoenix.core.multi_dimensional_role import MultiDimensionalRole
from phoenix.core.scalar_dimension import ScalarDimension
from phoenix.core.singular_dimensional_role import SingularDimensionalRole

Name: TypeAlias = str
ColumnKey: TypeAlias = Union[Name, Column, SingularDimensionalRole]


def is_column_key(key: Any) -> TypeGuard[ColumnKey]:
    return isinstance(key, (str, Column, SingularDimensionalRole))


MultiDimensionKey: TypeAlias = Union[MultiDimensionalRole, Sequence[DimensionRole]]


def is_multi_dimension_key(
    key: Any,
) -> TypeGuard[MultiDimensionKey]:
    if isinstance(key, str):
        return False
    try:
        for k in iter(key):
            if not isinstance(k, DimensionRole):
                return False
        return True
    except TypeError:
        return isinstance(key, MultiDimensionalRole)


def is_dimension_type_filter(
    key: Any,
) -> TypeGuard[Tuple[MultiDimensionKey, Union[Type[ScalarDimension], Type[EmbeddingDimension]]]]:
    return (
        isinstance(key, tuple)
        and len(key) == 2
        and is_multi_dimension_key(key[0])
        and isinstance(key[1], (Dimension, EmbeddingDimension))
    )


def is_named_df(obj: Any) -> TypeGuard[Tuple[Name, pd.DataFrame]]:
    return (
        isinstance(obj, tuple)
        and len(obj) == 2
        and isinstance(obj[0], str)
        and isinstance(obj[1], pd.DataFrame)
    )


RowNumbering: TypeAlias = Union[int, List[int]]
RowId: TypeAlias = int
