from datetime import timedelta
from typing import Callable

import pytest

from phoenix.config import (
    ENV_PHOENIX_ACCESS_TOKEN_EXPIRY,
    ENV_PHOENIX_REFRESH_TOKEN_EXPIRY,
    get_env_access_token_expiry,
    get_env_refresh_token_expiry,
)


@pytest.mark.parametrize(
    "env_var_value, expected_value",
    (
        pytest.param("3600", timedelta(seconds=3600), id="with-positive-unitless-integer"),
        pytest.param("3600.10", timedelta(seconds=3600.10), id="with-positive-decimal"),
        pytest.param("36 days", timedelta(days=36), id="with-positive-day-unit"),
        pytest.param("36d", timedelta(days=36), id="with-positive-d-unit"),
        pytest.param(
            "P4M6DT3H12M45S",
            timedelta(days=(4 * 30 + 6), hours=3, minutes=12, seconds=45),
            id="with-iso-8601-duration",
        ),
    ),
)
@pytest.mark.parametrize(
    "env_var_name, env_var_getter",
    (
        pytest.param(
            ENV_PHOENIX_ACCESS_TOKEN_EXPIRY, get_env_access_token_expiry, id="access-token-expiry"
        ),
        pytest.param(
            ENV_PHOENIX_REFRESH_TOKEN_EXPIRY,
            get_env_refresh_token_expiry,
            id="refresh-token-expiry",
        ),
    ),
)
def test_get_env_token_expiry_parses_valid_values(
    env_var_name: str,
    env_var_getter: Callable[[], timedelta],
    env_var_value: str,
    expected_value: timedelta,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv(env_var_name, env_var_value)
    env_var_getter() == expected_value


@pytest.mark.parametrize(
    "env_var_value, error_message",
    (
        pytest.param("-3600", "duration must be positive", id="with-negative-integer"),
        pytest.param("-3600.10", "duration must be positive", id="with-negative-decimal"),
        pytest.param("-36d", "duration must be positive", id="with-negative-d-unit"),
        pytest.param("0", "duration must be positive", id="with-zero-duration"),
        pytest.param("nan", "duration cannot be null", id="with-null"),
    ),
)
@pytest.mark.parametrize(
    "env_var_name, env_var_getter",
    (
        pytest.param(
            ENV_PHOENIX_ACCESS_TOKEN_EXPIRY, get_env_access_token_expiry, id="access-token-expiry"
        ),
        pytest.param(
            ENV_PHOENIX_REFRESH_TOKEN_EXPIRY,
            get_env_refresh_token_expiry,
            id="refresh-token-expiry",
        ),
    ),
)
def test_get_env_token_expiry_raises_expected_errors_for_invalid_values(
    env_var_name: str,
    env_var_getter: Callable[[], timedelta],
    env_var_value: str,
    error_message: str,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv(env_var_name, env_var_value)
    with pytest.raises(
        ValueError, match=f"Error reading {env_var_name} environment variable"
    ) as exc_info:
        env_var_getter()
    error = exc_info.value
    assert isinstance(cause := error.__cause__, ValueError)
    assert str(cause) == error_message
