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


@pytest.fixture
def schema() -> strawberry.Schema:
    return strawberry.Schema(query=Query, extensions=[PhoenixErrorMasker])


class TestPhoenixErrorMasker:
    def test_uncaught_resolver_exception_is_masked_when_enabled(
        self, schema: strawberry.Schema, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv(ENV_PHOENIX_MASK_INTERNAL_SERVER_ERRORS, "true")
        result = schema.execute_sync("{ boom }")
        assert isinstance(result, ExecutionResult)
        assert result.errors is not None
        assert len(result.errors) == 1
        assert result.errors[0].message == _GENERIC_MASK_MESSAGE
        assert "super secret internal detail" not in result.errors[0].message

    def test_uncaught_resolver_exception_is_not_masked_when_disabled(
        self, schema: strawberry.Schema, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv(ENV_PHOENIX_MASK_INTERNAL_SERVER_ERRORS, "false")
        result = schema.execute_sync("{ boom }")
        assert isinstance(result, ExecutionResult)
        assert result.errors is not None
        assert len(result.errors) == 1
        assert "super secret internal detail" in result.errors[0].message

    def test_custom_graphql_error_message_is_surfaced(
        self, schema: strawberry.Schema, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv(ENV_PHOENIX_MASK_INTERNAL_SERVER_ERRORS, "true")
        result = schema.execute_sync("{ badRequest }")
        assert isinstance(result, ExecutionResult)
        assert result.errors is not None
        assert len(result.errors) == 1
        assert result.errors[0].message == "you sent a bad request"

    def test_unknown_field_validation_error_passes_through_unmasked(
        self, schema: strawberry.Schema, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv(ENV_PHOENIX_MASK_INTERNAL_SERVER_ERRORS, "true")
        result = schema.execute_sync("{ doesNotExist }")
        assert isinstance(result, ExecutionResult)
        assert result.errors is not None
        assert len(result.errors) == 1
        message = result.errors[0].message
        assert message != _GENERIC_MASK_MESSAGE
        assert message == "Cannot query field 'doesNotExist' on type 'Query'."

    def test_malformed_query_syntax_error_passes_through_unmasked(
        self, schema: strawberry.Schema, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv(ENV_PHOENIX_MASK_INTERNAL_SERVER_ERRORS, "true")
        result = schema.execute_sync("{ ok ")
        assert isinstance(result, ExecutionResult)
        assert result.errors is not None
        assert len(result.errors) == 1
        message = result.errors[0].message
        assert message != _GENERIC_MASK_MESSAGE
        assert message == "Syntax Error: Expected Name, found <EOF>."
