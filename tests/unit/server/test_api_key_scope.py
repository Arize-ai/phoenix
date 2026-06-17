from collections.abc import MutableMapping
from datetime import datetime, timezone
from typing import Any, Optional
from unittest import mock

import pytest
from joserfc import jwt
from joserfc.jwk import OctKey
from pydantic import SecretStr

from phoenix.server.api_key_scope import (
    API_KEY_SCOPE_INGEST,
    ApiKeyScopeEnforcementMiddleware,
    deny_unknown_grpc_scope,
    get_request_api_key_scope,
    is_allowed_for_scope,
)
from phoenix.server.bearer_auth import PhoenixSystemUser, PhoenixUser
from phoenix.server.jwt_store import JwtStore
from phoenix.server.types import (
    AccessTokenAttributes,
    AccessTokenClaims,
    AccessTokenId,
    ApiKeyAttributes,
    ApiKeyClaims,
    ApiKeyId,
    RefreshTokenId,
    UserId,
)


def _api_key_user(scope: Optional[str]) -> PhoenixUser:
    user_id = UserId(1)
    claims = ApiKeyClaims(
        subject=user_id,
        token_id=ApiKeyId(1),
        attributes=ApiKeyAttributes(user_role="MEMBER", name="key", scope=scope),
    )
    return PhoenixUser(user_id, claims)


def _session_user() -> PhoenixUser:
    user_id = UserId(1)
    claims = AccessTokenClaims(
        subject=user_id,
        token_id=AccessTokenId(1),
        attributes=AccessTokenAttributes(user_role="MEMBER", refresh_token_id=RefreshTokenId(1)),
    )
    return PhoenixUser(user_id, claims)


class TestIsAllowedForScope:
    @pytest.mark.parametrize(
        "method,path",
        [
            ("POST", "/v1/traces"),
            ("POST", "/v1/traces/"),
            ("POST", "/v1/projects/my-project/spans"),
            ("POST", "/v1/projects/UHJvamVjdDox/spans"),
        ],
    )
    def test_ingest_allows_trace_writes(self, method: str, path: str) -> None:
        assert is_allowed_for_scope(API_KEY_SCOPE_INGEST, method, path)

    @pytest.mark.parametrize(
        "method,path",
        [
            ("GET", "/v1/traces"),  # reads are not ingest
            ("DELETE", "/v1/traces"),
            ("GET", "/v1/projects"),
            ("GET", "/v1/projects/my-project/spans"),
            ("POST", "/v1/projects/my-project/spans/otlpv1"),  # span search, not a write
            ("POST", "/v1/datasets/upload"),
            ("POST", "/v1/span_annotations"),
            ("POST", "/graphql"),
            ("GET", "/graphql"),
            ("POST", "/v1/projects"),
            ("GET", "/"),
        ],
    )
    def test_ingest_denies_everything_else(self, method: str, path: str) -> None:
        assert not is_allowed_for_scope(API_KEY_SCOPE_INGEST, method, path)

    @pytest.mark.parametrize("path", ["/v1/traces", "/graphql", "/v1/projects/p/spans"])
    def test_unknown_scope_denies_everything(self, path: str) -> None:
        # A scope minted by a newer server must fail closed, not fall back
        # to full access.
        assert not is_allowed_for_scope("future-scope", "POST", path)


class TestGetRequestApiKeyScope:
    def test_scoped_api_key(self) -> None:
        assert get_request_api_key_scope(_api_key_user("ingest")) == "ingest"

    def test_unscoped_api_key(self) -> None:
        assert get_request_api_key_scope(_api_key_user(None)) is None

    def test_session_user(self) -> None:
        assert get_request_api_key_scope(_session_user()) is None

    def test_system_user(self) -> None:
        assert get_request_api_key_scope(PhoenixSystemUser(UserId(1))) is None

    def test_unauthenticated(self) -> None:
        assert get_request_api_key_scope(None) is None


class TestDenyUnknownGrpcScope:
    def test_absent_scope_passes(self) -> None:
        assert not deny_unknown_grpc_scope(None)

    def test_ingest_passes(self) -> None:
        assert not deny_unknown_grpc_scope(API_KEY_SCOPE_INGEST)

    def test_unknown_scope_denied(self) -> None:
        assert deny_unknown_grpc_scope("future-scope")


class TestApiKeyScopeEnforcementMiddleware:
    @staticmethod
    async def _run(
        scope: dict[str, Any],
    ) -> tuple[bool, list[dict[str, Any]]]:
        """Returns (reached_downstream_app, messages_sent)."""
        reached = False
        sent: list[dict[str, Any]] = []

        async def app(scope: Any, receive: Any, send: Any) -> None:
            nonlocal reached
            reached = True

        async def receive() -> dict[str, Any]:
            return {"type": "http.request"}

        async def send(message: MutableMapping[str, Any]) -> None:
            sent.append(dict(message))

        await ApiKeyScopeEnforcementMiddleware(app)(scope, receive, send)
        return reached, sent

    async def test_unscoped_user_passes_through(self) -> None:
        scope = {
            "type": "http",
            "method": "GET",
            "path": "/v1/projects",
            "user": _api_key_user(None),
        }
        reached, sent = await self._run(scope)
        assert reached
        assert not sent

    async def test_session_user_passes_through(self) -> None:
        scope = {"type": "http", "method": "POST", "path": "/graphql", "user": _session_user()}
        reached, _ = await self._run(scope)
        assert reached

    async def test_scoped_key_allowed_on_ingest_route(self) -> None:
        scope = {
            "type": "http",
            "method": "POST",
            "path": "/v1/traces",
            "user": _api_key_user("ingest"),
        }
        reached, _ = await self._run(scope)
        assert reached

    @pytest.mark.parametrize(
        "method,path",
        [
            ("POST", "/graphql"),
            ("GET", "/v1/projects"),
            ("POST", "/v1/datasets/upload"),
            ("DELETE", "/v1/traces"),
        ],
    )
    async def test_scoped_key_denied_elsewhere(self, method: str, path: str) -> None:
        scope = {"type": "http", "method": method, "path": path, "user": _api_key_user("ingest")}
        reached, sent = await self._run(scope)
        assert not reached
        assert sent[0]["type"] == "http.response.start"
        assert sent[0]["status"] == 403

    async def test_scoped_key_denied_on_websocket(self) -> None:
        scope = {"type": "websocket", "path": "/graphql", "user": _api_key_user("ingest")}
        reached, sent = await self._run(scope)
        assert not reached
        assert sent == [{"type": "websocket.close", "code": 1008}]

    async def test_lifespan_passes_through(self) -> None:
        reached, _ = await self._run({"type": "lifespan"})
        assert reached


class TestJwtScopeRoundTrip:
    """The scope must survive mint → token → read, and absence must too."""

    _secret = SecretStr("0123456789abcdef0123456789abcdef")

    def _store(self) -> JwtStore:
        return JwtStore(mock.Mock(), self._secret)

    def _claims(self, scope: Optional[str]) -> ApiKeyClaims:
        return ApiKeyClaims(
            subject=UserId(7),
            token_id=ApiKeyId(7),
            issued_at=datetime.now(timezone.utc),
            attributes=ApiKeyAttributes(user_role="MEMBER", name="k", scope=scope),
        )

    @pytest.mark.parametrize("scope", ["ingest", None])
    async def test_round_trip(self, scope: Optional[str]) -> None:
        store = self._store()
        api_key_store = store._api_key_store
        claims = self._claims(scope)
        token = api_key_store._token(api_key_store._encode(claims))

        # the signed payload carries the scope claim (or omits it)
        decoded = jwt.decode(str(token), OctKey.import_key(self._secret.get_secret_value()))
        assert decoded.claims.get("scope") == scope
        assert decoded.claims["jti"] == "ApiKey:7"

        # read() rebuilds claims from the store (which knows no scope —
        # there is no DB column) and merges the scope from the token
        api_key_store._claims[ApiKeyId(7)] = self._claims(None)
        read_claims = await store.read(token)
        assert isinstance(read_claims, ApiKeyClaims)
        assert read_claims.attributes is not None
        assert read_claims.attributes.scope == scope

    async def test_scope_cannot_be_forged_without_secret(self) -> None:
        store = self._store()
        api_key_store = store._api_key_store
        api_key_store._claims[ApiKeyId(7)] = self._claims(None)
        forged = jwt.encode(
            {"alg": "HS256"},
            {"jti": "ApiKey:7", "scope": None},
            OctKey.import_key("wrong-secret-wrong-secret-wrong!"),
        )
        assert await store.read(api_key_store._token(forged)) is None
