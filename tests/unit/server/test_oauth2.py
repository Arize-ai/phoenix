"""Unit tests for OAuth2Client."""

from typing import Any

import pytest

from phoenix.config import OAuth2ClientConfig
from phoenix.server.oauth2 import OAuth2Client, OAuth2Clients

# Common test configuration constants
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
        )

        clients = OAuth2Clients()
        with pytest.raises(ValueError) as exc_info:
            clients.add_client(config)

        error_message = str(exc_info.value)
        assert "Invalid JMESPath expression" in error_message
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
        )

        clients = OAuth2Clients()
        clients.add_client(config)  # Should not raise


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
