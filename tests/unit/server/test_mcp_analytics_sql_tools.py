import pytest
from fastmcp import FastMCP
from mcp.types import TextContent

from phoenix.server.mcp_analytics_sql.allowlist import load_allowlist
from phoenix.server.mcp_analytics_sql.execute import _success_envelope
from phoenix.server.mcp_analytics_sql.rewrite import RewriteContext
from phoenix.server.mcp_analytics_sql.tools import register_analytics_sql_tools
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
    properties = schema["properties"]
    assert {"columns", "rows", "row_count", "row_count_is_partial", "applied"} <= set(properties)
    # The two fields most easily confused for each other carry the distinction
    # on the field rather than in the tool description.
    assert "row_count_is_partial" in properties["estimated_rows"]["description"]
    assert "not a count" in properties["estimated_rows"]["description"]


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

    ctx = RewriteContext(allowlist=load_allowlist(), dialect="sqlite", row_limit=500)
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

    undeclared = set(envelope) - set(schema["properties"])
    assert not undeclared, f"envelope carries fields the schema does not declare: {undeclared}"
    declared_applied = set(schema["properties"]["applied"]["properties"])
    assert not set(envelope["applied"]) - declared_applied
    # Every key the schema calls required has to be one the envelope always sets.
    assert not set(schema["required"]) - set(envelope)
