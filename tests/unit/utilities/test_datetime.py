from datetime import datetime

import pytest

from phoenix.utilities import hour_of_week


@pytest.mark.parametrize(
    "dt,expected",
    [
        pytest.param(datetime(2023, 1, 1, 0, 0, 0), 0, id="sunday_midnight"),
        pytest.param(datetime(2023, 1, 1, 12, 0, 0), 12, id="sunday_noon"),
        pytest.param(datetime(2023, 1, 2, 0, 0, 0), 24, id="monday_midnight"),
        pytest.param(datetime(2023, 1, 7, 23, 0, 0), 167, id="saturday_last_hour"),
    ],
)
def test_get_hour_of_week(dt: datetime, expected: int) -> None:
    assert hour_of_week(dt) == expected
