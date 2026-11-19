import importlib
import json
import pkgutil
from datetime import datetime, timezone
from typing import Any, Iterator, Literal, Mapping, Optional

import pytest

import phoenix.server.api.routers.v1 as v1
from phoenix.server.api.routers.v1.models import (
    IsoDatetime,
    V1RoutesBaseModel,
    datetime_encoder,
)


class TestIsoDatetime:
    def test_serialized_datetimes_are_parseable_iso_formatted_timestamps(self) -> None:
        class Model(V1RoutesBaseModel):
            datetime_field: IsoDatetime
            optional_field: Optional[IsoDatetime] = None
            string_field: str

        dt = datetime(2021, 1, 1, hour=2, minute=43, second=1, tzinfo=timezone.utc)
        model = Model(
            datetime_field=dt,
            optional_field=dt,
            string_field="test",
        )
        model_as_dict = json.loads(model.model_dump_json())
        assert set(model_as_dict.keys()) == {"datetime_field", "optional_field", "string_field"}
        assert model_as_dict["string_field"] == "test"
        for field in ("datetime_field", "optional_field"):
            datetime_field = model_as_dict[field]
            assert datetime_field == "2021-01-01T02:43:01+00:00"
            assert dt == datetime.fromisoformat(datetime_field)

    def test_none_is_left_alone(self) -> None:
        class Model(V1RoutesBaseModel):
            optional_field: Optional[IsoDatetime] = None

        assert json.loads(Model().model_dump_json()) == {"optional_field": None}

    def test_python_mode_keeps_the_datetime(self) -> None:
        class Model(V1RoutesBaseModel):
            datetime_field: IsoDatetime

        dt = datetime(2021, 1, 1, tzinfo=timezone.utc)
        assert Model(datetime_field=dt).model_dump() == {"datetime_field": dt}

    @pytest.mark.parametrize("mode", ["validation", "serialization"])
    def test_json_schema_keeps_the_date_time_format(
        self, mode: Literal["validation", "serialization"]
    ) -> None:
        class Model(V1RoutesBaseModel):
            datetime_field: IsoDatetime

        schema = Model.model_json_schema(mode=mode)["properties"]["datetime_field"]
        assert schema == {"format": "date-time", "title": "Datetime Field", "type": "string"}


def _v1_route_models() -> Iterator[type[V1RoutesBaseModel]]:
    for module in pkgutil.iter_modules(v1.__path__):
        importlib.import_module(f"{v1.__name__}.{module.name}")
    importlib.import_module("phoenix.server.api.routers.agents")

    def subclasses(cls: type[V1RoutesBaseModel]) -> Iterator[type[V1RoutesBaseModel]]:
        for sub in cls.__subclasses__():
            yield sub
            yield from subclasses(sub)

    yield from sorted(set(subclasses(V1RoutesBaseModel)), key=lambda c: c.__qualname__)


def _bare_datetime_fields(model: type[V1RoutesBaseModel]) -> list[str]:
    """Names of the model's own fields with a datetime not serialized by `datetime_encoder`.

    Walks each field's core schema through containers, unions, and nullables,
    but not into nested models, which are checked as models of their own.
    """
    root: Mapping[str, Any] = model.__pydantic_core_schema__
    while root["type"] in ("definitions", "function-after", "function-before", "function-wrap"):
        root = root["schema"]
    return [name for name, field in root["schema"]["fields"].items() if not _encoded(field, name)]


def _encoded(node: Any, name: str) -> bool:
    if isinstance(node, dict):
        if node.get("type") == "datetime":
            return node.get("serialization", {}).get("function") is datetime_encoder
        if node.get("type") in ("model", "definition-ref", "dataclass"):
            return True
        return all(_encoded(value, name) for key, value in node.items() if key != "metadata")
    if isinstance(node, (list, tuple)):
        return all(_encoded(item, name) for item in node)
    return True


@pytest.mark.parametrize("model", list(_v1_route_models()), ids=lambda m: m.__qualname__)
def test_every_v1_datetime_field_is_an_iso_datetime(model: type[V1RoutesBaseModel]) -> None:
    """A bare `datetime` on a route model would serialize with a `Z` suffix that
    `datetime.fromisoformat` rejects on Python 3.10."""
    assert _bare_datetime_fields(model) == []
