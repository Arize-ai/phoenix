from __future__ import annotations

from datetime import datetime, timedelta, timezone
from secrets import token_hex
from typing import Any, Optional

import pytest
from strawberry.relay import GlobalID

from phoenix.server.api.input_types.UserRoleInput import UserRoleInput

from .._helpers import (
    _ADMIN,
    _DEFAULT_ADMIN,
    _DENIED,
    _MEMBER,
    _OK,
    _OK_OR_DENIED,
    _VIEWER,
    _ApiKey,
    _AppInfo,
    _create_api_key,
    _delete_api_key,
    _delete_users,
    _GetUser,
    _gql,
    _httpx_client,
    _RoleOrUser,
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


class TestGraphQLApiKeys:
    @pytest.mark.parametrize("role_or_user", [_VIEWER, _MEMBER, _ADMIN, _DEFAULT_ADMIN])
    def test_create_and_delete_own_user_key(
        self,
        role_or_user: _RoleOrUser,
        _get_user: _GetUser,
        _app: _AppInfo,
    ) -> None:
        user = _get_user(_app, role_or_user).log_in(_app)
        api_key = user.create_api_key(_app)
        user.delete_api_key(_app, api_key)

    @pytest.mark.parametrize(
        "role_or_user,expectation",
        [
            (_VIEWER, _DENIED),
            (_MEMBER, _DENIED),
            (_ADMIN, _OK),
            (_DEFAULT_ADMIN, _OK),
        ],
    )
    def test_only_admin_can_create_system_key(
        self,
        role_or_user: _RoleOrUser,
        expectation: _OK_OR_DENIED,
        _get_user: _GetUser,
        _app: _AppInfo,
    ) -> None:
        user = _get_user(_app, role_or_user).log_in(_app)
        with expectation:
            user.create_api_key(_app, "System")

    @pytest.mark.parametrize(
        "role_or_user,expectation",
        [
            (_VIEWER, pytest.raises(RuntimeError, match="API key not found")),
            (_MEMBER, pytest.raises(RuntimeError, match="API key not found")),
            (_ADMIN, _OK),
            (_DEFAULT_ADMIN, _OK),
        ],
    )
    @pytest.mark.parametrize("owner_role", [_MEMBER, _ADMIN])
    def test_only_admin_can_delete_another_users_key(
        self,
        role_or_user: _RoleOrUser,
        owner_role: UserRoleInput,
        expectation: _OK_OR_DENIED,
        _get_user: _GetUser,
        _app: _AppInfo,
    ) -> None:
        user = _get_user(_app, role_or_user).log_in(_app)
        owner = _get_user(_app, owner_role).log_in(_app)
        assert owner.gid != user.gid
        api_key = owner.create_api_key(_app)
        with expectation:
            user.delete_api_key(_app, api_key)

    @pytest.mark.parametrize(
        "role_or_user,expectation",
        [
            (_VIEWER, _DENIED),
            (_MEMBER, _DENIED),
            (_ADMIN, _OK),
            (_DEFAULT_ADMIN, _OK),
        ],
    )
    def test_only_admin_can_delete_system_key(
        self,
        role_or_user: _RoleOrUser,
        expectation: _OK_OR_DENIED,
        _get_user: _GetUser,
        _app: _AppInfo,
    ) -> None:
        user = _get_user(_app, role_or_user).log_in(_app)
        api_key = _DEFAULT_ADMIN.create_api_key(_app, "System")
        with expectation:
            user.delete_api_key(_app, api_key)

    @pytest.mark.parametrize("role", [_VIEWER, _MEMBER, _ADMIN])
    def test_user_api_keys_cannot_issue_user_keys(
        self,
        role: UserRoleInput,
        _get_user: _GetUser,
        _app: _AppInfo,
    ) -> None:
        """A user API key is a delegated credential and cannot mint a replacement."""
        user = _get_user(_app, role).log_in(_app)
        existing_key = user.create_api_key(_app)
        response, _ = _gql(
            _app,
            existing_key,
            query='mutation { createUserApiKey(input: {name: "forbidden"}) { jwt } }',
            raise_on_errors=False,
        )
        assert response["data"] is None
        assert response["errors"][0]["message"] == "API keys cannot create API keys"

    def test_api_keys_cannot_issue_system_keys(
        self,
        _get_user: _GetUser,
        _app: _AppInfo,
    ) -> None:
        admin = _get_user(_app, _ADMIN).log_in(_app)
        query = 'mutation { createSystemApiKey(input: {name: "forbidden"}) { jwt } }'

        # An ADMIN-role user key passes the admin gate but is rejected by credential kind.
        user_key = admin.create_api_key(_app)
        response, _ = _gql(_app, user_key, query=query, raise_on_errors=False)
        assert response["data"] is None
        assert response["errors"][0]["message"] == "API keys cannot create API keys"

        # A SYSTEM key is not an admin, so the admin gate rejects it first.
        system_key = admin.create_api_key(_app, "System")
        response, _ = _gql(_app, system_key, query=query, raise_on_errors=False)
        assert response["data"] is None
        assert response["errors"]

    def test_admin_secret_can_issue_system_keys_but_not_user_keys(self, _app: _AppInfo) -> None:
        """The admin secret is an issuance origin for system keys only."""
        api_key = _create_api_key(_app, _app.admin_secret, "System")
        _delete_api_key(_app, api_key, _app.admin_secret)

        response, _ = _gql(
            _app,
            _app.admin_secret,
            query='mutation { createUserApiKey(input: {name: "forbidden"}) { jwt } }',
            raise_on_errors=False,
        )
        assert response["data"] is None
        assert response["errors"]

    @pytest.mark.parametrize(
        "role_or_user,expectation",
        [
            (_VIEWER, _DENIED),
            (_MEMBER, _DENIED),
            (_ADMIN, _OK),
            (_DEFAULT_ADMIN, _OK),
        ],
    )
    @pytest.mark.parametrize("query", ["query{userApiKeys{id}}", "query{systemApiKeys{id}}"])
    def test_only_admin_can_list_keys(
        self,
        role_or_user: _RoleOrUser,
        query: str,
        expectation: _OK_OR_DENIED,
        _get_user: _GetUser,
        _app: _AppInfo,
    ) -> None:
        user = _get_user(_app, role_or_user).log_in(_app)
        with expectation:
            user.gql(_app, query)


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
        """A user cannot manage another user's key, while an admin can revoke it."""
        owner = _get_user(_app, _MEMBER)
        other = _get_user(_app, _MEMBER)
        admin = _get_user(_app, _ADMIN)
        created = _create(_app, owner, "user").json()["data"]

        assert all(k["id"] != created["id"] for k in _list(_app, other, "user").json()["data"])
        # 404 rather than 403 so the endpoint cannot be used to probe for others' keys.
        assert _delete(_app, other, "user", created["id"]).status_code == 404

        assert _delete(_app, admin, "user", created["id"]).status_code == 204

    def test_deleting_a_user_revokes_their_api_keys(
        self, _get_user: _GetUser, _app: _AppInfo
    ) -> None:
        """A deleted user's keys must not outlive them."""
        owner = _get_user(_app, _MEMBER)
        created = _create(_app, owner, "user").json()["data"]
        key = _ApiKey(created["key"], created["id"])

        # The key authenticates while its owner exists.
        assert _httpx_client(_app, key).get("v1/user").status_code == 200

        _delete_users(_app, _app.admin_secret, users=[owner])

        # Once the owner is deleted, the key no longer authenticates.
        assert _httpx_client(_app, key).get("v1/user").status_code == 401

    def test_viewers_can_manage_their_own_keys(self, _get_user: _GetUser, _app: _AppInfo) -> None:
        viewer = _get_user(_app, _VIEWER)
        created = _create(_app, viewer, "user").json()["data"]
        assert any(k["id"] == created["id"] for k in _list(_app, viewer, "user").json()["data"])
        assert _delete(_app, viewer, "user", created["id"]).status_code == 204

    @pytest.mark.parametrize("role", [_VIEWER, _MEMBER, _ADMIN])
    def test_user_api_keys_cannot_issue_user_keys(
        self,
        role: UserRoleInput,
        _get_user: _GetUser,
        _app: _AppInfo,
    ) -> None:
        user = _get_user(_app, role)
        existing = _create(_app, user, "user").json()["data"]
        existing_key = _ApiKey(existing["key"], existing["id"])
        assert _create(_app, existing_key, "user").status_code == 403

    def test_admin_can_inventory_user_keys(self, _get_user: _GetUser, _app: _AppInfo) -> None:
        owner = _get_user(_app, _MEMBER)
        admin = _get_user(_app, _ADMIN)
        personal = [
            _create(_app, owner, "user").json()["data"],
            _create(_app, owner, "user").json()["data"],
        ]
        system = _create(_app, admin, "system").json()["data"]

        assert _httpx_client(_app, owner).get("v1/users/api_keys").status_code == 403
        # The page size is bounded to guard against oversized responses.
        assert (
            _httpx_client(_app, admin).get("v1/users/api_keys", params={"limit": 1001}).status_code
            == 422
        )
        response = _httpx_client(_app, admin).get("v1/users/api_keys", params={"limit": 1})
        assert response.status_code == 200
        first_page = response.json()
        assert len(first_page["data"]) == 1
        assert first_page["next_cursor"]
        response = _httpx_client(_app, admin).get(
            "v1/users/api_keys",
            params={"cursor": first_page["next_cursor"]},
        )
        assert response.status_code == 200
        keys = first_page["data"] + response.json()["data"]
        assert {key["id"] for key in keys}.issuperset(key["id"] for key in personal)
        entry = next(key for key in keys if key["id"] == personal[0]["id"])
        assert entry["user"]["id"] == owner.gid
        assert entry["user"]["username"] == owner.profile.username
        assert all(key["id"] != system["id"] for key in keys)

    def test_graphql_delete_does_not_reveal_key_existence(
        self, _get_user: _GetUser, _app: _AppInfo
    ) -> None:
        owner = _get_user(_app, _MEMBER)
        other = _get_user(_app, _MEMBER)
        existing_id = _create(_app, owner, "user").json()["data"]["id"]
        missing_id = str(GlobalID("UserApiKey", "999999999"))
        query = "mutation($id: ID!) { deleteUserApiKey(input: {id: $id}) { apiKeyId } }"

        messages = []
        for api_key_id in (existing_id, missing_id):
            response, _ = _gql(
                _app,
                other,
                query=query,
                variables={"id": api_key_id},
                raise_on_errors=False,
            )
            assert response["data"] is None
            messages.append(response["errors"][0]["message"])
        assert messages == ["API key not found", "API key not found"]

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

    def test_admin_secret_is_system_admin_but_has_no_personal_key_identity(
        self, _get_user: _GetUser, _app: _AppInfo
    ) -> None:
        owner = _get_user(_app, _MEMBER)
        admin_secret = _app.admin_secret

        # It owns no personal keys: listing returns an empty collection (matching GraphQL),
        # and it cannot create a personal key of its own.
        listed = _list(_app, admin_secret, "user")
        assert listed.status_code == 200
        assert listed.json()["data"] == []
        assert _create(_app, admin_secret, "user").status_code == 403

        # But its configured admin authority permits cross-user revocation of a human user's
        # key, on both surfaces, even though its database role is SYSTEM.
        rest_target = _create(_app, owner, "user").json()["data"]
        assert _delete(_app, admin_secret, "user", rest_target["id"]).status_code == 204
        assert all(k["id"] != rest_target["id"] for k in _list(_app, owner, "user").json()["data"])

        gql_target = _create(_app, owner, "user").json()["data"]
        _gql(
            _app,
            admin_secret,
            query="mutation($id: ID!) { deleteUserApiKey(input: {id: $id}) { apiKeyId } }",
            variables={"id": gql_target["id"]},
        )
        assert all(k["id"] != gql_target["id"] for k in _list(_app, owner, "user").json()["data"])

        # System-key administration remains available to the admin secret.
        created = _create(_app, admin_secret, "system").json()["data"]
        assert any(
            key["id"] == created["id"] for key in _list(_app, admin_secret, "system").json()["data"]
        )
        assert _delete(_app, admin_secret, "system", created["id"]).status_code == 204

    def test_api_keys_cannot_issue_system_keys(self, _get_user: _GetUser, _app: _AppInfo) -> None:
        admin = _get_user(_app, _ADMIN)
        user_key_data = _create(_app, admin, "user").json()["data"]
        user_key = _ApiKey(user_key_data["key"], user_key_data["id"])
        assert _create(_app, user_key, "system").status_code == 403

        system_key_data = _create(_app, admin, "system").json()["data"]
        system_key = _ApiKey(system_key_data["key"], system_key_data["id"], "System")
        assert _create(_app, system_key, "system").status_code == 403

    @pytest.mark.parametrize("role", [_MEMBER, _VIEWER])
    def test_non_admins_are_denied(self, role: Any, _get_user: _GetUser, _app: _AppInfo) -> None:
        user = _get_user(_app, role)
        assert _list(_app, user, "system").status_code == 403
        assert _create(_app, user, "system").status_code == 403
        assert _delete(_app, user, "system", "fake-id").status_code == 403

    def test_system_keys_cannot_manage_keys_through_the_user_routes(
        self, _get_user: _GetUser, _app: _AppInfo
    ) -> None:
        """
        A system key must not reach the personal-key routes. Every system key is owned by
        the single system user, so if the /user routes admitted a system caller it could
        list and revoke every other system key and mint fresh SYSTEM-role keys, bypassing
        the admin gate on the /system routes.
        """
        admin = _get_user(_app, _ADMIN)
        created = _create(_app, admin, "system").json()["data"]
        system = _ApiKey(created["key"], created["id"], "System")

        # Listing returns an empty personal collection: the system key's keys are system keys
        # and are deliberately not exposed here, so it cannot enumerate them. Create and
        # delete on the personal routes are rejected outright.
        listed = _list(_app, system, "user")
        assert listed.status_code == 200
        assert listed.json()["data"] == []
        assert _create(_app, system, "user").status_code == 403
        assert _delete(_app, system, "user", created["id"]).status_code == 403

        # The system key itself is untouched and still usable.
        assert _httpx_client(_app, system).get("v1/projects").status_code == 200

    def test_system_keys_cannot_manage_keys_through_graphql_personal_paths(
        self, _get_user: _GetUser, _app: _AppInfo
    ) -> None:
        created = _create(_app, _get_user(_app, _ADMIN), "system").json()["data"]
        system = _ApiKey(created["key"], created["id"], "System")

        listed, _ = _gql(_app, system, query="query { viewer { apiKeys { id } } }")
        assert listed == {"data": {"viewer": {"apiKeys": []}}}

        created_personal, _ = _gql(
            _app,
            system,
            query='mutation { createUserApiKey(input: {name: "forbidden"}) { jwt } }',
            raise_on_errors=False,
        )
        assert created_personal["data"] is None
        assert created_personal["errors"][0]["message"] == "API keys cannot create API keys"

        node_id = GlobalID.from_id(created["id"]).node_id
        relabeled_id = str(GlobalID("UserApiKey", node_id))
        deleted, _ = _gql(
            _app,
            system,
            query=("mutation($id: ID!) { deleteUserApiKey(input: {id: $id}) { apiKeyId } }"),
            variables={"id": relabeled_id},
            raise_on_errors=False,
        )
        assert deleted["data"] is None
        assert deleted["errors"][0]["message"] == "API key not found"
        assert _httpx_client(_app, system).get("v1/projects").status_code == 200

    def test_personal_keys_are_not_reachable_as_system_keys(
        self, _get_user: _GetUser, _app: _AppInfo
    ) -> None:
        """The two resources share a table; deleting across them must not work."""
        admin = _get_user(_app, _ADMIN)
        personal = _create(_app, admin, "user").json()["data"]

        # The personal key's GlobalID is of the wrong node type for the system endpoint.
        assert _delete(_app, admin, "system", personal["id"]).status_code == 422
        assert any(k["id"] == personal["id"] for k in _list(_app, admin, "user").json()["data"])

        node_id = GlobalID.from_id(personal["id"]).node_id
        relabeled_id = str(GlobalID("SystemApiKey", node_id))
        response, _ = _gql(
            _app,
            admin,
            query=("mutation($id: ID!) { deleteSystemApiKey(input: {id: $id}) { apiKeyId } }"),
            variables={"id": relabeled_id},
            raise_on_errors=False,
        )
        assert response["data"] is None
        assert response["errors"][0]["message"] == "API key not found"
        assert any(k["id"] == personal["id"] for k in _list(_app, admin, "user").json()["data"])

        assert _delete(_app, admin, "system", relabeled_id).status_code == 404
        assert any(k["id"] == personal["id"] for k in _list(_app, admin, "user").json()["data"])

        system = _create(_app, admin, "system").json()["data"]
        node_id = GlobalID.from_id(system["id"]).node_id
        relabeled_id = str(GlobalID("UserApiKey", node_id))
        assert _delete(_app, admin, "user", relabeled_id).status_code == 404
        assert any(k["id"] == system["id"] for k in _list(_app, admin, "system").json()["data"])

        assert _delete(_app, admin, "user", personal["id"]).status_code == 204
        assert _delete(_app, admin, "system", system["id"]).status_code == 204
