from urllib.parse import quote_plus

import pytest

from phoenix.config import get_env_postgres_connection_str


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
