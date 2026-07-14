from __future__ import annotations

from datetime import datetime, timedelta, timezone
from secrets import token_hex
from typing import Any, Optional

import pytest

from .._helpers import (
    _ADMIN,
    _MEMBER,
    _VIEWER,
    _ApiKey,
    _AppInfo,
    _GetUser,
    _httpx_client,
    _SecurityArtifact,
)


def _create(
    app: _AppInfo,
    auth: _SecurityArtifact,
    kind: str,
    *,
    name: Optional[str] = None,
    description: Optional[str] = None,
    expires_at: Optional[datetime] = None,
) -> Any:
    data: dict[str, Any] = {"name": name if name is not None else f"key-{token_hex(4)}"}
    if description is not None:
        data["description"] = description
    if expires_at is not None:
        data["expires_at"] = expires_at.isoformat()
    return _httpx_client(app, auth).post(f"v1/{kind}/api_keys", json={"data": data})


def _list(app: _AppInfo, auth: _SecurityArtifact, kind: str) -> Any:
    return _httpx_client(app, auth).get(f"v1/{kind}/api_keys")


def _delete(app: _AppInfo, auth: _SecurityArtifact, kind: str, api_key_id: str) -> Any:
    return _httpx_client(app, auth).delete(f"v1/{kind}/api_keys/{api_key_id}")


class TestUserApiKeys:
    def test_create_list_use_and_delete(self, _get_user: _GetUser, _app: _AppInfo) -> None:
        """The key is returned once on create, works as a bearer token, and dies on delete."""
        user = _get_user(_app, _MEMBER)
        name, description = f"key-{token_hex(4)}", "for onboarding"

        response = _create(_app, user, "user", name=name, description=description)
        assert response.status_code == 201
        created = response.json()["data"]
        assert created["name"] == name
        assert created["description"] == description
        key = created["key"]
        assert key

        # The key authenticates as the user who created it.
        viewer = _httpx_client(_app, _ApiKey(key, created["id"])).get("v1/user")
        viewer.raise_for_status()
        assert viewer.json()["data"]["email"] == user.email

        # The key itself is not recoverable from the listing endpoint.
        listed = _list(_app, user, "user").json()["data"]
        entry = next(k for k in listed if k["id"] == created["id"])
        assert entry["name"] == name
        assert entry["description"] == description
        assert "key" not in entry

        assert _delete(_app, user, "user", created["id"]).status_code == 204

        # The deleted key is gone from the listing and no longer authenticates.
        assert all(k["id"] != created["id"] for k in _list(_app, user, "user").json()["data"])
        assert _httpx_client(_app, _ApiKey(key, created["id"])).get("v1/user").status_code == 401

    def test_keys_are_scoped_to_their_owner(self, _get_user: _GetUser, _app: _AppInfo) -> None:
        """A user cannot see or delete another user's key, even as an admin."""
        owner = _get_user(_app, _MEMBER)
        other = _get_user(_app, _MEMBER)
        admin = _get_user(_app, _ADMIN)
        created = _create(_app, owner, "user").json()["data"]

        for stranger in (other, admin):
            assert all(
                k["id"] != created["id"] for k in _list(_app, stranger, "user").json()["data"]
            )
            # 404 rather than 403 so the endpoint cannot be used to probe for others' keys.
            assert _delete(_app, stranger, "user", created["id"]).status_code == 404

        # The key still works, i.e. the failed deletes were genuinely no-ops.
        assert _delete(_app, owner, "user", created["id"]).status_code == 204

    def test_viewers_cannot_create_keys(self, _get_user: _GetUser, _app: _AppInfo) -> None:
        # Viewers are blocked from all v1 write operations at the router level.
        assert _create(_app, _get_user(_app, _VIEWER), "user").status_code == 403

    @pytest.mark.parametrize(
        "data",
        [
            pytest.param({}, id="missing_name"),
            pytest.param({"name": "   "}, id="blank_name"),
            pytest.param(
                {
                    "name": "x",
                    "expires_at": (datetime.now(timezone.utc) - timedelta(days=1)).isoformat(),
                },
                id="expired_on_arrival",
            ),
        ],
    )
    def test_invalid_input_is_rejected(
        self, data: dict[str, Any], _get_user: _GetUser, _app: _AppInfo
    ) -> None:
        client = _httpx_client(_app, _get_user(_app, _MEMBER))
        assert client.post("v1/user/api_keys", json={"data": data}).status_code == 422


class TestSystemApiKeys:
    def test_admin_can_create_list_use_and_delete(
        self, _get_user: _GetUser, _app: _AppInfo
    ) -> None:
        admin = _get_user(_app, _ADMIN)
        name = f"key-{token_hex(4)}"

        response = _create(_app, admin, "system", name=name)
        assert response.status_code == 201
        created = response.json()["data"]
        key = created["key"]

        # A system key authenticates as the SYSTEM role. As with system keys minted through
        # GraphQL, that role is not `is_admin`, so the key grants ordinary (non-viewer)
        # access — enough to read and ingest, not enough to reach admin-only routes.
        client = _httpx_client(_app, _ApiKey(key, created["id"], "System"))
        assert client.get("v1/projects").status_code == 200
        assert client.get("v1/users").status_code == 403

        listed = _list(_app, admin, "system").json()["data"]
        entry = next(k for k in listed if k["id"] == created["id"])
        assert entry["name"] == name
        assert "key" not in entry

        # System keys belong to the system user, not to the admin who minted them.
        assert all(k["id"] != created["id"] for k in _list(_app, admin, "user").json()["data"])

        assert _delete(_app, admin, "system", created["id"]).status_code == 204
        assert all(k["id"] != created["id"] for k in _list(_app, admin, "system").json()["data"])

    @pytest.mark.parametrize("role", [_MEMBER, _VIEWER])
    def test_non_admins_are_denied(self, role: Any, _get_user: _GetUser, _app: _AppInfo) -> None:
        user = _get_user(_app, role)
        assert _list(_app, user, "system").status_code == 403
        assert _create(_app, user, "system").status_code == 403
        assert _delete(_app, user, "system", "fake-id").status_code == 403

    def test_personal_keys_are_not_reachable_as_system_keys(
        self, _get_user: _GetUser, _app: _AppInfo
    ) -> None:
        """The two resources share a table; deleting across them must not work."""
        admin = _get_user(_app, _ADMIN)
        personal = _create(_app, admin, "user").json()["data"]

        # The personal key's GlobalID is of the wrong node type for the system endpoint.
        assert _delete(_app, admin, "system", personal["id"]).status_code == 422
        assert any(k["id"] == personal["id"] for k in _list(_app, admin, "user").json()["data"])
        assert _delete(_app, admin, "user", personal["id"]).status_code == 204
