"""End-to-end integration tests for the per-resource access-control facility.

Why these live here (and not in unit tests)
--------------------------------------------
The oracle, the gate helpers, and the object-role tiers are exhaustively unit-tested
in isolation. But every unit test runs with **auth disabled**, where every access gate is
a deliberate no-op (access control presupposes authentication). So the one thing unit
tests *cannot* exercise is the property that matters most in production: that with auth on
**and** enforcement on, the gates actually deny. These integration tests run a real server
with ``PHOENIX_ENABLE_AUTH=true`` and ``PHOENIX_ACCESS_CONTROL_ENABLED=true`` and drive it
over HTTP as real users, so they verify enforcement, not just logic.

Design: rigorous but parsimonious
---------------------------------
One test per *distinct, emergent* invariant — the ones that only appear once auth and
enforcement are both on. Combinatorial detail (every tier, every subject kind, every object
type, access-by-parent, containment) is left to the unit suite; here we assert the seams hold
end to end. The chosen invariants:

1. ``test_admin_only_default_and_grant_visibility`` — the headline. New named projects are
   admin-only by default (the built-in ``default`` project is the deliberate shared landing
   area), grant → exactly-that-object visible, revoke → gone, and list-endpoint filtering —
   in one cohesive flow.
2. ``test_unauthorized_read_is_not_found`` — unauthorized point reads return **404**
   (indistinguishable from missing), never 403; you cannot probe for objects you can't see.
3. ``test_viewer_tier_reads_editor_tier_writes`` — the object-role tiers are *enforced*:
   a viewer-tier grant permits reads but a mutation 404s; an editor-tier grant permits it.
4. ``test_creator_sees_own_dataset_without_grant`` — creator-private roots: the creator of a
   dataset reaches it with no grant; another member cannot.
5. ``test_manager_can_administer_access_non_manager_cannot`` — decentralized sharing: a
   holder of ``OBJ_MANAGE_ACCESS`` may grant others on that object; a non-manager non-admin
   may not.
6. ``test_local_group_grant_confers_and_revokes_access`` — group-as-subject: a grant to a
   local (admin-managed) group reaches its members, and removing a member revokes access.
7. ``test_last_manager_of_an_ownerless_object_cannot_be_stranded`` — an object with no creator
   cannot lose its final manager (by delete *or* in-place downgrade), so it never becomes
   reachable only by administrators; naming a second manager first lifts the guard.
8. ``test_tag_grant_confers_curated_access_and_cannot_delegate_management`` — attribute-based
   access: an admin-set tag plus a tag grant reach whoever the tag matches; removing the tag
   severs it; and a tag grant may confer view/edit but never manage-access.

Deliberately deferred to the unit suite or to a follow-up (noted so the omission is a
choice, not an oversight):
- the oracle's tier/creator/access-by-parent/containment *logic* (unit-tested);
- the ingestion-birth invariant (ingest is ungated, ingest-born projects are admin-only) —
  worth an integration test, but needs an OTLP exporter authenticated with an ingest-scoped
  API key; add as ``test_ingest_born_project_is_admin_only`` once that exporter helper lands;
- the boot guard (refuse to start with access control on and auth off) — a process-startup
  assertion, better as a dedicated server-launch test than mixed in here.

NOTE: these require the integration environment (Postgres or sqlite + a live server
subprocess) and have not been executed in-repo; run via the integration tox target. The
access-control DB latch is **global to the database**, so this module gets its **own isolated
schema** (``_env_database_access_control``) — sharing the package schema would flip
enforcement for ``test_auth.py``.
"""

from __future__ import annotations

import asyncio
from collections.abc import Iterator, Mapping
from secrets import token_hex
from typing import Any, cast

import httpx
import pytest

from phoenix.config import (
    ENV_PHOENIX_ACCESS_CONTROL_ENABLED,
    ENV_PHOENIX_SQL_DATABASE_SCHEMA,
)
from tests.integration._helpers import (
    _DEFAULT_ADMIN,
    _MEMBER,
    _AppInfo,
    _httpx_client,
    _Profile,
    _random_schema,
    _server,
    _User,
)

# --- fixtures: a server with auth AND access control on, on an isolated database ----------


@pytest.fixture(scope="package")
def _env_database_access_control(_sql_database_url: Any) -> Iterator[dict[str, str]]:
    """A *separate* database/schema from the rest of the auth package.

    The ``access_control.enabled`` latch is a single row keyed to the database. Enabling it
    here on the shared package schema would turn enforcement on for every other app in the
    package (``test_auth.py`` et al.) mid-run, so this app gets its own schema.
    """
    env = {"PHOENIX_SQL_DATABASE_URL": _sql_database_url.render_as_string(hide_password=False)}
    if not _sql_database_url.get_backend_name().startswith("postgresql"):
        # sqlite ``:memory:`` is already per-process isolated.
        yield env
        return
    loop = asyncio.new_event_loop()
    ctx = _random_schema(_sql_database_url)
    schema = loop.run_until_complete(ctx.__aenter__())
    try:
        yield {**env, ENV_PHOENIX_SQL_DATABASE_SCHEMA: schema}
    finally:
        loop.run_until_complete(ctx.__aexit__(None, None, None))
        loop.close()


@pytest.fixture(scope="package")
def _env_ports_access_control(_ports: Iterator[int]) -> dict[str, str]:
    return {"PHOENIX_PORT": str(next(_ports)), "PHOENIX_GRPC_PORT": str(next(_ports))}


@pytest.fixture(scope="package")
def _app(
    _env_auth: Mapping[str, str],
    _env_smtp: Mapping[str, str],
    _env_tls: Mapping[str, str],
    _env_database_access_control: Mapping[str, str],
    _env_ports_access_control: Mapping[str, str],
) -> Iterator[_AppInfo]:
    """A live server with authentication and per-resource access control both enforcing."""
    env = {
        **_env_tls,
        **_env_smtp,
        **_env_auth,
        **_env_database_access_control,
        **_env_ports_access_control,
        ENV_PHOENIX_ACCESS_CONTROL_ENABLED: "true",
    }
    with _server(_AppInfo(env)) as app:
        yield app


# --- small REST helpers (all access-control surfaces are GlobalID-consistent) -------------


def _member(app: _AppInfo, _profiles: Iterator[_Profile]) -> _User:
    return _DEFAULT_ADMIN.create_user(app, _MEMBER, profile=next(_profiles))


def _create_project(app: _AppInfo, actor: _User) -> str:
    """Create a project as ``actor``; return its GlobalID."""
    resp = _httpx_client(app, actor).post("v1/projects", json={"name": f"p-{token_hex(4)}"})
    resp.raise_for_status()
    return cast(str, resp.json()["data"]["id"])


def _list_project_ids(app: _AppInfo, actor: _User) -> set[str]:
    resp = _httpx_client(app, actor).get("v1/projects")
    resp.raise_for_status()
    return {p["id"] for p in resp.json()["data"]}


def _grant(
    app: _AppInfo,
    actor: _User,
    *,
    user: _User,
    object_id: str,
    object_type: str = "project",
    role: str | None = None,
) -> httpx.Response:
    body: dict[str, Any] = {
        "subject": {"kind": "user", "id": user.gid},
        "object_type": object_type,
        "object_id": object_id,
    }
    if role is not None:
        body["role"] = role
    return _httpx_client(app, actor).post("v1/access/grants", json=body)


def _graphql(app: _AppInfo, actor: _User, query: str, variables: dict[str, Any]) -> dict[str, Any]:
    """Run a GraphQL operation as ``actor`` (the tag mutations are GraphQL-only). Returns the
    decoded body — GraphQL surfaces authorization/validation failures as an ``errors`` field on
    an HTTP 200, so callers assert on ``result["errors"]``, not the status code."""
    resp = _httpx_client(app, actor).post("graphql", json={"query": query, "variables": variables})
    resp.raise_for_status()
    return cast(dict[str, Any], resp.json())


class TestAccessControlEnforcement:
    def test_admin_only_default_and_grant_visibility(
        self, _app: _AppInfo, _profiles: Iterator[_Profile]
    ) -> None:
        member = _member(_app, _profiles)
        proj_a = _create_project(_app, _DEFAULT_ADMIN)
        proj_b = _create_project(_app, _DEFAULT_ADMIN)

        # New named projects are admin-only by default: the admin sees both; an ungranted
        # member sees neither. The built-in `default` project is seeded as an explicit
        # everyone-visible exception.
        admin_view = _list_project_ids(_app, _DEFAULT_ADMIN)
        assert {proj_a, proj_b} <= admin_view
        member_view = _list_project_ids(_app, member)
        assert proj_a not in member_view and proj_b not in member_view

        # A grant adds exactly its object — monotonic, nothing else leaks.
        assert _grant(_app, _DEFAULT_ADMIN, user=member, object_id=proj_a).status_code == 200
        member_view = _list_project_ids(_app, member)
        assert proj_a in member_view and proj_b not in member_view

        # Revoking removes it again (back to admin-only, not open-to-everyone).
        grant_id = (
            _httpx_client(_app, _DEFAULT_ADMIN)
            .get("v1/access/grants", params={"object_type": "project", "object_id": proj_a})
            .json()["data"][0]["id"]
        )
        assert (
            _httpx_client(_app, _DEFAULT_ADMIN).delete(f"v1/access/grants/{grant_id}").status_code
            == 204
        )
        assert proj_a not in _list_project_ids(_app, member)

    def test_unauthorized_read_is_not_found(
        self, _app: _AppInfo, _profiles: Iterator[_Profile]
    ) -> None:
        member = _member(_app, _profiles)
        proj = _create_project(_app, _DEFAULT_ADMIN)
        # The admin can read it; the ungranted member gets 404 (not 403) — unauthorized is
        # indistinguishable from not-found, so the object's existence cannot be probed.
        assert _httpx_client(_app, _DEFAULT_ADMIN).get(f"v1/projects/{proj}").status_code == 200
        assert _httpx_client(_app, member).get(f"v1/projects/{proj}").status_code == 404

    def test_viewer_tier_reads_editor_tier_writes(
        self, _app: _AppInfo, _profiles: Iterator[_Profile]
    ) -> None:
        member = _member(_app, _profiles)
        dataset_id = _upload_dataset(_app, _DEFAULT_ADMIN)

        # Viewer tier: may read, but a mutation (delete) is 404 (no edit permission).
        assert (
            _grant(
                _app,
                _DEFAULT_ADMIN,
                user=member,
                object_id=dataset_id,
                object_type="dataset",
                role="Resource Viewer",
            ).status_code
            == 200
        )
        client = _httpx_client(_app, member)
        assert client.get(f"v1/datasets/{dataset_id}").status_code == 200
        assert client.delete(f"v1/datasets/{dataset_id}").status_code == 404

        # Upgrade to editor tier (idempotent re-grant): the mutation now succeeds.
        assert (
            _grant(
                _app,
                _DEFAULT_ADMIN,
                user=member,
                object_id=dataset_id,
                object_type="dataset",
                role="Resource Editor",
            ).status_code
            == 200
        )
        assert _httpx_client(_app, member).delete(f"v1/datasets/{dataset_id}").status_code == 204

    def test_creator_sees_own_dataset_without_grant(
        self, _app: _AppInfo, _profiles: Iterator[_Profile]
    ) -> None:
        creator = _member(_app, _profiles)
        other = _member(_app, _profiles)
        dataset_id = _upload_dataset(_app, creator)  # creator-private root
        # The creator reaches it with no grant; an unrelated member cannot.
        assert _httpx_client(_app, creator).get(f"v1/datasets/{dataset_id}").status_code == 200
        assert _httpx_client(_app, other).get(f"v1/datasets/{dataset_id}").status_code == 404

    def test_hidden_dataset_name_create_collision_is_conflict(
        self, _app: _AppInfo, _profiles: Iterator[_Profile]
    ) -> None:
        creator = _member(_app, _profiles)
        other = _member(_app, _profiles)
        name = f"ds-{token_hex(4)}"
        _upload_dataset(_app, creator, name=name)
        client = _httpx_client(_app, other)

        # Creating with a globally occupied name should report name unavailability, not a
        # hidden-resource 404. The response still does not reveal who owns the dataset.
        resp = _upload_dataset_response(_app, other, name=name, action="create")
        assert resp.status_code == 409
        assert resp.text == "Dataset name is unavailable"

        # Append/update target an existing dataset, so hidden datasets remain hidden as 404.
        assert _upload_dataset_response(_app, other, name=name, action="append").status_code == 404
        assert _upload_dataset_response(_app, other, name=name, action="update").status_code == 404
        list_resp = client.get("v1/datasets", params={"name": name})
        assert list_resp.status_code == 200
        assert list_resp.json()["data"] == []

    def test_hidden_prompt_name_create_collision_is_conflict(
        self, _app: _AppInfo, _profiles: Iterator[_Profile]
    ) -> None:
        creator = _member(_app, _profiles)
        other = _member(_app, _profiles)
        name = f"prompt-{token_hex(4)}"
        _create_prompt_response(_app, creator, name=name).raise_for_status()

        resp = _create_prompt_response(_app, other, name=name)
        assert resp.status_code == 409
        assert "Prompt name is unavailable" in resp.text

    def test_experiment_writes_require_dataset_editor(
        self, _app: _AppInfo, _profiles: Iterator[_Profile]
    ) -> None:
        creator = _member(_app, _profiles)
        collaborator = _member(_app, _profiles)
        dataset_id = _upload_dataset(_app, creator)

        # No dataset access: cannot create an experiment from a hidden dataset.
        assert _create_experiment_response(_app, collaborator, dataset_id).status_code == 404

        # Viewer access is enough to read the dataset, but not to create or mutate experiments.
        assert (
            _grant(
                _app,
                _DEFAULT_ADMIN,
                user=collaborator,
                object_id=dataset_id,
                object_type="dataset",
                role="Resource Viewer",
            ).status_code
            == 200
        )
        assert _create_experiment_response(_app, collaborator, dataset_id).status_code == 404

        experiment = _create_experiment_response(_app, creator, dataset_id).json()["data"]
        experiment_id = experiment["id"]
        client = _httpx_client(_app, collaborator)
        assert client.get(f"v1/experiments/{experiment_id}").status_code == 200
        assert (
            client.patch(f"v1/experiments/{experiment_id}", json={"name": "x"}).status_code == 404
        )
        assert client.delete(f"v1/experiments/{experiment_id}").status_code == 404

        gql_resp = client.post(
            "graphql",
            json={
                "query": """
              mutation($experimentId: ID!) {
                patchExperiment(input: {experimentId: $experimentId, name: "patched"}) {
                  experiment { id }
                }
              }
            """,
                "variables": {"experimentId": experiment_id},
            },
        )
        assert gql_resp.status_code == 200
        assert gql_resp.json().get("errors")

        # Editor access can create and mutate experiments derived from the dataset.
        assert (
            _grant(
                _app,
                _DEFAULT_ADMIN,
                user=collaborator,
                object_id=dataset_id,
                object_type="dataset",
                role="Resource Editor",
            ).status_code
            == 200
        )
        editor_experiment = _create_experiment_response(_app, collaborator, dataset_id).json()[
            "data"
        ]
        editor_experiment_id = editor_experiment["id"]
        assert (
            client.patch(
                f"v1/experiments/{editor_experiment_id}", json={"name": "patched"}
            ).status_code
            == 200
        )
        assert client.delete(f"v1/experiments/{editor_experiment_id}").status_code == 204

    def test_manager_can_administer_access_non_manager_cannot(
        self, _app: _AppInfo, _profiles: Iterator[_Profile]
    ) -> None:
        manager = _member(_app, _profiles)
        grantee = _member(_app, _profiles)
        outsider = _member(_app, _profiles)
        proj = _create_project(_app, _DEFAULT_ADMIN)

        # Admin grants manager-tier access (OBJ_MANAGE_ACCESS) on the project.
        assert (
            _grant(
                _app, _DEFAULT_ADMIN, user=manager, object_id=proj, role="Resource Manager"
            ).status_code
            == 200
        )

        # The manager may now grant others on that object, without being a global admin.
        assert _grant(_app, manager, user=grantee, object_id=proj).status_code == 200
        assert proj in _list_project_ids(_app, grantee)

        # An outsider (no manage-access) cannot administer the project's access: 404.
        assert _grant(_app, outsider, user=outsider, object_id=proj).status_code == 404

    def test_local_group_grant_confers_and_revokes_access(
        self, _app: _AppInfo, _profiles: Iterator[_Profile]
    ) -> None:
        member = _member(_app, _profiles)
        proj = _create_project(_app, _DEFAULT_ADMIN)
        admin = _httpx_client(_app, _DEFAULT_ADMIN)

        # Admin creates a local group and grants it the project.
        group_id = admin.post("v1/access/groups", json={"name": f"team-{token_hex(4)}"}).json()[
            "data"
        ]["id"]
        admin.post(
            "v1/access/grants",
            json={
                "subject": {"kind": "group", "id": group_id},
                "object_type": "project",
                "object_id": proj,
            },
        ).raise_for_status()

        # Not a member yet → no access. Add to group → access. Remove → access revoked.
        assert proj not in _list_project_ids(_app, member)
        admin.post(f"v1/access/groups/{group_id}/members", json={"user_id": member.gid})
        assert proj in _list_project_ids(_app, member)
        admin.delete(f"v1/access/groups/{group_id}/members/{member.gid}")
        assert proj not in _list_project_ids(_app, member)

    def test_last_manager_of_an_ownerless_object_cannot_be_stranded(
        self, _app: _AppInfo, _profiles: Iterator[_Profile]
    ) -> None:
        manager = _member(_app, _profiles)
        other = _member(_app, _profiles)
        proj = _create_project(_app, _DEFAULT_ADMIN)  # a project has no creator-owner
        admin = _httpx_client(_app, _DEFAULT_ADMIN)

        # Make `manager` the project's only manager.
        grant_id = _grant(
            _app, _DEFAULT_ADMIN, user=manager, object_id=proj, role="Resource Manager"
        ).json()["data"]["id"]

        # Removing that last manager — by deleting the grant, or by downgrading it in place to a
        # viewer — is refused. A project with no owner would otherwise be reachable only by
        # administrators, with no non-admin able to restore access. Even the admin gets 409; the
        # remedy is to name another manager first, not to force the object admin-only by accident.
        assert admin.delete(f"v1/access/grants/{grant_id}").status_code == 409
        assert (
            _grant(
                _app, _DEFAULT_ADMIN, user=manager, object_id=proj, role="Resource Viewer"
            ).status_code
            == 409
        )

        # The grant is untouched, so `manager` still manages the project end to end — they can
        # grant another member on it without being a global admin.
        assert _grant(_app, manager, user=other, object_id=proj).status_code == 200

        # Once a second manager exists, removing the original no longer strands the object.
        assert (
            _grant(
                _app, _DEFAULT_ADMIN, user=other, object_id=proj, role="Resource Manager"
            ).status_code
            == 200
        )
        assert admin.delete(f"v1/access/grants/{grant_id}").status_code == 204

    def test_tag_grant_confers_curated_access_and_cannot_delegate_management(
        self, _app: _AppInfo, _profiles: Iterator[_Profile]
    ) -> None:
        member = _member(_app, _profiles)
        proj = _create_project(_app, _DEFAULT_ADMIN)
        admin = _httpx_client(_app, _DEFAULT_ADMIN)
        proj_object = {"projectId": proj}
        set_tag = "mutation($i: ResourceTagInput!){ setResourceTag(input:$i){ query{__typename} } }"
        remove_tag = (
            "mutation($i: ResourceTagInput!){ removeResourceTag(input:$i){ query{__typename} } }"
        )
        grant_tag = (
            "mutation($i: TagAccessGrantInput!){ grantTagAccess(input:$i){ query{__typename} } }"
        )

        # An admin tags the project, then grants "any project tagged env=prod" to the member.
        # Access is attribute-based: the member is reached because the object *carries the tag*,
        # not because it was named. (Permission set omitted → the view-only default.)
        _graphql(
            _app,
            _DEFAULT_ADMIN,
            set_tag,
            {"i": {"object": proj_object, "key": "env", "value": "prod"}},
        )
        assert proj not in _list_project_ids(_app, member)
        granted = _graphql(
            _app,
            _DEFAULT_ADMIN,
            grant_tag,
            {
                "i": {
                    "subject": {"userId": member.gid},
                    "objectType": "PROJECT",
                    "tagKey": "env",
                    "tagValue": "prod",
                }
            },
        )
        assert not granted.get("errors")
        assert proj in _list_project_ids(_app, member)

        # Removing the tag severs the access — the grant now matches nothing (fail-closed).
        _graphql(_app, _DEFAULT_ADMIN, remove_tag, {"i": {"object": proj_object, "key": "env"}})
        assert proj not in _list_project_ids(_app, member)

        # A tag grant may confer view or edit, never manage-access. A tag's reach is mutable (a
        # manager can drop the object's tag), so a manage-conferring tag grant would let a
        # non-admin strand an object in one step. Authoring one is rejected outright.
        manager_role = next(
            r["id"]
            for r in admin.get("v1/access/object-roles").json()["data"]
            if r["name"] == "Resource Manager"
        )
        rejected = _graphql(
            _app,
            _DEFAULT_ADMIN,
            grant_tag,
            {
                "i": {
                    "subject": {"userId": member.gid},
                    "objectType": "PROJECT",
                    "tagKey": "env",
                    "tagValue": "prod",
                    "permissionSetId": manager_role,
                }
            },
        )
        assert rejected.get("errors")


def _upload_dataset_response(
    app: _AppInfo, actor: _User, *, name: str, action: str = "create"
) -> httpx.Response:
    data: dict[str, Any] = {
        "name": name,
        "action": action,
        "input_keys[]": ["q"],
        "output_keys[]": ["a"],
    }
    return _httpx_client(app, actor).post(
        "v1/datasets/upload",
        params={"sync": "true"},
        files={"file": (f"{name}.csv", b"q,a\nhello,world\n", "text/csv")},
        data=data,
    )


def _upload_dataset(app: _AppInfo, actor: _User, *, name: str | None = None) -> str:
    """Create a one-row dataset as ``actor`` via the REST upload; return its GlobalID.

    The uploader becomes the dataset's creator (creator-private root).
    """
    resp = _upload_dataset_response(app, actor, name=name or f"ds-{token_hex(4)}")
    resp.raise_for_status()
    return str(resp.json()["data"]["dataset_id"])


def _create_prompt_response(app: _AppInfo, actor: _User, *, name: str) -> httpx.Response:
    return _httpx_client(app, actor).post(
        "v1/prompts",
        json={
            "prompt": {"name": name},
            "version": {
                "model_provider": "OPENAI",
                "model_name": "gpt-4o-mini",
                "template": {
                    "type": "chat",
                    "messages": [{"role": "user", "content": "hello"}],
                },
                "template_type": "CHAT",
                "template_format": "MUSTACHE",
                "invocation_parameters": {"type": "openai", "openai": {}},
            },
        },
    )


def _create_experiment_response(app: _AppInfo, actor: _User, dataset_id: str) -> httpx.Response:
    return _httpx_client(app, actor).post(
        f"v1/datasets/{dataset_id}/experiments",
        json={"version_id": None, "repetitions": 1},
    )
