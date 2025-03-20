from urllib.parse import quote_plus

import pytest
from _pytest.monkeypatch import MonkeyPatch

from phoenix.config import (
    ENV_PHOENIX_ADMINS,
    get_env_admins,
    get_env_postgres_connection_str,
)


def test_missing_required_vars(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("PHOENIX_POSTGRES_USER", raising=False)
    monkeypatch.delenv("PHOENIX_POSTGRES_PASSWORD", raising=False)
    monkeypatch.delenv("PHOENIX_POSTGRES_HOST", raising=False)
    monkeypatch.delenv("PHOENIX_POSTGRES_PORT", raising=False)
    monkeypatch.delenv("PHOENIX_POSTGRES_DB", raising=False)

    assert get_env_postgres_connection_str() is None

    monkeypatch.setenv("PHOENIX_POSTGRES_HOST", "localhost")
    assert get_env_postgres_connection_str() is None


def test_basic_connection_string(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PHOENIX_POSTGRES_USER", "user")
    monkeypatch.setenv("PHOENIX_POSTGRES_PASSWORD", "pass")
    monkeypatch.setenv("PHOENIX_POSTGRES_HOST", "localhost")
    monkeypatch.delenv("PHOENIX_POSTGRES_PORT", raising=False)
    monkeypatch.delenv("PHOENIX_POSTGRES_DB", raising=False)

    expected = f"postgresql://user:{quote_plus('pass')}@localhost"
    assert get_env_postgres_connection_str() == expected


def test_with_port_from_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PHOENIX_POSTGRES_USER", "user")
    monkeypatch.setenv("PHOENIX_POSTGRES_PASSWORD", "pass")
    monkeypatch.setenv("PHOENIX_POSTGRES_HOST", "localhost")
    monkeypatch.setenv("PHOENIX_POSTGRES_PORT", "5555")
    monkeypatch.delenv("PHOENIX_POSTGRES_DB", raising=False)

    expected = f"postgresql://user:{quote_plus('pass')}@localhost:5555"
    assert get_env_postgres_connection_str() == expected


def test_with_port_in_host(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PHOENIX_POSTGRES_USER", "user")
    monkeypatch.setenv("PHOENIX_POSTGRES_PASSWORD", "pass")
    # Host includes a port, and no explicit port is set.
    monkeypatch.setenv("PHOENIX_POSTGRES_HOST", "localhost:6666")
    monkeypatch.delenv("PHOENIX_POSTGRES_PORT", raising=False)
    monkeypatch.delenv("PHOENIX_POSTGRES_DB", raising=False)

    expected = f"postgresql://user:{quote_plus('pass')}@localhost:6666"
    assert get_env_postgres_connection_str() == expected


def test_overrides_port_in_host(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PHOENIX_POSTGRES_USER", "user")
    monkeypatch.setenv("PHOENIX_POSTGRES_PASSWORD", "pass")
    monkeypatch.setenv("PHOENIX_POSTGRES_HOST", "localhost:5432")
    monkeypatch.setenv("PHOENIX_POSTGRES_PORT", "9999")
    monkeypatch.delenv("PHOENIX_POSTGRES_DB", raising=False)

    expected = f"postgresql://user:{quote_plus('pass')}@localhost:9999"
    assert get_env_postgres_connection_str() == expected


def test_with_db(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PHOENIX_POSTGRES_USER", "user")
    monkeypatch.setenv("PHOENIX_POSTGRES_PASSWORD", "pass")
    monkeypatch.setenv("PHOENIX_POSTGRES_HOST", "localhost")
    monkeypatch.setenv("PHOENIX_POSTGRES_DB", "mydb")
    monkeypatch.delenv("PHOENIX_POSTGRES_PORT", raising=False)

    expected = f"postgresql://user:{quote_plus('pass')}@localhost/mydb"
    assert get_env_postgres_connection_str() == expected


def test_with_all_params_and_special_chars(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PHOENIX_POSTGRES_USER", "user")
    monkeypatch.setenv("PHOENIX_POSTGRES_PASSWORD", "pa ss")
    monkeypatch.setenv("PHOENIX_POSTGRES_HOST", "localhost:5432")
    monkeypatch.setenv("PHOENIX_POSTGRES_PORT", "1234")
    monkeypatch.setenv("PHOENIX_POSTGRES_DB", "mydb")

    expected = f"postgresql://user:{quote_plus('pa ss')}@localhost:1234/mydb"
    assert get_env_postgres_connection_str() == expected


class TestGetEnvStartupAdmins:
    @pytest.mark.parametrize(
        "env_value, expected_result",
        [
            pytest.param(
                "franklin=benjamin@example.com",
                {
                    "benjamin@example.com": "franklin",
                },
                id="single_valid_user",
            ),
            pytest.param(
                "franklin=benjamin@example.com;jefferson=thomas@example.com",
                {
                    "benjamin@example.com": "franklin",
                    "thomas@example.com": "jefferson",
                },
                id="multiple_valid_users",
            ),
            pytest.param(
                "Benjamin Franklin=benjamin@example.com;Thomas Jefferson=thomas@example.com",
                {
                    "benjamin@example.com": "Benjamin Franklin",
                    "thomas@example.com": "Thomas Jefferson",
                },
                id="names_with_spaces",
            ),
            pytest.param(
                " washington = george@example.com ; hamilton = alexander@example.com ",
                {
                    "george@example.com": "washington",
                    "alexander@example.com": "hamilton",
                },
                id="whitespace_handling",
            ),
            pytest.param(
                "User=With=Equals=user@example.com",
                {
                    "user@example.com": "User=With=Equals",
                },
                id="username_with_equals",
            ),
            pytest.param(
                "Samuel Adams=sam@example.com;J. Marshall=john@example.com",
                {
                    "sam@example.com": "Samuel Adams",
                    "john@example.com": "J. Marshall",
                },
                id="names_with_punctuation",
            ),
            pytest.param(
                "Madison, James=james@example.com",
                {
                    "james@example.com": "Madison, James",
                },
                id="username_with_comma",
            ),
            pytest.param(
                "Hamilton, Alexander=alex@example.com;Burr, Aaron=aaron@example.com",
                {
                    "alex@example.com": "Hamilton, Alexander",
                    "aaron@example.com": "Burr, Aaron",
                },
                id="multiple_usernames_with_commas",
            ),
            pytest.param(
                "Washington, George, Jr.=george@example.com",
                {
                    "george@example.com": "Washington, George, Jr.",
                },
                id="username_with_multiple_commas",
            ),
            pytest.param("", {}, id="empty_string"),
            pytest.param(None, {}, id="none_value"),
        ],
    )
    def test_valid_inputs(
        self,
        monkeypatch: MonkeyPatch,
        env_value: str,
        expected_result: dict[str, str],
    ) -> None:
        if env_value:
            monkeypatch.setenv(ENV_PHOENIX_ADMINS, env_value)
        else:
            monkeypatch.delenv(ENV_PHOENIX_ADMINS, raising=False)
        result = get_env_admins()
        assert result == expected_result

    @pytest.mark.parametrize(
        "env_value, expected_error_msg",
        [
            # Invalid formats
            pytest.param(
                "madison@example.com",
                "Invalid format",
                id="email_only_no_equals",
            ),
            # Invalid emails
            pytest.param(
                "John Hancock=john@",
                "Invalid email",
                id="incomplete_email",
            ),
            pytest.param(
                "John Jay=john@example",
                "Invalid email",
                id="missing_top_level_domain",
            ),
            pytest.param(
                "Robert Morris=robert",
                "Invalid email",
                id="no_at_symbol",
            ),
            pytest.param(
                "Charles Carroll=charles@exam@ple.com",
                "Invalid email",
                id="multiple_at_symbols",
            ),
            pytest.param(
                "Patrick Henry=",
                "Invalid email",
                id="empty_email",
            ),
            # Duplicates
            pytest.param(
                "John Adams=john@example.com;John Adams=different@example.com",
                "Duplicate username",
                id="duplicate_username",
            ),
            pytest.param(
                "John Adams=john@example.com;Different User=john@example.com",
                "Duplicate email",
                id="duplicate_email",
            ),
            # semicolons in username
            pytest.param(
                "John; Adams=john@example.com",
                "Invalid format",
                id="semicolon_in_username",
            ),
        ],
    )
    def test_invalid_inputs(
        self,
        monkeypatch: MonkeyPatch,
        env_value: str,
        expected_error_msg: str,
    ) -> None:
        monkeypatch.setenv(ENV_PHOENIX_ADMINS, env_value)
        with pytest.raises(ValueError) as e:
            get_env_admins()
        assert expected_error_msg in str(e.value)
