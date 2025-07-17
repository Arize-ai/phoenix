from datetime import datetime, timezone

import pytest

from phoenix.datetime_utils import is_timezone_aware


class TestIsTimezoneAware:
    @pytest.mark.parametrize("t", [datetime.now(timezone.utc), datetime.now()])
    def test_is_timezone_aware(self, t: datetime) -> None:
        try:
            t < datetime.now(timezone.utc)
        except TypeError:
            assert not is_timezone_aware(t)
        else:
            assert is_timezone_aware(t)
