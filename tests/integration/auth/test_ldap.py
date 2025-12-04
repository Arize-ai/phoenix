"""Integration tests for LDAP authentication.

These tests use a real in-process mock LDAP server that implements the LDAP
protocol, similar to how OIDC tests use _OIDCServer. The mock server runs in
a separate thread and listens on a dynamically allocated port.
"""

from __future__ import annotations

from dataclasses import dataclass
from secrets import token_hex
from typing import Optional

from phoenix.server.api.input_types.UserRoleInput import UserRoleInput
from tests.integration._mock_ldap_server import _LDAPServer

from .._helpers import (
    _AppInfo,
    _delete_users,
    _httpx_client,
    _list_users,
    _User,
)

# Test constants
_ADMIN_GROUP = "cn=admins,ou=groups,dc=example,dc=com"
_MEMBER_GROUP = "cn=members,ou=groups,dc=example,dc=com"
_DEFAULT_PASSWORD = "password123"


@dataclass
class LDAPTestUser:
    """Test user specification for LDAP tests."""

    username: str
    password: str
    email: str
    display_name: str
    groups: list[str]
    expected_role: UserRoleInput


def _create_test_user(
    ldap_server: _LDAPServer,
    suffix: str,
    base_username: str,
    role: UserRoleInput,
    groups: Optional[list[str]] = None,
) -> LDAPTestUser:
    """Create a test user with unique identifiers for isolation.

    Args:
        ldap_server: Mock LDAP server to add user to
        suffix: Unique suffix (e.g., token_hex(4))
        base_username: Base username before suffix
        role: Expected Phoenix role
        groups: LDAP groups (defaults to role-appropriate groups)

    Returns:
        LDAPTestUser specification
    """
    if groups is None:
        role_to_groups = {
            UserRoleInput.ADMIN: [_ADMIN_GROUP],
            UserRoleInput.MEMBER: [_MEMBER_GROUP],
            UserRoleInput.VIEWER: [],  # Wildcard
        }
        groups = role_to_groups.get(role, [])

    username = f"{base_username}_{suffix}"
    email = f"{base_username}_{suffix}@example.com"
    display_name = base_username.replace("_", " ").title()

    ldap_server.add_user(
        username=username,
        password=_DEFAULT_PASSWORD,
        email=email,
        display_name=display_name,
        groups=groups,
    )

    return LDAPTestUser(
        username=username,
        password=_DEFAULT_PASSWORD,
        email=email,
        display_name=display_name,
        groups=groups,
        expected_role=role,
    )


def _get_user_by_email(app: _AppInfo, email: str) -> Optional[_User]:
    """Get user by email from the user list."""
    users = {u.profile.email: u for u in _list_users(app, app.admin_secret)}
    return users.get(email)


def _verify_ldap_login_success(
    status_code: int,
    access_token: Optional[str],
    refresh_token: Optional[str],
) -> None:
    """Verify LDAP login was successful and tokens were issued.

    Checks:
    - HTTP 204 status
    - Access token present and non-empty
    - Refresh token present and non-empty
    """
    assert status_code == 204, f"Expected 204, got {status_code}"
    assert access_token is not None, "Access token must be present"
    assert refresh_token is not None, "Refresh token must be present"
    assert len(access_token) > 10, f"Access token too short: {len(access_token)} chars"
    assert len(refresh_token) > 10, f"Refresh token too short: {len(refresh_token)} chars"


def _verify_user_created(
    app: _AppInfo,
    test_user: LDAPTestUser,
    expected_username: Optional[str] = None,
) -> _User:
    """Verify user was created in Phoenix DB with correct attributes.

    Args:
        app: Application info
        test_user: Test user specification
        expected_username: Expected username (defaults to test_user.display_name)

    Returns:
        The created user object
    """
    user = _get_user_by_email(app, test_user.email)
    assert user is not None, f"User not found: {test_user.email}"
    assert user.role == test_user.expected_role, (
        f"Expected role {test_user.expected_role}, got {user.role}"
    )

    expected_username = expected_username or test_user.display_name
    assert user.profile.username == expected_username, (
        f"Expected username '{expected_username}', got '{user.profile.username}'"
    )

    return user


def _ldap_login(
    app: _AppInfo, username: str, password: str
) -> tuple[int, Optional[str], Optional[str]]:
    """Perform LDAP login and return response details.

    Returns:
        Tuple of (status_code, access_token, refresh_token)
    """
    client = _httpx_client(app)
    response = client.post(
        "/auth/ldap/login",
        json={"username": username, "password": password},
    )
    return (
        response.status_code,
        response.cookies.get("phoenix-access-token"),
        response.cookies.get("phoenix-refresh-token"),
    )


class TestLDAPAuthentication:
    """Test LDAP authentication - core flows and security."""

    async def test_authentication_and_role_mapping(
        self, _app: _AppInfo, _ldap_server: _LDAPServer
    ) -> None:
        """Test successful login assigns role from group membership."""
        suffix = token_hex(4)

        # Admin user (in admins group)
        admin = _create_test_user(_ldap_server, suffix, "admin", UserRoleInput.ADMIN)
        status, access_token, refresh_token = _ldap_login(_app, admin.username, admin.password)
        _verify_ldap_login_success(status, access_token, refresh_token)
        admin_user = _verify_user_created(_app, admin)
        assert admin_user.role == UserRoleInput.ADMIN

        # Viewer user (no groups → wildcard)
        viewer = _create_test_user(_ldap_server, suffix, "viewer", UserRoleInput.VIEWER, groups=[])
        status, access_token, refresh_token = _ldap_login(_app, viewer.username, viewer.password)
        _verify_ldap_login_success(status, access_token, refresh_token)
        viewer_user = _verify_user_created(_app, viewer)
        assert viewer_user.role == UserRoleInput.VIEWER

        _delete_users(_app, _app.admin_secret, users=[admin_user.gid, viewer_user.gid])

    async def test_invalid_credentials_rejected(
        self, _app: _AppInfo, _ldap_server: _LDAPServer
    ) -> None:
        """Test login fails for wrong password, nonexistent user, and empty credentials."""
        user = _create_test_user(_ldap_server, token_hex(4), "user", UserRoleInput.ADMIN)

        # Wrong password
        assert _ldap_login(_app, user.username, "wrong")[0] == 401
        # Nonexistent user
        assert _ldap_login(_app, "nonexistent", "pass")[0] == 401
        # Empty credentials
        assert _ldap_login(_app, "", "")[0] == 401

    async def test_role_syncs_on_subsequent_login(
        self, _app: _AppInfo, _ldap_server: _LDAPServer
    ) -> None:
        """Test role updates from LDAP groups but username remains stable."""
        suffix = token_hex(4)
        username, email = f"sync_{suffix}", f"sync_{suffix}@example.com"

        # First login with members group (mapped to MEMBER)
        _ldap_server.add_user(
            username=username,
            password=_DEFAULT_PASSWORD,
            email=email,
            display_name="Original Name",
            groups=[_MEMBER_GROUP],
        )
        status, _, _ = _ldap_login(_app, username, _DEFAULT_PASSWORD)
        assert status == 204
        user = _get_user_by_email(_app, email)
        assert user is not None and user.role == UserRoleInput.MEMBER

        # LDAP changes: promoted to admin, display name changed
        _ldap_server.add_user(
            username=username,
            password=_DEFAULT_PASSWORD,
            email=email,
            display_name="New Name",
            groups=[_ADMIN_GROUP],
        )
        status, _, _ = _ldap_login(_app, username, _DEFAULT_PASSWORD)
        assert status == 204

        # Verify: role updated, username stable
        updated = _get_user_by_email(_app, email)
        assert updated is not None
        assert updated.gid == user.gid  # Same user
        assert updated.role == UserRoleInput.ADMIN  # Role synced
        assert updated.profile.username == "Original Name"  # Username stable

        _delete_users(_app, _app.admin_secret, users=[user.gid])

    async def test_injection_prevention(self, _app: _AppInfo, _ldap_server: _LDAPServer) -> None:
        """Test LDAP injection attempts are rejected."""
        for payload in ["*", "admin*", "*(objectClass=*)", "admin)(|(objectClass=*"]:
            assert _ldap_login(_app, payload, _DEFAULT_PASSWORD)[0] == 401

    async def test_unicode_credentials(self, _app: _AppInfo, _ldap_server: _LDAPServer) -> None:
        """Test login with Unicode username/password."""
        suffix = token_hex(4)
        email = f"unicode_{suffix}@example.com"
        _ldap_server.add_user(
            username="用户名",
            password="密码123",
            email=email,
            display_name="Unicode User",
            groups=[_MEMBER_GROUP],
        )
        status, access_token, refresh_token = _ldap_login(_app, "用户名", "密码123")
        _verify_ldap_login_success(status, access_token, refresh_token)
        user = _get_user_by_email(_app, email)
        assert user is not None
        _delete_users(_app, _app.admin_secret, users=[user.gid])

    async def test_missing_email_rejected(self, _app: _AppInfo, _ldap_server: _LDAPServer) -> None:
        """Test login fails when LDAP user has no email."""
        suffix = token_hex(4)
        _ldap_server.add_user(
            username=f"noemail_{suffix}",
            password=_DEFAULT_PASSWORD,
            email="",
            display_name="No Email",
            groups=[_ADMIN_GROUP],
        )
        assert _ldap_login(_app, f"noemail_{suffix}", _DEFAULT_PASSWORD)[0] == 401

    async def test_missing_display_name_uses_fallback(
        self, _app: _AppInfo, _ldap_server: _LDAPServer
    ) -> None:
        """Test missing displayName falls back to email prefix."""
        suffix = token_hex(4)
        email = f"noname_{suffix}@example.com"
        _ldap_server.add_user(
            username=f"noname_{suffix}",
            password=_DEFAULT_PASSWORD,
            email=email,
            display_name="",
            groups=[_MEMBER_GROUP],
        )
        status, _, _ = _ldap_login(_app, f"noname_{suffix}", _DEFAULT_PASSWORD)
        assert status == 204
        user = _get_user_by_email(_app, email)
        assert user is not None
        assert user.profile.username == f"noname_{suffix}"  # Fallback to email prefix
        _delete_users(_app, _app.admin_secret, users=[user.gid])

    async def test_multiple_groups_uses_first_match(
        self, _app: _AppInfo, _ldap_server: _LDAPServer
    ) -> None:
        """Test user in multiple groups gets role from first matching mapping."""
        suffix = token_hex(4)
        email = f"multi_{suffix}@example.com"
        _ldap_server.add_user(
            username=f"multi_{suffix}",
            password=_DEFAULT_PASSWORD,
            email=email,
            display_name="Multi",
            groups=[_MEMBER_GROUP, _ADMIN_GROUP],  # Both groups
        )
        status, _, _ = _ldap_login(_app, f"multi_{suffix}", _DEFAULT_PASSWORD)
        assert status == 204
        user = _get_user_by_email(_app, email)
        assert user is not None
        assert user.role == UserRoleInput.ADMIN  # ADMIN mapping comes first in config
        _delete_users(_app, _app.admin_secret, users=[user.gid])

    async def test_group_dn_case_insensitive(
        self, _app: _AppInfo, _ldap_server: _LDAPServer
    ) -> None:
        """Test group DN matching is case-insensitive per RFC 4514."""
        suffix = token_hex(4)
        email = f"case_{suffix}@example.com"
        _ldap_server.add_user(
            username=f"case_{suffix}",
            password=_DEFAULT_PASSWORD,
            email=email,
            display_name="Case",
            groups=["CN=Admins,OU=Groups,DC=Example,DC=Com"],  # Mixed case
        )
        status, _, _ = _ldap_login(_app, f"case_{suffix}", _DEFAULT_PASSWORD)
        assert status == 204
        user = _get_user_by_email(_app, email)
        assert user is not None
        assert user.role == UserRoleInput.ADMIN  # Should match despite case difference
        _delete_users(_app, _app.admin_secret, users=[user.gid])


class TestLDAPDNStability:
    """Test LDAP user identification strategies.

    Phoenix supports two modes:
    1. Simple Mode (default): Email is the identifier. Email changes create new users.
    2. Enterprise Mode (PHOENIX_LDAP_ATTR_UNIQUE_ID): Stable ID is the identifier.
       Email changes preserve identity.
    """

    def test_email_change_creates_new_user_without_unique_id(
        self, _app: _AppInfo, _ldap_server: _LDAPServer
    ) -> None:
        """Simple mode: email change creates a new user (email is the identifier)."""
        suffix = token_hex(4)
        username = f"simple_{suffix}"
        email_v1 = f"simple_v1_{suffix}@example.com"
        email_v2 = f"simple_v2_{suffix}@example.com"

        # First login with email_v1
        _ldap_server.add_user(
            username=username,
            password=_DEFAULT_PASSWORD,
            email=email_v1,
            display_name="User",
            groups=[_ADMIN_GROUP],
        )
        status, access_token, refresh_token = _ldap_login(_app, username, _DEFAULT_PASSWORD)
        _verify_ldap_login_success(status, access_token, refresh_token)

        user_v1 = _get_user_by_email(_app, email_v1)
        assert user_v1 is not None

        # Email changes in LDAP, login again
        _ldap_server.add_user(
            username=username,
            password=_DEFAULT_PASSWORD,
            email=email_v2,
            display_name="User",
            groups=[_ADMIN_GROUP],
        )
        status, access_token, refresh_token = _ldap_login(_app, username, _DEFAULT_PASSWORD)
        _verify_ldap_login_success(status, access_token, refresh_token)

        # Result: NEW user created (email is the identifier)
        user_v2 = _get_user_by_email(_app, email_v2)
        assert user_v2 is not None
        assert user_v2.gid != user_v1.gid, "Different user when email changes"

        # Cleanup both users
        _delete_users(_app, _app.admin_secret, users=[user_v1.gid, user_v2.gid])

    def test_email_change_preserves_identity_with_unique_id(
        self, _app_ldap_unique_id: _AppInfo, _ldap_server: _LDAPServer
    ) -> None:
        """Enterprise mode: email change preserves identity (unique_id is the identifier).

        Also tests migration: admin pre-provisions user, first login migrates to unique_id,
        subsequent email change still preserves identity.
        """
        app = _app_ldap_unique_id
        suffix = token_hex(4)
        username = f"enterprise_{suffix}"
        email_v1 = f"enterprise_v1_{suffix}@example.com"
        email_v2 = f"enterprise_v2_{suffix}@example.com"

        # Admin pre-provisions user (no unique_id in DB yet)
        graphql_client = _httpx_client(app, app.admin_secret)
        response = graphql_client.post(
            "/graphql",
            json={
                "query": """
                    mutation($email: String!, $username: String!, $role: UserRoleInput!) {
                        createUser(input: {
                            email: $email, username: $username, role: $role, authMethod: LDAP
                        }) { user { id } }
                    }
                """,
                "variables": {"email": email_v1, "username": "Pre-Provisioned", "role": "MEMBER"},
            },
        )
        assert response.status_code == 200

        # First login (migrates pre-provisioned user to unique_id)
        _ldap_server.add_user(
            username=username,
            password=_DEFAULT_PASSWORD,
            email=email_v1,
            display_name="User",
            groups=[_ADMIN_GROUP],
        )
        status, access_token, refresh_token = _ldap_login(app, username, _DEFAULT_PASSWORD)
        _verify_ldap_login_success(status, access_token, refresh_token)

        user_v1 = _get_user_by_email(app, email_v1)
        assert user_v1 is not None
        assert user_v1.role == UserRoleInput.ADMIN, "Role updated from LDAP groups"
        assert user_v1.username == "Pre-Provisioned", "Username stable from pre-provisioning"

        # Email changes in LDAP, login again
        _ldap_server.add_user(
            username=username,  # Same username = same entryUUID
            password=_DEFAULT_PASSWORD,
            email=email_v2,
            display_name="User",
            groups=[_ADMIN_GROUP],
        )
        status, access_token, refresh_token = _ldap_login(app, username, _DEFAULT_PASSWORD)
        _verify_ldap_login_success(status, access_token, refresh_token)

        # Result: SAME user (unique_id is the identifier)
        user_v2 = _get_user_by_email(app, email_v2)
        assert user_v2 is not None
        assert user_v2.gid == user_v1.gid, "Same user when unique_id is configured"

        # Old email no longer exists
        assert _get_user_by_email(app, email_v1) is None

        # Cleanup
        _delete_users(app, app.admin_secret, users=[user_v2.gid])


class TestLDAPGraphQLIntegration:
    """Test GraphQL integration for LDAP users."""

    async def test_ldap_user_graphql_auth_method(
        self, _app: _AppInfo, _ldap_server: _LDAPServer
    ) -> None:
        """Test that GraphQL correctly exposes LDAP users with authMethod='LDAP'.

        Verifies the GraphQL resolver translates the database storage (OAuth2 with marker)
        to the semantic AuthMethod.LDAP for the frontend.
        """
        test_user = _create_test_user(
            _ldap_server, token_hex(4), "graphql_user", UserRoleInput.ADMIN
        )

        # Step 1: Create LDAP user via login
        status, access_token, refresh_token = _ldap_login(
            _app, test_user.username, test_user.password
        )
        _verify_ldap_login_success(status, access_token, refresh_token)

        # Step 2: Query GraphQL to verify authMethod is 'LDAP'
        graphql_query = """
        query {
          users {
            edges {
              user: node {
                email
                authMethod
              }
            }
          }
        }
        """

        graphql_client = _httpx_client(_app, _app.admin_secret)
        graphql_response = graphql_client.post(
            "/graphql",
            json={"query": graphql_query},
        )

        assert graphql_response.status_code == 200
        data = graphql_response.json()

        # Find our LDAP user in the response
        users = data["data"]["users"]["edges"]
        ldap_user_data = next((u for u in users if u["user"]["email"] == test_user.email), None)

        assert ldap_user_data is not None, f"User {test_user.email} not found in GraphQL response"
        # The key assertion: GraphQL should expose authMethod as 'LDAP' (not 'OAUTH2')
        assert ldap_user_data["user"]["authMethod"] == "LDAP", (
            f"Expected authMethod='LDAP', got '{ldap_user_data['user']['authMethod']}'"
        )

        # Cleanup
        user = _get_user_by_email(_app, test_user.email)
        if user:
            _delete_users(_app, _app.admin_secret, users=[user.gid])


class TestLDAPSecurityIsolation:
    """Test that LDAP, OAuth2, and LOCAL auth methods are isolated from each other."""

    async def test_local_user_protected_from_ldap_login(
        self, _app: _AppInfo, _ldap_server: _LDAPServer
    ) -> None:
        """LOCAL user cannot be hijacked via LDAP login with same email."""
        suffix = token_hex(4)
        email = f"local_{suffix}@example.com"

        # Create LOCAL user
        graphql_client = _httpx_client(_app, _app.admin_secret)
        resp = graphql_client.post(
            "/graphql",
            json={
                "query": """mutation($i: CreateUserInput!) { createUser(input: $i) { user { id } } }""",
                "variables": {
                    "i": {
                        "email": email,
                        "username": "Local",
                        "role": "MEMBER",
                        "authMethod": "LOCAL",
                        "password": "pass123",
                    }
                },
            },
        )
        local_user_id = resp.json()["data"]["createUser"]["user"]["id"]

        # Add same email to LDAP
        _ldap_server.add_user(
            username=f"local_{suffix}",
            password="ldappass",
            email=email,
            display_name="LDAP",
            groups=[_ADMIN_GROUP],
        )

        # LDAP login should fail (LOCAL user protected)
        assert _ldap_login(_app, f"local_{suffix}", "ldappass")[0] == 401
        _delete_users(_app, _app.admin_secret, users=[local_user_id])

    async def test_ldap_user_protected_from_password_login(
        self, _app: _AppInfo, _ldap_server: _LDAPServer
    ) -> None:
        """LDAP user cannot login via password endpoint (no password_hash)."""
        user = _create_test_user(_ldap_server, token_hex(4), "ldap", UserRoleInput.ADMIN)
        status, _, _ = _ldap_login(_app, user.username, user.password)
        assert status == 204

        # Password login should fail
        client = _httpx_client(_app)
        resp = client.post("/auth/login", json={"email": user.email, "password": user.password})
        assert resp.status_code == 401

        db_user = _get_user_by_email(_app, user.email)
        assert db_user is not None
        _delete_users(_app, _app.admin_secret, users=[db_user.gid])

    async def test_oauth2_user_protected_from_ldap_login(
        self, _app: _AppInfo, _ldap_server: _LDAPServer
    ) -> None:
        """OAuth2 user cannot be hijacked via LDAP login with same email."""
        suffix = token_hex(4)
        email = f"oauth_{suffix}@example.com"

        # Create OAuth2 user via REST API
        client = _httpx_client(_app, _app.admin_secret)
        resp = client.post(
            "/v1/users",
            json={
                "user": {
                    "email": email,
                    "username": f"oauth_{suffix}",
                    "role": "VIEWER",
                    "auth_method": "OAUTH2",
                    "oauth2_client_id": "google",
                    "oauth2_user_id": f"google-{suffix}",
                },
                "send_welcome_email": False,
            },
        )
        assert resp.status_code == 201
        oauth_user_id = resp.json()["data"]["id"]

        # Add same email to LDAP
        _ldap_server.add_user(
            username=f"oauth_{suffix}",
            password=_DEFAULT_PASSWORD,
            email=email,
            display_name="LDAP",
            groups=[_ADMIN_GROUP],
        )

        # LDAP login should fail (OAuth2 user protected)
        assert _ldap_login(_app, f"oauth_{suffix}", _DEFAULT_PASSWORD)[0] == 401
        client.delete(f"/v1/users/{oauth_user_id}")


class TestLDAPConfiguration:
    """Test LDAP configuration-specific behaviors."""

    def test_ldap_allow_sign_up_false_with_email_lookup(
        self, _app_ldap_no_sign_up: _AppInfo, _ldap_server: _LDAPServer
    ) -> None:
        """Test email-based user lookup when allow_sign_up=false.

        Critical behavior for allow_sign_up=false:
        1. Admin creates LDAP user with email "john@example.com"
        2. User logs in via LDAP with any username
        3. Phoenix gets email from LDAP authentication
        4. Phoenix looks up user by email → finds user
        5. Login succeeds and attributes synced from LDAP
        """
        # Step 1: Admin pre-creates LDAP user (only needs email)
        suffix = token_hex(4)
        ldap_username = f"jdoe_{suffix}"  # What user will login with
        email = f"john_{suffix}@example.com"

        # Admin creates user via GraphQL with wrong username
        graphql_client = _httpx_client(_app_ldap_no_sign_up, _app_ldap_no_sign_up.admin_secret)
        create_response = graphql_client.post(
            "/graphql",
            json={
                "query": """
                    mutation CreateUser($input: CreateUserInput!) {
                        createUser(input: $input) {
                            user { id email username authMethod }
                        }
                    }
                """,
                "variables": {
                    "input": {
                        "email": email,
                        "username": "John Doe",  # Display name
                        "role": "MEMBER",
                        "authMethod": "LDAP",
                    },
                },
            },
        )
        assert create_response.status_code == 200
        user_data = create_response.json()["data"]["createUser"]["user"]
        assert user_data["authMethod"] == "LDAP"
        created_user_gid = user_data["id"]

        # Step 2: Add user to LDAP with matching email
        _ldap_server.add_user(
            username=ldap_username,
            password=_DEFAULT_PASSWORD,
            email=email,
            display_name="John Smith, Ph.D.",
            groups=[_ADMIN_GROUP],
        )

        # Step 3: User logs in via LDAP (email lookup finds pre-created user)
        status, access_token, refresh_token = _ldap_login(
            _app_ldap_no_sign_up, ldap_username, _DEFAULT_PASSWORD
        )
        _verify_ldap_login_success(status, access_token, refresh_token)

        # Step 4: Verify username remains stable (not synced from LDAP)
        users = _list_users(_app_ldap_no_sign_up, _app_ldap_no_sign_up.admin_secret)
        updated_user = next((u for u in users if u.profile.email == email), None)
        assert updated_user is not None
        # Username stays stable from admin creation (prevents collisions on displayName changes)
        assert updated_user.profile.username == "John Doe"

        # Step 5: Verify subsequent logins work
        status, access_token, refresh_token = _ldap_login(
            _app_ldap_no_sign_up, ldap_username, _DEFAULT_PASSWORD
        )
        _verify_ldap_login_success(status, access_token, refresh_token)

        _delete_users(
            _app_ldap_no_sign_up, _app_ldap_no_sign_up.admin_secret, users=[created_user_gid]
        )


class TestLDAPPosixGroupSearch:
    """Test LDAP POSIX group search (OpenLDAP style).

    POSIX groups store member DNs in a 'member' attribute, requiring Phoenix
    to search for groups containing the user's DN.
    """

    def test_posix_role_from_group_search(
        self, _app_ldap_posix: _AppInfo, _ldap_server: _LDAPServer
    ) -> None:
        """Test role assignment via POSIX group search (no memberOf attribute)."""
        suffix = token_hex(4)
        username = f"posix_{suffix}"
        email = f"posix_{suffix}@example.com"
        user_dn = f"uid={username},ou=users,dc=example,dc=com"

        # User without memberOf
        _ldap_server.add_user(
            username=username,
            password=_DEFAULT_PASSWORD,
            email=email,
            display_name="POSIX",
            groups=[],
        )
        # Add to admins group via POSIX-style membership
        _ldap_server.add_group(cn="admins", members=[user_dn])

        status, _, _ = _ldap_login(_app_ldap_posix, username, _DEFAULT_PASSWORD)
        assert status == 204
        user = _get_user_by_email(_app_ldap_posix, email)
        assert user is not None
        assert user.role == UserRoleInput.ADMIN
        _delete_users(_app_ldap_posix, _app_ldap_posix.admin_secret, users=[user.gid])

    def test_posix_wildcard_when_no_groups(
        self, _app_ldap_posix: _AppInfo, _ldap_server: _LDAPServer
    ) -> None:
        """Test wildcard role when user is in no POSIX groups."""
        suffix = token_hex(4)
        username = f"posix_none_{suffix}"
        email = f"posix_none_{suffix}@example.com"

        _ldap_server.add_user(
            username=username,
            password=_DEFAULT_PASSWORD,
            email=email,
            display_name="No Groups",
            groups=[],
        )
        # Don't add to any group

        status, _, _ = _ldap_login(_app_ldap_posix, username, _DEFAULT_PASSWORD)
        assert status == 204
        user = _get_user_by_email(_app_ldap_posix, email)
        assert user is not None
        assert user.role == UserRoleInput.VIEWER  # Wildcard
        _delete_users(_app_ldap_posix, _app_ldap_posix.admin_secret, users=[user.gid])

    def test_posix_dn_case_insensitive(
        self, _app_ldap_posix: _AppInfo, _ldap_server: _LDAPServer
    ) -> None:
        """Test DN matching in group search is case-insensitive per RFC 4514."""
        suffix = token_hex(4)
        username = f"posix_case_{suffix}"
        email = f"posix_case_{suffix}@example.com"

        _ldap_server.add_user(
            username=username,
            password=_DEFAULT_PASSWORD,
            email=email,
            display_name="Case",
            groups=[],
        )
        # Group has UPPERCASE DN but user's actual DN is lowercase
        _ldap_server.add_group(
            cn="admins", members=[f"UID={username.upper()},OU=USERS,DC=EXAMPLE,DC=COM"]
        )

        status, _, _ = _ldap_login(_app_ldap_posix, username, _DEFAULT_PASSWORD)
        assert status == 204
        user = _get_user_by_email(_app_ldap_posix, email)
        assert user is not None
        assert user.role == UserRoleInput.ADMIN  # Should match despite case
        _delete_users(_app_ldap_posix, _app_ldap_posix.admin_secret, users=[user.gid])


class TestLDAPDNHandling:
    """Test DN-related security and RFC 4514 compliance."""

    def test_duplicate_username_rejected(self, _ldap_server: _LDAPServer, _app: _AppInfo) -> None:
        """Login rejected when multiple LDAP entries match the same username.

        Security: Prevents non-deterministic authentication when same uid exists
        in different OUs (e.g., uid=admin in IT and HR).
        """
        suffix = token_hex(4)
        username = f"dup_{suffix}"

        # Two users with same username, different OUs
        _ldap_server.add_user(
            username=username,
            password="pass",
            email=f"{username}_it@example.com",
            display_name="IT",
            groups=[_ADMIN_GROUP],
            custom_dn=f"uid={username},ou=IT,dc=example,dc=com",
        )
        _ldap_server.add_user(
            username=username,
            password="pass",
            email=f"{username}_hr@example.com",
            display_name="HR",
            groups=[_ADMIN_GROUP],
            custom_dn=f"uid={username},ou=HR,dc=example,dc=com",
        )

        # Should reject (ambiguous)
        status, _, _ = _ldap_login(_app, username, "pass")
        assert status == 401

        # No user created
        all_users = _list_users(_app, _app.admin_secret)
        assert not any(u.email.startswith(f"{username}_") for u in all_users)

    def test_dn_case_variation_same_user(self, _app: _AppInfo, _ldap_server: _LDAPServer) -> None:
        """DN case variations don't create duplicate users (RFC 4514).

        Real scenario: AD controllers may return different casing for same user.
        """
        suffix = token_hex(4)
        username = f"dncase_{suffix}"
        email = f"dncase_{suffix}@example.com"

        # First login with lowercase DN
        _ldap_server.add_user(
            username=username,
            password=_DEFAULT_PASSWORD,
            email=email,
            display_name="User",
            groups=[_ADMIN_GROUP],
            custom_dn=f"uid={username},ou=users,dc=example,dc=com",
        )
        status, _, _ = _ldap_login(_app, username, _DEFAULT_PASSWORD)
        assert status == 204
        user1 = _get_user_by_email(_app, email)
        assert user1 is not None

        # Second login - LDAP returns MIXED CASE DN (same user)
        _ldap_server.add_user(
            username=username,
            password=_DEFAULT_PASSWORD,
            email=email,
            display_name="User",
            groups=[_ADMIN_GROUP],
            custom_dn=f"UID={username.upper()},OU=Users,DC=Example,DC=Com",
        )
        status, _, _ = _ldap_login(_app, username, _DEFAULT_PASSWORD)
        assert status == 204

        # Verify same user (no duplicate)
        user2 = _get_user_by_email(_app, email)
        assert user2 is not None
        assert user2.gid == user1.gid

        _delete_users(_app, _app.admin_secret, users=[user1.gid])
