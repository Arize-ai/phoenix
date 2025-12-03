from __future__ import annotations

from pathlib import Path
from secrets import token_hex
from typing import TYPE_CHECKING, Iterator, Mapping

import pytest
from smtpdfix.certs import Cert, _generate_certs

from .._helpers import (
    _AppInfo,
    _ExistingSpan,
    _insert_spans,
    _OIDCServer,
    _server,
)

if TYPE_CHECKING:
    from tests.integration._mock_ldap_server import _LDAPServer


@pytest.fixture(scope="package")
def _env_oauth2_standard(
    _oidc_server_standard: _OIDCServer,
) -> dict[str, str]:
    """Configure standard OAuth2/OIDC environment variables (confidential client)."""
    return {
        f"PHOENIX_OAUTH2_{_oidc_server_standard}_CLIENT_ID".upper(): _oidc_server_standard.client_id,
        f"PHOENIX_OAUTH2_{_oidc_server_standard}_CLIENT_SECRET".upper(): _oidc_server_standard.client_secret,
        f"PHOENIX_OAUTH2_{_oidc_server_standard}_OIDC_CONFIG_URL".upper(): f"{_oidc_server_standard.base_url}/.well-known/openid-configuration",
        f"PHOENIX_OAUTH2_{_oidc_server_standard}_NO_SIGN_UP_CLIENT_ID".upper(): _oidc_server_standard.client_id,
        f"PHOENIX_OAUTH2_{_oidc_server_standard}_NO_SIGN_UP_CLIENT_SECRET".upper(): _oidc_server_standard.client_secret,
        f"PHOENIX_OAUTH2_{_oidc_server_standard}_NO_SIGN_UP_OIDC_CONFIG_URL".upper(): f"{_oidc_server_standard.base_url}/.well-known/openid-configuration",
        f"PHOENIX_OAUTH2_{_oidc_server_standard}_NO_SIGN_UP_ALLOW_SIGN_UP".upper(): "false",
    }


@pytest.fixture(scope="package")
def _env_oauth2_pkce_public(
    _oidc_server_pkce_public: _OIDCServer,
) -> dict[str, str]:
    """Configure PKCE OAuth2 environment variables for public client (no client_secret)."""
    return {
        f"PHOENIX_OAUTH2_{_oidc_server_pkce_public}_CLIENT_ID".upper(): _oidc_server_pkce_public.client_id,
        f"PHOENIX_OAUTH2_{_oidc_server_pkce_public}_OIDC_CONFIG_URL".upper(): f"{_oidc_server_pkce_public.base_url}/.well-known/openid-configuration",
        f"PHOENIX_OAUTH2_{_oidc_server_pkce_public}_USE_PKCE".upper(): "true",
        f"PHOENIX_OAUTH2_{_oidc_server_pkce_public}_TOKEN_ENDPOINT_AUTH_METHOD".upper(): "none",
    }


@pytest.fixture(scope="package")
def _env_oauth2_pkce_confidential(
    _oidc_server_pkce_confidential: _OIDCServer,
) -> dict[str, str]:
    """Configure PKCE OAuth2 environment variables for confidential client (defense-in-depth)."""
    return {
        f"PHOENIX_OAUTH2_{_oidc_server_pkce_confidential}_CLIENT_ID".upper(): _oidc_server_pkce_confidential.client_id,
        f"PHOENIX_OAUTH2_{_oidc_server_pkce_confidential}_CLIENT_SECRET".upper(): _oidc_server_pkce_confidential.client_secret,
        f"PHOENIX_OAUTH2_{_oidc_server_pkce_confidential}_OIDC_CONFIG_URL".upper(): f"{_oidc_server_pkce_confidential.base_url}/.well-known/openid-configuration",
        f"PHOENIX_OAUTH2_{_oidc_server_pkce_confidential}_USE_PKCE".upper(): "true",
    }


@pytest.fixture(scope="package")
def _env_oauth2_pkce_groups_granted(
    _oidc_server_pkce_with_groups: _OIDCServer,
) -> dict[str, str]:
    """Configure PKCE OAuth2 with group access control - user HAS matching group."""
    return {
        f"PHOENIX_OAUTH2_{_oidc_server_pkce_with_groups}_GRANTED_CLIENT_ID".upper(): _oidc_server_pkce_with_groups.client_id,
        f"PHOENIX_OAUTH2_{_oidc_server_pkce_with_groups}_GRANTED_OIDC_CONFIG_URL".upper(): f"{_oidc_server_pkce_with_groups.base_url}/.well-known/openid-configuration",
        f"PHOENIX_OAUTH2_{_oidc_server_pkce_with_groups}_GRANTED_USE_PKCE".upper(): "true",
        f"PHOENIX_OAUTH2_{_oidc_server_pkce_with_groups}_GRANTED_TOKEN_ENDPOINT_AUTH_METHOD".upper(): "none",
        f"PHOENIX_OAUTH2_{_oidc_server_pkce_with_groups}_GRANTED_GROUPS_ATTRIBUTE_PATH".upper(): "groups",
        f"PHOENIX_OAUTH2_{_oidc_server_pkce_with_groups}_GRANTED_ALLOWED_GROUPS".upper(): "engineering,admin",
    }


@pytest.fixture(scope="package")
def _env_oauth2_pkce_groups_denied(
    _oidc_server_pkce_with_groups: _OIDCServer,
) -> dict[str, str]:
    """Configure PKCE OAuth2 with group access control - user does NOT have matching group."""
    return {
        f"PHOENIX_OAUTH2_{_oidc_server_pkce_with_groups}_DENIED_CLIENT_ID".upper(): _oidc_server_pkce_with_groups.client_id,
        f"PHOENIX_OAUTH2_{_oidc_server_pkce_with_groups}_DENIED_OIDC_CONFIG_URL".upper(): f"{_oidc_server_pkce_with_groups.base_url}/.well-known/openid-configuration",
        f"PHOENIX_OAUTH2_{_oidc_server_pkce_with_groups}_DENIED_USE_PKCE".upper(): "true",
        f"PHOENIX_OAUTH2_{_oidc_server_pkce_with_groups}_DENIED_TOKEN_ENDPOINT_AUTH_METHOD".upper(): "none",
        f"PHOENIX_OAUTH2_{_oidc_server_pkce_with_groups}_DENIED_GROUPS_ATTRIBUTE_PATH".upper(): "groups",
        f"PHOENIX_OAUTH2_{_oidc_server_pkce_with_groups}_DENIED_ALLOWED_GROUPS".upper(): "admin,sales",
    }


@pytest.fixture(scope="package")
def _env_oauth2_standard_groups_granted(
    _oidc_server_standard_with_groups: _OIDCServer,
) -> dict[str, str]:
    """Configure standard OIDC with group access control - user HAS matching group."""
    return {
        f"PHOENIX_OAUTH2_{_oidc_server_standard_with_groups}_GRANTED_CLIENT_ID".upper(): _oidc_server_standard_with_groups.client_id,
        f"PHOENIX_OAUTH2_{_oidc_server_standard_with_groups}_GRANTED_CLIENT_SECRET".upper(): _oidc_server_standard_with_groups.client_secret,
        f"PHOENIX_OAUTH2_{_oidc_server_standard_with_groups}_GRANTED_OIDC_CONFIG_URL".upper(): f"{_oidc_server_standard_with_groups.base_url}/.well-known/openid-configuration",
        f"PHOENIX_OAUTH2_{_oidc_server_standard_with_groups}_GRANTED_GROUPS_ATTRIBUTE_PATH".upper(): "groups",
        f"PHOENIX_OAUTH2_{_oidc_server_standard_with_groups}_GRANTED_ALLOWED_GROUPS".upper(): "engineering,admin",
    }


@pytest.fixture(scope="package")
def _env_oauth2_standard_groups_denied(
    _oidc_server_standard_with_groups: _OIDCServer,
) -> dict[str, str]:
    """Configure standard OIDC with group access control - user does NOT have matching group."""
    return {
        f"PHOENIX_OAUTH2_{_oidc_server_standard_with_groups}_DENIED_CLIENT_ID".upper(): _oidc_server_standard_with_groups.client_id,
        f"PHOENIX_OAUTH2_{_oidc_server_standard_with_groups}_DENIED_CLIENT_SECRET".upper(): _oidc_server_standard_with_groups.client_secret,
        f"PHOENIX_OAUTH2_{_oidc_server_standard_with_groups}_DENIED_OIDC_CONFIG_URL".upper(): f"{_oidc_server_standard_with_groups.base_url}/.well-known/openid-configuration",
        f"PHOENIX_OAUTH2_{_oidc_server_standard_with_groups}_DENIED_GROUPS_ATTRIBUTE_PATH".upper(): "groups",
        f"PHOENIX_OAUTH2_{_oidc_server_standard_with_groups}_DENIED_ALLOWED_GROUPS".upper(): "admin,sales",
    }


@pytest.fixture(scope="package")
def _env_oauth2_role_admin(
    _oidc_server_with_role_admin: _OIDCServer,
) -> dict[str, str]:
    """Configure OAuth2 with role mapping - Owner → ADMIN."""
    return {
        f"PHOENIX_OAUTH2_{_oidc_server_with_role_admin}_ADMIN_CLIENT_ID".upper(): _oidc_server_with_role_admin.client_id,
        f"PHOENIX_OAUTH2_{_oidc_server_with_role_admin}_ADMIN_CLIENT_SECRET".upper(): _oidc_server_with_role_admin.client_secret,
        f"PHOENIX_OAUTH2_{_oidc_server_with_role_admin}_ADMIN_OIDC_CONFIG_URL".upper(): f"{_oidc_server_with_role_admin.base_url}/.well-known/openid-configuration",
        f"PHOENIX_OAUTH2_{_oidc_server_with_role_admin}_ADMIN_ROLE_ATTRIBUTE_PATH".upper(): "role",
        f"PHOENIX_OAUTH2_{_oidc_server_with_role_admin}_ADMIN_ROLE_MAPPING".upper(): "Owner:ADMIN,Developer:MEMBER,Reader:VIEWER",
    }


@pytest.fixture(scope="package")
def _env_oauth2_dynamic(
    _oidc_server_dynamic: _OIDCServer,
) -> dict[str, str]:
    """Configure OAuth2 with dynamic attribute changes (for testing IDP updates between logins)."""
    return {
        f"PHOENIX_OAUTH2_{_oidc_server_dynamic}_DYNAMIC_CLIENT_ID".upper(): _oidc_server_dynamic.client_id,
        f"PHOENIX_OAUTH2_{_oidc_server_dynamic}_DYNAMIC_CLIENT_SECRET".upper(): _oidc_server_dynamic.client_secret,
        f"PHOENIX_OAUTH2_{_oidc_server_dynamic}_DYNAMIC_OIDC_CONFIG_URL".upper(): f"{_oidc_server_dynamic.base_url}/.well-known/openid-configuration",
        f"PHOENIX_OAUTH2_{_oidc_server_dynamic}_DYNAMIC_ROLE_ATTRIBUTE_PATH".upper(): "role",
        f"PHOENIX_OAUTH2_{_oidc_server_dynamic}_DYNAMIC_ROLE_MAPPING".upper(): "Owner:ADMIN,Developer:MEMBER,Reader:VIEWER",
    }


@pytest.fixture(scope="package")
def _env_oauth2_role_member(
    _oidc_server_with_role_member: _OIDCServer,
) -> dict[str, str]:
    """Configure OAuth2 with role mapping - Developer → MEMBER."""
    return {
        f"PHOENIX_OAUTH2_{_oidc_server_with_role_member}_MEMBER_CLIENT_ID".upper(): _oidc_server_with_role_member.client_id,
        f"PHOENIX_OAUTH2_{_oidc_server_with_role_member}_MEMBER_CLIENT_SECRET".upper(): _oidc_server_with_role_member.client_secret,
        f"PHOENIX_OAUTH2_{_oidc_server_with_role_member}_MEMBER_OIDC_CONFIG_URL".upper(): f"{_oidc_server_with_role_member.base_url}/.well-known/openid-configuration",
        f"PHOENIX_OAUTH2_{_oidc_server_with_role_member}_MEMBER_ROLE_ATTRIBUTE_PATH".upper(): "role",
        f"PHOENIX_OAUTH2_{_oidc_server_with_role_member}_MEMBER_ROLE_MAPPING".upper(): "Owner:ADMIN,Developer:MEMBER,Reader:VIEWER",
    }


@pytest.fixture(scope="package")
def _env_oauth2_role_viewer(
    _oidc_server_with_role_viewer: _OIDCServer,
) -> dict[str, str]:
    """Configure OAuth2 with role mapping - Reader → VIEWER."""
    return {
        f"PHOENIX_OAUTH2_{_oidc_server_with_role_viewer}_VIEWER_CLIENT_ID".upper(): _oidc_server_with_role_viewer.client_id,
        f"PHOENIX_OAUTH2_{_oidc_server_with_role_viewer}_VIEWER_CLIENT_SECRET".upper(): _oidc_server_with_role_viewer.client_secret,
        f"PHOENIX_OAUTH2_{_oidc_server_with_role_viewer}_VIEWER_OIDC_CONFIG_URL".upper(): f"{_oidc_server_with_role_viewer.base_url}/.well-known/openid-configuration",
        f"PHOENIX_OAUTH2_{_oidc_server_with_role_viewer}_VIEWER_ROLE_ATTRIBUTE_PATH".upper(): "role",
        f"PHOENIX_OAUTH2_{_oidc_server_with_role_viewer}_VIEWER_ROLE_MAPPING".upper(): "Owner:ADMIN,Developer:MEMBER,Reader:VIEWER",
    }


@pytest.fixture(scope="package")
def _env_oauth2_role_system(
    _oidc_server_with_role_system: _OIDCServer,
) -> dict[str, str]:
    """Configure OAuth2 to test SYSTEM role blocking (no explicit mapping needed - raw value test)."""
    return {
        f"PHOENIX_OAUTH2_{_oidc_server_with_role_system}_SYSTEM_CLIENT_ID".upper(): _oidc_server_with_role_system.client_id,
        f"PHOENIX_OAUTH2_{_oidc_server_with_role_system}_SYSTEM_CLIENT_SECRET".upper(): _oidc_server_with_role_system.client_secret,
        f"PHOENIX_OAUTH2_{_oidc_server_with_role_system}_SYSTEM_OIDC_CONFIG_URL".upper(): f"{_oidc_server_with_role_system.base_url}/.well-known/openid-configuration",
        f"PHOENIX_OAUTH2_{_oidc_server_with_role_system}_SYSTEM_ROLE_ATTRIBUTE_PATH".upper(): "role",
        # No role_mapping - tests raw value handling
    }


@pytest.fixture(scope="package")
def _env_oauth2_role_invalid_non_strict(
    _oidc_server_with_invalid_role: _OIDCServer,
) -> dict[str, str]:
    """Configure OAuth2 with role mapping - Invalid role defaults to VIEWER (non-strict)."""
    return {
        f"PHOENIX_OAUTH2_{_oidc_server_with_invalid_role}_INVALID_CLIENT_ID".upper(): _oidc_server_with_invalid_role.client_id,
        f"PHOENIX_OAUTH2_{_oidc_server_with_invalid_role}_INVALID_CLIENT_SECRET".upper(): _oidc_server_with_invalid_role.client_secret,
        f"PHOENIX_OAUTH2_{_oidc_server_with_invalid_role}_INVALID_OIDC_CONFIG_URL".upper(): f"{_oidc_server_with_invalid_role.base_url}/.well-known/openid-configuration",
        f"PHOENIX_OAUTH2_{_oidc_server_with_invalid_role}_INVALID_ROLE_ATTRIBUTE_PATH".upper(): "role",
        f"PHOENIX_OAUTH2_{_oidc_server_with_invalid_role}_INVALID_ROLE_MAPPING".upper(): "Owner:ADMIN,Developer:MEMBER,Reader:VIEWER",
        f"PHOENIX_OAUTH2_{_oidc_server_with_invalid_role}_INVALID_ROLE_ATTRIBUTE_STRICT".upper(): "false",
    }


@pytest.fixture(scope="package")
def _env_oauth2_role_invalid_strict(
    _oidc_server_with_invalid_role: _OIDCServer,
) -> dict[str, str]:
    """Configure OAuth2 with role mapping - Invalid role denies access (strict mode)."""
    return {
        f"PHOENIX_OAUTH2_{_oidc_server_with_invalid_role}_STRICT_CLIENT_ID".upper(): _oidc_server_with_invalid_role.client_id,
        f"PHOENIX_OAUTH2_{_oidc_server_with_invalid_role}_STRICT_CLIENT_SECRET".upper(): _oidc_server_with_invalid_role.client_secret,
        f"PHOENIX_OAUTH2_{_oidc_server_with_invalid_role}_STRICT_OIDC_CONFIG_URL".upper(): f"{_oidc_server_with_invalid_role.base_url}/.well-known/openid-configuration",
        f"PHOENIX_OAUTH2_{_oidc_server_with_invalid_role}_STRICT_ROLE_ATTRIBUTE_PATH".upper(): "role",
        f"PHOENIX_OAUTH2_{_oidc_server_with_invalid_role}_STRICT_ROLE_MAPPING".upper(): "Owner:ADMIN,Developer:MEMBER,Reader:VIEWER",
        f"PHOENIX_OAUTH2_{_oidc_server_with_invalid_role}_STRICT_ROLE_ATTRIBUTE_STRICT".upper(): "true",
    }


@pytest.fixture(scope="package")
def _env_oauth2_role_missing_defaults_viewer(
    _oidc_server_without_role: _OIDCServer,
) -> dict[str, str]:
    """Configure OAuth2 without role mapping - defaults to VIEWER."""
    return {
        f"PHOENIX_OAUTH2_{_oidc_server_without_role}_DEFAULT_CLIENT_ID".upper(): _oidc_server_without_role.client_id,
        f"PHOENIX_OAUTH2_{_oidc_server_without_role}_DEFAULT_CLIENT_SECRET".upper(): _oidc_server_without_role.client_secret,
        f"PHOENIX_OAUTH2_{_oidc_server_without_role}_DEFAULT_OIDC_CONFIG_URL".upper(): f"{_oidc_server_without_role.base_url}/.well-known/openid-configuration",
    }


@pytest.fixture(scope="package")
def _env_oauth2(
    _env_oauth2_standard: dict[str, str],
    _env_oauth2_pkce_public: dict[str, str],
    _env_oauth2_pkce_confidential: dict[str, str],
    _env_oauth2_pkce_groups_granted: dict[str, str],
    _env_oauth2_pkce_groups_denied: dict[str, str],
    _env_oauth2_standard_groups_granted: dict[str, str],
    _env_oauth2_standard_groups_denied: dict[str, str],
    _env_oauth2_dynamic: dict[str, str],
    _env_oauth2_role_admin: dict[str, str],
    _env_oauth2_role_member: dict[str, str],
    _env_oauth2_role_viewer: dict[str, str],
    _env_oauth2_role_system: dict[str, str],
    _env_oauth2_role_invalid_non_strict: dict[str, str],
    _env_oauth2_role_invalid_strict: dict[str, str],
    _env_oauth2_role_missing_defaults_viewer: dict[str, str],
) -> dict[str, str]:
    """Combine all OAuth2 environment configurations for testing."""
    return {
        **_env_oauth2_standard,
        **_env_oauth2_pkce_public,
        **_env_oauth2_pkce_confidential,
        **_env_oauth2_pkce_groups_granted,
        **_env_oauth2_pkce_groups_denied,
        **_env_oauth2_standard_groups_granted,
        **_env_oauth2_standard_groups_denied,
        **_env_oauth2_dynamic,
        **_env_oauth2_role_admin,
        **_env_oauth2_role_member,
        **_env_oauth2_role_viewer,
        **_env_oauth2_role_system,
        **_env_oauth2_role_invalid_non_strict,
        **_env_oauth2_role_invalid_strict,
        **_env_oauth2_role_missing_defaults_viewer,
    }


@pytest.fixture(scope="package")
def _env_ldap(_ldap_server: _LDAPServer) -> dict[str, str]:
    """Configure LDAP environment variables for testing with mock LDAP server."""
    return {
        "PHOENIX_LDAP_HOST": _ldap_server.host,
        "PHOENIX_LDAP_PORT": str(_ldap_server.port),
        "PHOENIX_LDAP_USE_TLS": "false",  # Disable TLS for mock testing
        "PHOENIX_LDAP_BIND_DN": _ldap_server.bind_dn,
        "PHOENIX_LDAP_BIND_PASSWORD": _ldap_server.bind_password,
        "PHOENIX_LDAP_USER_SEARCH_BASE": _ldap_server.user_search_base,
        "PHOENIX_LDAP_USER_SEARCH_FILTER": "(uid=%s)",
        "PHOENIX_LDAP_ATTR_EMAIL": "mail",
        "PHOENIX_LDAP_ATTR_DISPLAY_NAME": "displayName",
        "PHOENIX_LDAP_ATTR_MEMBER_OF": "memberOf",
        "PHOENIX_LDAP_GROUP_ROLE_MAPPINGS": (
            '[{"group_dn": "cn=admins,ou=groups,dc=example,dc=com", "role": "ADMIN"}, '
            '{"group_dn": "cn=viewers,ou=groups,dc=example,dc=com", "role": "MEMBER"}, '
            '{"group_dn": "*", "role": "VIEWER"}]'
        ),
        # Default: allow_sign_up=true (users auto-created on first login)
    }


@pytest.fixture(scope="package")
def _env_ldap_no_sign_up(_env_ldap: Mapping[str, str]) -> dict[str, str]:
    """Configure LDAP with allow_sign_up=false (admin must pre-create users)."""
    return {
        **_env_ldap,
        "PHOENIX_LDAP_ALLOW_SIGN_UP": "false",
    }


@pytest.fixture(scope="package")
def _env_ldap_posix(_ldap_server: _LDAPServer) -> dict[str, str]:
    """Configure LDAP with POSIX group search (OpenLDAP style) instead of memberOf.

    This fixture tests the alternative group lookup method where Phoenix searches
    for groups containing the user's DN as a member attribute, rather than reading
    a memberOf attribute from the user entry (Active Directory style).

    Key differences from _env_ldap:
    - No ATTR_MEMBER_OF (relies on group search)
    - Adds GROUP_SEARCH_BASE and GROUP_SEARCH_FILTER
    - Tests DN escaping for LDAP injection prevention
    """
    return {
        "PHOENIX_LDAP_HOST": _ldap_server.host,
        "PHOENIX_LDAP_PORT": str(_ldap_server.port),
        "PHOENIX_LDAP_USE_TLS": "false",  # Disable TLS for mock testing
        "PHOENIX_LDAP_BIND_DN": _ldap_server.bind_dn,
        "PHOENIX_LDAP_BIND_PASSWORD": _ldap_server.bind_password,
        "PHOENIX_LDAP_USER_SEARCH_BASE": _ldap_server.user_search_base,
        "PHOENIX_LDAP_USER_SEARCH_FILTER": "(uid=%s)",
        "PHOENIX_LDAP_ATTR_EMAIL": "mail",
        "PHOENIX_LDAP_ATTR_DISPLAY_NAME": "displayName",
        "PHOENIX_LDAP_ATTR_MEMBER_OF": "",
        "PHOENIX_LDAP_GROUP_SEARCH_BASE": _ldap_server.group_search_base,
        "PHOENIX_LDAP_GROUP_SEARCH_FILTER": "(member=%s)",  # %s replaced with user DN
        "PHOENIX_LDAP_GROUP_ROLE_MAPPINGS": (
            '[{"group_dn": "cn=admins,ou=groups,dc=example,dc=com", "role": "ADMIN"}, '
            '{"group_dn": "cn=viewers,ou=groups,dc=example,dc=com", "role": "MEMBER"}, '
            '{"group_dn": "*", "role": "VIEWER"}]'
        ),
        # Default: allow_sign_up=true (users auto-created on first login)
    }


@pytest.fixture(scope="package")
def _env(
    _env_auth: Mapping[str, str],
    _env_database: Mapping[str, str],
    _env_oauth2: Mapping[str, str],
    _env_ldap: Mapping[str, str],
    _env_ports: Mapping[str, str],
    _env_smtp: Mapping[str, str],
    _env_tls: Mapping[str, str],
) -> dict[str, str]:
    """Combine all environment variable configurations for testing."""
    return {
        **_env_tls,
        **_env_ports,
        **_env_database,
        **_env_auth,
        **_env_smtp,
        **_env_oauth2,
        **_env_ldap,
    }


@pytest.fixture(scope="package")
def _app(
    _env: dict[str, str],
) -> Iterator[_AppInfo]:
    with _server(_AppInfo(_env)) as app:
        yield app


@pytest.fixture(scope="package")
def _env_ports_ldap_no_sign_up(
    _ports: Iterator[int],
) -> dict[str, str]:
    """Separate port allocation for LDAP no-sign-up app."""
    return {
        "PHOENIX_PORT": str(next(_ports)),
        "PHOENIX_GRPC_PORT": str(next(_ports)),
    }


@pytest.fixture(scope="package")
def _app_ldap_no_sign_up(
    _env_auth: Mapping[str, str],
    _env_database: Mapping[str, str],
    _env_oauth2: Mapping[str, str],
    _env_ldap_no_sign_up: Mapping[str, str],
    _env_ports_ldap_no_sign_up: Mapping[str, str],
    _env_smtp: Mapping[str, str],
    _env_tls: Mapping[str, str],
) -> Iterator[_AppInfo]:
    """App instance with LDAP allow_sign_up=false.

    Uses separate ports from _app_ldap to allow both apps to run concurrently.
    """
    env = {
        **_env_tls,
        **_env_ports_ldap_no_sign_up,
        **_env_database,
        **_env_auth,
        **_env_smtp,
        **_env_oauth2,
        **_env_ldap_no_sign_up,
    }
    with _server(_AppInfo(env)) as app:
        yield app


@pytest.fixture(scope="package")
def _env_ports_posix(
    _ports: Iterator[int],
) -> dict[str, str]:
    """Separate port allocation for POSIX LDAP app to avoid conflicts with _app_ldap."""
    return {
        "PHOENIX_PORT": str(next(_ports)),
        "PHOENIX_GRPC_PORT": str(next(_ports)),
    }


@pytest.fixture(scope="package")
def _app_ldap_posix(
    _env_auth: Mapping[str, str],
    _env_database: Mapping[str, str],
    _env_oauth2: Mapping[str, str],
    _env_ldap_posix: Mapping[str, str],
    _env_ports_posix: Mapping[str, str],
    _env_smtp: Mapping[str, str],
    _env_tls: Mapping[str, str],
) -> Iterator[_AppInfo]:
    """App instance with LDAP configured for POSIX group search (OpenLDAP).

    Uses separate ports from _app_ldap to allow both apps to run concurrently
    during integration tests.
    """
    env = {
        **_env_tls,
        **_env_ports_posix,
        **_env_database,
        **_env_auth,
        **_env_smtp,
        **_env_oauth2,
        **_env_ldap_posix,
    }
    with _server(_AppInfo(env)) as app:
        yield app


@pytest.fixture(scope="package")
def _env_tls(
    _tls_certs_for_server: Cert,
    _tls_certs_for_client: Cert,
) -> dict[str, str]:
    """Configure TLS environment variables for testing.

    This fixture sets up the necessary environment variables for TLS configuration
    in the Phoenix server. It encrypts the server's private key with a random password
    and configures both server and client certificates for mutual TLS authentication.

    The fixture is automatically used in all tests within its scope and patches
    the environment variables temporarily during test execution.

    Args:
        _tls_certs_server: Server TLS certificates fixture
        _tls_certs_client: Client TLS certificates fixture

    Yields:
        None: The fixture yields control back to the test after setting up the environment
    """
    key_file_password = token_hex(16)
    key_file = _encrypt_private_key(_tls_certs_for_server.key[0], key_file_password)
    return {
        "PHOENIX_TLS_ENABLED": "true",
        "PHOENIX_TLS_CERT_FILE": str(_tls_certs_for_server.cert.resolve()),
        "PHOENIX_TLS_KEY_FILE": str(key_file.resolve()),
        "PHOENIX_TLS_KEY_FILE_PASSWORD": key_file_password,
        "PHOENIX_TLS_CA_FILE": str(_tls_certs_for_client.cert.resolve()),
        "PHOENIX_TLS_VERIFY_CLIENT": "true",
    }


@pytest.fixture(scope="package")
def _tls_certs_for_server(
    tmp_path_factory: pytest.TempPathFactory,
) -> Cert:
    """Fixture that provides TLS certificates in a temporary directory."""
    path = tmp_path_factory.mktemp(f"certs_for_server_{token_hex(8)}")
    return _generate_certs(path, separate_key=True)


@pytest.fixture(scope="package")
def _tls_certs_for_client(
    tmp_path_factory: pytest.TempPathFactory,
) -> Cert:
    """Fixture that provides TLS certificates in a temporary directory."""
    path = tmp_path_factory.mktemp(f"certs_for_client_{token_hex(8)}")
    return _generate_certs(path, separate_key=False)


@pytest.fixture(scope="package")
def _oidc_server_standard(
    _ports: Iterator[int],
) -> Iterator[_OIDCServer]:
    """Standard OAuth2/OIDC server (confidential client with client_secret)."""
    with _OIDCServer(port=next(_ports), use_pkce=False) as server:
        yield server


@pytest.fixture(scope="package")
def _oidc_server_pkce_public(
    _ports: Iterator[int],
) -> Iterator[_OIDCServer]:
    """PKCE-enabled OIDC server for public clients (no client_secret)."""
    with _OIDCServer(port=next(_ports), use_pkce=True) as server:
        yield server


@pytest.fixture(scope="package")
def _oidc_server_pkce_confidential(
    _ports: Iterator[int],
) -> Iterator[_OIDCServer]:
    """PKCE-enabled OIDC server for confidential clients (defense-in-depth)."""
    with _OIDCServer(port=next(_ports), use_pkce=True) as server:
        yield server


@pytest.fixture(scope="package")
def _oidc_server_pkce_with_groups(
    _ports: Iterator[int],
) -> Iterator[_OIDCServer]:
    """PKCE-enabled OIDC server with group claims for access control testing."""
    with _OIDCServer(
        port=next(_ports), use_pkce=True, groups=["engineering", "operations"]
    ) as server:
        yield server


@pytest.fixture(scope="package")
def _oidc_server_standard_with_groups(
    _ports: Iterator[int],
) -> Iterator[_OIDCServer]:
    """Standard OIDC server with group claims for access control testing."""
    with _OIDCServer(
        port=next(_ports), use_pkce=False, groups=["engineering", "operations"]
    ) as server:
        yield server


# Backward compatibility alias
@pytest.fixture(scope="package")
def _oidc_server(
    _oidc_server_standard: _OIDCServer,
) -> _OIDCServer:
    """Alias for backward compatibility with existing tests."""
    return _oidc_server_standard


@pytest.fixture(scope="package")
def _oidc_server_dynamic(
    _ports: Iterator[int],
) -> Iterator[_OIDCServer]:
    """
    Dynamic OIDC server for testing IDP attribute changes between logins.

    This flexible server supports dynamically changing role, email, and user
    identity using set_role(), set_email(), and set_user() to simulate
    IDP changes between login sessions.

    Starts with 'Developer' role (maps to MEMBER), but all attributes can be changed
    dynamically for testing scenarios where the IDP state changes between logins.

    Examples:
        # Test role changes for same user across logins
        server.set_user("user_123", "alice@example.com", num_logins=2)
        server.set_role("Developer", num_logins=1)  # First login: MEMBER
        email1, _, _ = await complete_flow(app, server)

        server.set_role("Owner", num_logins=1)  # Second login: ADMIN
        email2, _, _ = await complete_flow(app, server)
        assert email1 == email2  # Same user, different role!

        # Test email changes for same user
        server.set_user("user_123", "old@example.com", num_logins=2)
        email1, _, _ = await complete_flow(app, server)  # old@example.com

        server.set_email("new@example.com", num_logins=1)
        email2, _, _ = await complete_flow(app, server)  # new@example.com
    """
    with _OIDCServer(port=next(_ports), use_pkce=False, role="Developer") as server:
        yield server


@pytest.fixture(scope="package")
def _oidc_server_with_role_admin(
    _ports: Iterator[int],
) -> Iterator[_OIDCServer]:
    """OIDC server with role claim set to 'Owner' (maps to ADMIN)."""
    with _OIDCServer(port=next(_ports), use_pkce=False, role="Owner") as server:
        yield server


@pytest.fixture(scope="package")
def _oidc_server_with_role_member(
    _ports: Iterator[int],
) -> Iterator[_OIDCServer]:
    """OIDC server with role claim set to 'Developer' (maps to MEMBER)."""
    with _OIDCServer(port=next(_ports), use_pkce=False, role="Developer") as server:
        yield server


@pytest.fixture(scope="package")
def _oidc_server_with_role_viewer(
    _ports: Iterator[int],
) -> Iterator[_OIDCServer]:
    """OIDC server with role claim set to 'Reader' (maps to VIEWER)."""
    with _OIDCServer(port=next(_ports), use_pkce=False, role="Reader") as server:
        yield server


@pytest.fixture(scope="package")
def _oidc_server_with_role_system(
    _ports: Iterator[int],
) -> Iterator[_OIDCServer]:
    """OIDC server with role claim set to 'SYSTEM' (should be blocked)."""
    with _OIDCServer(port=next(_ports), use_pkce=False, role="SYSTEM") as server:
        yield server


@pytest.fixture(scope="package")
def _oidc_server_with_invalid_role(
    _ports: Iterator[int],
) -> Iterator[_OIDCServer]:
    """OIDC server with role claim set to an invalid/unmapped role."""
    with _OIDCServer(port=next(_ports), use_pkce=False, role="InvalidRole") as server:
        yield server


@pytest.fixture(scope="package")
def _oidc_server_without_role(
    _ports: Iterator[int],
) -> Iterator[_OIDCServer]:
    """OIDC server without role claim (role=None)."""
    with _OIDCServer(port=next(_ports), use_pkce=False, role=None) as server:
        yield server


def _encrypt_private_key(key_path: Path, password: str) -> Path:
    """
    Encrypt an existing private key file with a password and save to a new file.

    Args:
        key_path: Path to the private key file (PEM format)
        password: Password to encrypt the key with

    Returns:
        Path: Path to the new encrypted key file
    """
    from cryptography.hazmat.backends import default_backend
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.serialization import load_pem_private_key

    # Create path for encrypted file
    encrypted_path = key_path.with_name(f"{key_path.stem}_encrypted{key_path.suffix}")

    # Read the unencrypted private key
    with open(key_path, "rb") as f:
        private_key_data = f.read()

    # Load the private key (it's currently unencrypted)
    private_key = load_pem_private_key(
        private_key_data,
        password=None,  # The key is not encrypted yet
        backend=default_backend(),
    )

    # Convert password to bytes
    password_bytes = password.encode()

    # Encrypt the private key
    encrypted_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.TraditionalOpenSSL,  # Match the original format
        encryption_algorithm=serialization.BestAvailableEncryption(password_bytes),
    )

    # Write the encrypted key to the new file
    with open(encrypted_path, "wb") as f:
        f.write(encrypted_pem)

    return encrypted_path


@pytest.fixture(scope="package")
def _existing_spans(
    _app: _AppInfo,
) -> tuple[_ExistingSpan, ...]:
    return _insert_spans(_app, 10)


# =============================================================================
# LDAP Test Fixtures
# =============================================================================


@pytest.fixture(scope="package")
def _ldap_server(_ports: Iterator[int]) -> Iterator[_LDAPServer]:
    """Start mock LDAP server for integration tests.

    This fixture provides a lightweight, in-process LDAP server that implements
    minimal LDAP protocol operations (bind, search) needed for testing Phoenix's
    LDAP authentication flow.

    The server is similar to _oidc_server - it runs in a separate thread and
    listens on a dynamically allocated port.
    """
    from tests.integration._mock_ldap_server import _LDAPServer

    with _LDAPServer(port=next(_ports)) as ldap_server:
        yield ldap_server
