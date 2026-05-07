import datetime
from secrets import token_bytes, token_hex
from typing import Any

import httpx
import pytest
from sqlalchemy import select
from starlette.types import ASGIApp, Receive, Scope, Send
from strawberry.relay.types import GlobalID

from phoenix.db import models
from phoenix.db.facilitator import _ensure_enums
from phoenix.server.api.types.AnnotationSource import AnnotationSource
from phoenix.server.bearer_auth import PhoenixUser
from phoenix.server.types import (
    AccessTokenAttributes,
    AccessTokenClaims,
    AccessTokenId,
    DbSessionFactory,
    RefreshTokenId,
    UserId,
)
from tests.unit.graphql import AsyncGraphQLClient


class _AuthenticatedASGIApp:
    def __init__(self, app: ASGIApp, user: PhoenixUser) -> None:
        self._app = app
        self._user = user

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http":
            scope = {**scope, "user": self._user}
        await self._app(scope, receive, send)


def _phoenix_user(user_id: int) -> PhoenixUser:
    return PhoenixUser(
        UserId(user_id),
        AccessTokenClaims(
            subject=UserId(user_id),
            token_id=AccessTokenId(user_id),
            attributes=AccessTokenAttributes(
                refresh_token_id=RefreshTokenId(user_id),
                user_role="MEMBER",
            ),
        ),
    )


@pytest.fixture
async def _trace_data(db: DbSessionFactory) -> models.Trace:
    """Create and persist a single `Trace` record for annotation tests.

    Returns the created `Trace` so tests can derive a stable Relay `GlobalID`.
    """
    async with db() as session:
        project = models.Project(name=token_hex(8))
        session.add(project)
        await session.flush()

        trace = models.Trace(
            project_rowid=project.id,
            trace_id=token_hex(16),
            start_time=datetime.datetime.now(),
            end_time=datetime.datetime.now(),
        )
        session.add(trace)
    return trace


@pytest.fixture
async def _member_user_ids(db: DbSessionFactory) -> tuple[int, int]:
    await _ensure_enums(db)
    async with db() as session:
        member_role_id = await session.scalar(select(models.UserRole.id).filter_by(name="MEMBER"))
        assert isinstance(member_role_id, int)
        users = [
            models.LocalUser(
                email=f"{token_hex(8)}@example.com",
                username=token_hex(8),
                user_role_id=member_role_id,
                reset_password=False,
                password_hash=token_bytes(32),
                password_salt=token_bytes(32),
            )
            for _ in range(2)
        ]
        session.add_all(users)
        await session.flush()
        return users[0].id, users[1].id


def _transport_for_user(asgi_app: ASGIApp, user_id: int) -> httpx.ASGITransport:
    return httpx.ASGITransport(app=_AuthenticatedASGIApp(asgi_app, _phoenix_user(user_id)))


class TestTraceAnnotationMutations:
    """End-to-end tests for creating and upserting Trace annotations.

    This suite validates both initial creation and upsert-on-conflict behavior
    with and without an `identifier` for the same `(trace, name)` pair.
    """

    QUERY = """
    mutation CreateTraceAnnotations($input: [CreateTraceAnnotationInput!]!) {
      createTraceAnnotations(input: $input) {
        traceAnnotations {
          id
          name
          label
          score
          explanation
          identifier
          metadata
        }
      }
    }

    mutation PatchTraceAnnotations($input: [PatchAnnotationInput!]!) {
      patchTraceAnnotations(input: $input) {
        traceAnnotations {
          id
          name
          label
          score
          explanation
          identifier
          metadata
        }
      }
    }

    mutation DeleteTraceAnnotations($input: DeleteAnnotationsInput!) {
      deleteTraceAnnotations(input: $input) {
        traceAnnotations {
          id
        }
      }
    }

    mutation SetTraceUserFeedback($input: SetTraceUserFeedbackInput!) {
      setTraceUserFeedback(input: $input) {
        traceAnnotation {
          id
          name
          label
          score
          explanation
          identifier
          metadata
        }
      }
    }

    mutation DeleteTraceUserFeedback($input: DeleteTraceUserFeedbackInput!) {
      deleteTraceUserFeedback(input: $input) {
        traceAnnotation {
          id
          name
        }
      }
    }
    """

    async def test_trace_annotations_create_upsert_patch_delete(
        self,
        _trace_data: models.Trace,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        """End-to-end CRUD:

        - Create without identifier
        - Upsert with identifier
        - Upsert without identifier
        - Patch (label)
        - Delete
        """
        trace_gid = str(GlobalID("Trace", str(_trace_data.id)))

        # 1) Basic create (no identifier)
        create_input: dict[str, Any] = {
            "traceId": trace_gid,
            "name": "create_basic",
            "label": "LABEL1",
            "score": 0.75,
            "explanation": "Initial explanation",
            "annotatorKind": "HUMAN",
            "metadata": {},
            "identifier": "",
            "source": AnnotationSource.API.name,
        }
        result_create = await gql_client.execute(
            self.QUERY, {"input": [create_input]}, operation_name="CreateTraceAnnotations"
        )
        assert not result_create.errors
        assert result_create.data is not None
        data_create = result_create.data
        created = data_create["createTraceAnnotations"]["traceAnnotations"][0]
        assert created["name"] == create_input["name"]
        assert created["label"] == create_input["label"]
        assert created["score"] == create_input["score"]
        assert created["explanation"] == create_input["explanation"]
        assert created["identifier"] == ""
        assert isinstance(created["id"], str)

        # 2) Upsert with identifier (should update in place)
        base_with_id: dict[str, Any] = {
            "traceId": trace_gid,
            "name": "conflict_with_id",
            "label": "FIRST_LABEL",
            "score": 1.0,
            "explanation": "First",
            "annotatorKind": "HUMAN",
            "metadata": {"k": "v"},
            "identifier": "conflict",
            "source": "APP",
        }
        res1 = await gql_client.execute(
            self.QUERY, {"input": [base_with_id]}, operation_name="CreateTraceAnnotations"
        )
        assert not res1.errors
        assert (data1 := res1.data)
        ann1 = data1["createTraceAnnotations"]["traceAnnotations"][0]
        assert ann1["metadata"] == {"k": "v"}

        updated_with_id = {
            **base_with_id,
            "label": "UPDATED_LABEL",
            "score": 2.0,
            "explanation": "Updated explanation",
            "metadata": {"k": "v2", "x": 1},
        }
        res2 = await gql_client.execute(
            self.QUERY, {"input": [updated_with_id]}, operation_name="CreateTraceAnnotations"
        )
        assert not res2.errors
        assert (data2 := res2.data)
        ann2 = data2["createTraceAnnotations"]["traceAnnotations"][0]
        assert ann1["id"] == ann2["id"]
        assert ann2["label"] == "UPDATED_LABEL"
        assert ann2["score"] == 2.0
        assert ann2["explanation"] == "Updated explanation"
        assert ann2["metadata"] == {"k": "v2", "x": 1}

        # 3) Upsert without identifier (empty identifier also conflicts on (trace, name))
        base_no_id: dict[str, Any] = {
            "traceId": trace_gid,
            "name": "conflict_no_id",
            "label": "FIRST_LABEL",
            "score": 1.0,
            "explanation": "First",
            "annotatorKind": "HUMAN",
            "metadata": {},
            "identifier": "",
            "source": "APP",
        }
        res3 = await gql_client.execute(
            self.QUERY, {"input": [base_no_id]}, operation_name="CreateTraceAnnotations"
        )
        assert not res3.errors
        assert (data3 := res3.data)
        ann3 = data3["createTraceAnnotations"]["traceAnnotations"][0]
        assert ann3["name"] == base_no_id["name"]
        assert ann3["label"] == base_no_id["label"]
        assert ann3["score"] == base_no_id["score"]
        assert ann3["explanation"] == base_no_id["explanation"]
        assert ann3["identifier"] == ""

        updated_no_id = {
            **base_no_id,
            "label": "UPDATED_LABEL",
            "score": 2.0,
            "explanation": "Updated explanation",
        }
        res4 = await gql_client.execute(
            self.QUERY, {"input": [updated_no_id]}, operation_name="CreateTraceAnnotations"
        )
        assert not res4.errors
        assert (data4 := res4.data)
        ann4 = data4["createTraceAnnotations"]["traceAnnotations"][0]

        # Optional: patch the last annotation (label, score, explanation, metadata)
        patch_input = [
            {
                "annotationId": ann4["id"],
                "label": "PATCHED_LABEL",
                "score": 3.5,
                "explanation": "Patched explanation",
                "metadata": {"patched": True},
            }
        ]
        res_patch = await gql_client.execute(
            self.QUERY, {"input": patch_input}, operation_name="PatchTraceAnnotations"
        )
        assert not res_patch.errors
        assert (data_patch := res_patch.data)
        patched = data_patch["patchTraceAnnotations"]["traceAnnotations"][0]
        assert patched["id"] == ann4["id"]
        assert patched["label"] == "PATCHED_LABEL"
        assert patched["score"] == 3.5
        assert patched["explanation"] == "Patched explanation"
        assert patched["metadata"] == {"patched": True}

        delete_input = {"annotationIds": [ann4["id"]]}
        res_delete = await gql_client.execute(
            self.QUERY, {"input": delete_input}, operation_name="DeleteTraceAnnotations"
        )
        assert not res_delete.errors
        assert (data_delete := res_delete.data)
        deleted = data_delete["deleteTraceAnnotations"]["traceAnnotations"][0]
        assert deleted["id"] == ann4["id"]

    async def test_trace_annotations_reject_reserved_note_name(
        self,
        _trace_data: models.Trace,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        trace_gid = str(GlobalID("Trace", str(_trace_data.id)))
        response = await gql_client.execute(
            self.QUERY,
            {
                "input": [
                    {
                        "traceId": trace_gid,
                        "name": "note",
                        "explanation": "This should fail",
                        "annotatorKind": "HUMAN",
                        "metadata": {},
                        "identifier": "",
                        "source": AnnotationSource.API.name,
                    }
                ]
            },
            operation_name="CreateTraceAnnotations",
        )

        assert response.data is None
        assert response.errors
        assert (
            "The name 'note' is reserved for trace and span notes. "
            "Use POST /v1/trace_notes instead."
        ) in response.errors[0].message

    async def test_trace_annotations_reject_reserved_user_feedback_name(
        self,
        _trace_data: models.Trace,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        trace_gid = str(GlobalID("Trace", str(_trace_data.id)))
        response = await gql_client.execute(
            self.QUERY,
            {
                "input": [
                    {
                        "traceId": trace_gid,
                        "name": "user_feedback",
                        "label": "positive",
                        "score": 1,
                        "annotatorKind": "HUMAN",
                        "metadata": {},
                        "identifier": "",
                        "source": AnnotationSource.API.name,
                    }
                ]
            },
            operation_name="CreateTraceAnnotations",
        )

        assert response.data is None
        assert response.errors
        assert (
            "The name 'user_feedback' is reserved for trace user feedback. "
            "Use setTraceUserFeedback instead."
        ) in response.errors[0].message

    async def test_trace_user_feedback_set_upserts_and_second_delete_errors(
        self,
        _trace_data: models.Trace,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        trace_gid = str(GlobalID("Trace", str(_trace_data.id)))

        response = await gql_client.execute(
            self.QUERY,
            {"input": {"traceId": trace_gid, "label": "positive"}},
            operation_name="SetTraceUserFeedback",
        )
        assert not response.errors
        assert response.data is not None
        created = response.data["setTraceUserFeedback"]["traceAnnotation"]
        assert created["name"] == "user_feedback"
        assert created["label"] == "positive"
        assert created["score"] == 1.0
        assert created["explanation"] is None
        assert created["identifier"] == "px-app:anonymous"
        assert created["metadata"] == {}

        response = await gql_client.execute(
            self.QUERY,
            {"input": {"traceId": trace_gid, "label": "negative"}},
            operation_name="SetTraceUserFeedback",
        )
        assert not response.errors
        assert response.data is not None
        updated = response.data["setTraceUserFeedback"]["traceAnnotation"]
        assert updated["id"] == created["id"]
        assert updated["label"] == "negative"
        assert updated["score"] == 0.0

        async with db() as session:
            annotations = list(
                await session.scalars(
                    select(models.TraceAnnotation).where(
                        models.TraceAnnotation.name == "user_feedback"
                    )
                )
            )
        assert len(annotations) == 1
        assert annotations[0].source == "APP"

        response = await gql_client.execute(
            self.QUERY,
            {"input": {"traceId": trace_gid}},
            operation_name="DeleteTraceUserFeedback",
        )
        assert not response.errors
        assert response.data is not None
        deleted = response.data["deleteTraceUserFeedback"]["traceAnnotation"]
        assert deleted["id"] == created["id"]
        assert deleted["name"] == "user_feedback"

        response = await gql_client.execute(
            self.QUERY,
            {"input": {"traceId": trace_gid}},
            operation_name="DeleteTraceUserFeedback",
        )
        assert response.data is None
        assert response.errors
        assert "Trace user feedback not found" in response.errors[0].message

    async def test_trace_user_feedback_is_scoped_to_authenticated_user(
        self,
        _trace_data: models.Trace,
        _member_user_ids: tuple[int, int],
        asgi_app: ASGIApp,
        db: DbSessionFactory,
    ) -> None:
        trace_gid = str(GlobalID("Trace", str(_trace_data.id)))
        user_1_id, user_2_id = _member_user_ids

        async with (
            httpx.AsyncClient(
                transport=_transport_for_user(asgi_app, user_1_id),
                base_url="http://test",
            ) as user_1_httpx_client,
            httpx.AsyncClient(
                transport=_transport_for_user(asgi_app, user_2_id),
                base_url="http://test",
            ) as user_2_httpx_client,
        ):
            user_1_gql_client = AsyncGraphQLClient(user_1_httpx_client)
            user_2_gql_client = AsyncGraphQLClient(user_2_httpx_client)

            response = await user_1_gql_client.execute(
                self.QUERY,
                {"input": {"traceId": trace_gid, "label": "positive"}},
                operation_name="SetTraceUserFeedback",
            )
            assert not response.errors

            response = await user_2_gql_client.execute(
                self.QUERY,
                {"input": {"traceId": trace_gid, "label": "negative"}},
                operation_name="SetTraceUserFeedback",
            )
            assert not response.errors

            async with db() as session:
                annotations = list(
                    await session.scalars(
                        select(models.TraceAnnotation)
                        .where(models.TraceAnnotation.name == "user_feedback")
                        .order_by(models.TraceAnnotation.user_id)
                    )
                )
            assert [(annotation.user_id, annotation.label) for annotation in annotations] == [
                (user_1_id, "positive"),
                (user_2_id, "negative"),
            ]
            assert [annotation.identifier for annotation in annotations] == [
                f"px-app:{GlobalID('User', str(user_1_id))}",
                f"px-app:{GlobalID('User', str(user_2_id))}",
            ]

            response = await user_1_gql_client.execute(
                self.QUERY,
                {"input": {"traceId": trace_gid}},
                operation_name="DeleteTraceUserFeedback",
            )
            assert not response.errors

        async with db() as session:
            remaining_annotations = list(
                await session.scalars(
                    select(models.TraceAnnotation).where(
                        models.TraceAnnotation.name == "user_feedback"
                    )
                )
            )
        assert len(remaining_annotations) == 1
        assert remaining_annotations[0].user_id == user_2_id
        assert remaining_annotations[0].label == "negative"

    async def test_trace_user_feedback_rejects_unknown_label(
        self,
        _trace_data: models.Trace,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        trace_gid = str(GlobalID("Trace", str(_trace_data.id)))

        response = await gql_client.execute(
            self.QUERY,
            {"input": {"traceId": trace_gid, "label": "neutral"}},
            operation_name="SetTraceUserFeedback",
        )

        assert response.data is None
        assert response.errors
        assert "User feedback label must be 'positive' or 'negative'." in response.errors[0].message
