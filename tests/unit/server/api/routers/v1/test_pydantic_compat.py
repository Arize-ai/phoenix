import json
from datetime import datetime, timezone

from phoenix.server.api.routers.v1.models import V1RoutesBaseModel


class TestV1RoutesBaseModel:
    def test_serialized_datetimes_are_parseable_iso_formatted_timestamps(self) -> None:
        class Model(V1RoutesBaseModel):
            datetime_field: datetime
            string_field: str

        dt = datetime(2021, 1, 1, hour=2, minute=43, second=1, tzinfo=timezone.utc)
        model = Model(
            datetime_field=dt,
            string_field="test",
        )
        model_as_dict = json.loads(model.json())
        assert set(model_as_dict.keys()) == {"datetime_field", "string_field"}
        assert model_as_dict["string_field"] == "test"
        datetime_field = model_as_dict["datetime_field"]
        assert datetime_field == "2021-01-01T02:43:01+00:00"
        assert dt == datetime.fromisoformat(datetime_field)
