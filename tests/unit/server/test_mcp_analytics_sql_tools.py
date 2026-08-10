import pytest
from fastmcp import FastMCP
from mcp.types import TextContent

from phoenix.server.mcp_analytics_sql.allowlist import load_allowlist
from phoenix.server.mcp_analytics_sql.errors import AnalyticsSqlError, ErrorCode
from phoenix.server.mcp_analytics_sql.execute import _success_envelope
from phoenix.server.mcp_analytics_sql.output import ExecuteSqlErrorEnvelope
from phoenix.server.mcp_analytics_sql.parse import AdmissionOutcome, try_parse_and_admit
from phoenix.server.mcp_analytics_sql.rewrite import RewriteContext
from phoenix.server.mcp_analytics_sql.tools import (
    _EXECUTE_SQL_OUTPUT_SCHEMA,
    _preamble,
    register_analytics_sql_tools,
)
from phoenix.server.types import DbSessionFactory


@pytest.fixture
def analytics_mcp(db: DbSessionFactory) -> FastMCP:
    mcp = FastMCP("test")
    register_analytics_sql_tools(mcp, db=db)
    return mcp


async def test_tools_are_registered(analytics_mcp: FastMCP) -> None:
    """The analytics surface registers unconditionally alongside the other MCP tools."""
    tools = await analytics_mcp.list_tools()
    names = {tool.name for tool in tools}
    assert {"describeSqlSchema", "executeSql"} <= names


async def test_schema_carries_the_invariants_the_envelope_does_not(
    analytics_mcp: FastMCP,
) -> None:
    """Everything constant is stated here, once, rather than on every answer.

    The per-query envelope carries only fields that can differ between two
    calls. That split is only sound if the constants remain reachable somewhere,
    so this is the other half of the contract the liveness suite pins from the
    execute side: drop a field from the envelope without landing it here and
    callers lose it entirely.
    """
    result = await analytics_mcp.call_tool("describeSqlSchema", {"detail": "brief"})
    text = "".join(block.text for block in result.content if isinstance(block, TextContent))
    assert "read-only" in text
    assert "Not snapshot-isolated" in text
    assert "sqlite_progress_handler" in text or "statement_timeout" in text
    assert "rows by default" in text and "max" in text
    assert "bytes per row" in text and "per response" in text
    assert "global allowlisted schema defines queryable tables" in text
    assert "FOREIGN KEY targets outside that allowlist are descriptive" in text
    assert "Common allowed functions" in text
    assert "percent_rank" in text
    assert "percentile(x, p)" in text or "percentile_cont(p)" in text
    assert "portable subset shared by SQLite and PostgreSQL" in text
    assert 'detail="detailed"' in text
    assert "cannot use a direct index" in text


def test_postgres_preamble_advertises_its_percentile_spelling() -> None:
    """The function names must match the backend that will execute the query."""
    assert "percentile_cont(p) WITHIN GROUP" in _preamble("postgresql", None)


async def test_filtered_schema_does_not_limit_the_global_allowlist(analytics_mcp: FastMCP) -> None:
    """A filter affects discovery output, not the executor's allowlisted surface."""
    result = await analytics_mcp.call_tool(
        "describeSqlSchema", {"tables": ["spans"], "detail": "detailed"}
    )
    text = "".join(block.text for block in result.content if isinstance(block, TextContent))

    assert "CREATE TABLE spans" in text
    assert "CREATE TABLE traces" not in text
    assert "global allowlisted schema defines queryable tables" in text
    admission = try_parse_and_admit("SELECT id FROM traces", dialect="sqlite")
    assert admission.outcome is AdmissionOutcome.ADMIT, admission.detail


async def test_schema_is_returned_as_text_without_a_structured_mirror(
    analytics_mcp: FastMCP,
) -> None:
    """Nothing parses this, so it ships as text and ships once.

    FastMCP mirrors a scalar return into `{"result": <the same text>}` unless the
    output schema is suppressed. Over MCP both halves land in the model's
    context, so the whole schema would be paid for twice.
    """
    result = await analytics_mcp.call_tool("describeSqlSchema", {"detail": "brief"})
    assert result.structured_content is None
    assert [type(block).__name__ for block in result.content] == ["TextContent"]


async def test_execute_sql_declares_its_envelope(analytics_mcp: FastMCP) -> None:
    """`dict[str, Any]` derives an output schema that names nothing.

    FastMCP fills one in from the return annotation when none is given, and for
    a bare dict that is `{"type": "object"}` -- true, and carrying no field. The
    distinctions that decide how an answer is read then have nowhere to live
    except prose in the description.
    """
    tool = {t.name: t for t in await analytics_mcp.list_tools()}["executeSql"]
    schema = tool.output_schema
    assert schema is not None
    success_schema, error_schema = schema["oneOf"]
    properties = success_schema["properties"]
    assert {"columns", "rows", "row_count", "row_count_is_partial", "applied"} <= set(properties)
    # The two fields most easily confused for each other carry the distinction
    # on the field rather than in the tool description.
    assert "row_count_is_partial" in properties["estimated_rows"]["description"]
    assert "not a count" in properties["estimated_rows"]["description"]
    assert "effective dialect" in properties["applied"]["description"]
    assert "Caveats" in properties["notes"]["description"]
    error_properties = error_schema["properties"]["error"]["properties"]
    assert {"code", "message", "identifiers"} <= set(error_properties)
    assert set(error_properties["code"]["enum"]) == {code.value for code in ErrorCode}
    assert "error" in (tool.description or "")
    assert "json.loads" in (tool.description or "")
    assert "available only" in (tool.description or "")
    assert "PostgreSQL" in (tool.description or "")
    assert "Preserve any error" in (tool.description or "")


async def test_envelope_matches_the_declared_schema(analytics_mcp: FastMCP) -> None:
    """A field added to the envelope must fail here, not at a caller's validator.

    `additionalProperties` is left open in the declaration, so an undeclared
    field would pass validation at runtime and simply be invisible to anything
    reading the schema. This is the check that keeps the two in step.

    The envelope is built directly rather than by executing a statement. What is
    under test is which keys `_success_envelope` can emit, and executing to
    obtain them would make the assertion depend on a database: the tool resolves
    its own SQLite path from the deployment config, so the call reads whatever
    `~/.phoenix/phoenix.db` happens to be rather than any fixture.

    `estimated_rows` is passed a value because it is the one key emitted
    conditionally, so an envelope built without it would not exercise it.
    """
    tool = {t.name: t for t in await analytics_mcp.list_tools()}["executeSql"]
    schema = tool.output_schema
    assert schema is not None

    ctx = RewriteContext(allowlist=load_allowlist("sqlite"), dialect="sqlite", row_limit=500)
    ctx.applied.append("limit_injection")
    ctx.notes.append("a note")
    envelope = _success_envelope(
        columns=["v"],
        rows=[[1]],
        row_count=1,
        partial=False,
        ctx=ctx,
        backend_validated=True,
        estimated_rows=42,
    )

    error_envelope = AnalyticsSqlError(
        code=ErrorCode.NOT_READ_ONLY,
        message="Only read-only SELECT is supported.",
        identifiers=("spans",),
    )
    assert schema["type"] == _EXECUTE_SQL_OUTPUT_SCHEMA["type"] == "object"
    assert len(schema["oneOf"]) == len(_EXECUTE_SQL_OUTPUT_SCHEMA["oneOf"]) == 2
    assert envelope.model_dump(exclude_none=True)["estimated_rows"] == 42
    assert ExecuteSqlErrorEnvelope.from_error(error_envelope).model_dump(exclude_none=True) == {
        "error": {
            "code": ErrorCode.NOT_READ_ONLY,
            "message": "Only read-only SELECT is supported.",
            "identifiers": ["spans"],
        }
    }


async def test_execute_sql_returns_failures_as_data(analytics_mcp: FastMCP) -> None:
    """A failure is data rather than a transport error."""
    result = await analytics_mcp.call_tool("executeSql", {"sql": "DELETE FROM spans"})

    assert not result.is_error
    assert result.structured_content is not None
    error = result.structured_content["error"]
    assert error["code"] in {code.value for code in ErrorCode}
    assert error["message"]
