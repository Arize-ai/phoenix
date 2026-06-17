from dataclasses import replace
from datetime import datetime, timedelta, timezone

import pytest

from phoenix.server.access import (
    BUILTIN_ROLE_PERMISSIONS,
    Permission,
    can,
    permissions_for_role,
)
from phoenix.server.bearer_auth import PhoenixSystemUser, PhoenixUser
from phoenix.server.types import ApiKeyAttributes, ApiKeyClaims, ApiKeyId, UserId


class TestOracle:
    @pytest.mark.parametrize(
        "role, permission, expected",
        [
            ("SYSTEM", Permission.ADMINISTER, True),
            ("ADMIN", Permission.ADMINISTER, True),
            ("ADMIN", Permission.WRITE, True),
            ("ADMIN", Permission.READ, True),
            ("MEMBER", Permission.READ, True),
            ("MEMBER", Permission.WRITE, True),
            ("MEMBER", Permission.ADMINISTER, False),
            ("VIEWER", Permission.READ, True),
            ("VIEWER", Permission.WRITE, False),
            ("VIEWER", Permission.ADMINISTER, False),
        ],
    )
    def test_can(self, role: str, permission: Permission, expected: bool) -> None:
        assert can(role, permission) is expected

    def test_unknown_role_holds_nothing(self) -> None:
        # The oracle fails closed for an unrecognized role.
        assert permissions_for_role("AUDITOR") == frozenset()
        assert can("AUDITOR", Permission.READ) is False

    def test_every_role_can_read(self) -> None:
        for role, permissions in BUILTIN_ROLE_PERMISSIONS.items():
            assert Permission.READ in permissions, role

    def test_only_viewer_lacks_write(self) -> None:
        lacks_write = {
            role
            for role, perms in BUILTIN_ROLE_PERMISSIONS.items()
            if Permission.WRITE not in perms
        }
        assert lacks_write == {"VIEWER"}

    def test_administer_is_system_and_admin_only(self) -> None:
        administers = {
            role
            for role, perms in BUILTIN_ROLE_PERMISSIONS.items()
            if Permission.ADMINISTER in perms
        }
        assert administers == {"SYSTEM", "ADMIN"}


def _api_key_user(role: str, expired: bool = False) -> PhoenixUser:
    # A claim set is VALID when it has a subject + token_id and is unexpired;
    # an expiration in the past makes it EXPIRED (status is derived, not set).
    expiration = (
        datetime.now(timezone.utc) - timedelta(hours=1)
        if expired
        else datetime.now(timezone.utc) + timedelta(hours=1)
    )
    claims = ApiKeyClaims(
        subject=UserId(1),
        token_id=ApiKeyId(1),
        expiration_time=expiration,
        attributes=ApiKeyAttributes(user_role=role, name="k"),  # type: ignore[arg-type]
    )
    return PhoenixUser(UserId(1), claims)


class TestPhoenixUserResolvesThroughOracle:
    @pytest.mark.parametrize(
        "role, is_admin, is_viewer, can_write",
        [
            ("ADMIN", True, False, True),
            ("MEMBER", False, False, True),
            ("VIEWER", False, True, False),
        ],
    )
    def test_role_properties(
        self, role: str, is_admin: bool, is_viewer: bool, can_write: bool
    ) -> None:
        user = _api_key_user(role)
        assert user.is_admin is is_admin
        assert user.is_viewer is is_viewer
        assert user.can(Permission.WRITE) is can_write

    def test_invalid_claim_holds_no_permissions(self) -> None:
        # An invalid claim set resolves to no permissions, and — preserving prior
        # behavior — is treated as neither admin nor viewer.
        user = _api_key_user("ADMIN", expired=True)
        assert user.permissions == frozenset()
        assert user.is_admin is False
        assert user.is_viewer is False

    def test_system_user_holds_everything(self) -> None:
        system = PhoenixSystemUser(UserId(1))
        assert system.is_admin is True
        assert system.is_viewer is False
        assert system.can(Permission.ADMINISTER) is True
        assert system.can(Permission.WRITE) is True

    def test_claim_status_does_not_widen(self) -> None:
        valid = _api_key_user("VIEWER")
        # A viewer never gains write, however the claim is read.
        assert not valid.can(Permission.WRITE)
        attributes = valid.claims.attributes
        assert attributes is not None
        elevated = replace(valid.claims, attributes=replace(attributes, user_role="ADMIN"))
        assert PhoenixUser(UserId(1), elevated).can(Permission.WRITE)
