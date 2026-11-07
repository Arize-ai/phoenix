import logging

import pytest
import strawberry

from phoenix.server.api.exceptions import NotFound, PhoenixErrorMasker
from phoenix.server.api.schema import PhoenixSchema

SECRET = "alice@example.com"


@strawberry.type
class Query:
    @strawberry.field
    def user(self, email: str) -> str:
        raise NotFound(f"No user with email {email}")

    @strawberry.field
    def boom(self, email: str) -> str:
        raise RuntimeError(f"lookup failed for {email}")


@pytest.fixture
def schema() -> strawberry.Schema:
    return PhoenixSchema(query=Query, extensions=[PhoenixErrorMasker])


@pytest.fixture(autouse=True)
def _capture_error_logs(caplog: pytest.LogCaptureFixture) -> None:
    caplog.set_level(logging.DEBUG, logger="strawberry.execution")
    caplog.set_level(logging.DEBUG, logger="phoenix.server.api.schema")


class TestPhoenixSchemaProcessErrors:
    async def test_expected_errors_are_not_logged(
        self, schema: strawberry.Schema, caplog: pytest.LogCaptureFixture
    ) -> None:
        result = await schema.execute(f'query Q {{ user(email: "{SECRET}") }}')

        assert result.errors and SECRET in result.errors[0].message
        assert caplog.records == []

    async def test_resolver_faults_are_logged_without_the_message(
        self, schema: strawberry.Schema, caplog: pytest.LogCaptureFixture
    ) -> None:
        result = await schema.execute(f'query Q {{ boom(email: "{SECRET}") }}')

        assert result.errors
        (record,) = caplog.records
        assert record.name == "phoenix.server.api.schema"
        assert record.levelno == logging.ERROR
        assert record.getMessage() == "GraphQL operation Q failed at path ['boom']"
        assert record.exc_info is not None
        assert isinstance(record.exc_info[1], RuntimeError)

    async def test_rejected_requests_are_logged_by_position_only(
        self, schema: strawberry.Schema, caplog: pytest.LogCaptureFixture
    ) -> None:
        result = await schema.execute(f'query Q {{ nope(email: "{SECRET}") }}')

        assert result.errors
        (record,) = caplog.records
        assert record.levelno == logging.WARNING
        assert record.getMessage() == "GraphQL operation Q rejected at [(1, 11)]"
        assert SECRET not in record.getMessage()
        assert "nope" not in record.getMessage()
