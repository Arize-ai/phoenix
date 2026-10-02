import pytest

from phoenix.server.api.exceptions import BadRequest
from phoenix.server.api.input_types.TimeBinConfig import (
    MAX_TIME_BIN_INTERVAL,
    TimeBinConfig,
    TimeBinScale,
    TimeBucketSpec,
)


class TestTimeBucketSpecFromConfig:
    def test_defaults_without_config(self) -> None:
        assert TimeBucketSpec.from_config(None) == TimeBucketSpec(
            unit="hour", interval=1, utc_offset_minutes=0
        )

    def test_interval_defaults_to_one(self) -> None:
        config = TimeBinConfig(scale=TimeBinScale.DAY, utc_offset_minutes=-300)
        assert TimeBucketSpec.from_config(config) == TimeBucketSpec(
            unit="day", interval=1, utc_offset_minutes=-300
        )

    @pytest.mark.parametrize(
        "scale",
        [TimeBinScale.MINUTE, TimeBinScale.HOUR, TimeBinScale.DAY, TimeBinScale.WEEK],
    )
    def test_accepts_multiples_of_fixed_length_scales(self, scale: TimeBinScale) -> None:
        config = TimeBinConfig(scale=scale, utc_offset_minutes=330, interval=3)
        assert TimeBucketSpec.from_config(config) == TimeBucketSpec(
            unit=scale.value, interval=3, utc_offset_minutes=330
        )

    @pytest.mark.parametrize("scale", [TimeBinScale.MONTH, TimeBinScale.YEAR])
    def test_rejects_multiples_of_calendar_scales(self, scale: TimeBinScale) -> None:
        with pytest.raises(BadRequest):
            TimeBucketSpec.from_config(TimeBinConfig(scale=scale, interval=2))

    @pytest.mark.parametrize("scale", [TimeBinScale.MONTH, TimeBinScale.YEAR])
    def test_accepts_single_calendar_units(self, scale: TimeBinScale) -> None:
        spec = TimeBucketSpec.from_config(TimeBinConfig(scale=scale, interval=1))
        assert spec.unit == scale.value

    @pytest.mark.parametrize("interval", [0, -5, MAX_TIME_BIN_INTERVAL + 1])
    def test_rejects_out_of_range_intervals(self, interval: int) -> None:
        with pytest.raises(BadRequest):
            TimeBucketSpec.from_config(TimeBinConfig(scale=TimeBinScale.MINUTE, interval=interval))

    def test_accepts_maximum_interval(self) -> None:
        config = TimeBinConfig(scale=TimeBinScale.MINUTE, interval=MAX_TIME_BIN_INTERVAL)
        assert TimeBucketSpec.from_config(config).interval == MAX_TIME_BIN_INTERVAL
