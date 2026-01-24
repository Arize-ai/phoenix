import os
from pathlib import Path
from typing import Any, Optional, get_args
from unittest.mock import MagicMock
from urllib.parse import quote

import pytest
from _pytest.monkeypatch import MonkeyPatch
from starlette.datastructures import URL

from phoenix.config import (
    ENV_PHOENIX_ADMINS,
    ENV_PHOENIX_ALLOW_EXTERNAL_RESOURCES,
    AssignableUserRoleName,
    OAuth2ClientConfig,
    ensure_working_dir_if_needed,
    get_env_admins,
    get_env_auth_settings,
    get_env_phoenix_admin_secret,
    get_env_postgres_connection_str,
    get_env_root_url,
    get_env_tls_enabled_for_grpc,
    get_env_tls_enabled_for_http,
)
from phoenix.db.models import UserRoleName


class TestPostgresConnectionString:
    """Tests for PostgreSQL connection string generation from environment variables."""

    class TestBasicFunctionality:
        """Core functionality and validation tests."""

        def test_missing_required_vars(self, monkeypatch: pytest.MonkeyPatch) -> None:
            """Test that missing required environment variables return None."""
            monkeypatch.delenv("PHOENIX_POSTGRES_USER", raising=False)
            monkeypatch.delenv("PHOENIX_POSTGRES_PASSWORD", raising=False)
            monkeypatch.delenv("PHOENIX_POSTGRES_HOST", raising=False)
            monkeypatch.delenv("PHOENIX_POSTGRES_PORT", raising=False)
            monkeypatch.delenv("PHOENIX_POSTGRES_DB", raising=False)

            assert get_env_postgres_connection_str() is None

            # Having only host is insufficient
            monkeypatch.setenv("PHOENIX_POSTGRES_HOST", "localhost")
            assert get_env_postgres_connection_str() is None

        def test_minimal_connection_string(self, monkeypatch: pytest.MonkeyPatch) -> None:
            """Test basic connection string with minimal required parameters."""
            monkeypatch.setenv("PHOENIX_POSTGRES_USER", "user")
            monkeypatch.setenv("PHOENIX_POSTGRES_PASSWORD", "pass")
            monkeypatch.setenv("PHOENIX_POSTGRES_HOST", "localhost")
            monkeypatch.delenv("PHOENIX_POSTGRES_PORT", raising=False)
            monkeypatch.delenv("PHOENIX_POSTGRES_DB", raising=False)

            expected = f"postgresql://{quote('user')}:{quote('pass')}@localhost"
            assert get_env_postgres_connection_str() == expected

        def test_full_connection_string_with_separate_port(
            self, monkeypatch: pytest.MonkeyPatch
        ) -> None:
            """Test connection string with all parameters including separate host and port."""
            monkeypatch.setenv("PHOENIX_POSTGRES_USER", "user")
            monkeypatch.setenv("PHOENIX_POSTGRES_PASSWORD", "pass")
            monkeypatch.setenv("PHOENIX_POSTGRES_HOST", "localhost")
            monkeypatch.setenv("PHOENIX_POSTGRES_PORT", "9999")
            monkeypatch.setenv("PHOENIX_POSTGRES_DB", "mydb")

            expected = f"postgresql://{quote('user')}:{quote('pass')}@localhost:9999/mydb"
            assert get_env_postgres_connection_str() == expected

    class TestUrlEncoding:
        """Tests for proper URL encoding of userinfo components."""

        def test_comprehensive_special_character_encoding(
            self, monkeypatch: pytest.MonkeyPatch
        ) -> None:
            """Test encoding of both username and password with challenging special characters."""
            monkeypatch.setenv("PHOENIX_POSTGRES_USER", "user@domain.com")
            monkeypatch.setenv("PHOENIX_POSTGRES_PASSWORD", "p@ss w0rd&123=abc%")
            monkeypatch.setenv("PHOENIX_POSTGRES_HOST", "localhost")
            monkeypatch.setenv("PHOENIX_POSTGRES_PORT", "5432")
            monkeypatch.setenv("PHOENIX_POSTGRES_DB", "mydb")

            expected = f"postgresql://{quote('user@domain.com')}:{quote('p@ss w0rd&123=abc%')}@localhost:5432/mydb"
            assert get_env_postgres_connection_str() == expected

    class TestHostParsingEdgeCases:
        """Tests for challenging host parsing scenarios that shouldn't be split as host:port."""

        def test_cloud_sql_socket_path(self, monkeypatch: pytest.MonkeyPatch) -> None:
            """Test that Cloud SQL Unix socket paths with colons are not incorrectly parsed."""
            monkeypatch.setenv("PHOENIX_POSTGRES_USER", "user")
            monkeypatch.setenv("PHOENIX_POSTGRES_PASSWORD", "pass")
            monkeypatch.setenv("PHOENIX_POSTGRES_HOST", "/cloudsql/project:region:instance-id")
            monkeypatch.setenv("PHOENIX_POSTGRES_PORT", "5432")
            monkeypatch.delenv("PHOENIX_POSTGRES_DB", raising=False)

            expected = f"postgresql://{quote('user')}:{quote('pass')}@/cloudsql/project:region:instance-id:5432"
            assert get_env_postgres_connection_str() == expected

        def test_ipv6_address(self, monkeypatch: pytest.MonkeyPatch) -> None:
            """Test that IPv6 addresses with multiple colons are not incorrectly parsed."""
            monkeypatch.setenv("PHOENIX_POSTGRES_USER", "user")
            monkeypatch.setenv("PHOENIX_POSTGRES_PASSWORD", "pass")
            monkeypatch.setenv("PHOENIX_POSTGRES_HOST", "2001:db8::1")
            monkeypatch.setenv("PHOENIX_POSTGRES_PORT", "5432")
            monkeypatch.delenv("PHOENIX_POSTGRES_DB", raising=False)

            expected = f"postgresql://{quote('user')}:{quote('pass')}@2001:db8::1:5432"
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
                "",
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
        expected_result: str,
    ) -> None:
        for key, value in env_vars.items():
            if value is None:
                monkeypatch.delenv(key, raising=False)
            else:
                monkeypatch.setenv(key, value)
        assert str(get_env_phoenix_admin_secret()) == expected_result

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


class TestGetEnvAuthSettings:
    @pytest.mark.parametrize(
        "env_vars, expected_result",
        [
            pytest.param(
                {},  # No environment variables set
                {
                    "enable_auth": False,
                    "disable_basic_auth": False,
                    "phoenix_secret": "",
                    "phoenix_admin_secret": "",
                    "oauth2_clients": [],
                },
                id="default_values",
            ),
            pytest.param(
                {
                    "PHOENIX_ENABLE_AUTH": "true",
                    "PHOENIX_SECRET": "validsecret123456789012345678901234567890",
                },
                {
                    "enable_auth": True,
                    "disable_basic_auth": False,
                    "phoenix_secret": "validsecret123456789012345678901234567890",
                    "phoenix_admin_secret": "",
                    "oauth2_clients": [],
                },
                id="auth_enabled_with_secret",
            ),
            pytest.param(
                {
                    "PHOENIX_ENABLE_AUTH": "true",
                    "PHOENIX_SECRET": "validsecret123456789012345678901234567890",
                    "PHOENIX_ADMIN_SECRET": "validadminsecret123456789012345678901234567890",
                },
                {
                    "enable_auth": True,
                    "disable_basic_auth": False,
                    "phoenix_secret": "validsecret123456789012345678901234567890",
                    "phoenix_admin_secret": "validadminsecret123456789012345678901234567890",
                    "oauth2_clients": [],
                },
                id="auth_enabled_with_both_secrets",
            ),
            pytest.param(
                {
                    "PHOENIX_ENABLE_AUTH": "true",
                    "PHOENIX_SECRET": "validsecret123456789012345678901234567890",
                    "PHOENIX_DISABLE_BASIC_AUTH": "true",
                    "PHOENIX_OAUTH2_GOOGLE_CLIENT_ID": "google_client_id",
                    "PHOENIX_OAUTH2_GOOGLE_CLIENT_SECRET": "google_client_secret",
                    "PHOENIX_OAUTH2_GOOGLE_OIDC_CONFIG_URL": "https://accounts.google.com/.well-known/openid-configuration",
                },
                {
                    "enable_auth": True,
                    "disable_basic_auth": True,
                    "phoenix_secret": "validsecret123456789012345678901234567890",
                    "phoenix_admin_secret": "",
                    "oauth2_clients": [
                        {
                            "idp_name": "google",
                            "idp_display_name": "Google",
                            "client_id": "google_client_id",
                            "client_secret": "google_client_secret",
                            "oidc_config_url": "https://accounts.google.com/.well-known/openid-configuration",
                            "allow_sign_up": True,
                            "auto_login": False,
                        }
                    ],
                },
                id="auth_enabled_with_oauth2",
            ),
            pytest.param(
                {
                    "PHOENIX_ENABLE_AUTH": "true",
                    "PHOENIX_SECRET": "validsecret123456789012345678901234567890",
                    "PHOENIX_DISABLE_BASIC_AUTH": "true",
                    "PHOENIX_OAUTH2_GOOGLE_CLIENT_ID": "google_client_id",
                    "PHOENIX_OAUTH2_GOOGLE_CLIENT_SECRET": "google_client_secret",
                    "PHOENIX_OAUTH2_GOOGLE_OIDC_CONFIG_URL": "https://accounts.google.com/.well-known/openid-configuration",
                    "PHOENIX_OAUTH2_AZURE_CLIENT_ID": "azure_client_id",
                    "PHOENIX_OAUTH2_AZURE_CLIENT_SECRET": "azure_client_secret",
                    "PHOENIX_OAUTH2_AZURE_OIDC_CONFIG_URL": "https://login.microsoftonline.com/.well-known/openid-configuration",
                },
                {
                    "enable_auth": True,
                    "disable_basic_auth": True,
                    "phoenix_secret": "validsecret123456789012345678901234567890",
                    "phoenix_admin_secret": "",
                    "oauth2_clients": [
                        {
                            "idp_name": "azure",
                            "idp_display_name": "Azure",
                            "client_id": "azure_client_id",
                            "client_secret": "azure_client_secret",
                            "oidc_config_url": "https://login.microsoftonline.com/.well-known/openid-configuration",
                            "allow_sign_up": True,
                            "auto_login": False,
                        },
                        {
                            "idp_name": "google",
                            "idp_display_name": "Google",
                            "client_id": "google_client_id",
                            "client_secret": "google_client_secret",
                            "oidc_config_url": "https://accounts.google.com/.well-known/openid-configuration",
                            "allow_sign_up": True,
                            "auto_login": False,
                        },
                    ],
                },
                id="auth_enabled_with_multiple_oauth2",
            ),
            pytest.param(
                {
                    "PHOENIX_ENABLE_AUTH": "true",
                    "PHOENIX_SECRET": "validsecret123456789012345678901234567890",
                    "PHOENIX_DISABLE_BASIC_AUTH": "true",
                    "PHOENIX_OAUTH2_GOOGLE_CLIENT_ID": "google_client_id",
                    "PHOENIX_OAUTH2_GOOGLE_CLIENT_SECRET": "google_client_secret",
                    "PHOENIX_OAUTH2_GOOGLE_OIDC_CONFIG_URL": "https://accounts.google.com/.well-known/openid-configuration",
                    "PHOENIX_OAUTH2_GOOGLE_DISPLAY_NAME": "Custom Google Name",
                    "PHOENIX_OAUTH2_GOOGLE_ALLOW_SIGN_UP": "false",
                    "PHOENIX_OAUTH2_GOOGLE_AUTO_LOGIN": "true",
                },
                {
                    "enable_auth": True,
                    "disable_basic_auth": True,
                    "phoenix_secret": "validsecret123456789012345678901234567890",
                    "phoenix_admin_secret": "",
                    "oauth2_clients": [
                        {
                            "idp_name": "google",
                            "idp_display_name": "Custom Google Name",
                            "client_id": "google_client_id",
                            "client_secret": "google_client_secret",
                            "oidc_config_url": "https://accounts.google.com/.well-known/openid-configuration",
                            "allow_sign_up": False,
                            "auto_login": True,
                        }
                    ],
                },
                id="auth_enabled_with_custom_oauth2_settings",
            ),
        ],
    )
    def test_valid_inputs(
        self,
        monkeypatch: MonkeyPatch,
        env_vars: dict[str, str],
        expected_result: dict[str, Any],
    ) -> None:
        # Clear all auth-related environment variables first
        monkeypatch.delenv("PHOENIX_ENABLE_AUTH", raising=False)
        monkeypatch.delenv("PHOENIX_SECRET", raising=False)
        monkeypatch.delenv("PHOENIX_ADMIN_SECRET", raising=False)
        monkeypatch.delenv("PHOENIX_DISABLE_BASIC_AUTH", raising=False)
        monkeypatch.delenv("PHOENIX_OAUTH2_AZURE_CLIENT_ID", raising=False)
        monkeypatch.delenv("PHOENIX_OAUTH2_AZURE_CLIENT_SECRET", raising=False)
        monkeypatch.delenv("PHOENIX_OAUTH2_AZURE_OIDC_CONFIG_URL", raising=False)
        monkeypatch.delenv("PHOENIX_OAUTH2_GOOGLE_ALLOW_SIGN_UP", raising=False)
        monkeypatch.delenv("PHOENIX_OAUTH2_GOOGLE_AUTO_LOGIN", raising=False)
        monkeypatch.delenv("PHOENIX_OAUTH2_GOOGLE_CLIENT_ID", raising=False)
        monkeypatch.delenv("PHOENIX_OAUTH2_GOOGLE_CLIENT_SECRET", raising=False)
        monkeypatch.delenv("PHOENIX_OAUTH2_GOOGLE_DISPLAY_NAME", raising=False)
        monkeypatch.delenv("PHOENIX_OAUTH2_GOOGLE_OIDC_CONFIG_URL", raising=False)

        # Set the test environment variables
        for key, value in env_vars.items():
            monkeypatch.setenv(key, value)

        result = get_env_auth_settings()
        assert result.enable_auth == expected_result["enable_auth"]
        assert result.disable_basic_auth == expected_result["disable_basic_auth"]
        assert str(result.phoenix_secret) == expected_result["phoenix_secret"]
        assert str(result.phoenix_admin_secret) == expected_result["phoenix_admin_secret"]

        # Compare OAuth2 clients
        assert len(result.oauth2_clients) == len(expected_result["oauth2_clients"])
        # Create lookup dictionaries by IDP name
        actual_clients = {client.name: client for client in result.oauth2_clients}
        expected_clients = {
            client["idp_name"]: client for client in expected_result["oauth2_clients"]
        }
        # Compare each client by name
        for idp_name, expected in expected_clients.items():
            actual = actual_clients[idp_name]
            assert actual.name == expected["idp_name"]
            assert actual.client_id == expected["client_id"]
            assert actual.client_secret == expected["client_secret"]
            assert actual.display_name == expected["idp_display_name"]
            assert actual.allow_sign_up == expected["allow_sign_up"]
            assert actual.auto_login == expected["auto_login"]

    @pytest.mark.parametrize(
        "env_vars, expected_error_msg",
        [
            pytest.param(
                {
                    "PHOENIX_ENABLE_AUTH": "true",
                },
                "`PHOENIX_SECRET` must be set when auth is enabled with `PHOENIX_ENABLE_AUTH`",
                id="auth_enabled_without_secret",
            ),
            pytest.param(
                {
                    "PHOENIX_ENABLE_AUTH": "true",
                    "PHOENIX_SECRET": "validsecret123456789012345678901234567890",
                    "PHOENIX_DISABLE_BASIC_AUTH": "true",
                },
                "PHOENIX_DISABLE_BASIC_AUTH is set, but no alternative authentication methods "
                "are configured",
                id="basic_auth_disabled_without_oauth2",
            ),
        ],
    )
    def test_invalid_inputs(
        self,
        monkeypatch: MonkeyPatch,
        env_vars: dict[str, str],
        expected_error_msg: str,
    ) -> None:
        # Clear all auth-related environment variables first
        monkeypatch.delenv("PHOENIX_ENABLE_AUTH", raising=False)
        monkeypatch.delenv("PHOENIX_SECRET", raising=False)
        monkeypatch.delenv("PHOENIX_ADMIN_SECRET", raising=False)
        monkeypatch.delenv("PHOENIX_DISABLE_BASIC_AUTH", raising=False)
        monkeypatch.delenv("PHOENIX_OAUTH2_AZURE_CLIENT_ID", raising=False)
        monkeypatch.delenv("PHOENIX_OAUTH2_AZURE_CLIENT_SECRET", raising=False)
        monkeypatch.delenv("PHOENIX_OAUTH2_AZURE_OIDC_CONFIG_URL", raising=False)
        monkeypatch.delenv("PHOENIX_OAUTH2_GOOGLE_ALLOW_SIGN_UP", raising=False)
        monkeypatch.delenv("PHOENIX_OAUTH2_GOOGLE_AUTO_LOGIN", raising=False)
        monkeypatch.delenv("PHOENIX_OAUTH2_GOOGLE_CLIENT_ID", raising=False)
        monkeypatch.delenv("PHOENIX_OAUTH2_GOOGLE_CLIENT_SECRET", raising=False)
        monkeypatch.delenv("PHOENIX_OAUTH2_GOOGLE_DISPLAY_NAME", raising=False)
        monkeypatch.delenv("PHOENIX_OAUTH2_GOOGLE_OIDC_CONFIG_URL", raising=False)
        monkeypatch.delenv("PHOENIX_LDAP_HOST", raising=False)

        # Set the test environment variables
        for key, value in env_vars.items():
            monkeypatch.setenv(key, value)

        with pytest.raises(ValueError) as e:
            get_env_auth_settings()
        assert expected_error_msg in str(e.value)


def test_ensure_working_dir_if_needed_skips_when_no_local_storage(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("PHOENIX_POSTGRES_USER", "user")
    monkeypatch.setenv("PHOENIX_POSTGRES_PASSWORD", "password")
    monkeypatch.setenv("PHOENIX_POSTGRES_HOST", "host")
    monkeypatch.setenv("PHOENIX_POSTGRES_PORT", "5432")
    monkeypatch.setenv("PHOENIX_POSTGRES_DB", "somedb")
    monkeypatch.delenv("PHOENIX_WORKING_DIR", raising=False)
    mkdir_spy = MagicMock()
    monkeypatch.setattr(Path, "mkdir", mkdir_spy, raising=True)

    ensure_working_dir_if_needed()

    mkdir_spy.assert_not_called()


def test_allow_external_resources_env_var_exists() -> None:
    """Test that the ENV_PHOENIX_ALLOW_EXTERNAL_RESOURCES constant is properly defined."""
    assert ENV_PHOENIX_ALLOW_EXTERNAL_RESOURCES == "PHOENIX_ALLOW_EXTERNAL_RESOURCES"


def test_allow_external_resources_env_parsing(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test that the environment variable parsing logic works correctly."""
    import os

    # Test default (env var not set) - should be True
    monkeypatch.delenv(ENV_PHOENIX_ALLOW_EXTERNAL_RESOURCES, raising=False)
    assert os.getenv(ENV_PHOENIX_ALLOW_EXTERNAL_RESOURCES, "True").lower() == "true"

    # Test explicit True
    monkeypatch.setenv(ENV_PHOENIX_ALLOW_EXTERNAL_RESOURCES, "True")
    assert os.getenv(ENV_PHOENIX_ALLOW_EXTERNAL_RESOURCES, "True").lower() == "true"

    # Test explicit true (lowercase)
    monkeypatch.setenv(ENV_PHOENIX_ALLOW_EXTERNAL_RESOURCES, "true")
    assert os.getenv(ENV_PHOENIX_ALLOW_EXTERNAL_RESOURCES, "True").lower() == "true"

    # Test explicit False
    monkeypatch.setenv(ENV_PHOENIX_ALLOW_EXTERNAL_RESOURCES, "False")
    assert os.getenv(ENV_PHOENIX_ALLOW_EXTERNAL_RESOURCES, "True").lower() == "false"

    # Test explicit false (lowercase)
    monkeypatch.setenv(ENV_PHOENIX_ALLOW_EXTERNAL_RESOURCES, "false")
    assert os.getenv(ENV_PHOENIX_ALLOW_EXTERNAL_RESOURCES, "True").lower() == "false"

    # Test invalid value - should be false (not "true")
    monkeypatch.setenv(ENV_PHOENIX_ALLOW_EXTERNAL_RESOURCES, "invalid")
    assert os.getenv(ENV_PHOENIX_ALLOW_EXTERNAL_RESOURCES, "True").lower() != "true"


class TestOAuth2ClientConfigFromEnv:
    """Tests for OAuth2ClientConfig.from_env edge cases and validation."""

    def test_basic_configuration(self, monkeypatch: MonkeyPatch) -> None:
        """Test basic OAuth2 configuration with defaults."""
        monkeypatch.setenv("PHOENIX_OAUTH2_GOOGLE_CLIENT_ID", "test_client_id")
        monkeypatch.setenv("PHOENIX_OAUTH2_GOOGLE_CLIENT_SECRET", "test_secret")
        monkeypatch.setenv(
            "PHOENIX_OAUTH2_GOOGLE_OIDC_CONFIG_URL",
            "https://accounts.google.com/.well-known/openid-configuration",
        )

        config = OAuth2ClientConfig.from_env("google")

        assert config.idp_name == "google"
        assert config.client_id == "test_client_id"
        assert config.client_secret == "test_secret"
        assert config.scopes == "openid email profile"
        assert config.use_pkce is False
        assert config.allow_sign_up is True  # Default is True
        assert config.auto_login is False

    def test_pkce_without_client_secret(self, monkeypatch: MonkeyPatch) -> None:
        """Test PKCE public client (no client secret required with auth method 'none')."""
        monkeypatch.setenv("PHOENIX_OAUTH2_MOBILE_CLIENT_ID", "mobile_client")
        monkeypatch.setenv("PHOENIX_OAUTH2_MOBILE_USE_PKCE", "true")
        monkeypatch.setenv("PHOENIX_OAUTH2_MOBILE_TOKEN_ENDPOINT_AUTH_METHOD", "none")
        monkeypatch.setenv(
            "PHOENIX_OAUTH2_MOBILE_OIDC_CONFIG_URL",
            "https://auth.example.com/.well-known/openid-configuration",
        )

        config = OAuth2ClientConfig.from_env("mobile")

        assert config.client_secret is None
        assert config.use_pkce is True
        assert config.token_endpoint_auth_method == "none"

    def test_pkce_with_client_secret(self, monkeypatch: MonkeyPatch) -> None:
        """Test PKCE hybrid client (client secret optional but allowed)."""
        monkeypatch.setenv("PHOENIX_OAUTH2_HYBRID_CLIENT_ID", "hybrid_client")
        monkeypatch.setenv("PHOENIX_OAUTH2_HYBRID_CLIENT_SECRET", "hybrid_secret")
        monkeypatch.setenv("PHOENIX_OAUTH2_HYBRID_USE_PKCE", "true")
        monkeypatch.setenv(
            "PHOENIX_OAUTH2_HYBRID_OIDC_CONFIG_URL",
            "https://auth.example.com/.well-known/openid-configuration",
        )

        config = OAuth2ClientConfig.from_env("hybrid")

        assert config.client_secret == "hybrid_secret"
        assert config.use_pkce is True

    @pytest.mark.parametrize(
        "field,env_suffix,value,error_match",
        [
            ("CLIENT_ID", "CLIENT_ID", "", "Client ID must be set"),
            ("CLIENT_ID", "CLIENT_ID", "   ", "Client ID must be set"),
            ("CLIENT_SECRET", "CLIENT_SECRET", "   ", "Client secret must be set"),
            (
                "OIDC_CONFIG_URL",
                "OIDC_CONFIG_URL",
                "   ",
                "OpenID Connect configuration URL must be set",
            ),
        ],
    )
    def test_required_field_validation(
        self,
        monkeypatch: MonkeyPatch,
        field: str,
        env_suffix: str,
        value: str,
        error_match: str,
    ) -> None:
        """Test that required fields reject empty/whitespace values."""
        # Set all required fields first
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_CLIENT_ID", "client_id")
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_CLIENT_SECRET", "secret")
        monkeypatch.setenv(
            "PHOENIX_OAUTH2_TEST_OIDC_CONFIG_URL",
            "https://example.com/.well-known/openid-configuration",
        )
        # Override the field being tested
        monkeypatch.setenv(f"PHOENIX_OAUTH2_TEST_{env_suffix}", value)

        with pytest.raises(ValueError, match=error_match):
            OAuth2ClientConfig.from_env("test")

    def test_missing_client_secret_without_pkce(self, monkeypatch: MonkeyPatch) -> None:
        """Test that CLIENT_SECRET is required for traditional (non-PKCE) flow."""
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_CLIENT_ID", "client_id")
        monkeypatch.setenv(
            "PHOENIX_OAUTH2_TEST_OIDC_CONFIG_URL",
            "https://example.com/.well-known/openid-configuration",
        )

        with pytest.raises(ValueError, match="Client secret must be set"):
            OAuth2ClientConfig.from_env("test")

    def test_invalid_url_format(self, monkeypatch: MonkeyPatch) -> None:
        """Test that malformed URLs are rejected."""
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_CLIENT_ID", "client_id")
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_CLIENT_SECRET", "secret")
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_OIDC_CONFIG_URL", "not-a-valid-url")

        with pytest.raises(ValueError, match="Invalid OIDC configuration URL"):
            OAuth2ClientConfig.from_env("test")

    def test_non_https_url_rejected(self, monkeypatch: MonkeyPatch) -> None:
        """Test that non-HTTPS URLs are rejected (except localhost)."""
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_CLIENT_ID", "client_id")
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_CLIENT_SECRET", "secret")
        monkeypatch.setenv(
            "PHOENIX_OAUTH2_TEST_OIDC_CONFIG_URL",
            "http://example.com/.well-known/openid-configuration",
        )

        with pytest.raises(ValueError, match="must use HTTPS"):
            OAuth2ClientConfig.from_env("test")

    @pytest.mark.parametrize(
        "localhost_url",
        [
            "http://localhost:8080/.well-known/openid-configuration",
            "http://127.0.0.1:8080/.well-known/openid-configuration",
            "http://[::1]:8080/.well-known/openid-configuration",
        ],
    )
    def test_localhost_http_allowed(self, monkeypatch: MonkeyPatch, localhost_url: str) -> None:
        """Test that HTTP is allowed for localhost (all variants)."""
        monkeypatch.setenv("PHOENIX_OAUTH2_LOCAL_CLIENT_ID", "client_id")
        monkeypatch.setenv("PHOENIX_OAUTH2_LOCAL_CLIENT_SECRET", "secret")
        monkeypatch.setenv("PHOENIX_OAUTH2_LOCAL_OIDC_CONFIG_URL", localhost_url)

        config = OAuth2ClientConfig.from_env("local")
        assert config.oidc_config_url == localhost_url

    def test_zero_address_not_treated_as_localhost(self, monkeypatch: MonkeyPatch) -> None:
        """Test that 0.0.0.0 is NOT treated as localhost and HTTP is rejected.

        0.0.0.0 is a meta-address for binding to all interfaces (server-side),
        not a valid client-facing hostname. It should not bypass HTTPS requirements.
        """
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_CLIENT_ID", "client_id")
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_CLIENT_SECRET", "secret")
        monkeypatch.setenv(
            "PHOENIX_OAUTH2_TEST_OIDC_CONFIG_URL",
            "http://0.0.0.0:8080/.well-known/openid-configuration",
        )

        with pytest.raises(ValueError, match="must use HTTPS"):
            OAuth2ClientConfig.from_env("test")

    def test_invalid_token_auth_method(self, monkeypatch: MonkeyPatch) -> None:
        """Test that invalid TOKEN_ENDPOINT_AUTH_METHOD is rejected."""
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_CLIENT_ID", "client_id")
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_CLIENT_SECRET", "secret")
        monkeypatch.setenv(
            "PHOENIX_OAUTH2_TEST_OIDC_CONFIG_URL",
            "https://example.com/.well-known/openid-configuration",
        )
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_TOKEN_ENDPOINT_AUTH_METHOD", "invalid_method")

        with pytest.raises(ValueError, match="Invalid TOKEN_ENDPOINT_AUTH_METHOD"):
            OAuth2ClientConfig.from_env("test")

    def test_token_auth_method_case_insensitive(self, monkeypatch: MonkeyPatch) -> None:
        """Test that TOKEN_ENDPOINT_AUTH_METHOD is normalized to lowercase."""
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_CLIENT_ID", "client_id")
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_CLIENT_SECRET", "secret")
        monkeypatch.setenv(
            "PHOENIX_OAUTH2_TEST_OIDC_CONFIG_URL",
            "https://example.com/.well-known/openid-configuration",
        )
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_TOKEN_ENDPOINT_AUTH_METHOD", "CLIENT_SECRET_POST")

        config = OAuth2ClientConfig.from_env("test")
        assert config.token_endpoint_auth_method == "client_secret_post"

    def test_pkce_with_none_auth_method(self, monkeypatch: MonkeyPatch) -> None:
        """Test that PKCE with auth_method='none' is allowed."""
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_CLIENT_ID", "client_id")
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_USE_PKCE", "true")
        monkeypatch.setenv(
            "PHOENIX_OAUTH2_TEST_OIDC_CONFIG_URL",
            "https://example.com/.well-known/openid-configuration",
        )
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_TOKEN_ENDPOINT_AUTH_METHOD", "none")

        config = OAuth2ClientConfig.from_env("test")
        assert config.use_pkce is True
        assert config.token_endpoint_auth_method == "none"

    def test_scopes_deduplication(self, monkeypatch: MonkeyPatch) -> None:
        """Test that duplicate scopes are removed while preserving order."""
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_CLIENT_ID", "client_id")
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_CLIENT_SECRET", "secret")
        monkeypatch.setenv(
            "PHOENIX_OAUTH2_TEST_OIDC_CONFIG_URL",
            "https://example.com/.well-known/openid-configuration",
        )
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_SCOPES", "openid groups offline_access openid")

        config = OAuth2ClientConfig.from_env("test")
        scopes = config.scopes.split()
        assert scopes.count("openid") == 1
        assert "groups" in scopes
        assert "offline_access" in scopes

    def test_allowed_groups_requires_path(self, monkeypatch: MonkeyPatch) -> None:
        """Test that ALLOWED_GROUPS requires GROUPS_ATTRIBUTE_PATH."""
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_CLIENT_ID", "client_id")
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_CLIENT_SECRET", "secret")
        monkeypatch.setenv(
            "PHOENIX_OAUTH2_TEST_OIDC_CONFIG_URL",
            "https://example.com/.well-known/openid-configuration",
        )
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_ALLOWED_GROUPS", "admin,developers")

        with pytest.raises(ValueError, match="GROUPS_ATTRIBUTE_PATH must be configured"):
            OAuth2ClientConfig.from_env("test")

    def test_groups_attribute_path_requires_allowed_groups(self, monkeypatch: MonkeyPatch) -> None:
        """Test that GROUPS_ATTRIBUTE_PATH requires ALLOWED_GROUPS (fail-closed security)."""
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_CLIENT_ID", "client_id")
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_CLIENT_SECRET", "secret")
        monkeypatch.setenv(
            "PHOENIX_OAUTH2_TEST_OIDC_CONFIG_URL",
            "https://example.com/.well-known/openid-configuration",
        )
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_GROUPS_ATTRIBUTE_PATH", "groups")
        # No ALLOWED_GROUPS set - should fail

        with pytest.raises(
            ValueError, match="GROUPS_ATTRIBUTE_PATH is set.*but ALLOWED_GROUPS is not"
        ):
            OAuth2ClientConfig.from_env("test")

    def test_groups_attribute_path_with_empty_allowed_groups_fails(
        self, monkeypatch: MonkeyPatch
    ) -> None:
        """Test that GROUPS_ATTRIBUTE_PATH with empty ALLOWED_GROUPS fails (fail-closed)."""
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_CLIENT_ID", "client_id")
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_CLIENT_SECRET", "secret")
        monkeypatch.setenv(
            "PHOENIX_OAUTH2_TEST_OIDC_CONFIG_URL",
            "https://example.com/.well-known/openid-configuration",
        )
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_GROUPS_ATTRIBUTE_PATH", "groups")
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_ALLOWED_GROUPS", "")  # Empty string

        with pytest.raises(
            ValueError, match="GROUPS_ATTRIBUTE_PATH is set.*but ALLOWED_GROUPS is not"
        ):
            OAuth2ClientConfig.from_env("test")

    def test_groups_attribute_path_with_whitespace_allowed_groups_fails(
        self, monkeypatch: MonkeyPatch
    ) -> None:
        """Test that GROUPS_ATTRIBUTE_PATH with whitespace-only ALLOWED_GROUPS fails."""
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_CLIENT_ID", "client_id")
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_CLIENT_SECRET", "secret")
        monkeypatch.setenv(
            "PHOENIX_OAUTH2_TEST_OIDC_CONFIG_URL",
            "https://example.com/.well-known/openid-configuration",
        )
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_GROUPS_ATTRIBUTE_PATH", "groups")
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_ALLOWED_GROUPS", "  ,  ,  ")  # Only whitespace

        with pytest.raises(
            ValueError, match="GROUPS_ATTRIBUTE_PATH is set.*but ALLOWED_GROUPS is not"
        ):
            OAuth2ClientConfig.from_env("test")

    @pytest.mark.parametrize(
        "allowed_groups_value",
        [
            "admin,users,admin,developers,users",  # Comma-separated with duplicates
            "admin, users, admin, developers,users",  # Comma-separated with spaces
            "admin , users , admin , developers , users",  # Spaces around commas
        ],
    )
    def test_groups_deduplication(
        self, monkeypatch: MonkeyPatch, allowed_groups_value: str
    ) -> None:
        """Test that duplicate allowed groups are removed while preserving order."""
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_CLIENT_ID", "client_id")
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_CLIENT_SECRET", "secret")
        monkeypatch.setenv(
            "PHOENIX_OAUTH2_TEST_OIDC_CONFIG_URL",
            "https://example.com/.well-known/openid-configuration",
        )
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_GROUPS_ATTRIBUTE_PATH", "groups")
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_ALLOWED_GROUPS", allowed_groups_value)

        config = OAuth2ClientConfig.from_env("test")
        assert config.allowed_groups == ["admin", "users", "developers"]

    def test_whitespace_handling(self, monkeypatch: MonkeyPatch) -> None:
        """Test that leading/trailing whitespace is trimmed and extra spaces handled."""
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_CLIENT_ID", "  client_id  ")
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_CLIENT_SECRET", "  secret  ")
        monkeypatch.setenv(
            "PHOENIX_OAUTH2_TEST_OIDC_CONFIG_URL",
            "  https://example.com/.well-known/openid-configuration  ",
        )
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_DISPLAY_NAME", "  My Provider  ")
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_SCOPES", "  groups   offline_access  ")
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_GROUPS_ATTRIBUTE_PATH", "  groups  ")
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_ALLOWED_GROUPS", "  admin , developers  ")

        config = OAuth2ClientConfig.from_env("test")
        assert config.client_id == "client_id"
        assert config.client_secret == "secret"
        assert config.oidc_config_url == "https://example.com/.well-known/openid-configuration"
        assert config.idp_display_name == "My Provider"
        assert config.groups_attribute_path == "groups"
        assert config.allowed_groups == ["admin", "developers"]

    def test_display_name_defaults(self, monkeypatch: MonkeyPatch) -> None:
        """Test that display name defaults to capitalized IDP name."""
        monkeypatch.setenv("PHOENIX_OAUTH2_MYIDP_CLIENT_ID", "client_id")
        monkeypatch.setenv("PHOENIX_OAUTH2_MYIDP_CLIENT_SECRET", "secret")
        monkeypatch.setenv(
            "PHOENIX_OAUTH2_MYIDP_OIDC_CONFIG_URL",
            "https://example.com/.well-known/openid-configuration",
        )

        config = OAuth2ClientConfig.from_env("myidp")
        assert config.idp_display_name == "Myidp"

    def test_idp_name_case_handling(self, monkeypatch: MonkeyPatch) -> None:
        """Test that IDP name is case insensitive (env vars are uppercased)."""
        monkeypatch.setenv("PHOENIX_OAUTH2_GOOGLE_CLIENT_ID", "client_id")
        monkeypatch.setenv("PHOENIX_OAUTH2_GOOGLE_CLIENT_SECRET", "secret")
        monkeypatch.setenv(
            "PHOENIX_OAUTH2_GOOGLE_OIDC_CONFIG_URL",
            "https://accounts.google.com/.well-known/openid-configuration",
        )

        config = OAuth2ClientConfig.from_env("google")
        assert config.idp_name == "google"
        assert config.client_id == "client_id"

    def test_allowed_groups_comma_separated(self, monkeypatch: MonkeyPatch) -> None:
        """Test that ALLOWED_GROUPS can be parsed as comma-separated."""
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_CLIENT_ID", "client_id")
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_CLIENT_SECRET", "secret")
        monkeypatch.setenv(
            "PHOENIX_OAUTH2_TEST_OIDC_CONFIG_URL",
            "https://example.com/.well-known/openid-configuration",
        )
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_GROUPS_ATTRIBUTE_PATH", "groups")
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_ALLOWED_GROUPS", "admin,developers,viewers")

        config = OAuth2ClientConfig.from_env("test")
        assert config.allowed_groups == ["admin", "developers", "viewers"]

    def test_allowed_groups_space_delimited_not_supported(self, monkeypatch: MonkeyPatch) -> None:
        """Test that space-delimited groups are no longer supported (treated as single group)."""
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_CLIENT_ID", "client_id")
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_CLIENT_SECRET", "secret")
        monkeypatch.setenv(
            "PHOENIX_OAUTH2_TEST_OIDC_CONFIG_URL",
            "https://example.com/.well-known/openid-configuration",
        )
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_GROUPS_ATTRIBUTE_PATH", "groups")
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_ALLOWED_GROUPS", "admin developers viewers")

        config = OAuth2ClientConfig.from_env("test")
        # Space-delimited is NOT supported, so this is treated as one single group name
        assert config.allowed_groups == ["admin developers viewers"]

    def test_pkce_with_client_secret_auth_method_requires_secret(
        self, monkeypatch: MonkeyPatch
    ) -> None:
        """Test that PKCE with client_secret auth methods requires CLIENT_SECRET."""
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_CLIENT_ID", "client_id")
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_USE_PKCE", "true")
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_TOKEN_ENDPOINT_AUTH_METHOD", "client_secret_basic")
        monkeypatch.setenv(
            "PHOENIX_OAUTH2_TEST_OIDC_CONFIG_URL",
            "https://example.com/.well-known/openid-configuration",
        )
        # CLIENT_SECRET not set - should fail

        with pytest.raises(ValueError, match="Client secret must be set"):
            OAuth2ClientConfig.from_env("test")

    def test_pkce_with_client_secret_post_requires_secret(self, monkeypatch: MonkeyPatch) -> None:
        """Test that PKCE with client_secret_post auth method requires CLIENT_SECRET."""
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_CLIENT_ID", "client_id")
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_USE_PKCE", "true")
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_TOKEN_ENDPOINT_AUTH_METHOD", "client_secret_post")
        monkeypatch.setenv(
            "PHOENIX_OAUTH2_TEST_OIDC_CONFIG_URL",
            "https://example.com/.well-known/openid-configuration",
        )
        # CLIENT_SECRET not set - should fail

        with pytest.raises(ValueError, match="Client secret must be set"):
            OAuth2ClientConfig.from_env("test")

    def test_pkce_with_none_auth_method_allows_missing_secret(
        self, monkeypatch: MonkeyPatch
    ) -> None:
        """Test that PKCE with 'none' auth method works without CLIENT_SECRET (public client)."""
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_CLIENT_ID", "client_id")
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_USE_PKCE", "true")
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_TOKEN_ENDPOINT_AUTH_METHOD", "none")
        monkeypatch.setenv(
            "PHOENIX_OAUTH2_TEST_OIDC_CONFIG_URL",
            "https://example.com/.well-known/openid-configuration",
        )
        # CLIENT_SECRET not set - should succeed with 'none' method

        config = OAuth2ClientConfig.from_env("test")
        assert config.client_secret is None
        assert config.token_endpoint_auth_method == "none"
        assert config.use_pkce is True

    def test_role_mapping_single(self, monkeypatch: MonkeyPatch) -> None:
        """Test single role mapping configuration."""
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_CLIENT_ID", "client_id")
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_CLIENT_SECRET", "secret")
        monkeypatch.setenv(
            "PHOENIX_OAUTH2_TEST_OIDC_CONFIG_URL",
            "https://example.com/.well-known/openid-configuration",
        )
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_ROLE_ATTRIBUTE_PATH", "roles")
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_ROLE_MAPPING", "Owner:ADMIN")

        config = OAuth2ClientConfig.from_env("test")
        assert config.role_attribute_path == "roles"
        assert config.role_mapping == {"Owner": "ADMIN"}
        assert config.role_attribute_strict is False

    def test_role_mapping_multiple(self, monkeypatch: MonkeyPatch) -> None:
        """Test multiple role mappings configuration."""
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_CLIENT_ID", "client_id")
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_CLIENT_SECRET", "secret")
        monkeypatch.setenv(
            "PHOENIX_OAUTH2_TEST_OIDC_CONFIG_URL",
            "https://example.com/.well-known/openid-configuration",
        )
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_ROLE_ATTRIBUTE_PATH", "roles")
        monkeypatch.setenv(
            "PHOENIX_OAUTH2_TEST_ROLE_MAPPING",
            "Owner:ADMIN,Developer:MEMBER,Reader:VIEWER",
        )

        config = OAuth2ClientConfig.from_env("test")
        assert config.role_mapping == {
            "Owner": "ADMIN",
            "Developer": "MEMBER",
            "Reader": "VIEWER",
        }

    def test_role_mapping_case_insensitive(self, monkeypatch: MonkeyPatch) -> None:
        """Test that Phoenix roles in mapping are case-insensitive."""
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_CLIENT_ID", "client_id")
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_CLIENT_SECRET", "secret")
        monkeypatch.setenv(
            "PHOENIX_OAUTH2_TEST_OIDC_CONFIG_URL",
            "https://example.com/.well-known/openid-configuration",
        )
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_ROLE_ATTRIBUTE_PATH", "role")
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_ROLE_MAPPING", "owner:admin,dev:member,view:viewer")

        config = OAuth2ClientConfig.from_env("test")
        assert config.role_mapping == {
            "owner": "ADMIN",
            "dev": "MEMBER",
            "view": "VIEWER",
        }

    def test_role_mapping_whitespace_handling(self, monkeypatch: MonkeyPatch) -> None:
        """Test that whitespace around role mappings is handled correctly."""
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_CLIENT_ID", "client_id")
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_CLIENT_SECRET", "secret")
        monkeypatch.setenv(
            "PHOENIX_OAUTH2_TEST_OIDC_CONFIG_URL",
            "https://example.com/.well-known/openid-configuration",
        )
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_ROLE_ATTRIBUTE_PATH", "role")
        monkeypatch.setenv(
            "PHOENIX_OAUTH2_TEST_ROLE_MAPPING", "  Owner : ADMIN , Developer : MEMBER  "
        )

        config = OAuth2ClientConfig.from_env("test")
        assert config.role_mapping == {"Owner": "ADMIN", "Developer": "MEMBER"}

    def test_role_mapping_missing_colon_fails(self, monkeypatch: MonkeyPatch) -> None:
        """Test that role mapping without colon separator fails."""
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_CLIENT_ID", "client_id")
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_CLIENT_SECRET", "secret")
        monkeypatch.setenv(
            "PHOENIX_OAUTH2_TEST_OIDC_CONFIG_URL",
            "https://example.com/.well-known/openid-configuration",
        )
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_ROLE_MAPPING", "OwnerADMIN")

        with pytest.raises(ValueError, match="Invalid ROLE_MAPPING format.*Expected format"):
            OAuth2ClientConfig.from_env("test")

    def test_role_mapping_empty_idp_role_fails(self, monkeypatch: MonkeyPatch) -> None:
        """Test that empty IDP role in mapping fails."""
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_CLIENT_ID", "client_id")
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_CLIENT_SECRET", "secret")
        monkeypatch.setenv(
            "PHOENIX_OAUTH2_TEST_OIDC_CONFIG_URL",
            "https://example.com/.well-known/openid-configuration",
        )
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_ROLE_MAPPING", ":ADMIN")

        with pytest.raises(ValueError, match="IDP role cannot be empty"):
            OAuth2ClientConfig.from_env("test")

    def test_role_mapping_system_role_fails(self, monkeypatch: MonkeyPatch) -> None:
        """Test that SYSTEM role cannot be assigned via OAuth2 role mapping."""
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_CLIENT_ID", "client_id")
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_CLIENT_SECRET", "secret")
        monkeypatch.setenv(
            "PHOENIX_OAUTH2_TEST_OIDC_CONFIG_URL",
            "https://example.com/.well-known/openid-configuration",
        )
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_ROLE_MAPPING", "SuperAdmin:SYSTEM")

        with pytest.raises(
            ValueError, match="SYSTEM role cannot be assigned via OAuth2.*internal-only"
        ):
            OAuth2ClientConfig.from_env("test")

    def test_role_mapping_invalid_phoenix_role_fails(self, monkeypatch: MonkeyPatch) -> None:
        """Test that invalid Phoenix role in mapping fails."""
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_CLIENT_ID", "client_id")
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_CLIENT_SECRET", "secret")
        monkeypatch.setenv(
            "PHOENIX_OAUTH2_TEST_OIDC_CONFIG_URL",
            "https://example.com/.well-known/openid-configuration",
        )
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_ROLE_MAPPING", "Owner:SUPERUSER")

        with pytest.raises(ValueError, match="not a valid Phoenix role.*Valid roles are"):
            OAuth2ClientConfig.from_env("test")

    def test_role_mapping_empty_string_ignored(self, monkeypatch: MonkeyPatch) -> None:
        """Test that empty role mapping string results in empty dict."""
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_CLIENT_ID", "client_id")
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_CLIENT_SECRET", "secret")
        monkeypatch.setenv(
            "PHOENIX_OAUTH2_TEST_OIDC_CONFIG_URL",
            "https://example.com/.well-known/openid-configuration",
        )
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_ROLE_MAPPING", "")

        config = OAuth2ClientConfig.from_env("test")
        assert config.role_mapping == {}

    def test_role_mapping_trailing_commas_ignored(self, monkeypatch: MonkeyPatch) -> None:
        """Test that trailing commas and empty segments are ignored."""
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_CLIENT_ID", "client_id")
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_CLIENT_SECRET", "secret")
        monkeypatch.setenv(
            "PHOENIX_OAUTH2_TEST_OIDC_CONFIG_URL",
            "https://example.com/.well-known/openid-configuration",
        )
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_ROLE_ATTRIBUTE_PATH", "role")
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_ROLE_MAPPING", "Owner:ADMIN,,Developer:MEMBER,")

        config = OAuth2ClientConfig.from_env("test")
        assert config.role_mapping == {"Owner": "ADMIN", "Developer": "MEMBER"}

    def test_role_attribute_strict_mode(self, monkeypatch: MonkeyPatch) -> None:
        """Test that role_attribute_strict mode can be enabled."""
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_CLIENT_ID", "client_id")
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_CLIENT_SECRET", "secret")
        monkeypatch.setenv(
            "PHOENIX_OAUTH2_TEST_OIDC_CONFIG_URL",
            "https://example.com/.well-known/openid-configuration",
        )
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_ROLE_ATTRIBUTE_PATH", "roles")
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_ROLE_MAPPING", "Owner:ADMIN")
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_ROLE_ATTRIBUTE_STRICT", "true")

        config = OAuth2ClientConfig.from_env("test")
        assert config.role_attribute_strict is True

    def test_role_attribute_path_without_mapping_allowed(self, monkeypatch: MonkeyPatch) -> None:
        """Test that role_attribute_path can be set without role_mapping (uses defaults)."""
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_CLIENT_ID", "client_id")
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_CLIENT_SECRET", "secret")
        monkeypatch.setenv(
            "PHOENIX_OAUTH2_TEST_OIDC_CONFIG_URL",
            "https://example.com/.well-known/openid-configuration",
        )
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_ROLE_ATTRIBUTE_PATH", "roles")

        config = OAuth2ClientConfig.from_env("test")
        assert config.role_attribute_path == "roles"
        assert config.role_mapping == {}

    def test_role_mapping_without_attribute_path_fails(self, monkeypatch: MonkeyPatch) -> None:
        """Test that role_mapping requires role_attribute_path."""
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_CLIENT_ID", "client_id")
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_CLIENT_SECRET", "secret")
        monkeypatch.setenv(
            "PHOENIX_OAUTH2_TEST_OIDC_CONFIG_URL",
            "https://example.com/.well-known/openid-configuration",
        )
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_ROLE_MAPPING", "Owner:ADMIN")

        with pytest.raises(
            ValueError,
            match="ROLE_MAPPING is set but ROLE_ATTRIBUTE_PATH is not configured",
        ):
            OAuth2ClientConfig.from_env("test")

    def test_role_attribute_strict_without_attribute_path_fails(
        self, monkeypatch: MonkeyPatch
    ) -> None:
        """Test that role_attribute_strict requires role_attribute_path."""
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_CLIENT_ID", "client_id")
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_CLIENT_SECRET", "secret")
        monkeypatch.setenv(
            "PHOENIX_OAUTH2_TEST_OIDC_CONFIG_URL",
            "https://example.com/.well-known/openid-configuration",
        )
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_ROLE_ATTRIBUTE_STRICT", "true")

        with pytest.raises(
            ValueError,
            match="ROLE_ATTRIBUTE_STRICT is set to true but ROLE_ATTRIBUTE_PATH is not configured",
        ):
            OAuth2ClientConfig.from_env("test")

    def test_role_mapping_defaults(self, monkeypatch: MonkeyPatch) -> None:
        """Test that role mapping fields default to empty/None when not configured."""
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_CLIENT_ID", "client_id")
        monkeypatch.setenv("PHOENIX_OAUTH2_TEST_CLIENT_SECRET", "secret")
        monkeypatch.setenv(
            "PHOENIX_OAUTH2_TEST_OIDC_CONFIG_URL",
            "https://example.com/.well-known/openid-configuration",
        )

        config = OAuth2ClientConfig.from_env("test")
        assert config.role_attribute_path is None
        assert config.role_mapping == {}
        assert config.role_attribute_strict is False


def test_oauth2_role_names_are_subset_of_user_role_names() -> None:
    """Test that OAuth2 valid roles are a proper subset of UserRoleName from models.py.

    This ensures that:
    1. All OAuth2 roles are valid Phoenix user roles
    2. SYSTEM role is explicitly excluded from OAuth2 (security requirement)
    """
    # Get all valid roles from both type aliases
    all_user_roles = set(get_args(UserRoleName))
    oauth2_roles = set(get_args(AssignableUserRoleName))

    # Verify OAuth2 roles are a proper subset (not equal, must exclude SYSTEM)
    assert oauth2_roles < all_user_roles, "OAuth2 roles must be a proper subset of all user roles"

    # Verify SYSTEM is in UserRoleName but NOT in AssignableUserRoleName
    assert "SYSTEM" in all_user_roles, "SYSTEM role must exist in UserRoleName"
    assert "SYSTEM" not in oauth2_roles, "SYSTEM role must NOT be allowed for OAuth2"

    # Verify expected OAuth2 roles are present
    assert oauth2_roles == {"ADMIN", "MEMBER", "VIEWER"}, (
        "OAuth2 should only allow ADMIN, MEMBER, VIEWER"
    )


class TestLDAPConfigFromEnv:
    """Test LDAP configuration loading from environment variables."""

    @pytest.mark.parametrize(
        "env_vars, expected_error_msg",
        [
            pytest.param(
                {
                    "PHOENIX_LDAP_HOST": "ldap.example.com",
                    "PHOENIX_LDAP_USER_SEARCH_BASE_DNS": '["ou=people,dc=example,dc=com"]',
                    "PHOENIX_LDAP_GROUP_ROLE_MAPPINGS": "not-valid-json",
                },
                "is not valid JSON",
                id="invalid_json_mappings",
            ),
            pytest.param(
                {
                    "PHOENIX_LDAP_HOST": "ldap.example.com",
                    "PHOENIX_LDAP_USER_SEARCH_BASE_DNS": '["ou=people,dc=example,dc=com"]',
                    "PHOENIX_LDAP_GROUP_ROLE_MAPPINGS": '{"admin": ["..."]}',
                },
                "must be a JSON array",
                id="mappings_not_array",
            ),
            pytest.param(
                {
                    "PHOENIX_LDAP_HOST": "ldap.example.com",
                    "PHOENIX_LDAP_USER_SEARCH_BASE_DNS": '["ou=people,dc=example,dc=com"]',
                    "PHOENIX_LDAP_GROUP_ROLE_MAPPINGS": '["not-a-dict"]',
                },
                "must be an object",
                id="mapping_not_object",
            ),
            pytest.param(
                {
                    "PHOENIX_LDAP_HOST": "ldap.example.com",
                    "PHOENIX_LDAP_USER_SEARCH_BASE_DNS": '["ou=people,dc=example,dc=com"]',
                    "PHOENIX_LDAP_GROUP_ROLE_MAPPINGS": '[{"role": "ADMIN"}]',
                },
                "missing required field 'group_dn'",
                id="missing_group_dn",
            ),
            pytest.param(
                {
                    "PHOENIX_LDAP_HOST": "ldap.example.com",
                    "PHOENIX_LDAP_USER_SEARCH_BASE_DNS": '["ou=people,dc=example,dc=com"]',
                    "PHOENIX_LDAP_GROUP_ROLE_MAPPINGS": '[{"group_dn": "..."}]',
                },
                "missing required field 'role'",
                id="missing_role",
            ),
            pytest.param(
                {
                    "PHOENIX_LDAP_HOST": "ldap.example.com",
                    "PHOENIX_LDAP_USER_SEARCH_BASE_DNS": '["ou=people,dc=example,dc=com"]',
                    "PHOENIX_LDAP_GROUP_ROLE_MAPPINGS": '[{"group_dn": "*", "role": "invalid_role"}]',
                },
                "role must be one of",
                id="invalid_role_lowercase",
            ),
            pytest.param(
                {
                    "PHOENIX_LDAP_HOST": "ldap.example.com",
                    "PHOENIX_LDAP_USER_SEARCH_BASE_DNS": '["ou=people,dc=example,dc=com"]',
                    "PHOENIX_LDAP_GROUP_ROLE_MAPPINGS": '[{"group_dn": "*", "role": "MEMBER"}]',
                    "PHOENIX_LDAP_TLS_MODE": "invalid",
                },
                "must be 'none', 'starttls', or 'ldaps'",
                id="invalid_tls_mode",
            ),
            pytest.param(
                {
                    "PHOENIX_LDAP_HOST": "ldap.example.com",
                    "PHOENIX_LDAP_USER_SEARCH_BASE_DNS": '["ou=people,dc=example,dc=com"]',
                    "PHOENIX_LDAP_GROUP_ROLE_MAPPINGS": '[{"group_dn": "*", "role": "MEMBER"}]',
                    "PHOENIX_LDAP_GROUP_SEARCH_FILTER": "(&(objectClass=posixGroup)(memberUid=%s))",
                    # Missing PHOENIX_LDAP_GROUP_SEARCH_BASE_DNS
                },
                "GROUP_SEARCH_FILTER is set but",
                id="group_search_filter_without_base_dns",
            ),
            pytest.param(
                {
                    "PHOENIX_LDAP_HOST": "ldap.example.com",
                    "PHOENIX_LDAP_GROUP_ROLE_MAPPINGS": '[{"group_dn": "*", "role": "MEMBER"}]',
                },
                "must be set",
                id="missing_user_search_base_dns",
            ),
            pytest.param(
                {
                    "PHOENIX_LDAP_HOST": "ldap.example.com",
                    "PHOENIX_LDAP_USER_SEARCH_BASE_DNS": '["ou=people,dc=example,dc=com"]',
                    "PHOENIX_LDAP_GROUP_ROLE_MAPPINGS": '[{"group_dn": "*", "role": "MEMBER"}]',
                    "PHOENIX_LDAP_TLS_CLIENT_CERT_FILE": "/path/to/cert.pem",
                },
                "requires PHOENIX_LDAP_TLS_CLIENT_KEY_FILE",
                id="client_cert_without_key",
            ),
            pytest.param(
                {
                    "PHOENIX_LDAP_HOST": "ldap.example.com",
                    "PHOENIX_LDAP_USER_SEARCH_BASE_DNS": '["ou=people,dc=example,dc=com"]',
                    "PHOENIX_LDAP_GROUP_ROLE_MAPPINGS": '[{"group_dn": "*", "role": "MEMBER"}]',
                    "PHOENIX_LDAP_TLS_CLIENT_KEY_FILE": "/path/to/key.pem",
                },
                "requires PHOENIX_LDAP_TLS_CLIENT_CERT_FILE",
                id="client_key_without_cert",
            ),
            pytest.param(
                {
                    "PHOENIX_LDAP_HOST": "ldap.example.com",
                    "PHOENIX_LDAP_USER_SEARCH_BASE_DNS": '["ou=people,dc=example,dc=com"]',
                    "PHOENIX_LDAP_GROUP_ROLE_MAPPINGS": '[{"group_dn": "*", "role": "MEMBER"}]',
                    "PHOENIX_LDAP_ATTR_UNIQUE_ID": "object GUID",
                },
                "LDAP attribute names do not contain spaces",
                id="attr_unique_id_with_spaces",
            ),
            pytest.param(
                {
                    "PHOENIX_LDAP_HOST": "ldap.example.com",
                    "PHOENIX_LDAP_USER_SEARCH_BASE_DNS": '["ou=people,dc=example,dc=com"]',
                    "PHOENIX_LDAP_GROUP_ROLE_MAPPINGS": '[{"group_dn": "*", "role": "MEMBER"}]',
                    "PHOENIX_LDAP_ATTR_EMAIL": "e mail",
                },
                "LDAP attribute names do not contain spaces",
                id="attr_email_with_spaces",
            ),
            pytest.param(
                {
                    "PHOENIX_LDAP_HOST": "ldap.example.com",
                    "PHOENIX_LDAP_USER_SEARCH_BASE_DNS": '["ou=people,dc=example,dc=com"]',
                    "PHOENIX_LDAP_GROUP_ROLE_MAPPINGS": '[{"group_dn": "*", "role": "MEMBER"}]',
                    "PHOENIX_LDAP_ATTR_EMAIL": "",
                    # No-email mode requires unique_id
                },
                "PHOENIX_LDAP_ATTR_UNIQUE_ID is required",
                id="attr_email_empty_requires_unique_id",
            ),
            pytest.param(
                {
                    "PHOENIX_LDAP_HOST": "ldap.example.com",
                    "PHOENIX_LDAP_USER_SEARCH_BASE_DNS": '["ou=people,dc=example,dc=com"]',
                    "PHOENIX_LDAP_GROUP_ROLE_MAPPINGS": '[{"group_dn": "*", "role": "MEMBER"}]',
                    "PHOENIX_LDAP_ATTR_EMAIL": "",
                    "PHOENIX_LDAP_ATTR_UNIQUE_ID": "entryUUID",
                    "PHOENIX_LDAP_ALLOW_SIGN_UP": "false",
                    # No-email mode requires allow_sign_up=true
                },
                "PHOENIX_LDAP_ALLOW_SIGN_UP must be True",
                id="attr_email_empty_requires_allow_sign_up",
            ),
            pytest.param(
                {
                    "PHOENIX_LDAP_HOST": "ldap.example.com",
                    "PHOENIX_LDAP_USER_SEARCH_BASE_DNS": '["ou=people,dc=example,dc=com"]',
                    "PHOENIX_LDAP_GROUP_ROLE_MAPPINGS": '[{"group_dn": "*", "role": "MEMBER"}]',
                    "PHOENIX_LDAP_ATTR_EMAIL": "null",
                    # No-email mode (via "null" sentinel) requires unique_id
                },
                "PHOENIX_LDAP_ATTR_UNIQUE_ID is required",
                id="attr_email_null_sentinel_requires_unique_id",
            ),
            pytest.param(
                {
                    "PHOENIX_LDAP_HOST": "ldap.example.com",
                    "PHOENIX_LDAP_USER_SEARCH_BASE_DNS": '["ou=people,dc=example,dc=com"]',
                    "PHOENIX_LDAP_GROUP_ROLE_MAPPINGS": '[{"group_dn": "*", "role": "MEMBER"}]',
                    "PHOENIX_LDAP_ATTR_EMAIL": "null",
                    "PHOENIX_LDAP_ATTR_UNIQUE_ID": "entryUUID",
                    "PHOENIX_LDAP_ALLOW_SIGN_UP": "false",
                    # No-email mode (via "null" sentinel) requires allow_sign_up=true
                },
                "PHOENIX_LDAP_ALLOW_SIGN_UP must be True",
                id="attr_email_null_sentinel_requires_allow_sign_up",
            ),
            pytest.param(
                {
                    "PHOENIX_LDAP_HOST": "ldap.example.com",
                    "PHOENIX_LDAP_USER_SEARCH_BASE_DNS": '["ou=people,dc=example,dc=com"]',
                    "PHOENIX_LDAP_GROUP_ROLE_MAPPINGS": '[{"group_dn": "*", "role": "MEMBER"}]',
                    "PHOENIX_LDAP_ATTR_EMAIL": "null",
                    "PHOENIX_LDAP_ATTR_UNIQUE_ID": "entryUUID",
                    "PHOENIX_LDAP_ALLOW_SIGN_UP": "true",
                    "PHOENIX_ADMINS": "Admin User=admin@example.com",
                    # No-email mode (via "null" sentinel) rejects PHOENIX_ADMINS
                },
                "PHOENIX_ADMINS is not supported",
                id="attr_email_null_sentinel_rejects_phoenix_admins",
            ),
            pytest.param(
                {
                    "PHOENIX_LDAP_HOST": "ldap.example.com",
                    "PHOENIX_LDAP_USER_SEARCH_BASE_DNS": '["ou=people,dc=example,dc=com"]',
                    "PHOENIX_LDAP_GROUP_ROLE_MAPPINGS": "[]",
                },
                "must contain at least one mapping",
                id="empty_group_role_mappings",
            ),
            pytest.param(
                {
                    "PHOENIX_LDAP_HOST": "ldap.example.com",
                    "PHOENIX_LDAP_USER_SEARCH_BASE_DNS": '["ou=people,dc=example,dc=com"]',
                    "PHOENIX_LDAP_GROUP_ROLE_MAPPINGS": '[{"group_dn": "*", "role": "MEMBER"}]',
                    "PHOENIX_LDAP_USER_SEARCH_FILTER": "(&(objectClass=user)(sAMAccountName=admin))",
                },
                "must contain '%s' placeholder for username",
                id="user_search_filter_missing_placeholder",
            ),
            pytest.param(
                {
                    "PHOENIX_LDAP_HOST": "ldap.example.com",
                    "PHOENIX_LDAP_USER_SEARCH_BASE_DNS": '["ou=people,dc=example,dc=com"]',
                    "PHOENIX_LDAP_GROUP_ROLE_MAPPINGS": '[{"group_dn": "*", "role": "MEMBER"}]',
                    "PHOENIX_LDAP_GROUP_SEARCH_BASE_DNS": '["ou=groups,dc=example,dc=com"]',
                    "PHOENIX_LDAP_GROUP_SEARCH_FILTER": "(&(objectClass=posixGroup)(memberUid=admin))",
                },
                "must contain '%s' placeholder",
                id="group_search_filter_missing_placeholder",
            ),
            pytest.param(
                {
                    "PHOENIX_LDAP_HOST": "ldap.example.com",
                    "PHOENIX_LDAP_USER_SEARCH_BASE_DNS": '["ou=people,dc=example,dc=com"]',
                    "PHOENIX_LDAP_GROUP_ROLE_MAPPINGS": '[{"group_dn": "*", "role": "MEMBER"}]',
                    "PHOENIX_LDAP_BIND_PASSWORD": "secret",
                    # Missing PHOENIX_LDAP_BIND_DN
                },
                "PHOENIX_LDAP_BIND_PASSWORD is set but PHOENIX_LDAP_BIND_DN is missing",
                id="bind_password_without_bind_dn",
            ),
            pytest.param(
                {
                    "PHOENIX_LDAP_HOST": "ldap.example.com",
                    "PHOENIX_LDAP_USER_SEARCH_BASE_DNS": '["ou=people,dc=example,dc=com"]',
                    "PHOENIX_LDAP_GROUP_ROLE_MAPPINGS": '[{"group_dn": "*", "role": "MEMBER"}]',
                    "PHOENIX_LDAP_BIND_DN": "not a valid dn",
                    "PHOENIX_LDAP_BIND_PASSWORD": "secret",
                },
                "has invalid LDAP DN syntax",
                id="bind_dn_invalid_syntax",
            ),
            pytest.param(
                {
                    "PHOENIX_LDAP_HOST": "ldap.example.com",
                    "PHOENIX_LDAP_USER_SEARCH_BASE_DNS": '["not a valid dn"]',
                    "PHOENIX_LDAP_GROUP_ROLE_MAPPINGS": '[{"group_dn": "*", "role": "MEMBER"}]',
                },
                "has invalid LDAP DN syntax",
                id="user_search_base_dn_invalid_syntax",
            ),
            pytest.param(
                {
                    "PHOENIX_LDAP_HOST": "ldap.example.com",
                    "PHOENIX_LDAP_USER_SEARCH_BASE_DNS": '["ou=people,dc=example,dc=com"]',
                    "PHOENIX_LDAP_GROUP_ROLE_MAPPINGS": '[{"group_dn": "*", "role": "MEMBER"}]',
                    "PHOENIX_LDAP_GROUP_SEARCH_BASE_DNS": '["not a valid dn"]',
                    "PHOENIX_LDAP_GROUP_SEARCH_FILTER": "(&(objectClass=posixGroup)(memberUid=%s))",
                },
                "has invalid LDAP DN syntax",
                id="group_search_base_dn_invalid_syntax",
            ),
            pytest.param(
                {
                    "PHOENIX_LDAP_HOST": "ldap.example.com",
                    "PHOENIX_LDAP_USER_SEARCH_BASE_DNS": '["ou=people,dc=example,dc=com"]',
                    "PHOENIX_LDAP_GROUP_ROLE_MAPPINGS": (
                        '[{"group_dn": "not a valid dn", "role": "MEMBER"}]'
                    ),
                },
                "has invalid LDAP DN syntax",
                id="group_role_mapping_dn_invalid_syntax",
            ),
            pytest.param(
                {
                    "PHOENIX_LDAP_HOST": "ldap.example.com",
                    "PHOENIX_LDAP_USER_SEARCH_BASE_DNS": '["ou=people,dc=example,dc=com"]',
                    # Empty group_dn in role mapping is rejected (wildcard "*" should be used instead)
                    "PHOENIX_LDAP_GROUP_ROLE_MAPPINGS": '[{"group_dn": "", "role": "MEMBER"}]',
                },
                "must be a non-empty string",
                id="group_role_mapping_dn_empty_string",
            ),
        ],
    )
    def test_invalid_inputs(
        self,
        monkeypatch: MonkeyPatch,
        env_vars: dict[str, str],
        expected_error_msg: str,
    ) -> None:
        """Test that invalid LDAP configuration raises appropriate errors."""
        # Clear all LDAP environment variables
        for key in [k for k in os.environ if k.startswith("PHOENIX_LDAP_")]:
            monkeypatch.delenv(key, raising=False)

        # Set test environment variables
        for key, value in env_vars.items():
            monkeypatch.setenv(key, value)

        from phoenix.config import LDAPConfig

        with pytest.raises(ValueError) as exc_info:
            LDAPConfig.from_env()
        assert expected_error_msg in str(exc_info.value)

    @pytest.mark.parametrize(
        "env_vars, expected_attrs",
        [
            pytest.param(
                {
                    "PHOENIX_LDAP_HOST": "ldap.example.com",
                    "PHOENIX_LDAP_USER_SEARCH_BASE_DNS": '["ou=people,dc=example,dc=com"]',
                    "PHOENIX_LDAP_GROUP_ROLE_MAPPINGS": (
                        '[{"group_dn": "cn=admins,ou=groups,dc=example,dc=com", "role": "ADMIN"}]'
                    ),
                },
                {
                    "hosts": ("ldap.example.com",),
                    "port": 389,
                    "tls_mode": "starttls",
                    "tls_verify": True,
                    "bind_dn": None,
                    "bind_password": None,
                    "user_search_base_dns": ("ou=people,dc=example,dc=com",),
                    "user_search_filter": "(&(objectClass=user)(sAMAccountName=%s))",
                    "attr_email": "mail",
                    "attr_display_name": "displayName",
                    "attr_member_of": "memberOf",
                    "group_search_base_dns": (),
                    "group_search_filter": None,
                    "group_role_mappings": (
                        {
                            "group_dn": "cn=admins,ou=groups,dc=example,dc=com",
                            "role": "ADMIN",
                        },
                    ),
                },
                id="minimal_active_directory",
            ),
            pytest.param(
                {
                    "PHOENIX_LDAP_HOST": "dc1.example.com,dc2.example.com",
                    "PHOENIX_LDAP_PORT": "636",
                    "PHOENIX_LDAP_TLS_MODE": "ldaps",
                    "PHOENIX_LDAP_TLS_VERIFY": "false",
                    "PHOENIX_LDAP_BIND_DN": "cn=admin,dc=example,dc=com",
                    "PHOENIX_LDAP_BIND_PASSWORD": "secret",
                    "PHOENIX_LDAP_USER_SEARCH_BASE_DNS": '["ou=users,dc=example,dc=com"]',
                    "PHOENIX_LDAP_USER_SEARCH_FILTER": "(&(objectClass=person)(uid=%s))",
                    "PHOENIX_LDAP_ATTR_EMAIL": "email",
                    "PHOENIX_LDAP_ATTR_DISPLAY_NAME": "cn",
                    "PHOENIX_LDAP_GROUP_ROLE_MAPPINGS": '[{"group_dn": "*", "role": "VIEWER"}]',
                },
                {
                    "hosts": ("dc1.example.com", "dc2.example.com"),
                    "port": 636,
                    "tls_mode": "ldaps",
                    "tls_verify": False,
                    "bind_dn": "cn=admin,dc=example,dc=com",
                    "bind_password": "secret",
                    "user_search_base_dns": ("ou=users,dc=example,dc=com",),
                    "user_search_filter": "(&(objectClass=person)(uid=%s))",
                    "attr_email": "email",
                    "attr_display_name": "cn",
                    "attr_member_of": "memberOf",
                    "group_search_base_dns": (),
                    "group_search_filter": None,
                    "group_role_mappings": ({"group_dn": "*", "role": "VIEWER"},),
                },
                id="custom_settings_with_multiple_servers",
            ),
            pytest.param(
                {
                    "PHOENIX_LDAP_HOST": "ldap.example.com",
                    "PHOENIX_LDAP_USER_SEARCH_BASE_DNS": '["ou=people,dc=example,dc=com"]',
                    "PHOENIX_LDAP_ATTR_MEMBER_OF": "",
                    "PHOENIX_LDAP_GROUP_SEARCH_BASE_DNS": '["ou=groups,dc=example,dc=com"]',
                    "PHOENIX_LDAP_GROUP_SEARCH_FILTER": "(&(objectClass=posixGroup)(memberUid=%s))",
                    "PHOENIX_LDAP_GROUP_ROLE_MAPPINGS": (
                        '[{"group_dn": "cn=phoenix-users,ou=groups,dc=example,dc=com", '
                        '"role": "MEMBER"}]'
                    ),
                },
                {
                    "hosts": ("ldap.example.com",),
                    "port": 389,
                    "tls_mode": "starttls",
                    "tls_verify": True,
                    "bind_dn": None,
                    "bind_password": None,
                    "user_search_base_dns": ("ou=people,dc=example,dc=com",),
                    "user_search_filter": "(&(objectClass=user)(sAMAccountName=%s))",
                    "attr_email": "mail",
                    "attr_display_name": "displayName",
                    "attr_member_of": None,
                    "group_search_base_dns": ("ou=groups,dc=example,dc=com",),
                    "group_search_filter": "(&(objectClass=posixGroup)(memberUid=%s))",
                    "group_role_mappings": (
                        {
                            "group_dn": "cn=phoenix-users,ou=groups,dc=example,dc=com",
                            "role": "MEMBER",
                        },
                    ),
                },
                id="posix_groups",
            ),
            pytest.param(
                {
                    "PHOENIX_LDAP_HOST": "ldap.example.com",
                    "PHOENIX_LDAP_USER_SEARCH_BASE_DNS": '["ou=people,dc=example,dc=com"]',
                    "PHOENIX_LDAP_TLS_MODE": "starttls",
                    "PHOENIX_LDAP_GROUP_ROLE_MAPPINGS": '[{"group_dn": "*", "role": "VIEWER"}]',
                },
                {
                    "hosts": ("ldap.example.com",),
                    "port": 389,  # Should default to 389 for STARTTLS
                    "tls_mode": "starttls",
                },
                id="starttls_defaults_to_port_389",
            ),
            pytest.param(
                {
                    "PHOENIX_LDAP_HOST": "ldap.example.com",
                    "PHOENIX_LDAP_USER_SEARCH_BASE_DNS": '["ou=people,dc=example,dc=com"]',
                    # Group DN with mixed case and extra whitespace - should be canonicalized
                    "PHOENIX_LDAP_GROUP_ROLE_MAPPINGS": (
                        '[{"group_dn": "  CN=Admins,OU=Groups,DC=Example,DC=COM  ", "role": "admin"}]'
                    ),
                },
                {
                    # Should be canonicalized: lowercase, stripped, normalized
                    "group_role_mappings": (
                        {
                            "group_dn": "cn=admins,ou=groups,dc=example,dc=com",
                            "role": "ADMIN",
                        },
                    ),
                },
                id="group_dn_canonicalized_and_role_uppercase",
            ),
            pytest.param(
                {
                    "PHOENIX_LDAP_HOST": "ldap.example.com",
                    "PHOENIX_LDAP_USER_SEARCH_BASE_DNS": '["ou=people,dc=example,dc=com"]',
                    "PHOENIX_LDAP_TLS_MODE": "ldaps",
                    "PHOENIX_LDAP_GROUP_ROLE_MAPPINGS": '[{"group_dn": "*", "role": "VIEWER"}]',
                },
                {
                    "hosts": ("ldap.example.com",),
                    "port": 636,  # Should default to 636 for LDAPS
                    "tls_mode": "ldaps",
                },
                id="ldaps_defaults_to_port_636",
            ),
            pytest.param(
                {
                    "PHOENIX_LDAP_HOST": "ldap.example.com",
                    "PHOENIX_LDAP_USER_SEARCH_BASE_DNS": '["ou=people,dc=example,dc=com"]',
                    "PHOENIX_LDAP_GROUP_ROLE_MAPPINGS": '[{"group_dn": "*", "role": "MEMBER"}]',
                    "PHOENIX_LDAP_ATTR_EMAIL": "",
                    "PHOENIX_LDAP_ATTR_UNIQUE_ID": "entryUUID",
                    "PHOENIX_LDAP_ALLOW_SIGN_UP": "true",
                },
                {
                    "hosts": ("ldap.example.com",),
                    "attr_email": None,  # Empty string becomes None in no-email mode
                    "attr_unique_id": "entryUUID",
                    "allow_sign_up": True,
                },
                id="no_email_mode_valid",
            ),
            pytest.param(
                {
                    "PHOENIX_LDAP_HOST": "ldap.example.com",
                    "PHOENIX_LDAP_USER_SEARCH_BASE_DNS": '["ou=people,dc=example,dc=com"]',
                    "PHOENIX_LDAP_GROUP_ROLE_MAPPINGS": '[{"group_dn": "*", "role": "MEMBER"}]',
                    "PHOENIX_LDAP_ATTR_EMAIL": "null",
                    "PHOENIX_LDAP_ATTR_UNIQUE_ID": "entryUUID",
                    "PHOENIX_LDAP_ALLOW_SIGN_UP": "true",
                },
                {
                    "hosts": ("ldap.example.com",),
                    "attr_email": None,  # "null" sentinel becomes None in no-email mode
                    "attr_unique_id": "entryUUID",
                    "allow_sign_up": True,
                },
                id="no_email_mode_null_sentinel",
            ),
            pytest.param(
                {
                    "PHOENIX_LDAP_HOST": "ldap.example.com",
                    "PHOENIX_LDAP_USER_SEARCH_BASE_DNS": '["ou=people,dc=example,dc=com"]',
                    "PHOENIX_LDAP_GROUP_ROLE_MAPPINGS": '[{"group_dn": "*", "role": "MEMBER"}]',
                    "PHOENIX_LDAP_ATTR_EMAIL": "NULL",  # Case-insensitive
                    "PHOENIX_LDAP_ATTR_UNIQUE_ID": "entryUUID",
                    "PHOENIX_LDAP_ALLOW_SIGN_UP": "true",
                },
                {
                    "hosts": ("ldap.example.com",),
                    "attr_email": None,  # "NULL" (uppercase) also becomes None
                    "attr_unique_id": "entryUUID",
                    "allow_sign_up": True,
                },
                id="no_email_mode_null_sentinel_uppercase",
            ),
            pytest.param(
                {
                    "PHOENIX_LDAP_HOST": "ldap.example.com",
                    # Base DNs with extra whitespace - should be stripped
                    "PHOENIX_LDAP_USER_SEARCH_BASE_DNS": '["  ou=people,dc=example,dc=com  "]',
                    "PHOENIX_LDAP_GROUP_ROLE_MAPPINGS": '[{"group_dn": "*", "role": "MEMBER"}]',
                    "PHOENIX_LDAP_BIND_DN": "  cn=admin,dc=example,dc=com  ",
                    "PHOENIX_LDAP_BIND_PASSWORD": "secret",
                },
                {
                    # Base DNs should be stripped (but not canonicalized - passed to LDAP as-is)
                    "user_search_base_dns": ("ou=people,dc=example,dc=com",),
                    "bind_dn": "cn=admin,dc=example,dc=com",
                },
                id="base_dns_and_bind_dn_stripped",
            ),
            pytest.param(
                {
                    "PHOENIX_LDAP_HOST": "ldap.example.com",
                    # Empty DN is valid - represents root DSE (search entire directory)
                    "PHOENIX_LDAP_USER_SEARCH_BASE_DNS": '[""]',
                    "PHOENIX_LDAP_GROUP_ROLE_MAPPINGS": '[{"group_dn": "*", "role": "MEMBER"}]',
                },
                {
                    "user_search_base_dns": ("",),  # Empty DN stored as-is
                },
                id="empty_dn_valid_root_dse",
            ),
            pytest.param(
                {
                    "PHOENIX_LDAP_HOST": "ldap.example.com",
                    # Whitespace-only becomes empty DN after strip
                    "PHOENIX_LDAP_USER_SEARCH_BASE_DNS": '["   "]',
                    "PHOENIX_LDAP_GROUP_ROLE_MAPPINGS": '[{"group_dn": "*", "role": "MEMBER"}]',
                },
                {
                    "user_search_base_dns": ("",),  # Whitespace stripped to empty
                },
                id="whitespace_only_dn_becomes_empty",
            ),
        ],
    )
    def test_valid_inputs(
        self,
        monkeypatch: MonkeyPatch,
        env_vars: dict[str, str],
        expected_attrs: dict[str, Any],
    ) -> None:
        """Test that valid LDAP configuration is loaded correctly."""
        # Clear all LDAP environment variables
        for key in [k for k in os.environ if k.startswith("PHOENIX_LDAP_")]:
            monkeypatch.delenv(key, raising=False)

        # Set test environment variables
        for key, value in env_vars.items():
            monkeypatch.setenv(key, value)

        from phoenix.config import LDAPConfig

        config = LDAPConfig.from_env()
        assert config is not None

        for attr, expected_value in expected_attrs.items():
            assert getattr(config, attr) == expected_value, (
                f"Mismatch for attribute '{attr}': "
                f"expected {expected_value}, got {getattr(config, attr)}"
            )

    def test_returns_none_when_host_not_set(self, monkeypatch: MonkeyPatch) -> None:
        """Test that from_env returns None when PHOENIX_LDAP_HOST is not set."""
        monkeypatch.delenv("PHOENIX_LDAP_HOST", raising=False)

        from phoenix.config import LDAPConfig

        assert LDAPConfig.from_env() is None

    def test_tls_custom_ca_cert(self, monkeypatch: MonkeyPatch, tmp_path: Any) -> None:
        """Test that custom CA certificate file path is correctly loaded."""
        # Create a dummy CA cert file
        ca_cert_file = tmp_path / "ca.pem"
        ca_cert_file.write_text("-----BEGIN CERTIFICATE-----\nfake cert\n-----END CERTIFICATE-----")

        monkeypatch.setenv("PHOENIX_LDAP_HOST", "ldap.example.com")
        monkeypatch.setenv("PHOENIX_LDAP_USER_SEARCH_BASE_DNS", '["ou=people,dc=example,dc=com"]')
        monkeypatch.setenv(
            "PHOENIX_LDAP_GROUP_ROLE_MAPPINGS", '[{"group_dn": "*", "role": "MEMBER"}]'
        )
        monkeypatch.setenv("PHOENIX_LDAP_TLS_CA_CERT_FILE", str(ca_cert_file))

        from phoenix.config import LDAPConfig

        config = LDAPConfig.from_env()
        assert config is not None
        assert config.tls_ca_cert_file == str(ca_cert_file)

    def test_tls_client_cert_and_key(self, monkeypatch: MonkeyPatch, tmp_path: Any) -> None:
        """Test that client certificate and key paths are correctly loaded."""
        # Create dummy client cert and key files
        client_cert_file = tmp_path / "client.crt"
        client_key_file = tmp_path / "client.key"
        client_cert_file.write_text(
            "-----BEGIN CERTIFICATE-----\nfake cert\n-----END CERTIFICATE-----"
        )
        client_key_file.write_text(
            "-----BEGIN PRIVATE KEY-----\nfake key\n-----END PRIVATE KEY-----"
        )

        monkeypatch.setenv("PHOENIX_LDAP_HOST", "ldap.example.com")
        monkeypatch.setenv("PHOENIX_LDAP_USER_SEARCH_BASE_DNS", '["ou=people,dc=example,dc=com"]')
        monkeypatch.setenv(
            "PHOENIX_LDAP_GROUP_ROLE_MAPPINGS", '[{"group_dn": "*", "role": "MEMBER"}]'
        )
        monkeypatch.setenv("PHOENIX_LDAP_TLS_CLIENT_CERT_FILE", str(client_cert_file))
        monkeypatch.setenv("PHOENIX_LDAP_TLS_CLIENT_KEY_FILE", str(client_key_file))

        from phoenix.config import LDAPConfig

        config = LDAPConfig.from_env()
        assert config is not None
        assert config.tls_client_cert_file == str(client_cert_file)
        assert config.tls_client_key_file == str(client_key_file)
