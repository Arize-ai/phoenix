from typing import Optional
from urllib.parse import quote_plus

import pytest
from _pytest.monkeypatch import MonkeyPatch
from starlette.datastructures import URL

from phoenix.config import (
    EnvPhoenixAdmin,
    get_env_admins,
    get_env_phoenix_admin_secret,
    get_env_postgres_connection_str,
    get_env_root_url,
    get_env_tls_enabled_for_grpc,
    get_env_tls_enabled_for_http,
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
                    "benjamin@example.com": EnvPhoenixAdmin(
                        username="franklin", auth_method="LOCAL"
                    ),
                },
                id="single_valid_user",
            ),
            pytest.param(
                "franklin=benjamin@example.com;jefferson=thomas@example.com",
                {
                    "benjamin@example.com": EnvPhoenixAdmin(
                        username="franklin", auth_method="LOCAL"
                    ),
                    "thomas@example.com": EnvPhoenixAdmin(
                        username="jefferson", auth_method="LOCAL"
                    ),
                },
                id="multiple_valid_users",
            ),
            pytest.param(
                "Benjamin Franklin=benjamin@example.com;Thomas Jefferson=thomas@example.com",
                {
                    "benjamin@example.com": EnvPhoenixAdmin(
                        username="Benjamin Franklin", auth_method="LOCAL"
                    ),
                    "thomas@example.com": EnvPhoenixAdmin(
                        username="Thomas Jefferson", auth_method="LOCAL"
                    ),
                },
                id="names_with_spaces",
            ),
            pytest.param(
                " washington = george@example.com ; hamilton = alexander@example.com ",
                {
                    "george@example.com": EnvPhoenixAdmin(
                        username="washington", auth_method="LOCAL"
                    ),
                    "alexander@example.com": EnvPhoenixAdmin(
                        username="hamilton", auth_method="LOCAL"
                    ),
                },
                id="whitespace_handling",
            ),
            pytest.param(
                "User=With=Equals=user@example.com",
                {
                    "user@example.com": EnvPhoenixAdmin(
                        username="User=With=Equals", auth_method="LOCAL"
                    ),
                },
                id="username_with_equals",
            ),
            pytest.param(
                "Samuel Adams=sam@example.com;J. Marshall=john@example.com",
                {
                    "sam@example.com": EnvPhoenixAdmin(
                        username="Samuel Adams", auth_method="LOCAL"
                    ),
                    "john@example.com": EnvPhoenixAdmin(
                        username="J. Marshall", auth_method="LOCAL"
                    ),
                },
                id="names_with_punctuation",
            ),
            pytest.param(
                "Madison, James=james@example.com",
                {
                    "james@example.com": EnvPhoenixAdmin(
                        username="Madison, James", auth_method="LOCAL"
                    ),
                },
                id="username_with_comma",
            ),
            pytest.param(
                "Hamilton, Alexander=alex@example.com;Burr, Aaron=aaron@example.com",
                {
                    "alex@example.com": EnvPhoenixAdmin(
                        username="Hamilton, Alexander", auth_method="LOCAL"
                    ),
                    "aaron@example.com": EnvPhoenixAdmin(
                        username="Burr, Aaron", auth_method="LOCAL"
                    ),
                },
                id="multiple_usernames_with_commas",
            ),
            pytest.param(
                "Washington, George, Jr.=george@example.com",
                {
                    "george@example.com": EnvPhoenixAdmin(
                        username="Washington, George, Jr.", auth_method="LOCAL"
                    ),
                },
                id="username_with_multiple_commas",
            ),
            pytest.param(
                "John Adams=john@example.com(LOCAL)",
                {
                    "john@example.com": EnvPhoenixAdmin(username="John Adams", auth_method="LOCAL"),
                },
                id="explicit_local_auth",
            ),
            pytest.param(
                "Thomas Jefferson=thomas@example.com(OAUTH2)",
                {
                    "thomas@example.com": EnvPhoenixAdmin(
                        username="Thomas Jefferson", auth_method="OAUTH2"
                    ),
                },
                id="explicit_oauth2_auth",
            ),
            pytest.param(
                "John Adams=john@example.com(local)",
                {
                    "john@example.com": EnvPhoenixAdmin(username="John Adams", auth_method="LOCAL"),
                },
                id="case_insensitive_local",
            ),
            pytest.param(
                "Thomas Jefferson=thomas@example.com(oauth2)",
                {
                    "thomas@example.com": EnvPhoenixAdmin(
                        username="Thomas Jefferson", auth_method="OAUTH2"
                    ),
                },
                id="case_insensitive_oauth2",
            ),
            pytest.param(
                "John Adams=john@example.com(Local)",
                {
                    "john@example.com": EnvPhoenixAdmin(username="John Adams", auth_method="LOCAL"),
                },
                id="mixed_case_local",
            ),
            pytest.param(
                "Thomas Jefferson=thomas@example.com(OAuth2)",
                {
                    "thomas@example.com": EnvPhoenixAdmin(
                        username="Thomas Jefferson", auth_method="OAUTH2"
                    ),
                },
                id="mixed_case_oauth2",
            ),
            pytest.param("", {}, id="empty_string"),
            pytest.param(None, {}, id="none_value"),
        ],
    )
    def test_valid_inputs(
        self,
        monkeypatch: MonkeyPatch,
        env_value: str,
        expected_result: dict[str, EnvPhoenixAdmin],
    ) -> None:
        if env_value:
            monkeypatch.setenv("PHOENIX_ADMINS", env_value)
        else:
            monkeypatch.delenv("PHOENIX_ADMINS", raising=False)
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
            # Invalid auth methods
            pytest.param(
                "John Adams=john@example.com(INVALID)",
                "Invalid auth method",
                id="invalid_auth_method",
            ),
            pytest.param(
                "John Adams=john@example.com(LOCAL",
                "Invalid email in PHOENIX_ADMINS: 'john@example.com(LOCAL'",
                id="unclosed_parenthesis",
            ),
            pytest.param(
                "John Adams=john@example.com)LOCAL(",
                "Invalid email in PHOENIX_ADMINS: 'john@example.com)LOCAL('",
                id="reversed_parenthesis",
            ),
            pytest.param(
                "John Adams=john@example.com(SSO)",
                "Invalid auth method",
                id="invalid_auth_method_sso",
            ),
            pytest.param(
                "John Adams=john@example.com(google)",
                "Invalid auth method",
                id="invalid_auth_method_google",
            ),
        ],
    )
    def test_invalid_inputs(
        self,
        monkeypatch: MonkeyPatch,
        env_value: str,
        expected_error_msg: str,
    ) -> None:
        monkeypatch.setenv("PHOENIX_ADMINS", env_value)
        with pytest.raises(ValueError) as e:
            get_env_admins()
        assert expected_error_msg in str(e.value)


class TestGetEnvRootUrl:
    @pytest.mark.parametrize(
        "env_vars, expected_url",
        [
            pytest.param(
                {
                    "PHOENIX_ROOT_URL": "https://example.com",
                    "PHOENIX_HOST": "0.0.0.0",
                    "PHOENIX_PORT": "6006",
                    "PHOENIX_HOST_ROOT_PATH": "/phoenix",
                },
                URL("https://example.com"),
                id="explicit_root_url",
            ),
            pytest.param(
                {
                    "PHOENIX_HOST": "localhost",
                    "PHOENIX_PORT": "8080",
                    "PHOENIX_HOST_ROOT_PATH": "/phoenix",
                },
                URL("http://localhost:8080/phoenix"),
                id="constructed_url_with_root_path",
            ),
            pytest.param(
                {
                    "PHOENIX_HOST": "0.0.0.0",
                    "PHOENIX_PORT": "6006",
                    "PHOENIX_HOST_ROOT_PATH": "",
                },
                URL("http://127.0.0.1:6006"),
                id="constructed_url_with_0.0.0.0_host",
            ),
            pytest.param(
                {
                    "PHOENIX_HOST": "example.com",
                    "PHOENIX_PORT": "443",
                    "PHOENIX_HOST_ROOT_PATH": "/app",
                },
                URL("http://example.com:443/app"),
                id="constructed_url_with_domain",
            ),
            pytest.param(
                {
                    "PHOENIX_ROOT_URL": "https://example.com/",
                    "PHOENIX_HOST": "localhost",
                    "PHOENIX_PORT": "6006",
                    "PHOENIX_HOST_ROOT_PATH": "/phoenix",
                },
                URL("https://example.com/"),
                id="explicit_root_url_with_trailing_slash",
            ),
        ],
    )
    def test_valid_inputs(
        self,
        monkeypatch: MonkeyPatch,
        env_vars: dict[str, str],
        expected_url: URL,
    ) -> None:
        for key, value in env_vars.items():
            monkeypatch.setenv(key, value)
        assert get_env_root_url() == expected_url

    @pytest.mark.parametrize(
        "env_vars, expected_error_msg",
        [
            pytest.param(
                {"PHOENIX_ROOT_URL": "not_a_url"},
                "must be a valid URL",
                id="invalid_root_url",
            ),
            pytest.param(
                {"PHOENIX_HOST_ROOT_PATH": "no_leading_slash"},
                "must start with '/'",
                id="invalid_root_path_no_leading_slash",
            ),
            pytest.param(
                {"PHOENIX_HOST_ROOT_PATH": "/trailing/slash/"},
                "cannot end with '/'",
                id="invalid_root_path_trailing_slash",
            ),
        ],
    )
    def test_invalid_inputs(
        self,
        monkeypatch: MonkeyPatch,
        env_vars: dict[str, str],
        expected_error_msg: str,
    ) -> None:
        for key, value in env_vars.items():
            monkeypatch.setenv(key, value)
        with pytest.raises(ValueError) as e:
            get_env_root_url()
        assert expected_error_msg in str(e.value)


class TestGetEnvPhoenixAdminSecret:
    @pytest.mark.parametrize(
        "env_vars, expected_result",
        [
            pytest.param(
                {
                    "PHOENIX_ADMIN_SECRET": None,
                },
                None,
                id="not_set",
            ),
            pytest.param(
                {
                    "PHOENIX_ADMIN_SECRET": "4fd8ea0caef4f6f87ca5a74912d51baf",
                    "PHOENIX_SECRET": "57d2e6c8fda06190411e9bd342747ee8",
                },
                "4fd8ea0caef4f6f87ca5a74912d51baf",
                id="valid_admin_secret",
            ),
        ],
    )
    def test_valid_inputs(
        self,
        monkeypatch: MonkeyPatch,
        env_vars: dict[str, Optional[str]],
        expected_result: Optional[str],
    ) -> None:
        for key, value in env_vars.items():
            if value is None:
                monkeypatch.delenv(key, raising=False)
            else:
                monkeypatch.setenv(key, value)
        assert get_env_phoenix_admin_secret() == expected_result

    @pytest.mark.parametrize(
        "env_vars",
        [
            pytest.param(
                {
                    "PHOENIX_ADMIN_SECRET": "validadminsecret12345678901234567890",
                    "PHOENIX_SECRET": None,
                },
                id="admin_secret_without_phoenix_secret",
            ),
            pytest.param(
                {
                    "PHOENIX_ADMIN_SECRET": "validadminsecret12345678901234567890",
                    "PHOENIX_SECRET": "",
                },
                id="admin_secret_with_empty_phoenix_secret",
            ),
            pytest.param(
                {
                    "PHOENIX_ADMIN_SECRET": "validadminsecret12345678901234567890",
                    "PHOENIX_SECRET": "validadminsecret12345678901234567890",
                },
                id="admin_secret_same_as_phoenix_secret",
            ),
            pytest.param(
                {
                    "PHOENIX_ADMIN_SECRET": "short",
                    "PHOENIX_SECRET": "validsecret12345678901234567890",
                },
                id="admin_secret_too_short",
            ),
            pytest.param(
                {
                    "PHOENIX_ADMIN_SECRET": "12345678901234567890123456789012",
                    "PHOENIX_SECRET": "validsecret12345678901234567890",
                },
                id="admin_secret_no_lowercase",
            ),
            pytest.param(
                {
                    "PHOENIX_ADMIN_SECRET": "abcdefghijklmnopqrstuvwxyzabcdef",
                    "PHOENIX_SECRET": "validsecret12345678901234567890",
                },
                id="admin_secret_no_digit",
            ),
        ],
    )
    def test_invalid_inputs(
        self,
        monkeypatch: MonkeyPatch,
        env_vars: dict[str, Optional[str]],
    ) -> None:
        for key, value in env_vars.items():
            if value is None or value == "":
                monkeypatch.delenv(key, raising=False)
            else:
                monkeypatch.setenv(key, value)
        with pytest.raises(ValueError):
            get_env_phoenix_admin_secret()


class TestGetEnvTlsEnabled:
    @pytest.mark.parametrize(
        "env_vars, expected_http, expected_grpc",
        [
            # Base case: No variables set - defaults to False for both
            pytest.param(
                {},
                False,
                False,
                id="no_vars_set",
            ),
            # Global variable only tests - tests fallback behavior
            pytest.param(
                {"PHOENIX_TLS_ENABLED": "true"},
                True,
                True,
                id="global_only_enabled",
            ),
            pytest.param(
                {"PHOENIX_TLS_ENABLED": "false"},
                False,
                False,
                id="global_only_disabled",
            ),
            # HTTP-specific variable tests - should override global
            pytest.param(
                {
                    "PHOENIX_TLS_ENABLED": "false",
                    "PHOENIX_TLS_ENABLED_FOR_HTTP": "true",
                },
                True,
                False,
                id="http_overrides_global",
            ),
            # gRPC-specific variable tests - should override global
            pytest.param(
                {
                    "PHOENIX_TLS_ENABLED": "true",
                    "PHOENIX_TLS_ENABLED_FOR_GRPC": "false",
                },
                True,
                False,
                id="grpc_overrides_global",
            ),
        ],
    )
    def test_tls_enabled(
        self,
        monkeypatch: MonkeyPatch,
        env_vars: dict[str, str],
        expected_http: bool,
        expected_grpc: bool,
    ) -> None:
        # Clear all TLS-related environment variables first
        monkeypatch.delenv("PHOENIX_TLS_ENABLED", raising=False)
        monkeypatch.delenv("PHOENIX_TLS_ENABLED_FOR_HTTP", raising=False)
        monkeypatch.delenv("PHOENIX_TLS_ENABLED_FOR_GRPC", raising=False)

        # Set the test environment variables
        for key, value in env_vars.items():
            monkeypatch.setenv(key, value)

        # Test HTTP TLS enablement
        assert get_env_tls_enabled_for_http() == expected_http

        # Test gRPC TLS enablement
        assert get_env_tls_enabled_for_grpc() == expected_grpc
