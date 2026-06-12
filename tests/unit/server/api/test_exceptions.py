import pytest
import strawberry
from strawberry.types.execution import ExecutionResult

from phoenix.config import ENV_PHOENIX_MASK_INTERNAL_SERVER_ERRORS
from phoenix.server.api.exceptions import (
    _GENERIC_MASK_MESSAGE,
    BadRequest,
    PhoenixErrorMasker,
)


@strawberry.type
class Query:
    @strawberry.field
    def ok(self) -> str:
        return "ok"

    @strawberry.field
    def boom(self) -> str:
        raise RuntimeError("super secret internal detail")

    @strawberry.field
    def bad_request(self) -> str:
        raise BadRequest("you sent a bad request")


def _build_schema() -> strawberry.Schema:
    return strawberry.Schema(query=Query, extensions=[PhoenixErrorMasker])


class TestPhoenixErrorMasker:
    def test_uncaught_resolver_exception_is_masked_when_enabled(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv(ENV_PHOENIX_MASK_INTERNAL_SERVER_ERRORS, "true")
        result = _build_schema().execute_sync("{ boom }")
        assert isinstance(result, ExecutionResult)
        assert result.errors is not None
        assert len(result.errors) == 1
        assert result.errors[0].message == _GENERIC_MASK_MESSAGE
        # the original exception detail must not leak to the client
        assert "super secret internal detail" not in result.errors[0].message

    def test_uncaught_resolver_exception_is_not_masked_when_disabled(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv(ENV_PHOENIX_MASK_INTERNAL_SERVER_ERRORS, "false")
        result = _build_schema().execute_sync("{ boom }")
        assert isinstance(result, ExecutionResult)
        assert result.errors is not None
        assert len(result.errors) == 1
        assert "super secret internal detail" in result.errors[0].message

    def test_custom_graphql_error_message_is_surfaced(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        # masking is enabled, but a CustomGraphQLError should still surface its
        # friendly message rather than the generic masked message
        monkeypatch.setenv(ENV_PHOENIX_MASK_INTERNAL_SERVER_ERRORS, "true")
        result = _build_schema().execute_sync("{ badRequest }")
        assert isinstance(result, ExecutionResult)
        assert result.errors is not None
        assert len(result.errors) == 1
        assert result.errors[0].message == "you sent a bad request"

    def test_validation_error_is_not_masked(self, monkeypatch: pytest.MonkeyPatch) -> None:
        # querying a field that does not exist is a validation error produced
        # during the validate phase; it never reaches a resolver and must pass
        # through to the client unmasked even when masking is enabled
        monkeypatch.setenv(ENV_PHOENIX_MASK_INTERNAL_SERVER_ERRORS, "true")
        result = _build_schema().execute_sync("{ doesNotExist }")
        assert isinstance(result, ExecutionResult)
        assert result.errors is not None
        assert len(result.errors) == 1
        message = result.errors[0].message
        assert message != _GENERIC_MASK_MESSAGE
        assert "doesNotExist" in message

    def test_syntax_error_is_not_masked(self, monkeypatch: pytest.MonkeyPatch) -> None:
        # a malformed query is a parse-phase error with no original_error and
        # must not be masked
        monkeypatch.setenv(ENV_PHOENIX_MASK_INTERNAL_SERVER_ERRORS, "true")
        result = _build_schema().execute_sync("{ ok ")
        assert isinstance(result, ExecutionResult)
        assert result.errors is not None
        assert len(result.errors) == 1
        assert result.errors[0].message != _GENERIC_MASK_MESSAGE
