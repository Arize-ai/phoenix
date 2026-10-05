import pytest

from phoenix.server.api.exceptions import BadRequest
from phoenix.server.api.input_types.TimeBinConfig import (
    MAX_UNITS_PER_BIN,
    TimeBinConfig,
    TimeBinScale,
    TimeBucketSpec,
)


class TestTimeBucketSpecFromConfig:
    def test_defaults_without_config(self) -> None:
        assert TimeBucketSpec.from_config(None) == TimeBucketSpec(
            unit="hour", units_per_bin=1, utc_offset_minutes=0
        )

    def test_units_per_bin_defaults_to_one(self) -> None:
        config = TimeBinConfig(scale=TimeBinScale.DAY, utc_offset_minutes=-300)
        assert TimeBucketSpec.from_config(config) == TimeBucketSpec(
            unit="day", units_per_bin=1, utc_offset_minutes=-300
        )

    @pytest.mark.parametrize(
        "scale",
        [TimeBinScale.MINUTE, TimeBinScale.HOUR, TimeBinScale.DAY, TimeBinScale.WEEK],
    )
    def test_accepts_multiples_of_fixed_length_scales(self, scale: TimeBinScale) -> None:
        config = TimeBinConfig(scale=scale, utc_offset_minutes=330, units_per_bin=3)
        assert TimeBucketSpec.from_config(config) == TimeBucketSpec(
            unit=scale.value, units_per_bin=3, utc_offset_minutes=330
        )

    @pytest.mark.parametrize("scale", [TimeBinScale.MONTH, TimeBinScale.YEAR])
    def test_rejects_multiples_of_calendar_scales(self, scale: TimeBinScale) -> None:
        with pytest.raises(BadRequest):
            TimeBucketSpec.from_config(TimeBinConfig(scale=scale, units_per_bin=2))

    @pytest.mark.parametrize("scale", [TimeBinScale.MONTH, TimeBinScale.YEAR])
    def test_accepts_single_calendar_units(self, scale: TimeBinScale) -> None:
        spec = TimeBucketSpec.from_config(TimeBinConfig(scale=scale, units_per_bin=1))
        assert spec.unit == scale.value

    @pytest.mark.parametrize("units_per_bin", [0, -5, MAX_UNITS_PER_BIN + 1])
    def test_rejects_out_of_range_units_per_bin(self, units_per_bin: int) -> None:
        with pytest.raises(BadRequest):
            TimeBucketSpec.from_config(
                TimeBinConfig(scale=TimeBinScale.MINUTE, units_per_bin=units_per_bin)
            )

    def test_accepts_maximum_units_per_bin(self) -> None:
        config = TimeBinConfig(scale=TimeBinScale.MINUTE, units_per_bin=MAX_UNITS_PER_BIN)
        assert TimeBucketSpec.from_config(config).units_per_bin == MAX_UNITS_PER_BIN
