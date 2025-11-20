"""Unit tests for OAuth2Client."""

from typing import Any

import pytest

from phoenix.config import OAuth2ClientConfig
from phoenix.server.oauth2 import OAuth2Client, OAuth2Clients

# Common test configuration constants
# Note: Optional features (groups, roles) are excluded - tests add them explicitly
_OAUTH2_CONFIG_DEFAULTS: dict[str, Any] = {
    "idp_name": "test",
    "idp_display_name": "Test IDP",
    "client_id": "test_client_id",
    "client_secret": "test_secret",
    "oidc_config_url": "https://test.example.com/.well-known/openid-configuration",
    "allow_sign_up": False,
    "auto_login": False,
    "use_pkce": False,
    "token_endpoint_auth_method": None,
    "scopes": "openid email profile",
}

_OAUTH2_CLIENT_DEFAULTS: dict[str, Any] = {
    "name": "test",
    "client_id": "test_id",
    "client_secret": "test_secret",
    "server_metadata_url": "https://test.example.com/.well-known/openid-configuration",
    "display_name": "Test IDP",
    "allow_sign_up": False,
    "auto_login": False,
}


class TestOAuth2ClientJMESPathValidation:
    """Test that JMESPath expressions are validated at startup."""

    @pytest.mark.parametrize(
        "groups_attribute_path",
        [
            pytest.param("groups", id="simple_path"),
            pytest.param("resource_access.phoenix.roles", id="nested_path"),
            pytest.param('"cognito:groups"', id="quoted_identifier_colon"),
            pytest.param('"https://myapp.com/groups"', id="quoted_identifier_url"),
            pytest.param("teams[*].name", id="array_projection"),
            pytest.param('resource_access."my-app".roles', id="nested_with_quoted_segment"),
        ],
    )
    def test_valid_jmespath_expressions(self, groups_attribute_path: str) -> None:
        """Test that valid JMESPath expressions are accepted at startup."""
        config = OAuth2ClientConfig(
            **_OAUTH2_CONFIG_DEFAULTS,
            groups_attribute_path=groups_attribute_path,
            allowed_groups=["admin"],
            role_attribute_path=None,
            role_mapping={},
            role_attribute_strict=False,
        )

        clients = OAuth2Clients()
        clients.add_client(config)  # Should not raise

    @pytest.mark.parametrize(
        "groups_attribute_path",
        [
            pytest.param("cognito:groups", id="missing_quotes_colon"),
            pytest.param("https://myapp.com/groups", id="missing_quotes_url"),
            pytest.param("[invalid syntax!", id="malformed_bracket"),
            pytest.param("groups[*", id="unclosed_bracket"),
        ],
    )
    def test_invalid_jmespath_expressions(self, groups_attribute_path: str) -> None:
        """Test that invalid JMESPath expressions are rejected at startup."""
        config = OAuth2ClientConfig(
            **_OAUTH2_CONFIG_DEFAULTS,
            groups_attribute_path=groups_attribute_path,
            allowed_groups=["admin"],
            role_attribute_path=None,
            role_mapping={},
            role_attribute_strict=False,
        )

        clients = OAuth2Clients()
        with pytest.raises(ValueError, match="Invalid JMESPath expression"):
            clients.add_client(config)

    def test_helpful_error_message_on_invalid_jmespath(self) -> None:
        """Test that error message includes helpful hints about quoting special characters."""
        config = OAuth2ClientConfig(
            **{**_OAUTH2_CONFIG_DEFAULTS, "idp_name": "auth0", "idp_display_name": "Auth0"},
            groups_attribute_path="https://myapp.com/groups",  # Invalid - needs quotes
            allowed_groups=["admin"],
            role_attribute_path=None,
            role_mapping={},
            role_attribute_strict=False,
        )

        clients = OAuth2Clients()
        with pytest.raises(ValueError) as exc_info:
            clients.add_client(config)

        error_message = str(exc_info.value)
        assert "Invalid JMESPath expression in GROUPS_ATTRIBUTE_PATH" in error_message
        assert "https://myapp.com/groups" in error_message
        assert "double quotes" in error_message
        assert '"cognito:groups"' in error_message  # Example in hint
        assert '"https://myapp.com/groups"' in error_message  # Example in hint

    def test_no_validation_when_groups_attribute_path_is_none(self) -> None:
        """Test that client creation works when groups_attribute_path is not configured."""
        config = OAuth2ClientConfig(
            **_OAUTH2_CONFIG_DEFAULTS,
            groups_attribute_path=None,  # No group-based access control
            allowed_groups=[],
            role_attribute_path=None,
            role_mapping={},
            role_attribute_strict=False,
        )

        clients = OAuth2Clients()
        clients.add_client(config)  # Should not raise

    def test_role_attribute_path_error_message_identifies_role(self) -> None:
        """Test that error message for invalid role JMESPath correctly identifies ROLE_ATTRIBUTE_PATH."""
        config = OAuth2ClientConfig(
            **_OAUTH2_CONFIG_DEFAULTS,
            groups_attribute_path=None,
            allowed_groups=[],
            role_attribute_path="https://myapp.com/role",  # Invalid - needs quotes
            role_mapping={"Owner": "ADMIN"},
            role_attribute_strict=False,
        )

        clients = OAuth2Clients()
        with pytest.raises(ValueError) as exc_info:
            clients.add_client(config)

        error_message = str(exc_info.value)
        assert "Invalid JMESPath expression in ROLE_ATTRIBUTE_PATH" in error_message
        assert "https://myapp.com/role" in error_message
        assert "double quotes" in error_message


class TestHasSufficientClaims:
    """Test has_sufficient_claims method for determining if UserInfo call is needed."""

    def test_sufficient_when_email_present_no_group_control(self) -> None:
        """Test that claims are sufficient when email is present and no group control."""
        client = OAuth2Client(
            **_OAUTH2_CLIENT_DEFAULTS,
            groups_attribute_path=None,
            allowed_groups=[],
        )

        claims = {"sub": "user123", "email": "user@example.com"}

        assert client.has_sufficient_claims(claims) is True

    def test_sufficient_when_email_and_groups_present(self) -> None:
        """Test that claims are sufficient when both email and required groups present."""
        client = OAuth2Client(
            **_OAUTH2_CLIENT_DEFAULTS,
            groups_attribute_path="groups",
            allowed_groups=["admin", "users"],
        )

        claims = {"sub": "user123", "email": "user@example.com", "groups": ["users"]}

        assert client.has_sufficient_claims(claims) is True

    def test_insufficient_when_email_missing(self) -> None:
        """Test that claims are insufficient when email is missing."""
        client = OAuth2Client(
            **_OAUTH2_CLIENT_DEFAULTS,
            groups_attribute_path=None,
            allowed_groups=[],
        )

        claims = {"sub": "user123"}  # No email

        assert client.has_sufficient_claims(claims) is False

    def test_insufficient_when_email_is_none(self) -> None:
        """Test that claims are insufficient when email is None."""
        client = OAuth2Client(
            **_OAUTH2_CLIENT_DEFAULTS,
            groups_attribute_path=None,
            allowed_groups=[],
        )

        claims = {"sub": "user123", "email": None}

        assert client.has_sufficient_claims(claims) is False

    def test_insufficient_when_email_is_empty_string(self) -> None:
        """Test that claims are insufficient when email is empty string."""
        client = OAuth2Client(
            **_OAUTH2_CLIENT_DEFAULTS,
            groups_attribute_path=None,
            allowed_groups=[],
        )

        claims = {"sub": "user123", "email": ""}

        assert client.has_sufficient_claims(claims) is False

    def test_insufficient_when_email_is_whitespace(self) -> None:
        """Test that claims are insufficient when email is whitespace only."""
        client = OAuth2Client(
            **_OAUTH2_CLIENT_DEFAULTS,
            groups_attribute_path=None,
            allowed_groups=[],
        )

        claims = {"sub": "user123", "email": "   "}

        assert client.has_sufficient_claims(claims) is False

    def test_insufficient_when_email_is_not_string(self) -> None:
        """Test that claims are insufficient when email is not a string."""
        client = OAuth2Client(
            **_OAUTH2_CLIENT_DEFAULTS,
            groups_attribute_path=None,
            allowed_groups=[],
        )

        claims = {"sub": "user123", "email": 12345}

        assert client.has_sufficient_claims(claims) is False

    def test_insufficient_when_groups_missing_and_required(self) -> None:
        """Test that claims are insufficient when groups are missing but required."""
        client = OAuth2Client(
            **_OAUTH2_CLIENT_DEFAULTS,
            groups_attribute_path="groups",
            allowed_groups=["admin", "users"],
        )

        claims = {"sub": "user123", "email": "user@example.com"}  # No groups

        assert client.has_sufficient_claims(claims) is False

    def test_insufficient_when_groups_empty_and_required(self) -> None:
        """Test that claims are insufficient when groups array is empty but required."""
        client = OAuth2Client(
            **_OAUTH2_CLIENT_DEFAULTS,
            groups_attribute_path="groups",
            allowed_groups=["admin", "users"],
        )

        claims = {"sub": "user123", "email": "user@example.com", "groups": []}

        assert client.has_sufficient_claims(claims) is False

    def test_insufficient_when_email_missing_even_with_groups(self) -> None:
        """Test that email is required even when groups are present."""
        client = OAuth2Client(
            **_OAUTH2_CLIENT_DEFAULTS,
            groups_attribute_path="groups",
            allowed_groups=["admin"],
        )

        claims = {"sub": "user123", "groups": ["admin"]}  # Groups present but no email

        assert client.has_sufficient_claims(claims) is False

    def test_sufficient_with_nested_groups(self) -> None:
        """Test that claims are sufficient with nested group paths."""
        client = OAuth2Client(
            **_OAUTH2_CLIENT_DEFAULTS,
            groups_attribute_path="resource_access.phoenix.roles",
            allowed_groups=["admin"],
        )

        claims = {
            "sub": "user123",
            "email": "user@example.com",
            "resource_access": {"phoenix": {"roles": ["admin", "developer"]}},
        }

        assert client.has_sufficient_claims(claims) is True

    def test_insufficient_with_nested_groups_missing(self) -> None:
        """Test that claims are insufficient when nested groups are missing."""
        client = OAuth2Client(
            **_OAUTH2_CLIENT_DEFAULTS,
            groups_attribute_path="resource_access.phoenix.roles",
            allowed_groups=["admin"],
        )

        claims = {
            "sub": "user123",
            "email": "user@example.com",
            "resource_access": {},  # Missing phoenix key
        }

        assert client.has_sufficient_claims(claims) is False

    def test_sufficient_with_quoted_jmespath(self) -> None:
        """Test that claims are sufficient with quoted JMESPath (special characters)."""
        client = OAuth2Client(
            **_OAUTH2_CLIENT_DEFAULTS,
            groups_attribute_path='"cognito:groups"',
            allowed_groups=["Administrators"],
        )

        claims = {
            "sub": "user123",
            "email": "user@example.com",
            "cognito:groups": ["Administrators", "PowerUsers"],
        }

        assert client.has_sufficient_claims(claims) is True


class TestOAuth2ClientAccessValidation:
    """Test group-based access control validation."""

    @pytest.mark.parametrize(
        ("groups_attribute_path", "allowed_groups", "user_claims"),
        [
            pytest.param(
                "groups",
                ["admin", "users"],
                {"sub": "user123", "email": "user@example.com", "groups": ["users", "developers"]},
                id="single_matching_group",
            ),
            pytest.param(
                "groups",
                ["admin", "powerusers"],
                {
                    "sub": "user123",
                    "email": "admin@example.com",
                    "groups": ["admin", "powerusers", "support"],
                },
                id="multiple_matching_groups",
            ),
            pytest.param(
                "groups",
                ["1", "True"],
                {"sub": "user123", "email": "user@example.com", "groups": [1, True, "other"]},
                id="type_normalization",
            ),
        ],
    )
    def test_access_granted(
        self, groups_attribute_path: str, allowed_groups: list[str], user_claims: dict[str, Any]
    ) -> None:
        """Test that access is granted when user belongs to at least one allowed group."""
        client = OAuth2Client(
            **_OAUTH2_CLIENT_DEFAULTS,
            groups_attribute_path=groups_attribute_path,
            allowed_groups=allowed_groups,
        )

        # Should not raise
        client.validate_access(user_claims)

    @pytest.mark.parametrize(
        ("groups_attribute_path", "allowed_groups", "user_claims"),
        [
            pytest.param(
                "groups",
                ["admin", "powerusers"],
                {"sub": "user123", "email": "user@example.com", "groups": ["guest", "readonly"]},
                id="no_matching_groups",
            ),
            pytest.param(
                "groups",
                ["admin"],
                {"sub": "user123", "email": "user@example.com"},  # No groups claim
                id="missing_groups_claim",
            ),
            pytest.param(
                "groups",
                ["admin"],
                {"sub": "user123", "email": "user@example.com", "groups": []},
                id="empty_groups_array",
            ),
            pytest.param(
                "groups",
                ["Admin"],
                {"sub": "user123", "email": "user@example.com", "groups": ["admin"]},
                id="case_sensitive_mismatch",
            ),
            pytest.param(
                "teams[*].name",
                ["engineering", "product"],
                {
                    "sub": "user123",
                    "email": "support@example.com",
                    "teams": [{"id": "3", "name": "support"}, {"id": "4", "name": "sales"}],
                },
                id="array_projection_no_match",
            ),
            pytest.param(
                "nonexistent.path.to.groups",
                ["admin"],
                {"sub": "user123", "email": "user@example.com", "other": "data"},
                id="nonexistent_jmespath_path",
            ),
        ],
    )
    def test_access_denied(
        self, groups_attribute_path: str, allowed_groups: list[str], user_claims: dict[str, Any]
    ) -> None:
        """Test that access is denied when user doesn't meet group requirements."""
        client = OAuth2Client(
            **_OAUTH2_CLIENT_DEFAULTS,
            groups_attribute_path=groups_attribute_path,
            allowed_groups=allowed_groups,
        )

        with pytest.raises(PermissionError, match="Access denied"):
            client.validate_access(user_claims)

    def test_no_validation_when_disabled_no_allowed_groups(self) -> None:
        """Test that validation is skipped when group-based access control is disabled."""
        client = OAuth2Client(
            **_OAUTH2_CLIENT_DEFAULTS,
            groups_attribute_path=None,  # Disabled - no path configured
            allowed_groups=[],
        )

        user_claims = {
            "sub": "user123",
            "email": "user@example.com",
            "groups": ["guest"],  # Groups present but validation is disabled
        }

        # Should not raise - validation is disabled
        client.validate_access(user_claims)

    def test_invalid_configuration_raises_error(self) -> None:
        """Test that invalid configuration raises ValueError at initialization."""
        with pytest.raises(
            ValueError,
            match="groups_attribute_path must be specified when allowed_groups is configured",
        ):
            OAuth2Client(
                **_OAUTH2_CLIENT_DEFAULTS,
                groups_attribute_path=None,
                allowed_groups=["admin"],
            )

    def test_groups_attribute_path_without_allowed_groups_raises_error(self) -> None:
        """Test that groups_attribute_path without allowed_groups raises ValueError (fail-closed)."""
        with pytest.raises(
            ValueError,
            match="allowed_groups must be specified when groups_attribute_path is configured",
        ):
            OAuth2Client(
                **_OAUTH2_CLIENT_DEFAULTS,
                groups_attribute_path="groups",
                allowed_groups=[],
            )

    def test_groups_attribute_path_with_empty_allowed_groups_raises_error(self) -> None:
        """Test that groups_attribute_path with list of empty strings raises ValueError."""
        with pytest.raises(
            ValueError,
            match="allowed_groups must be specified when groups_attribute_path is configured",
        ):
            OAuth2Client(
                **_OAUTH2_CLIENT_DEFAULTS,
                groups_attribute_path="groups",
                allowed_groups=["", "  ", ""],  # All empty/whitespace - will be filtered out
            )

    def test_empty_string_groups_attribute_path_normalized(self) -> None:
        """Test that empty string groups_attribute_path is normalized to None."""
        client = OAuth2Client(
            **_OAUTH2_CLIENT_DEFAULTS,
            groups_attribute_path="",
            allowed_groups=[],
        )
        # Test that validation is skipped when groups_attribute_path is None
        user_claims = {"groups": ["admin"]}
        client.validate_access(user_claims)  # Should not raise

    def test_whitespace_groups_attribute_path_normalized(self) -> None:
        """Test that whitespace-only groups_attribute_path is normalized to None."""
        client = OAuth2Client(
            **_OAUTH2_CLIENT_DEFAULTS,
            groups_attribute_path="   ",
            allowed_groups=[],
        )
        # Test that validation is skipped when groups_attribute_path is None
        user_claims = {"groups": ["admin"]}
        client.validate_access(user_claims)  # Should not raise

    def test_empty_strings_in_allowed_groups_removed(self) -> None:
        """Test that empty strings in allowed_groups are removed."""
        client = OAuth2Client(
            **_OAUTH2_CLIENT_DEFAULTS,
            groups_attribute_path="groups",
            allowed_groups=["admin", "", "user", "   "],
        )
        # Test that validation works with cleaned groups
        user_claims = {"groups": ["admin"]}
        client.validate_access(user_claims)  # Should not raise

    def test_duplicate_groups_removed(self) -> None:
        """Test that duplicate groups in allowed_groups are removed."""
        client = OAuth2Client(
            **_OAUTH2_CLIENT_DEFAULTS,
            groups_attribute_path="groups",
            allowed_groups=["admin", "user", "admin", "user", "admin"],
        )
        # Test that validation works with deduplicated groups
        user_claims = {"groups": ["admin"]}
        client.validate_access(user_claims)  # Should not raise

    def test_normalization_removes_duplicates(self) -> None:
        """Test that group normalization removes duplicates."""
        client = OAuth2Client(
            **_OAUTH2_CLIENT_DEFAULTS,
            groups_attribute_path="groups",
            allowed_groups=["z", "a", "z", "b", "a", "c"],
        )
        # Test that validation works with deduplicated groups
        user_claims = {"groups": ["a"]}
        client.validate_access(user_claims)  # Should not raise

    @pytest.mark.parametrize(
        ("groups_attribute_path", "allowed_groups", "user_claims"),
        [
            pytest.param(
                "resource_access.phoenix.roles",
                ["admin", "user"],
                {
                    "sub": "user123",
                    "email": "user@example.com",
                    "resource_access": {"phoenix": {"roles": ["admin", "developer"]}},
                },
                id="keycloak_nested_structure",
            ),
            pytest.param(
                '"cognito:groups"',
                ["Administrators", "PowerUsers"],
                {
                    "sub": "user123",
                    "email": "admin@example.com",
                    "cognito:groups": ["Administrators", "Developers"],
                },
                id="cognito_special_chars_in_key",
            ),
        ],
    )
    def test_complex_jmespath_integration(
        self,
        groups_attribute_path: str,
        allowed_groups: list[str],
        user_claims: dict[str, Any],
    ) -> None:
        """Integration test: Complex JMESPath patterns work end-to-end with real IDP claim structures."""
        client = OAuth2Client(
            **_OAUTH2_CLIENT_DEFAULTS,
            groups_attribute_path=groups_attribute_path,
            allowed_groups=allowed_groups,
        )

        # Should not raise - validates JMESPath extraction + access control together
        client.validate_access(user_claims)

    @pytest.mark.parametrize(
        ("groups_attribute_path", "allowed_groups", "user_claims"),
        [
            pytest.param(
                "groups",
                ["admin"],
                {"sub": "user123", "email": "user@example.com", "groups": ["admin", None, "user"]},
                id="null_values_in_array",
            ),
            pytest.param(
                "groups",
                ["管理者"],
                {"sub": "user123", "email": "user@example.com", "groups": ["管理者", "ユーザー"]},
                id="unicode_group_names",
            ),
            pytest.param(
                "groups",
                ["admin"],
                {
                    "sub": "user123",
                    "email": "user@example.com",
                    "groups": [{"nested": "value"}, "admin", {"other": "obj"}],
                },
                id="mixed_valid_invalid_items",
            ),
        ],
    )
    def test_edge_case_claim_values_granted(
        self,
        groups_attribute_path: str,
        allowed_groups: list[str],
        user_claims: dict[str, Any],
    ) -> None:
        """Test that edge case claim values are handled gracefully (null, empty, unicode, nested objects)."""
        client = OAuth2Client(
            **_OAUTH2_CLIENT_DEFAULTS,
            groups_attribute_path=groups_attribute_path,
            allowed_groups=allowed_groups,
        )

        # Should not raise - normalization filters out invalid items, keeps valid ones
        client.validate_access(user_claims)

    def test_empty_strings_do_not_grant_access(self) -> None:
        """Test that empty strings in groups array don't match any allowed groups."""
        client = OAuth2Client(
            **_OAUTH2_CLIENT_DEFAULTS,
            groups_attribute_path="groups",
            allowed_groups=["admin"],
        )

        user_claims = {
            "sub": "user123",
            "email": "user@example.com",
            "groups": ["", "guest"],  # Empty string preserved but shouldn't match 'admin'
        }

        with pytest.raises(PermissionError, match="Access denied"):
            client.validate_access(user_claims)

    @pytest.mark.parametrize(
        ("user_claims", "should_grant_access"),
        [
            pytest.param(
                {"sub": "user123", "email": "user@example.com", "groups": "admin"},
                True,
                id="string_instead_of_array",
            ),
            pytest.param(
                {"sub": "user123", "email": "user@example.com", "groups": 123},
                False,
                id="number_instead_of_array",
            ),
            pytest.param(
                {"sub": "user123", "email": "user@example.com", "groups": True},
                False,
                id="boolean_instead_of_array",
            ),
            pytest.param(
                {"sub": "user123", "email": "user@example.com", "groups": {"admin": True}},
                False,
                id="dict_instead_of_array",
            ),
        ],
    )
    def test_type_confusion_from_jmespath(
        self, user_claims: dict[str, Any], should_grant_access: bool
    ) -> None:
        """
        SECURITY: Test that non-array types returned by JMESPath are handled safely.

        Malicious or misconfigured IDPs might return unexpected types. The normalization
        logic must handle these safely to prevent authorization bypass.
        """
        client = OAuth2Client(
            **_OAUTH2_CLIENT_DEFAULTS,
            groups_attribute_path="groups",
            allowed_groups=["admin"],
        )

        if should_grant_access:
            # Should not raise - string "admin" normalized to ["admin"]
            client.validate_access(user_claims)
        else:
            # Should deny - cannot normalize to matching groups
            with pytest.raises(PermissionError, match="Access denied"):
                client.validate_access(user_claims)

    def test_whitespace_requires_exact_match(self) -> None:
        """
        SECURITY: Whitespace is NOT trimmed - exact match required.

        This prevents potential confusion attacks where "  admin  " could be
        used to bypass "admin" restrictions. Trade-off: legitimate users with
        whitespace in group names from IDP will be denied.
        """
        client = OAuth2Client(
            **_OAUTH2_CLIENT_DEFAULTS,
            groups_attribute_path="groups",
            allowed_groups=["admin"],
        )

        # User group with leading/trailing whitespace should NOT match
        user_claims = {
            "sub": "user123",
            "email": "user@example.com",
            "groups": ["  admin  ", "user"],
        }

        with pytest.raises(PermissionError, match="Access denied"):
            client.validate_access(user_claims)

    @pytest.mark.parametrize(
        "malicious_group",
        [
            pytest.param("admin\x00", id="null_byte"),
            pytest.param("admin\n", id="newline"),
            pytest.param("admin\t", id="tab"),
            pytest.param("admin\r", id="carriage_return"),
            pytest.param("аdmin", id="cyrillic_lookalike"),  # Cyrillic 'а' U+0430
        ],
    )
    def test_special_characters_do_not_match(self, malicious_group: str) -> None:
        """
        SECURITY: Control characters and lookalike Unicode should NOT match ASCII group names.

        Prevents injection attacks and homograph attacks where visually similar
        characters could be used to bypass authorization.
        """
        client = OAuth2Client(
            **_OAUTH2_CLIENT_DEFAULTS,
            groups_attribute_path="groups",
            allowed_groups=["admin"],  # ASCII "admin"
        )

        user_claims = {
            "sub": "user123",
            "email": "user@example.com",
            "groups": [malicious_group],
        }

        # Should deny - exact byte-level match required
        with pytest.raises(PermissionError, match="Access denied"):
            client.validate_access(user_claims)

    def test_nested_arrays_are_skipped(self) -> None:
        """
        SECURITY: Nested arrays in JMESPath results are ignored (not flattened).

        Prevents exploitation via deeply nested structures that could cause
        unexpected behavior or DoS.
        """
        client = OAuth2Client(
            **_OAUTH2_CLIENT_DEFAULTS,
            groups_attribute_path="groups",
            allowed_groups=["admin"],
        )

        # Simulates JMESPath returning nested structure (rare but possible)
        # Since we can't easily make JMESPath return nested arrays, we test
        # that the normalization handles them correctly
        user_claims = {
            "sub": "user123",
            "email": "user@example.com",
            "groups": [["admin"], ["user"]],  # Nested arrays
        }

        # Should deny - nested arrays are skipped, results in empty user_groups
        with pytest.raises(PermissionError, match="Access denied"):
            client.validate_access(user_claims)

    def test_large_number_of_groups_handled(self) -> None:
        """
        SECURITY: Verify large number of groups doesn't cause DoS.

        While not a strict security test, ensures the implementation can handle
        realistic loads (e.g., enterprise users in many groups).
        """
        client = OAuth2Client(
            **_OAUTH2_CLIENT_DEFAULTS,
            groups_attribute_path="groups",
            allowed_groups=["admin"],
        )

        # Simulate user in 1000 groups (realistic for enterprise AD/LDAP)
        user_claims = {
            "sub": "user123",
            "email": "user@example.com",
            "groups": [f"group{i}" for i in range(1000)] + ["admin"],
        }

        # Should grant access - "admin" is in the list
        client.validate_access(user_claims)


class TestOAuth2ClientRoleMapping:
    """Test role mapping functionality."""

    def test_role_extraction_simple_path(self) -> None:
        """Test role extraction with simple JMESPath."""
        client = OAuth2Client(
            **_OAUTH2_CLIENT_DEFAULTS,
            role_attribute_path="role",
            role_mapping={"Owner": "ADMIN", "Developer": "MEMBER"},
        )

        claims = {"email": "user@example.com", "role": "Owner"}
        role = client.extract_and_map_role(claims)
        assert role == "ADMIN"

    def test_role_extraction_nested_path(self) -> None:
        """Test role extraction with nested JMESPath."""
        client = OAuth2Client(
            **_OAUTH2_CLIENT_DEFAULTS,
            role_attribute_path="user.organization.role",
            role_mapping={"admin": "ADMIN"},
        )

        claims = {
            "email": "user@example.com",
            "user": {"organization": {"role": "admin"}},
        }
        role = client.extract_and_map_role(claims)
        assert role == "ADMIN"

    def test_role_extraction_with_quoted_jmespath(self) -> None:
        """Test role extraction with quoted JMESPath (special characters)."""
        client = OAuth2Client(
            **_OAUTH2_CLIENT_DEFAULTS,
            role_attribute_path='"https://myapp.com/roles"',
            role_mapping={"SuperAdmin": "ADMIN"},
        )

        claims = {"email": "user@example.com", "https://myapp.com/roles": "SuperAdmin"}
        role = client.extract_and_map_role(claims)
        assert role == "ADMIN"

    def test_role_mapping_case_sensitive(self) -> None:
        """Test that IDP role keys are case-sensitive but Phoenix roles are normalized."""
        client = OAuth2Client(
            **_OAUTH2_CLIENT_DEFAULTS,
            role_attribute_path="role",
            role_mapping={"Owner": "ADMIN", "owner": "MEMBER"},  # Different IDP roles
        )

        # Exact match required for IDP role
        claims1 = {"email": "user@example.com", "role": "Owner"}
        assert client.extract_and_map_role(claims1) == "ADMIN"

        claims2 = {"email": "user@example.com", "role": "owner"}
        assert client.extract_and_map_role(claims2) == "MEMBER"

    def test_unmapped_role_defaults_to_viewer(self) -> None:
        """Test that unmapped role defaults to VIEWER in non-strict mode."""
        client = OAuth2Client(
            **_OAUTH2_CLIENT_DEFAULTS,
            role_attribute_path="role",
            role_mapping={"Owner": "ADMIN"},
            role_attribute_strict=False,
        )

        claims = {"email": "user@example.com", "role": "Guest"}
        role = client.extract_and_map_role(claims)
        assert role == "VIEWER"  # Default to least privilege

    def test_unmapped_role_raises_in_strict_mode(self) -> None:
        """Test that unmapped role raises PermissionError in strict mode."""
        client = OAuth2Client(
            **_OAUTH2_CLIENT_DEFAULTS,
            role_attribute_path="role",
            role_mapping={"Owner": "ADMIN"},
            role_attribute_strict=True,
        )

        claims = {"email": "user@example.com", "role": "Guest"}
        with pytest.raises(PermissionError, match="Role 'Guest' is not mapped"):
            client.extract_and_map_role(claims)

    def test_missing_role_claim_defaults_to_viewer(self) -> None:
        """Test that missing role claim defaults to VIEWER in non-strict mode."""
        client = OAuth2Client(
            **_OAUTH2_CLIENT_DEFAULTS,
            role_attribute_path="role",
            role_mapping={"Owner": "ADMIN"},
            role_attribute_strict=False,
        )

        claims = {"email": "user@example.com"}
        role = client.extract_and_map_role(claims)
        assert role == "VIEWER"

    def test_missing_role_claim_raises_in_strict_mode(self) -> None:
        """Test that missing role claim raises PermissionError in strict mode."""
        client = OAuth2Client(
            **_OAUTH2_CLIENT_DEFAULTS,
            role_attribute_path="role",
            role_mapping={"Owner": "ADMIN"},
            role_attribute_strict=True,
        )

        claims = {"email": "user@example.com"}
        with pytest.raises(PermissionError, match="Role claim not found"):
            client.extract_and_map_role(claims)

    def test_no_role_path_returns_none(self) -> None:
        """Test that no role path configured returns None (preserves existing roles)."""
        client = OAuth2Client(
            **_OAUTH2_CLIENT_DEFAULTS,
            role_attribute_path=None,
            role_mapping={},
        )

        claims = {"email": "user@example.com", "role": "Owner"}
        role = client.extract_and_map_role(claims)
        assert role is None  # None preserves existing user roles (backward compatibility)

    def test_system_role_defaults_to_viewer(self) -> None:
        """Test that SYSTEM role from IDP defaults to VIEWER (not mapped)."""
        client = OAuth2Client(
            **_OAUTH2_CLIENT_DEFAULTS,
            role_attribute_path="role",
            role_mapping={"SuperAdmin": "ADMIN"},  # SYSTEM not in mapping
        )

        # Even if IDP returns "SYSTEM", it should not be mapped
        claims = {"email": "user@example.com", "role": "SYSTEM"}
        role = client.extract_and_map_role(claims)
        assert role == "VIEWER"  # Not in mapping, defaults to VIEWER

    def test_complex_jmespath_with_conditional_logic(self) -> None:
        """Test complex JMESPath expression with logical operators to derive role from groups.

        This tests the pattern:
        contains(groups[*], 'admin') && 'ADMIN' || contains(groups[*], 'editor') && 'MEMBER' || 'VIEWER'

        The expression evaluates to a role string that can be used directly without ROLE_MAPPING.
        """
        client = OAuth2Client(
            **_OAUTH2_CLIENT_DEFAULTS,
            # Complex JMESPath expression that derives role from group membership
            role_attribute_path=(
                "contains(groups[*], 'admin') && 'ADMIN' || "
                "contains(groups[*], 'editor') && 'MEMBER' || 'VIEWER'"
            ),
            role_mapping={},  # No mapping needed - JMESPath returns Phoenix role directly
        )

        # User in admin group gets ADMIN role
        claims_admin = {"email": "admin@example.com", "groups": ["admin", "users"]}
        assert client.extract_and_map_role(claims_admin) == "ADMIN"

        # User in editor group (but not admin) gets MEMBER role
        claims_editor = {"email": "editor@example.com", "groups": ["editor", "users"]}
        assert client.extract_and_map_role(claims_editor) == "MEMBER"

        # User in neither group gets default VIEWER role
        claims_viewer = {"email": "viewer@example.com", "groups": ["users"]}
        assert client.extract_and_map_role(claims_viewer) == "VIEWER"

        # User with no groups gets default VIEWER role
        claims_no_groups = {"email": "viewer@example.com", "groups": []}
        assert client.extract_and_map_role(claims_no_groups) == "VIEWER"

    def test_jmespath_returning_system_is_rejected(self) -> None:
        """Test that JMESPath expression returning SYSTEM is rejected (security).

        This tests the critical security edge case where a misconfigured JMESPath
        expression returns "SYSTEM" - which should NEVER be assignable via OAuth.

        Pattern tested:
        contains(groups[*], 'system_admin') && 'SYSTEM' || 'VIEWER'

        Expected behavior:
        - Non-strict mode: Defaults to VIEWER (least privilege)
        - Strict mode: Raises PermissionError (deny access)
        """
        # Non-strict mode: SYSTEM → VIEWER (default to least privilege)
        client_non_strict = OAuth2Client(
            **_OAUTH2_CLIENT_DEFAULTS,
            role_attribute_path="contains(groups[*], 'system_admin') && 'SYSTEM' || 'VIEWER'",
            role_mapping={},
            role_attribute_strict=False,
        )

        # User in system_admin group - JMESPath evaluates to 'SYSTEM'
        claims_system = {"email": "admin@example.com", "groups": ["system_admin", "users"]}
        result = client_non_strict.extract_and_map_role(claims_system)
        assert result == "VIEWER", (
            f"SECURITY: JMESPath returning 'SYSTEM' should default to 'VIEWER' in non-strict mode, "
            f"got '{result}'"
        )

        # Strict mode: SYSTEM → PermissionError
        client_strict = OAuth2Client(
            **_OAUTH2_CLIENT_DEFAULTS,
            role_attribute_path="contains(groups[*], 'system_admin') && 'SYSTEM' || 'VIEWER'",
            role_mapping={},
            role_attribute_strict=True,
        )

        with pytest.raises(
            PermissionError,
            match="Access denied: Role 'SYSTEM' is not a valid Phoenix role.*Strict mode is enabled",
        ):
            client_strict.extract_and_map_role(claims_system)

        # Verify non-system users still work correctly
        claims_normal = {"email": "viewer@example.com", "groups": ["users"]}
        assert client_non_strict.extract_and_map_role(claims_normal) == "VIEWER"
        assert client_strict.extract_and_map_role(claims_normal) == "VIEWER"


class TestHasSufficientClaimsWithRoles:
    """Test has_sufficient_claims method with role mapping."""

    def test_sufficient_with_role_present_and_mapped(self) -> None:
        """Test that claims are sufficient when role is present and can be mapped."""
        client = OAuth2Client(
            **_OAUTH2_CLIENT_DEFAULTS,
            role_attribute_path="role",
            role_mapping={"Owner": "ADMIN"},
        )

        claims = {"sub": "user123", "email": "user@example.com", "role": "Owner"}
        assert client.has_sufficient_claims(claims) is True

    def test_sufficient_when_unmapped_role_in_non_strict_mode(self) -> None:
        """Test that claims are sufficient when role is unmapped in non-strict mode (defaults to VIEWER)."""
        client = OAuth2Client(
            **_OAUTH2_CLIENT_DEFAULTS,
            role_attribute_path="role",
            role_mapping={"Owner": "ADMIN"},
            role_attribute_strict=False,
        )

        claims = {"sub": "user123", "email": "user@example.com", "role": "Guest"}
        # Returns VIEWER in non-strict mode, so claims are sufficient
        assert client.has_sufficient_claims(claims) is True

    def test_sufficient_when_unmapped_role_in_strict_mode(self) -> None:
        """Test that claims are sufficient even when role is unmapped in strict mode.

        UserInfo won't help since the role is already present in ID token.
        Access will be denied later by extract_and_map_role() raising PermissionError.
        """
        client = OAuth2Client(
            **_OAUTH2_CLIENT_DEFAULTS,
            role_attribute_path="role",
            role_mapping={"Owner": "ADMIN"},
            role_attribute_strict=True,
        )

        claims = {"sub": "user123", "email": "user@example.com", "role": "Guest"}
        # Role exists (even if unmapped), so UserInfo won't help - don't fetch it
        assert client.has_sufficient_claims(claims) is True

    def test_insufficient_when_missing_role_in_non_strict_mode(self) -> None:
        """Test that claims are insufficient when role is missing in non-strict mode.

        UserInfo might contain a mappable role that upgrades from default VIEWER.
        """
        client = OAuth2Client(
            **_OAUTH2_CLIENT_DEFAULTS,
            role_attribute_path="role",
            role_mapping={"Owner": "ADMIN"},
            role_attribute_strict=False,
        )

        claims = {"sub": "user123", "email": "user@example.com"}  # No role
        # Need to check UserInfo - might have a role that maps to ADMIN/MEMBER
        assert client.has_sufficient_claims(claims) is False

    def test_insufficient_when_missing_role_in_strict_mode(self) -> None:
        """Test that claims are insufficient when role is missing in strict mode."""
        client = OAuth2Client(
            **_OAUTH2_CLIENT_DEFAULTS,
            role_attribute_path="role",
            role_mapping={"Owner": "ADMIN"},
            role_attribute_strict=True,
        )

        claims = {"sub": "user123", "email": "user@example.com"}  # No role
        # Returns None in strict mode, need to try userinfo
        assert client.has_sufficient_claims(claims) is False

    def test_sufficient_with_email_groups_and_roles(self) -> None:
        """Test that all claims (email, groups, roles) must be present when configured."""
        client = OAuth2Client(
            **_OAUTH2_CLIENT_DEFAULTS,
            groups_attribute_path="groups",
            allowed_groups=["users"],
            role_attribute_path="role",
            role_mapping={"Owner": "ADMIN"},
        )

        claims = {
            "sub": "user123",
            "email": "user@example.com",
            "groups": ["users"],
            "role": "Owner",
        }
        assert client.has_sufficient_claims(claims) is True

    def test_insufficient_when_role_missing_but_non_strict_even_with_groups(self) -> None:
        """Test that claims are insufficient when role is missing in non-strict mode.

        UserInfo might contain a mappable role that upgrades from default VIEWER.
        """
        client = OAuth2Client(
            **_OAUTH2_CLIENT_DEFAULTS,
            groups_attribute_path="groups",
            allowed_groups=["users"],
            role_attribute_path="role",
            role_mapping={"Owner": "ADMIN"},
            role_attribute_strict=False,
        )

        claims = {
            "sub": "user123",
            "email": "user@example.com",
            "groups": ["users"],
            # Missing role - might be in UserInfo
        }
        # Need to check UserInfo - might have a role that maps to ADMIN/MEMBER
        assert client.has_sufficient_claims(claims) is False

    def test_insufficient_when_role_missing_and_strict_even_with_groups(self) -> None:
        """Test that claims are insufficient when role is missing in strict mode even with groups."""
        client = OAuth2Client(
            **_OAUTH2_CLIENT_DEFAULTS,
            groups_attribute_path="groups",
            allowed_groups=["users"],
            role_attribute_path="role",
            role_mapping={"Owner": "ADMIN"},
            role_attribute_strict=True,
        )

        claims = {
            "sub": "user123",
            "email": "user@example.com",
            "groups": ["users"],
            # Missing role
        }
        assert client.has_sufficient_claims(claims) is False

    def test_sufficient_with_nested_role_path(self) -> None:
        """Test that claims are sufficient with nested role paths."""
        client = OAuth2Client(
            **_OAUTH2_CLIENT_DEFAULTS,
            role_attribute_path="user.permissions.role",
            role_mapping={"admin": "ADMIN"},
        )

        claims = {
            "sub": "user123",
            "email": "user@example.com",
            "user": {"permissions": {"role": "admin"}},
        }
        assert client.has_sufficient_claims(claims) is True


class TestOAuth2ClientRoleValidation:
    """Test role-based access validation in validate_access."""

    def test_access_granted_with_admin_role(self) -> None:
        """Test that access validation works with role mapping (doesn't throw)."""
        client = OAuth2Client(
            **_OAUTH2_CLIENT_DEFAULTS,
            role_attribute_path="role",
            role_mapping={"Owner": "ADMIN", "Developer": "MEMBER"},
        )

        claims = {"email": "user@example.com", "role": "Owner"}
        # Should not raise - role mapping is for assignment, not access control
        client.validate_access(claims)

    def test_access_granted_with_viewer_role(self) -> None:
        """Test that access validation works with VIEWER role."""
        client = OAuth2Client(
            **_OAUTH2_CLIENT_DEFAULTS,
            role_attribute_path="role",
            role_mapping={"Reader": "VIEWER"},
        )

        claims = {"email": "user@example.com", "role": "Reader"}
        # Should not raise
        client.validate_access(claims)

    def test_access_granted_with_unmapped_role(self) -> None:
        """Test that access validation succeeds even with unmapped role (defaults to VIEWER)."""
        client = OAuth2Client(
            **_OAUTH2_CLIENT_DEFAULTS,
            role_attribute_path="role",
            role_mapping={"Owner": "ADMIN"},
        )

        claims = {"email": "user@example.com", "role": "Guest"}
        # Should not raise - unmapped role will default to VIEWER
        client.validate_access(claims)

    def test_access_works_with_both_groups_and_roles(self) -> None:
        """Test that validate_access works with both groups and roles configured."""
        client = OAuth2Client(
            **_OAUTH2_CLIENT_DEFAULTS,
            groups_attribute_path="groups",
            allowed_groups=["users"],
            role_attribute_path="role",
            role_mapping={"Owner": "ADMIN"},
        )

        claims = {"email": "user@example.com", "groups": ["users"], "role": "Owner"}
        # Should not raise - both groups and roles are valid
        client.validate_access(claims)

    def test_access_denied_when_groups_invalid_even_with_valid_role(self) -> None:
        """Test that group validation happens before role extraction."""
        client = OAuth2Client(
            **_OAUTH2_CLIENT_DEFAULTS,
            groups_attribute_path="groups",
            allowed_groups=["admin"],
            role_attribute_path="role",
            role_mapping={"Owner": "ADMIN"},
        )

        claims = {"email": "user@example.com", "groups": ["guest"], "role": "Owner"}
        # Should raise - group validation fails even though role is valid
        with pytest.raises(PermissionError, match="Access denied"):
            client.validate_access(claims)
