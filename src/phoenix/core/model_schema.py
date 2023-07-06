import json
import math
from dataclasses import dataclass, field, fields
from itertools import chain, groupby, repeat
from typing import (
    Any,
    Iterable,
    Iterator,
    List,
    Optional,
    Tuple,
    Union,
)

import pandas as pd

from phoenix.core.composite_dimension_spec import CompositeDimensionSpec
from phoenix.core.data_type import CONTINUOUS, DISCRETE, UNKNOWN
from phoenix.core.dataset_role import DatasetRole
from phoenix.core.dimension import Dimension
from phoenix.core.dimension_role import DimensionRole
from phoenix.core.embedding import Embedding
from phoenix.core.embedding_dimension import EmbeddingDimension
from phoenix.core.helpers import coerce_to_string, iterate_except_str
from phoenix.core.model import Model
from phoenix.core.multi_dimensional_role import FEATURE, TAG
from phoenix.core.scalar_dimension import ScalarDimension
from phoenix.core.schema_spec import SchemaSpec
from phoenix.core.singular_dimensional_role import (
    ACTUAL_LABEL,
    ACTUAL_SCORE,
    PREDICTION_ID,
    PREDICTION_LABEL,
    PREDICTION_SCORE,
    PROMPT,
    RESPONSE,
    TIMESTAMP,
)
from phoenix.core.types import Name


@dataclass(frozen=True)
class ModelSchema(SchemaSpec):
    prediction_id: Optional[str] = None
    timestamp: Optional[str] = None
    prediction_label: Optional[str] = None
    prediction_score: Optional[str] = None
    actual_label: Optional[str] = None
    actual_score: Optional[str] = None
    prompt: Optional[Embedding] = None
    response: Optional[Embedding] = None
    features: Iterable[Union[str, CompositeDimensionSpec]] = field(default_factory=list)
    tags: Iterable[Union[str, CompositeDimensionSpec]] = field(default_factory=list)

    # internal attribute not exposed to users
    _dimensions: List[Dimension] = field(
        init=False, repr=False, hash=False, compare=False, default_factory=list
    )

    def __post_init__(self) -> None:
        super().__post_init__()
        object.__setattr__(self, "features", tuple(iterate_except_str(self.features)))
        object.__setattr__(self, "tags", tuple(iterate_except_str(self.tags)))
        grouped_by_name = groupby(
            sorted(self._make_dims(), key=lambda dim: (dim.name, dim.role)),
            key=lambda dim: dim.name,
        )
        for name, group in grouped_by_name:
            self._dimensions.append(next(group))

    def _make_dims(self) -> Iterator[Dimension]:
        """Iterate over all dimensions defined by the Schema, substituting
        with dummy dimensions for ones omitted by user. The dummy dimensions
        have randomly generated names that can change for each iteration, but
        currently there's no need to iterate more than once."""
        for spec, role, data_type in chain(
            (
                (self.prediction_id, PREDICTION_ID, DISCRETE),
                (self.timestamp, TIMESTAMP, CONTINUOUS),
                (self.prediction_label, PREDICTION_LABEL, DISCRETE),
                (self.prediction_score, PREDICTION_SCORE, CONTINUOUS),
                (self.actual_label, ACTUAL_LABEL, DISCRETE),
                (self.actual_score, ACTUAL_SCORE, CONTINUOUS),
                (self.prompt, PROMPT, DISCRETE),
                (self.response, RESPONSE, DISCRETE),
            ),
            zip(self.features, repeat(FEATURE), repeat(UNKNOWN)),
            zip(self.tags, repeat(TAG), repeat(UNKNOWN)),
        ):
            if not isinstance(spec, CompositeDimensionSpec):
                spec = coerce_to_string(spec)
            assert isinstance(role, DimensionRole)  # for mypy
            if isinstance(spec, str):
                if role in (PROMPT, RESPONSE):
                    yield EmbeddingDimension(
                        spec,
                        role=role,
                        data_type=data_type,
                    )
                else:
                    yield ScalarDimension(
                        spec,
                        role=role,
                        data_type=data_type,
                    )
            elif isinstance(spec, Embedding):
                yield EmbeddingDimension.from_embedding(
                    spec,
                    role=role,
                    data_type=data_type,
                )
            else:
                raise TypeError(f"{role} has unrecognized type: {type(spec)}")

    def __call__(
        self,
        *dataframes: Union[pd.DataFrame, Tuple[Name, pd.DataFrame]],
        **kwargs: Any,
    ) -> Model:
        """Dimensions are the "baton" that Schema hands over to Model."""
        _raise_if_too_many_dataframes(len(dataframes))
        return Model(iter(self._dimensions), dataframes, **kwargs)

    def __iter__(self) -> Iterator[str]:
        for f in fields(self):
            if not f.init:
                continue
            value = getattr(self, f.name)
            if isinstance(value, str) and value:
                yield value
                continue
            try:
                for v in iter(value):
                    if isinstance(v, str) and v:
                        yield v
                        continue
                    try:
                        yield from iter(v)
                    except TypeError:
                        pass
            except TypeError:
                pass

    def to_json(self) -> str:
        return json.dumps(_jsonify(self))

    @classmethod
    def from_json(cls, input: str) -> "ModelSchema":
        data = json.loads(input)
        try:
            return cls(**{k: _objectify(v) for k, v in data.items()})
        except ValueError as e:
            raise ValueError(f"invalid json data: {repr(data)}") from e


def _raise_if_too_many_dataframes(given: int) -> None:
    limit = len(DatasetRole)
    if not 0 < given <= limit:
        raise ValueError(f"expected between 1 to {limit} dataframes, but {given} were given")


def _jsonify(obj: Any) -> Any:
    if getattr(obj, "__dataclass_fields__", None):
        return {
            attribute.name: _jsonify(value)
            for attribute in fields(obj)
            if attribute.init
            and (value := getattr(obj, attribute.name)) not in ("", None)
            and (not hasattr(value, "__len__") or len(value))
        }
    if isinstance(obj, str):
        return obj
    if isinstance(obj, Iterable):
        return list(map(_jsonify, iter(obj)))
    if isinstance(obj, float) and math.isnan(obj):
        return None
    return obj


def _objectify(json_data: Any) -> Any:
    if isinstance(json_data, str):
        return json_data
    if isinstance(json_data, list):
        return list(map(_objectify, json_data))
    assert isinstance(json_data, dict)
    json_data = {key: _objectify(value) for key, value in json_data.items()}
    # Note that this looks only at the immediate subclasses.
    for cls in CompositeDimensionSpec.__subclasses__():
        try:
            return cls(**json_data)  # type: ignore
        except TypeError:
            pass
    raise ValueError(f"invalid json data: {repr(json_data)}")
    raise ValueError(f"invalid json data: {repr(json_data)}")
