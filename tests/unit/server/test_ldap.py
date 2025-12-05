"""Unit tests for LDAP authentication module.

Tests security-critical functionality:
- Anonymous bind bypass prevention
- Empty credential rejection
- LDAP injection prevention
- Role mapping logic
- DN validation
"""

from unittest.mock import MagicMock, Mock, patch

import pytest
from ldap3.core.exceptions import LDAPException
from pytest import LogCaptureFixture

from phoenix.config import LDAPConfig
from phoenix.server.ldap import (
    LDAPAuthenticator,
    _get_attribute,
    _get_unique_id,
    _is_member_of,
    _validate_phoenix_role,
    canonicalize_dn,
)


class TestLDAPSecurityValidation:
    """Test security-critical input validation."""

    @pytest.fixture
    def config(self) -> LDAPConfig:
        """Minimal LDAP configuration for testing."""
        return LDAPConfig(
            host="ldap.example.com",
            port=389,
            use_tls=False,
            tls_mode="starttls",
            user_search_base="ou=users,dc=example,dc=com",
            user_search_filter="(uid=%s)",
            attr_email="mail",
            attr_display_name="displayName",
            attr_member_of="memberOf",
            group_role_mappings=(
                {"group_dn": "cn=admins,ou=groups,dc=example,dc=com", "role": "ADMIN"},
            ),
        )

    @pytest.fixture
    def authenticator(self, config: LDAPConfig) -> LDAPAuthenticator:
        """Create authenticator instance."""
        return LDAPAuthenticator(config)

    async def test_empty_username_rejected(self, authenticator: LDAPAuthenticator) -> None:
        """SECURITY: Empty username must be rejected to prevent anonymous bind bypass."""
        result = await authenticator.authenticate("", "password123")
        assert result is None

    async def test_whitespace_username_rejected(self, authenticator: LDAPAuthenticator) -> None:
        """SECURITY: Whitespace-only username must be rejected."""
        result = await authenticator.authenticate("   ", "password123")
        assert result is None

    async def test_empty_password_rejected(self, authenticator: LDAPAuthenticator) -> None:
        """SECURITY: Empty password must be rejected to prevent anonymous bind bypass.

        Many LDAP servers (including Active Directory) treat a bind with an empty
        password as an anonymous bind and return success, even with a valid DN.
        This would allow attackers to authenticate as any user.
        """
        result = await authenticator.authenticate("admin", "")
        assert result is None

    async def test_none_password_rejected(self, authenticator: LDAPAuthenticator) -> None:
        """SECURITY: None password must be rejected."""
        # Type ignore since we're testing runtime behavior
        result = await authenticator.authenticate("admin", None)  # type: ignore
        assert result is None


class TestRoleMapping:
    """Test role mapping logic."""

    @pytest.fixture
    def authenticator(self) -> LDAPAuthenticator:
        """Create authenticator with role mappings."""
        config = LDAPConfig(
            host="ldap.example.com",
            user_search_base="ou=users,dc=example,dc=com",
            user_search_filter="(uid=%s)",
            attr_email="mail",
            group_role_mappings=(
                {"group_dn": "cn=admins,ou=groups,dc=example,dc=com", "role": "ADMIN"},
                {"group_dn": "cn=members,ou=groups,dc=example,dc=com", "role": "MEMBER"},
                {"group_dn": "*", "role": "VIEWER"},  # Wildcard default
            ),
        )
        return LDAPAuthenticator(config)

    def test_admin_role_mapping(self, authenticator: LDAPAuthenticator) -> None:
        """Test admin group maps to ADMIN role."""
        groups = ["cn=admins,ou=groups,dc=example,dc=com"]
        role = authenticator.map_groups_to_role(groups)
        assert role == "ADMIN"

    def test_member_role_mapping(self, authenticator: LDAPAuthenticator) -> None:
        """Test member group maps to MEMBER role."""
        groups = ["cn=members,ou=groups,dc=example,dc=com"]
        role = authenticator.map_groups_to_role(groups)
        assert role == "MEMBER"

    def test_wildcard_role_mapping(self, authenticator: LDAPAuthenticator) -> None:
        """Test wildcard matches any user."""
        groups = ["cn=unknown,ou=groups,dc=example,dc=com"]
        role = authenticator.map_groups_to_role(groups)
        assert role == "VIEWER"

    def test_first_match_wins(self, authenticator: LDAPAuthenticator) -> None:
        """Test first matching group determines role (priority order)."""
        # User in both admin and member groups - admin should win
        groups = [
            "cn=admins,ou=groups,dc=example,dc=com",
            "cn=members,ou=groups,dc=example,dc=com",
        ]
        role = authenticator.map_groups_to_role(groups)
        assert role == "ADMIN"

    def test_case_insensitive_matching(self, authenticator: LDAPAuthenticator) -> None:
        """Test DN matching is case-insensitive per RFC 4514."""
        groups = ["CN=ADMINS,OU=GROUPS,DC=EXAMPLE,DC=COM"]  # Uppercase
        role = authenticator.map_groups_to_role(groups)
        assert role == "ADMIN"

    def test_dn_normalization_matching(self) -> None:
        """Group matching should handle spacing/order differences via canonicalization."""
        config = LDAPConfig(
            host="ldap.example.com",
            user_search_base="ou=users,dc=example,dc=com",
            user_search_filter="(uid=%s)",
            attr_email="mail",
            group_role_mappings=(
                {
                    "group_dn": "cn=Admins+email=admins@example.com,ou=Groups,dc=Example,dc=Com",
                    "role": "ADMIN",
                },
            ),
        )
        authenticator = LDAPAuthenticator(config)

        # Same group, different ordering/casing/spacing
        groups = ["EMAIL=admins@example.com+CN=ADMINS, OU=Groups , DC=example , DC=com"]
        role = authenticator.map_groups_to_role(groups)
        assert role == "ADMIN"

    def test_no_groups_no_wildcard(self) -> None:
        """Test user with no matching groups is denied when no wildcard."""
        config = LDAPConfig(
            host="ldap.example.com",
            user_search_base="ou=users,dc=example,dc=com",
            user_search_filter="(uid=%s)",
            attr_email="mail",
            group_role_mappings=(
                {"group_dn": "cn=admins,ou=groups,dc=example,dc=com", "role": "ADMIN"},
            ),
        )
        authenticator = LDAPAuthenticator(config)
        groups = ["cn=unknown,ou=groups,dc=example,dc=com"]
        role = authenticator.map_groups_to_role(groups)
        assert role is None

    def test_empty_groups_with_wildcard(self, authenticator: LDAPAuthenticator) -> None:
        """Test user with no groups still matches wildcard."""
        groups: list[str] = []
        role = authenticator.map_groups_to_role(groups)
        assert role == "VIEWER"


class TestRoleValidation:
    """Test role validation and normalization."""

    def test_valid_admin_role(self) -> None:
        """Test ADMIN role is valid."""
        assert _validate_phoenix_role("ADMIN") == "ADMIN"

    def test_valid_member_role(self) -> None:
        """Test MEMBER role is valid."""
        assert _validate_phoenix_role("MEMBER") == "MEMBER"

    def test_valid_viewer_role(self) -> None:
        """Test VIEWER role is valid."""
        assert _validate_phoenix_role("VIEWER") == "VIEWER"

    def test_lowercase_normalized(self) -> None:
        """Test lowercase roles are normalized to uppercase."""
        assert _validate_phoenix_role("admin") == "ADMIN"
        assert _validate_phoenix_role("member") == "MEMBER"
        assert _validate_phoenix_role("viewer") == "VIEWER"

    def test_mixed_case_normalized(self) -> None:
        """Test mixed case roles are normalized."""
        assert _validate_phoenix_role("Admin") == "ADMIN"
        assert _validate_phoenix_role("MeMbEr") == "MEMBER"

    def test_invalid_role_defaults_to_member(self) -> None:
        """Test invalid roles default to MEMBER (fail-safe)."""
        assert _validate_phoenix_role("SUPERUSER") == "MEMBER"
        assert _validate_phoenix_role("ROOT") == "MEMBER"


class TestExceptionSanitization:
    """Test exception messages don't leak sensitive information."""

    @pytest.fixture
    def config(self) -> LDAPConfig:
        """Create test config."""
        return LDAPConfig(
            host="ldap.example.com",
            user_search_base="ou=users,dc=example,dc=com",
            user_search_filter="(uid=%s)",
            attr_email="mail",
            group_role_mappings=(),
        )

    async def test_ldap_exception_not_leaked(
        self, config: LDAPConfig, caplog: LogCaptureFixture
    ) -> None:
        """SECURITY: LDAP exception details must not be logged."""
        authenticator = LDAPAuthenticator(config)

        with patch.object(authenticator, "_establish_connection") as mock_establish:
            mock_conn = MagicMock()
            mock_establish.return_value.__enter__ = Mock(return_value=mock_conn)
            mock_establish.return_value.__exit__ = Mock(return_value=None)

            # Simulate LDAP exception with sensitive info
            mock_conn.search.side_effect = LDAPException(
                "Connection to ldap://internal-ldap.corp.local:389 failed: "
                "Invalid credentials for cn=admin,dc=corp,dc=local"
            )

            result = await authenticator.authenticate("testuser", "password")

        assert result is None

        # Check logs don't contain the detailed exception message
        log_text = caplog.text
        assert "Invalid credentials for cn=admin" not in log_text
        assert "internal-ldap.corp.local" not in log_text
        # Should only contain error type
        assert "LDAPException" in log_text


class TestAttributeExtraction:
    """Test safe attribute extraction from LDAP entries."""

    def test_missing_attribute_returns_none(self) -> None:
        """Test missing attribute returns None (not exception)."""
        # Create entry with only specific attributes (not MagicMock which auto-generates)
        entry = type("Entry", (), {"mail": None})()

        result = _get_attribute(entry, "nonexistent")
        assert result is None

    def test_empty_attribute_returns_none(self) -> None:
        """Test empty attribute returns None."""
        entry = MagicMock()
        mock_attr = MagicMock()
        mock_attr.values = []
        entry.mail = mock_attr

        result = _get_attribute(entry, "mail")
        assert result is None

    def test_single_value_extraction(self) -> None:
        """Test extracting single attribute value."""
        entry = MagicMock()
        mock_attr = MagicMock()
        mock_attr.values = ["user@example.com"]
        entry.mail = mock_attr

        result = _get_attribute(entry, "mail")
        assert result == "user@example.com"

    def test_multiple_value_extraction(self) -> None:
        """Test extracting multiple attribute values."""
        entry = MagicMock()
        mock_attr = MagicMock()
        mock_attr.values = [
            "cn=admins,ou=groups,dc=example,dc=com",
            "cn=members,ou=groups,dc=example,dc=com",
        ]
        entry.memberOf = mock_attr

        result = _get_attribute(entry, "memberOf", multiple=True)
        assert result == [
            "cn=admins,ou=groups,dc=example,dc=com",
            "cn=members,ou=groups,dc=example,dc=com",
        ]


class TestUniqueIdExtraction:
    """Test unique identifier extraction from LDAP entries.

    Tests the _get_unique_id helper function which handles:
    - Active Directory objectGUID (binary, mixed-endian)
    - OpenLDAP entryUUID (string)
    - 389 DS nsUniqueId (string)
    """

    def test_missing_attribute_returns_none(self) -> None:
        """Test missing unique_id attribute returns None."""
        entry = type("Entry", (), {})()
        result = _get_unique_id(entry, "objectGUID")
        assert result is None

    def test_empty_attribute_returns_none(self) -> None:
        """Test empty raw_values returns None."""
        entry = MagicMock()
        mock_attr = MagicMock()
        mock_attr.raw_values = []
        entry.objectGUID = mock_attr

        result = _get_unique_id(entry, "objectGUID")
        assert result is None

    def test_string_uuid_as_bytes(self) -> None:
        """Test OpenLDAP entryUUID (string format stored as bytes).

        OpenLDAP stores entryUUID as a string like "550e8400-e29b-41d4-a716-446655440000".
        ldap3 returns this as bytes: b"550e8400-e29b-41d4-a716-446655440000" (36 bytes).
        This should be decoded as UTF-8, not treated as binary.
        """
        entry = MagicMock()
        mock_attr = MagicMock()
        # ldap3 always returns bytes - even for string UUIDs
        mock_attr.raw_values = [b"550e8400-e29b-41d4-a716-446655440000"]
        entry.entryUUID = mock_attr

        result = _get_unique_id(entry, "entryUUID")
        assert result == "550e8400-e29b-41d4-a716-446655440000"

    def test_uppercase_uuid_normalized_to_lowercase(self) -> None:
        """Test uppercase entryUUID is normalized to lowercase.

        UUIDs are case-insensitive per RFC 4122. We normalize to lowercase
        to ensure consistent database lookups. Existing DB entries with
        different casing will be updated via email fallback on next login.
        """
        entry = MagicMock()
        mock_attr = MagicMock()
        mock_attr.raw_values = [b"550E8400-E29B-41D4-A716-446655440000"]
        entry.entryUUID = mock_attr

        result = _get_unique_id(entry, "entryUUID")
        assert result == "550e8400-e29b-41d4-a716-446655440000"

    def test_whitespace_stripped_from_uuid(self) -> None:
        """Test whitespace is stripped from string UUIDs."""
        entry = MagicMock()
        mock_attr = MagicMock()
        mock_attr.raw_values = [b"  550e8400-e29b-41d4-a716-446655440000  "]
        entry.entryUUID = mock_attr

        result = _get_unique_id(entry, "entryUUID")
        assert result == "550e8400-e29b-41d4-a716-446655440000"

    def test_empty_bytes_returns_none(self) -> None:
        """Test empty bytes returns None, not empty string."""
        entry = MagicMock()
        mock_attr = MagicMock()
        mock_attr.raw_values = [b""]
        entry.entryUUID = mock_attr

        result = _get_unique_id(entry, "entryUUID")
        assert result is None

    def test_whitespace_only_returns_none(self) -> None:
        """Test whitespace-only value returns None after stripping."""
        entry = MagicMock()
        mock_attr = MagicMock()
        mock_attr.raw_values = [b"   "]
        entry.entryUUID = mock_attr

        result = _get_unique_id(entry, "entryUUID")
        assert result is None

    def test_binary_objectguid_conversion(self) -> None:
        """Test AD objectGUID binary to UUID string conversion (MS-DTYP §2.3.4).

        Active Directory stores objectGUID in mixed-endian format:
        - Data1 (4 bytes): little-endian
        - Data2 (2 bytes): little-endian
        - Data3 (2 bytes): little-endian
        - Data4 (8 bytes): big-endian

        Python's uuid.UUID(bytes_le=...) handles this correctly.
        """
        entry = MagicMock()
        mock_attr = MagicMock()
        # Known test case from Microsoft documentation
        # UUID: 2212e4c7-051e-4d0c-9a5b-12770a9bb7ab
        # Binary (little-endian for first 3 components):
        binary_guid = bytes(
            [
                0xC7,
                0xE4,
                0x12,
                0x22,  # Data1: 2212e4c7 reversed
                0x1E,
                0x05,  # Data2: 051e reversed
                0x0C,
                0x4D,  # Data3: 4d0c reversed
                0x9A,
                0x5B,
                0x12,
                0x77,
                0x0A,
                0x9B,
                0xB7,
                0xAB,  # Data4: as-is
            ]
        )
        mock_attr.raw_values = [binary_guid]
        entry.objectGUID = mock_attr

        result = _get_unique_id(entry, "objectGUID")
        assert result == "2212e4c7-051e-4d0c-9a5b-12770a9bb7ab"

    def test_bytearray_objectguid_conversion(self) -> None:
        """Test AD objectGUID as bytearray for defensive coding.

        Note: ldap3 always returns bytes (see ldap3/operation/search.py decode_raw_vals),
        but we test bytearray to ensure robustness if this ever changes.
        """
        entry = MagicMock()
        mock_attr = MagicMock()
        # Same GUID as above, but as bytearray
        binary_guid = bytearray(
            [
                0xC7,
                0xE4,
                0x12,
                0x22,  # Data1
                0x1E,
                0x05,  # Data2
                0x0C,
                0x4D,  # Data3
                0x9A,
                0x5B,
                0x12,
                0x77,
                0x0A,
                0x9B,
                0xB7,
                0xAB,  # Data4
            ]
        )
        mock_attr.raw_values = [binary_guid]
        entry.objectGUID = mock_attr

        result = _get_unique_id(entry, "objectGUID")
        assert result == "2212e4c7-051e-4d0c-9a5b-12770a9bb7ab"

    def test_binary_non_utf8_hex_encoded(self) -> None:
        """Test non-UTF-8 binary format falls back to hex encoding.

        If the value is not 16 bytes (binary UUID) and not valid UTF-8 (string UUID),
        it's hex-encoded as a safe fallback.
        """
        entry = MagicMock()
        mock_attr = MagicMock()
        # Invalid UTF-8 byte sequence (0x80-0xBF are continuation bytes, invalid as start)
        mock_attr.raw_values = [b"\x80\x81\x82\x83\x84"]
        entry.customId = mock_attr

        result = _get_unique_id(entry, "customId")
        assert result == "8081828384"

    def test_attribute_without_raw_values(self) -> None:
        """Test attribute object without raw_values property returns None."""
        entry = MagicMock()
        mock_attr = MagicMock(spec=[])  # No raw_values attribute
        entry.objectGUID = mock_attr

        result = _get_unique_id(entry, "objectGUID")
        assert result is None


class TestGroupMembershipCheck:
    """Test _is_member_of helper function."""

    def test_wildcard_matches_all(self) -> None:
        """Test wildcard '*' matches any user."""
        user_groups: set[str] = set()
        assert _is_member_of(user_groups, "*") is True

        user_groups = {"cn=admins,ou=groups,dc=example,dc=com"}
        assert _is_member_of(user_groups, "*") is True

    def test_exact_match(self) -> None:
        """Test exact DN match."""
        user_groups = {canonicalize_dn("cn=admins,ou=groups,dc=example,dc=com")}
        assert _is_member_of(user_groups, "cn=admins,ou=groups,dc=example,dc=com") is True

    def test_case_insensitive_match(self) -> None:
        """Test DN matching is case-insensitive per RFC 4514."""
        user_groups = {canonicalize_dn("cn=admins,ou=groups,dc=example,dc=com")}
        # Different casing in target
        assert _is_member_of(user_groups, "CN=ADMINS,OU=GROUPS,DC=EXAMPLE,DC=COM") is True

    def test_no_match(self) -> None:
        """Test non-matching group returns False."""
        user_groups = {canonicalize_dn("cn=members,ou=groups,dc=example,dc=com")}
        assert _is_member_of(user_groups, "cn=admins,ou=groups,dc=example,dc=com") is False

    def test_empty_user_groups_no_wildcard(self) -> None:
        """Test empty user groups with non-wildcard target returns False."""
        user_groups: set[str] = set()
        assert _is_member_of(user_groups, "cn=admins,ou=groups,dc=example,dc=com") is False

    def test_whitespace_normalization(self) -> None:
        """Test DN whitespace is normalized for matching."""
        user_groups = {canonicalize_dn("cn=admins,ou=groups,dc=example,dc=com")}
        # Target with extra whitespace
        assert (
            _is_member_of(user_groups, "cn = admins , ou = groups , dc = example , dc = com")
            is True
        )


class TestTLSConfiguration:
    """Test TLS mode configuration."""

    def test_ldaps_mode_sets_use_ssl(self) -> None:
        """Test LDAPS mode enables use_ssl on Server."""
        config = LDAPConfig(
            host="ldap.example.com",
            port=636,
            use_tls=True,
            tls_mode="ldaps",
            user_search_base="ou=users,dc=example,dc=com",
            user_search_filter="(uid=%s)",
            attr_email="mail",
            group_role_mappings=(),
        )
        authenticator = LDAPAuthenticator(config)

        # Check server configuration
        server = authenticator.servers[0]
        assert server.ssl is True  # use_ssl=True for LDAPS

    def test_starttls_mode_no_use_ssl(self) -> None:
        """Test STARTTLS mode does NOT enable use_ssl."""
        config = LDAPConfig(
            host="ldap.example.com",
            port=389,
            use_tls=True,
            tls_mode="starttls",
            user_search_base="ou=users,dc=example,dc=com",
            user_search_filter="(uid=%s)",
            attr_email="mail",
            group_role_mappings=(),
        )
        authenticator = LDAPAuthenticator(config)

        # Check server configuration
        server = authenticator.servers[0]
        assert server.ssl is False  # use_ssl=False for STARTTLS

    def test_plaintext_mode_no_tls_config(self) -> None:
        """Test plaintext mode has no TLS configuration."""
        config = LDAPConfig(
            host="ldap.example.com",
            port=389,
            use_tls=False,
            tls_mode="starttls",  # Irrelevant when use_tls=False
            user_search_base="ou=users,dc=example,dc=com",
            user_search_filter="(uid=%s)",
            attr_email="mail",
            group_role_mappings=(),
        )
        authenticator = LDAPAuthenticator(config)

        # Check server configuration
        server = authenticator.servers[0]
        assert server.ssl is False
        assert server.tls is None


class TestMultiServerFailover:
    """Test failover behavior with multiple LDAP servers."""

    def test_multiple_servers_created(self) -> None:
        """Test multiple servers are created from comma-separated hosts."""
        config = LDAPConfig(
            host="ldap1.example.com,ldap2.example.com,ldap3.example.com",
            user_search_base="ou=users,dc=example,dc=com",
            user_search_filter="(uid=%s)",
            attr_email="mail",
            group_role_mappings=(),
        )
        authenticator = LDAPAuthenticator(config)

        assert len(authenticator.servers) == 3
        assert authenticator.servers[0].host == "ldap1.example.com"
        assert authenticator.servers[1].host == "ldap2.example.com"
        assert authenticator.servers[2].host == "ldap3.example.com"

    def test_whitespace_stripped_from_hosts(self) -> None:
        """Test whitespace is stripped from host entries."""
        config = LDAPConfig(
            host="ldap1.example.com , ldap2.example.com  ,  ldap3.example.com",
            user_search_base="ou=users,dc=example,dc=com",
            user_search_filter="(uid=%s)",
            attr_email="mail",
            group_role_mappings=(),
        )
        authenticator = LDAPAuthenticator(config)

        assert len(authenticator.servers) == 3
        assert all(not server.host.startswith(" ") for server in authenticator.servers)
        assert all(not server.host.endswith(" ") for server in authenticator.servers)


class TestDNCanonicalization:
    """Test RFC 4514-compliant DN canonicalization."""

    def test_case_normalization(self) -> None:
        """DNs are case-insensitive per RFC 4514."""
        dn1 = "cn=John,ou=Users,dc=Example,dc=com"
        dn2 = "CN=john,OU=users,DC=example,DC=com"
        dn3 = "Cn=JOHN,Ou=USERS,Dc=EXAMPLE,Dc=COM"

        canonical1 = canonicalize_dn(dn1)
        canonical2 = canonicalize_dn(dn2)
        canonical3 = canonicalize_dn(dn3)

        # All variations should map to same canonical form
        assert canonical1 == canonical2 == canonical3
        # Should be fully lowercase
        assert canonical1 == "cn=john,ou=users,dc=example,dc=com"

    def test_whitespace_normalization(self) -> None:
        """Whitespace around = and , should be stripped."""
        dn_compact = "cn=John,ou=Users,dc=Example,dc=com"
        dn_spaces = "cn = John , ou = Users , dc = Example , dc = com"
        dn_mixed_spaces = "cn= John  ,ou =Users,dc=Example, dc=com"

        canonical_compact = canonicalize_dn(dn_compact)
        canonical_spaces = canonicalize_dn(dn_spaces)
        canonical_mixed = canonicalize_dn(dn_mixed_spaces)

        # All should normalize to same form
        assert canonical_compact == canonical_spaces == canonical_mixed
        assert canonical_compact == "cn=john,ou=users,dc=example,dc=com"

    def test_multi_valued_rdn_ordering(self) -> None:
        """Multi-valued RDN components should be sorted alphabetically.

        RFC 4514 allows multi-valued RDNs (e.g., cn=John+email=john@corp.com).
        Different LDAP servers may return components in different orders,
        so we sort them for deterministic comparison.
        """
        # Same RDN, different component ordering
        dn1 = "cn=John Smith+email=john@corp.com,ou=Users,dc=Example,dc=com"
        dn2 = "email=john@corp.com+cn=John Smith,ou=Users,dc=Example,dc=com"

        canonical1 = canonicalize_dn(dn1)
        canonical2 = canonicalize_dn(dn2)

        # Should normalize to same form with sorted attributes (cn before email)
        assert canonical1 == canonical2
        assert canonical1 == "cn=john smith+email=john@corp.com,ou=users,dc=example,dc=com"

    def test_multi_valued_rdn_three_components(self) -> None:
        """Multi-valued RDN with 3+ components should be sorted."""
        dn1 = "cn=John+sn=Smith+uid=jsmith,ou=Users,dc=Example,dc=com"
        dn2 = "uid=jsmith+cn=John+sn=Smith,ou=Users,dc=Example,dc=com"
        dn3 = "sn=Smith+uid=jsmith+cn=John,ou=Users,dc=Example,dc=com"

        canonical1 = canonicalize_dn(dn1)
        canonical2 = canonicalize_dn(dn2)
        canonical3 = canonicalize_dn(dn3)

        # All should normalize to alphabetically sorted form: cn, sn, uid
        assert canonical1 == canonical2 == canonical3
        assert canonical1 == "cn=john+sn=smith+uid=jsmith,ou=users,dc=example,dc=com"

    def test_escaped_characters_preserved(self) -> None:
        """Escaped special characters should be preserved."""
        # DN with escaped comma in CN
        dn = "cn=Smith\\, John,ou=Users,dc=Example,dc=com"
        canonical = canonicalize_dn(dn)

        # Escaped comma should be preserved (but lowercased)
        assert canonical == "cn=smith\\, john,ou=users,dc=example,dc=com"

    def test_multiple_escaped_characters(self) -> None:
        """Multiple types of escaped characters."""
        dn = "cn=user\\+name\\,test,ou=us\\=ers,dc=br\\\\anch,dc=com"
        canonical = canonicalize_dn(dn)

        # All escapes should be preserved
        assert "\\+" in canonical
        assert "\\," in canonical
        assert "\\=" in canonical
        assert "\\\\" in canonical

    def test_empty_dn(self) -> None:
        """Empty DN (root DSE) should be handled gracefully."""
        canonical = canonicalize_dn("")
        assert canonical == ""

    def test_single_rdn(self) -> None:
        """Single RDN without domain components."""
        dn = "cn=John"
        canonical = canonicalize_dn(dn)
        assert canonical == "cn=john"

    def test_real_world_active_directory_dn(self) -> None:
        """Typical Active Directory DN format."""
        dn = "CN=John Smith,OU=Engineering,OU=Employees,DC=corp,DC=example,DC=com"
        canonical = canonicalize_dn(dn)
        assert canonical == "cn=john smith,ou=engineering,ou=employees,dc=corp,dc=example,dc=com"

    def test_posix_ldap_dn(self) -> None:
        """Typical POSIX LDAP DN format with uid."""
        dn = "uid=jsmith,ou=people,dc=example,dc=com"
        canonical = canonicalize_dn(dn)
        assert canonical == "uid=jsmith,ou=people,dc=example,dc=com"

    def test_email_in_dn(self) -> None:
        """DN containing email address."""
        dn = "email=john.smith@corp.com,ou=users,dc=example,dc=com"
        canonical = canonicalize_dn(dn)
        # Email should be lowercased
        assert canonical == "email=john.smith@corp.com,ou=users,dc=example,dc=com"

    def test_special_characters_in_value(self) -> None:
        """Values with spaces, hyphens, dots should be preserved."""
        dn = "cn=John Q. Smith-Johnson,ou=IT Dept,dc=example,dc=com"
        canonical = canonicalize_dn(dn)
        assert canonical == "cn=john q. smith-johnson,ou=it dept,dc=example,dc=com"

    def test_unicode_dn(self) -> None:
        """DN with non-ASCII characters."""
        dn = "cn=José García,ou=Users,dc=example,dc=com"
        canonical = canonicalize_dn(dn)
        # Unicode should be lowercased
        assert canonical == "cn=josé garcía,ou=users,dc=example,dc=com"

    def test_idempotency(self) -> None:
        """Canonicalizing a canonical DN should be idempotent."""
        dn = "CN=John,OU=Users,DC=Example,DC=com"
        canonical1 = canonicalize_dn(dn)
        canonical2 = canonicalize_dn(canonical1)
        canonical3 = canonicalize_dn(canonical2)

        assert canonical1 == canonical2 == canonical3

    def test_invalid_dn_fallback(self) -> None:
        """Invalid DN syntax should fall back to simple lowercase."""
        invalid_dn = "not_a_valid_dn"
        canonical = canonicalize_dn(invalid_dn)
        # Should fallback to lowercase
        assert canonical == "not_a_valid_dn"

    def test_duplicate_prevention_scenario(self) -> None:
        """Real-world scenario: Same user, different DN formatting from AD."""
        # First login: standard format
        dn1 = "CN=John Smith,OU=Engineering,DC=corp,DC=example,DC=com"
        # Second login: different casing from replica DC
        dn2 = "cn=john smith,ou=engineering,dc=corp,dc=example,dc=com"
        # Third login: extra whitespace
        dn3 = "CN = John Smith , OU = Engineering , DC = corp , DC = example , DC = com"

        canonical1 = canonicalize_dn(dn1)
        canonical2 = canonicalize_dn(dn2)
        canonical3 = canonicalize_dn(dn3)

        # All should map to same canonical form → same database row
        assert canonical1 == canonical2 == canonical3


class TestSocketLeakPrevention:
    """Test that LDAP connections are properly closed to prevent file descriptor leaks."""

    @pytest.fixture
    def config(self) -> LDAPConfig:
        """Minimal LDAP configuration for testing."""
        return LDAPConfig(
            host="ldap.example.com",
            port=389,
            use_tls=True,
            tls_mode="starttls",
            user_search_base="ou=users,dc=example,dc=com",
            user_search_filter="(uid=%s)",
            attr_email="mail",
            attr_display_name="displayName",
            attr_member_of="memberOf",
            group_role_mappings=(
                {"group_dn": "cn=admins,ou=groups,dc=example,dc=com", "role": "ADMIN"},
            ),
        )

    @pytest.fixture
    def authenticator(self, config: LDAPConfig) -> LDAPAuthenticator:
        """Create authenticator instance."""
        return LDAPAuthenticator(config)

    def test_verify_user_password_closes_socket_on_bind_failure(
        self, authenticator: LDAPAuthenticator
    ) -> None:
        """Socket must be closed even when bind() fails (wrong password)."""
        mock_server = MagicMock()
        mock_conn = MagicMock()
        mock_conn.bound = False  # Simulate bind failure
        mock_conn.open = MagicMock()
        mock_conn.start_tls = MagicMock()
        mock_conn.bind = MagicMock()
        mock_conn.unbind = MagicMock()

        with patch("phoenix.server.ldap.Connection", return_value=mock_conn):
            result = authenticator._verify_user_password(
                mock_server, "uid=test,dc=example,dc=com", "wrong_password"
            )

        # Verify bind was attempted
        assert not result
        mock_conn.bind.assert_called_once()

        # CRITICAL: Socket must be closed to prevent FD leak (via unbind)
        mock_conn.unbind.assert_called_once()

    def test_verify_user_password_closes_socket_on_start_tls_failure(
        self, authenticator: LDAPAuthenticator
    ) -> None:
        """Socket must be closed when start_tls() raises."""
        mock_server = MagicMock()
        mock_conn = MagicMock()
        mock_conn.bound = False
        mock_conn.open = MagicMock()
        mock_conn.start_tls = MagicMock(side_effect=LDAPException("TLS handshake failed"))
        mock_conn.unbind = MagicMock()

        with patch("phoenix.server.ldap.Connection", return_value=mock_conn):
            with pytest.raises(LDAPException):
                authenticator._verify_user_password(
                    mock_server, "uid=test,dc=example,dc=com", "password123"
                )

        # CRITICAL: Socket must be closed even though start_tls() raised (via unbind)
        mock_conn.unbind.assert_called_once()

    def test_verify_user_password_closes_socket_on_open_failure(
        self, authenticator: LDAPAuthenticator
    ) -> None:
        """Socket must be closed when open() raises."""
        mock_server = MagicMock()
        mock_conn = MagicMock()
        mock_conn.bound = False
        mock_conn.open = MagicMock(side_effect=LDAPException("Connection refused"))
        mock_conn.unbind = MagicMock()

        with patch("phoenix.server.ldap.Connection", return_value=mock_conn):
            with pytest.raises(LDAPException):
                authenticator._verify_user_password(
                    mock_server, "uid=test,dc=example,dc=com", "password123"
                )

        # CRITICAL: Socket must be closed even though open() raised (via unbind)
        mock_conn.unbind.assert_called_once()

    def test_establish_connection_closes_socket_on_anonymous_bind_failure(
        self, authenticator: LDAPAuthenticator
    ) -> None:
        """Anonymous bind must close socket when start_tls() fails."""
        # Remove bind credentials to force anonymous bind path
        authenticator.config = LDAPConfig(
            host="ldap.example.com",
            port=389,
            use_tls=True,
            tls_mode="starttls",
            user_search_base="ou=users,dc=example,dc=com",
            user_search_filter="(uid=%s)",
            attr_email="mail",
            attr_display_name="displayName",
            attr_member_of="memberOf",
            group_role_mappings=(
                {"group_dn": "cn=admins,ou=groups,dc=example,dc=com", "role": "ADMIN"},
            ),
        )

        mock_server = MagicMock()
        mock_conn = MagicMock()
        mock_conn.open = MagicMock()
        mock_conn.start_tls = MagicMock(side_effect=LDAPException("TLS handshake failed"))
        mock_conn.unbind = MagicMock()

        with patch("phoenix.server.ldap.Connection", return_value=mock_conn):
            with pytest.raises(LDAPException):
                authenticator._establish_connection(mock_server)

        # CRITICAL: Socket must be closed when start_tls() fails (via unbind)
        mock_conn.unbind.assert_called_once()
