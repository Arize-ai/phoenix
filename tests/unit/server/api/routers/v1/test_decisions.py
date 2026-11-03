"""REST contracts for saved decisions, their versions, and version tags."""

from typing import Any, Optional

import httpx
import pytest
from sqlalchemy import delete, select
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server.types import DbSessionFactory


def version_body(**overrides: Any) -> dict[str, Any]:
    return {
        "template_format": "MUSTACHE",
        "state": {
            "type": "json",
            "template": {"ticket": "{{ticket}}", "plan": "{{customer.plan}}"},
        },
        "questions": [
            {"type": "predicate", "name": "urgent", "instructions": "Is it urgent by {{date}}?"},
            {
                "type": "choice",
                "name": "team",
                "instructions": "Which team owns it?",
                "choices": [{"value": "billing"}, {"value": "technical"}],
            },
        ],
        "model_provider": "TYPESAFE",
        "model_name": "tev1",
        **overrides,
    }


async def create(
    client: httpx.AsyncClient,
    name: str = "triage",
    *,
    decision: Optional[dict[str, Any]] = None,
    tags: Optional[list[dict[str, Any]]] = None,
    **version_overrides: Any,
) -> dict[str, Any]:
    body: dict[str, Any] = {
        "decision": {"name": name, **(decision or {})},
        "version": version_body(**version_overrides),
    }
    if tags is not None:
        body["tags"] = tags
    response = await client.post("v1/decisions", json=body)
    assert response.status_code == 201, response.text
    data: dict[str, Any] = response.json()["data"]
    assert response.headers["location"] == f"/v1/decision_versions/{data['id']}"
    return data


class TestCreateDecision:
    async def test_creates_decision_with_first_version(
        self, httpx_client: httpx.AsyncClient
    ) -> None:
        version = await create(
            httpx_client,
            decision={"description": "Routes tickets", "metadata": {"owner": "support"}},
        )
        assert GlobalID.from_id(version["id"]).type_name == "DecisionVersion"
        assert version["template_format"] == "MUSTACHE"
        assert version["model_provider"] == "TYPESAFE"
        assert version["variables"] == ["ticket", "customer", "date"]
        assert [q["type"] for q in version["questions"]] == ["predicate", "choice"]
        assert "created_at" in version
        response = await httpx_client.get(f"v1/decisions/{version['decision_id']}")
        assert response.status_code == 200
        decision = response.json()["data"]
        assert decision["name"] == "triage"
        assert decision["description"] == "Routes tickets"
        assert decision["metadata"] == {"owner": "support"}

    async def test_existing_name_appends_version_and_keeps_omitted_fields(
        self, httpx_client: httpx.AsyncClient
    ) -> None:
        first = await create(
            httpx_client, decision={"description": "keep me", "metadata": {"a": 1}}
        )
        second = await create(httpx_client, decision={"metadata": {"b": 2}}, model_name="tev2")
        assert second["decision_id"] == first["decision_id"]
        assert second["id"] != first["id"]
        decision = (await httpx_client.get("v1/decisions/triage")).json()["data"]
        assert decision["description"] == "keep me"
        assert decision["metadata"] == {"b": 2}
        latest = (await httpx_client.get("v1/decisions/triage/latest")).json()["data"]
        assert latest["id"] == second["id"]
        assert latest["model_name"] == "tev2"

    async def test_tags_are_set_on_the_new_version(self, httpx_client: httpx.AsyncClient) -> None:
        version = await create(httpx_client, tags=[{"name": "production"}])
        response = await httpx_client.get("v1/decisions/triage/tags/production")
        assert response.status_code == 200
        assert response.json()["data"]["id"] == version["id"]

    @pytest.mark.parametrize(
        "overrides,message",
        [
            pytest.param({"model_provider": "ANTHROPIC"}, "decision models", id="chat-provider"),
            pytest.param({"model_name": "  "}, "model name", id="blank-model"),
            pytest.param(
                {
                    "questions": [
                        {
                            "type": "choice",
                            "name": "team",
                            "instructions": "Which?",
                            "choices": [{"value": "only"}],
                        }
                    ]
                },
                "choices",
                id="too-few-choices",
            ),
            pytest.param(
                {"state": {"type": "text", "template": "  "}}, "cannot be empty", id="empty-state"
            ),
        ],
    )
    async def test_write_time_rules_are_enforced_atomically(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
        overrides: dict[str, Any],
        message: str,
    ) -> None:
        response = await httpx_client.post(
            "v1/decisions",
            json={"decision": {"name": "triage"}, "version": version_body(**overrides)},
        )
        assert response.status_code == 422, response.text
        assert response.headers["content-type"].startswith("application/problem+json")
        assert message in response.json()["detail"]
        async with db() as session:
            assert (await session.scalars(select(models.Decision))).all() == []

    async def test_schema_violations_are_problem_details(
        self, httpx_client: httpx.AsyncClient
    ) -> None:
        response = await httpx_client.post(
            "v1/decisions",
            json={
                "decision": {"name": "triage"},
                "version": version_body(questions=[{"type": "box", "name": "x"}]),
            },
        )
        assert response.status_code == 422
        problem = response.json()
        assert problem["code"] == "validation_error"
        assert [error["field"] for error in problem["errors"]] == ["body.version.questions.0"]

    async def test_field_paths_keep_real_fields_named_like_union_tags(
        self, httpx_client: httpx.AsyncClient
    ) -> None:
        response = await httpx_client.post(
            "v1/decisions",
            json={
                "decision": {"name": "triage"},
                "version": version_body(state={"type": "json"}),
            },
        )
        assert response.status_code == 422
        fields = [error["field"] for error in response.json()["errors"]]
        assert fields == ["body.version.state.template"]

    async def test_missing_custom_provider_is_not_found(
        self, httpx_client: httpx.AsyncClient, db: DbSessionFactory
    ) -> None:
        response = await httpx_client.post(
            "v1/decisions",
            json={
                "decision": {"name": "triage"},
                "version": version_body(
                    custom_provider_id=str(GlobalID("GenerativeModelCustomProvider", "999"))
                ),
            },
        )
        assert response.status_code == 404, response.text
        async with db() as session:
            assert (await session.scalars(select(models.Decision))).all() == []


class TestListAndGet:
    async def test_list_decisions_paginates_newest_first(
        self, httpx_client: httpx.AsyncClient
    ) -> None:
        names = ["a-decision", "b-decision", "c-decision"]
        for name in names:
            await create(httpx_client, name)
        seen: list[str] = []
        cursor = None
        while True:
            params = {"limit": "2", **({"cursor": cursor} if cursor else {})}
            response = await httpx_client.get("v1/decisions", params=params)
            assert response.status_code == 200
            body = response.json()
            seen.extend(decision["name"] for decision in body["data"])
            if not (cursor := body.get("next_cursor")):
                break
        assert seen == list(reversed(names))

    async def test_list_decisions_rejects_bad_cursor(self, httpx_client: httpx.AsyncClient) -> None:
        response = await httpx_client.get("v1/decisions", params={"cursor": "nope"})
        assert response.status_code == 422

    async def test_list_versions_by_id_and_name(self, httpx_client: httpx.AsyncClient) -> None:
        versions = [await create(httpx_client, model_name=f"m{i}") for i in range(3)]
        decision_id = versions[0]["decision_id"]
        for identifier in (decision_id, "triage"):
            ids: list[str] = []
            cursor = None
            while True:
                params = {"limit": "1", **({"cursor": cursor} if cursor else {})}
                response = await httpx_client.get(
                    f"v1/decisions/{identifier}/versions", params=params
                )
                assert response.status_code == 200, response.text
                body = response.json()
                ids.extend(version["id"] for version in body["data"])
                if not (cursor := body.get("next_cursor")):
                    break
            assert ids == [version["id"] for version in reversed(versions)]

    async def test_get_version_by_id(self, httpx_client: httpx.AsyncClient) -> None:
        version = await create(httpx_client)
        response = await httpx_client.get(f"v1/decision_versions/{version['id']}")
        assert response.status_code == 200
        assert response.json()["data"] == version

    @pytest.mark.parametrize(
        "path,status",
        [
            ("v1/decisions/missing", 404),
            ("v1/decisions/missing/versions", 404),
            ("v1/decisions/missing/latest", 404),
            ("v1/decisions/missing/tags/production", 404),
            ("v1/decisions/triage/tags/missing", 404),
            ("v1/decisions/Not%20A%20Name", 422),
            ("v1/decisions/triage/tags/Not%20A%20Tag", 422),
            (f"v1/decision_versions/{GlobalID('DecisionVersion', '999')}", 404),
            (f"v1/decision_versions/{GlobalID('Prompt', '1')}", 422),
            (f"v1/decision_versions/{GlobalID('DecisionVersion', '999')}/tags", 404),
        ],
    )
    async def test_not_found_and_invalid(
        self, httpx_client: httpx.AsyncClient, path: str, status: int
    ) -> None:
        await create(httpx_client)
        response = await httpx_client.get(path)
        assert response.status_code == status, response.text
        assert response.headers["content-type"].startswith("application/problem+json")


class TestCreateDecisionVersion:
    async def test_appends_and_moves_tag(self, httpx_client: httpx.AsyncClient) -> None:
        first = await create(httpx_client, tags=[{"name": "production", "description": "live"}])
        response = await httpx_client.post(
            "v1/decisions/triage/versions",
            json={"version": version_body(model_name="tev2"), "tags": [{"name": "production"}]},
        )
        assert response.status_code == 201, response.text
        second = response.json()["data"]
        assert second["decision_id"] == first["decision_id"]
        tagged = (await httpx_client.get("v1/decisions/triage/tags/production")).json()["data"]
        assert tagged["id"] == second["id"]
        tags = (await httpx_client.get(f"v1/decision_versions/{second['id']}/tags")).json()
        assert [(t["name"], t["description"]) for t in tags["data"]] == [("production", "live")]
        old_tags = (await httpx_client.get(f"v1/decision_versions/{first['id']}/tags")).json()
        assert old_tags["data"] == []

    async def test_missing_decision(self, httpx_client: httpx.AsyncClient) -> None:
        response = await httpx_client.post(
            "v1/decisions/missing/versions", json={"version": version_body()}
        )
        assert response.status_code == 404


class TestPatchDecision:
    async def test_updates_and_clears(self, httpx_client: httpx.AsyncClient) -> None:
        version = await create(httpx_client, decision={"description": "old", "metadata": {"a": 1}})
        response = await httpx_client.patch(
            f"v1/decisions/{version['decision_id']}", json={"description": "  new  "}
        )
        assert response.status_code == 200, response.text
        assert response.json()["data"]["description"] == "new"
        assert response.json()["data"]["metadata"] == {"a": 1}
        response = await httpx_client.patch(
            "v1/decisions/triage", json={"description": None, "metadata": {}}
        )
        assert response.status_code == 200
        data = response.json()["data"]
        assert "description" not in data or data["description"] is None
        assert data.get("metadata", {}) == {}

    @pytest.mark.parametrize(
        "identifier,body,status",
        [
            ("triage", {}, 422),
            ("triage", {"metadata": None}, 422),
            ("missing", {"description": "x"}, 404),
        ],
    )
    async def test_rejections(
        self, httpx_client: httpx.AsyncClient, identifier: str, body: dict[str, Any], status: int
    ) -> None:
        await create(httpx_client)
        response = await httpx_client.patch(f"v1/decisions/{identifier}", json=body)
        assert response.status_code == status, response.text


class TestDeleteDecision:
    async def test_deletes_by_name_and_id(self, httpx_client: httpx.AsyncClient) -> None:
        await create(httpx_client, "by-name", tags=[{"name": "production"}])
        version = await create(httpx_client, "by-id")
        assert (await httpx_client.delete("v1/decisions/by-name")).status_code == 204
        response = await httpx_client.delete(f"v1/decisions/{version['decision_id']}")
        assert response.status_code == 204
        assert (await httpx_client.get("v1/decisions")).json()["data"] == []
        assert (await httpx_client.delete("v1/decisions/by-name")).status_code == 404

    async def test_decision_run_by_an_evaluator_is_a_conflict(
        self, httpx_client: httpx.AsyncClient
    ) -> None:
        version = await create(httpx_client)
        response = await httpx_client.post(
            "v1/evaluators",
            json={
                "type": "decision",
                "name": "native-judge",
                "decision": {"selector": {"type": "version", "decision_version_id": version["id"]}},
            },
        )
        assert response.status_code == 201, response.text
        response = await httpx_client.delete("v1/decisions/triage")
        assert response.status_code == 409
        problem = response.json()
        assert problem["code"] == "conflict"
        assert problem["reason"] == "referenced_by_evaluator"
        assert "native-judge" in problem["detail"]
        assert (await httpx_client.get("v1/decisions/triage")).status_code == 200


class TestDecisionVersionTags:
    async def test_tag_lifecycle(self, httpx_client: httpx.AsyncClient) -> None:
        first = await create(httpx_client)
        second = await create(httpx_client, model_name="tev2")
        url = f"v1/decision_versions/{first['id']}/tags"
        response = await httpx_client.post(url, json={"name": "staging", "description": "qa"})
        assert response.status_code == 201, response.text
        created = response.json()["data"]
        assert (created["name"], created["description"]) == ("staging", "qa")
        assert created["decision_version_id"] == first["id"]
        assert response.headers["location"] == f"/v1/decisions/{first['decision_id']}/tags/staging"
        tags = (await httpx_client.get(url)).json()["data"]
        assert [(t["name"], t["decision_version_id"]) for t in tags] == [("staging", first["id"])]
        # Moving the tag keeps its description.
        response = await httpx_client.post(
            f"v1/decision_versions/{second['id']}/tags", json={"name": "staging"}
        )
        assert response.status_code == 200, response.text
        moved = response.json()["data"]
        assert moved["id"] == created["id"]
        assert (moved["description"], moved["decision_version_id"]) == ("qa", second["id"])
        assert "location" not in response.headers
        assert (await httpx_client.get(url)).json()["data"] == []
        tagged = (await httpx_client.get("v1/decisions/triage/tags/staging")).json()["data"]
        assert tagged["id"] == second["id"]
        # A tag is resolved within the version's decision, so any version can delete it.
        response = await httpx_client.delete(f"{url}/staging")
        assert response.status_code == 204
        assert (await httpx_client.get("v1/decisions/triage/tags/staging")).status_code == 404
        assert (await httpx_client.delete(f"{url}/staging")).status_code == 404

    async def test_tag_list_paginates(self, httpx_client: httpx.AsyncClient) -> None:
        version = await create(httpx_client)
        url = f"v1/decision_versions/{version['id']}/tags"
        for name in ("a", "b", "c"):
            assert (await httpx_client.post(url, json={"name": name})).status_code == 201
        names: list[str] = []
        cursor = None
        while True:
            params = {"limit": "2", **({"cursor": cursor} if cursor else {})}
            body = (await httpx_client.get(url, params=params)).json()
            names.extend(tag["name"] for tag in body["data"])
            if not (cursor := body.get("next_cursor")):
                break
        assert names == ["c", "b", "a"]

    @pytest.mark.parametrize(
        "method,suffix,body,status",
        [
            ("POST", "", {"name": "Not Valid"}, 422),
            ("DELETE", "/Not%20Valid", None, 422),
        ],
    )
    async def test_invalid_tag_names(
        self,
        httpx_client: httpx.AsyncClient,
        method: str,
        suffix: str,
        body: Optional[dict[str, Any]],
        status: int,
    ) -> None:
        version = await create(httpx_client)
        response = await httpx_client.request(
            method, f"v1/decision_versions/{version['id']}/tags{suffix}", json=body
        )
        assert response.status_code == status, response.text

    async def test_unknown_version(self, httpx_client: httpx.AsyncClient) -> None:
        missing = GlobalID("DecisionVersion", "999")
        response = await httpx_client.post(
            f"v1/decision_versions/{missing}/tags", json={"name": "x"}
        )
        assert response.status_code == 404
        response = await httpx_client.delete(f"v1/decision_versions/{missing}/tags/x")
        assert response.status_code == 404


class TestModelProviders:
    async def test_model_type_selects_provider_list(self, httpx_client: httpx.AsyncClient) -> None:
        chat = {
            p["provider"] for p in (await httpx_client.get("v1/model_providers")).json()["data"]
        }
        explicit_chat = {
            p["provider"]
            for p in (
                await httpx_client.get("v1/model_providers", params={"model_type": "CHAT"})
            ).json()["data"]
        }
        decision = {
            p["provider"]
            for p in (
                await httpx_client.get("v1/model_providers", params={"model_type": "DECISION"})
            ).json()["data"]
        }
        assert chat == explicit_chat
        assert "TYPESAFE" not in chat
        assert "TYPESAFE" in decision
        assert "ANTHROPIC" not in decision
        response = await httpx_client.get("v1/model_providers", params={"model_type": "BOX"})
        assert response.status_code == 422


class TestListFilters:
    async def test_filter_by_name_substring(self, httpx_client: httpx.AsyncClient) -> None:
        for name in ("ticket-triage", "refund-check", "triage_100"):
            await create(httpx_client, name)
        response = await httpx_client.get("v1/decisions", params={"name": "TRIAGE"})
        assert response.status_code == 200
        assert {d["name"] for d in response.json()["data"]} == {"ticket-triage", "triage_100"}
        # LIKE wildcards in the filter are matched literally.
        response = await httpx_client.get("v1/decisions", params={"name": "e_1"})
        assert [d["name"] for d in response.json()["data"]] == ["triage_100"]
        response = await httpx_client.get("v1/decisions", params={"name": "%"})
        assert response.json()["data"] == []

    async def test_filter_by_labels(self, httpx_client: httpx.AsyncClient) -> None:
        for name in ("a-decision", "b-decision", "c-decision"):
            await create(httpx_client, name)
        support = await create_label(httpx_client, "support")
        billing = await create_label(httpx_client, "billing")
        await httpx_client.put(f"v1/decisions/a-decision/labels/{support['id']}")
        await httpx_client.put(f"v1/decisions/b-decision/labels/{billing['id']}")
        response = await httpx_client.get("v1/decisions", params={"label_id": [support["id"]]})
        assert [d["name"] for d in response.json()["data"]] == ["a-decision"]
        response = await httpx_client.get(
            "v1/decisions", params={"label_id": [support["id"], billing["id"]]}
        )
        assert [d["name"] for d in response.json()["data"]] == ["b-decision", "a-decision"]
        response = await httpx_client.get("v1/decisions", params={"label_id": ["nope"]})
        assert response.status_code == 422


class TestDescriptions:
    async def test_descriptions_are_trimmed_on_every_route(
        self, httpx_client: httpx.AsyncClient
    ) -> None:
        await create(httpx_client, decision={"description": "  padded  "})
        decision = (await httpx_client.get("v1/decisions/triage")).json()["data"]
        assert decision["description"] == "padded"
        await create(httpx_client, decision={"description": "  again  "})
        decision = (await httpx_client.get("v1/decisions/triage")).json()["data"]
        assert decision["description"] == "again"


class TestCloneDecision:
    async def test_clone_copies_versions_but_not_tags(
        self, httpx_client: httpx.AsyncClient
    ) -> None:
        first = await create(
            httpx_client,
            decision={"description": "source", "metadata": {"a": 1}},
            tags=[{"name": "production"}],
        )
        await create(httpx_client, model_name="tev2")
        response = await httpx_client.post(
            "v1/decisions/triage/clones", json={"name": "triage-copy", "metadata": {"b": 2}}
        )
        assert response.status_code == 201, response.text
        clone = response.json()["data"]
        assert response.headers["location"] == f"/v1/decisions/{clone['id']}"
        assert clone["name"] == "triage-copy"
        assert clone["source_decision_id"] == first["decision_id"]
        assert clone["description"] == "source"
        assert clone["metadata"] == {"b": 2}
        versions = (await httpx_client.get(f"v1/decisions/{clone['id']}/versions")).json()
        assert [v["model_name"] for v in versions["data"]] == ["tev2", "tev1"]
        assert all(v["decision_id"] == clone["id"] for v in versions["data"])
        response = await httpx_client.get("v1/decisions/triage-copy/tags/production")
        assert response.status_code == 404

    async def test_taken_name_is_already_exists(self, httpx_client: httpx.AsyncClient) -> None:
        source = await create(httpx_client)
        other = await create(httpx_client, "other")
        response = await httpx_client.post("v1/decisions/triage/clones", json={"name": "other"})
        assert response.status_code == 409
        problem = response.json()
        assert problem["code"] == "already_exists"
        assert problem["existing_id"] == other["decision_id"]
        assert problem["existing_id"] != source["decision_id"]

    async def test_missing_source(self, httpx_client: httpx.AsyncClient) -> None:
        response = await httpx_client.post("v1/decisions/missing/clones", json={"name": "x"})
        assert response.status_code == 404


async def create_label(client: httpx.AsyncClient, name: str, **fields: Any) -> dict[str, Any]:
    response = await client.post(
        "v1/decision_labels", json={"name": name, "color": "#00cc88", **fields}
    )
    assert response.status_code == 201, response.text
    data: dict[str, Any] = response.json()["data"]
    assert response.headers["location"] == f"/v1/decision_labels/{data['id']}"
    return data


class TestDecisionLabels:
    async def test_label_crud(self, httpx_client: httpx.AsyncClient) -> None:
        label = await create_label(httpx_client, "support", description="Support routing")
        assert GlobalID.from_id(label["id"]).type_name == "DecisionLabel"
        response = await httpx_client.get(f"v1/decision_labels/{label['id']}")
        assert response.json()["data"] == label
        response = await httpx_client.patch(
            f"v1/decision_labels/{label['id']}", json={"color": "#112233", "description": None}
        )
        assert response.status_code == 200, response.text
        patched = response.json()["data"]
        assert patched["color"] == "#112233"
        assert patched["name"] == "support"
        assert patched.get("description") is None
        await create_label(httpx_client, "billing")
        listed = (await httpx_client.get("v1/decision_labels", params={"limit": 1})).json()
        assert [item["name"] for item in listed["data"]] == ["billing"]
        listed = (
            await httpx_client.get(
                "v1/decision_labels", params={"limit": 1, "cursor": listed["next_cursor"]}
            )
        ).json()
        assert [item["name"] for item in listed["data"]] == ["support"]
        assert listed.get("next_cursor") is None
        assert (await httpx_client.delete(f"v1/decision_labels/{label['id']}")).status_code == 204
        assert (await httpx_client.get(f"v1/decision_labels/{label['id']}")).status_code == 404
        assert (await httpx_client.delete(f"v1/decision_labels/{label['id']}")).status_code == 404

    async def test_names_are_unique(self, httpx_client: httpx.AsyncClient) -> None:
        support = await create_label(httpx_client, "support")
        billing = await create_label(httpx_client, "billing")
        response = await httpx_client.post(
            "v1/decision_labels", json={"name": "support", "color": "#00cc88"}
        )
        assert response.status_code == 409
        assert response.json()["code"] == "already_exists"
        assert response.json()["existing_id"] == support["id"]
        response = await httpx_client.patch(
            f"v1/decision_labels/{billing['id']}", json={"name": "support"}
        )
        assert response.status_code == 409
        assert response.json()["existing_id"] == support["id"]

    @pytest.mark.parametrize(
        "body",
        [
            pytest.param({}, id="empty-patch"),
            pytest.param({"color": "red"}, id="bad-color"),
            pytest.param({"name": ""}, id="empty-name"),
        ],
    )
    async def test_invalid_patch(
        self, httpx_client: httpx.AsyncClient, body: dict[str, Any]
    ) -> None:
        label = await create_label(httpx_client, "support")
        response = await httpx_client.patch(f"v1/decision_labels/{label['id']}", json=body)
        assert response.status_code == 422, response.text

    async def test_applying_labels(self, httpx_client: httpx.AsyncClient) -> None:
        await create(httpx_client)
        support = await create_label(httpx_client, "support")
        billing = await create_label(httpx_client, "billing")
        url = "v1/decisions/triage/labels"
        for _ in range(2):  # idempotent
            response = await httpx_client.put(f"{url}/{support['id']}")
            assert response.status_code == 200, response.text
            assert response.json()["data"]["id"] == support["id"]
        assert [lbl["id"] for lbl in (await httpx_client.get(url)).json()["data"]] == [
            support["id"]
        ]
        response = await httpx_client.put(url, json={"decision_label_ids": [billing["id"]]})
        assert response.status_code == 200, response.text
        assert [lbl["id"] for lbl in response.json()["data"]] == [billing["id"]]
        for _ in range(2):  # idempotent
            assert (await httpx_client.delete(f"{url}/{billing['id']}")).status_code == 204
        assert (await httpx_client.get(url)).json()["data"] == []
        response = await httpx_client.put(
            url, json={"decision_label_ids": [support["id"], billing["id"], support["id"]]}
        )
        assert {lbl["id"] for lbl in response.json()["data"]} == {support["id"], billing["id"]}
        # Deleting a label removes it from the decision.
        await httpx_client.delete(f"v1/decision_labels/{support['id']}")
        assert [lbl["id"] for lbl in (await httpx_client.get(url)).json()["data"]] == [
            billing["id"]
        ]
        response = await httpx_client.put(url, json={"decision_labels_ids": []})
        assert response.status_code == 422

    async def test_unknown_decision_or_label(self, httpx_client: httpx.AsyncClient) -> None:
        await create(httpx_client)
        label = await create_label(httpx_client, "support")
        missing_label = str(GlobalID("DecisionLabel", "999"))
        assert (await httpx_client.get("v1/decisions/missing/labels")).status_code == 404
        response = await httpx_client.put(f"v1/decisions/missing/labels/{label['id']}")
        assert response.status_code == 404
        response = await httpx_client.put(f"v1/decisions/triage/labels/{missing_label}")
        assert response.status_code == 404
        response = await httpx_client.put(
            "v1/decisions/triage/labels", json={"decision_label_ids": [label["id"], missing_label]}
        )
        assert response.status_code == 404
        assert (await httpx_client.get("v1/decisions/triage/labels")).json()["data"] == []
        response = await httpx_client.put("v1/decisions/triage/labels/not-an-id")
        assert response.status_code == 422


class TestDeletedMidRequest:
    """A decision or custom provider deleted between a route's checks and its write is a 404
    naming the missing row, not a 500."""

    @pytest.mark.parametrize("update_fields", [False, True])
    async def test_decision_deleted_before_version_insert(
        self, httpx_client: httpx.AsyncClient, db: DbSessionFactory, update_fields: bool
    ) -> None:
        from fastapi import HTTPException

        from phoenix.db.types.identifier import Identifier
        from phoenix.server.api.routers.v1.decision_models import DecisionData, DecisionVersionData
        from phoenix.server.api.routers.v1.decisions import _insert_version

        created = await create(httpx_client)
        decision_id = int(GlobalID.from_id(created["decision_id"]).node_id)
        async with db() as session:
            decision = await session.get(models.Decision, decision_id)
            assert decision is not None
            # Delete the row behind the session's back, as a concurrent request would.
            await session.execute(
                delete(models.Decision)
                .where(models.Decision.id == decision_id)
                .execution_options(synchronize_session=False)
            )
            version = DecisionVersionData.model_validate(version_body()).to_orm(user_id=None)
            with pytest.raises(HTTPException) as caught:
                await _insert_version(
                    session,
                    version,
                    decision_id=decision_id,
                    decision_identifier="triage",
                    update=(
                        decision,
                        DecisionData(name=Identifier("triage"), description="changed"),
                    )
                    if update_fields
                    else None,
                )
        assert caught.value.status_code == 404
        assert "Decision not found" in str(caught.value.detail)


class TestVersionContext:
    async def test_versions_name_their_decision_number_and_tags(
        self, httpx_client: httpx.AsyncClient
    ) -> None:
        first = await create(httpx_client, tags=[{"name": "production"}, {"name": "canary"}])
        assert (first["decision_name"], first["version_number"]) == ("triage", 1)
        assert first["tag_names"] == ["canary", "production"]
        second = await create(httpx_client, model_name="tev2")
        assert second["version_number"] == 2
        assert second["tag_names"] == []
        await create(httpx_client, "other")  # numbering is per decision
        third = await create(httpx_client, model_name="tev3", tags=[{"name": "production"}])
        assert third["version_number"] == 3
        listed = (await httpx_client.get("v1/decisions/triage/versions")).json()["data"]
        assert [(v["version_number"], v["tag_names"]) for v in listed] == [
            (3, ["production"]),
            (2, []),
            (1, ["canary"]),
        ]
        by_tag = (await httpx_client.get("v1/decisions/triage/tags/production")).json()["data"]
        assert (by_tag["decision_name"], by_tag["version_number"]) == ("triage", 3)
        clone = (
            await httpx_client.post("v1/decisions/triage/clones", json={"name": "copy"})
        ).json()["data"]
        latest = (await httpx_client.get(f"v1/decisions/{clone['id']}/latest")).json()["data"]
        assert (latest["decision_name"], latest["version_number"]) == ("copy", 3)


class TestRuleErrorsNameTheField:
    @pytest.mark.parametrize(
        "overrides,field,code",
        [
            pytest.param(
                {"model_provider": "ANTHROPIC"}, "model_provider", "invalid_choice", id="provider"
            ),
            pytest.param({"model_name": " "}, "model_name", "too_short", id="model"),
            pytest.param(
                {"state": {"type": "text", "template": " "}},
                "state.template",
                "too_short",
                id="state",
            ),
            pytest.param(
                {
                    "questions": [
                        {"type": "predicate", "name": "a", "instructions": "ok"},
                        {
                            "type": "choice",
                            "name": "b",
                            "instructions": "ok",
                            "choices": [{"value": "x"}],
                        },
                    ]
                },
                "questions.1.choices",
                "out_of_range",
                id="choice-count",
            ),
            pytest.param(
                {
                    "questions": [
                        {
                            "type": "scale",
                            "name": "s",
                            "instructions": "ok",
                            "levels": [{"label": "low"}, {"label": " "}],
                        }
                    ]
                },
                "questions.0.levels.1.label",
                "too_short",
                id="level-label",
            ),
            pytest.param(
                {
                    "questions": [
                        {"type": "predicate", "name": "a", "instructions": "ok"},
                        {"type": "predicate", "name": "a", "instructions": "ok"},
                    ]
                },
                "questions.1.name",
                "invalid",
                id="duplicate-name",
            ),
            pytest.param(
                {
                    "template_format": "F_STRING",
                    "state": {"type": "text", "template": "{ticket}"},
                    "questions": [{"type": "predicate", "name": "a", "instructions": "bad {"}],
                },
                "questions.0",
                "invalid",
                id="unparseable-question",
            ),
        ],
    )
    async def test_field_paths(
        self, httpx_client: httpx.AsyncClient, overrides: dict[str, Any], field: str, code: str
    ) -> None:
        response = await httpx_client.post(
            "v1/decisions",
            json={"decision": {"name": "triage"}, "version": version_body(**overrides)},
        )
        assert response.status_code == 422, response.text
        problem = response.json()
        assert problem["code"] == "invalid_argument"
        assert problem["errors"] == [
            {"field": f"body.version.{field}", "code": code, "message": problem["detail"]}
        ]
