from types import SimpleNamespace

from fastmcp import Client, FastMCP

from smoke_target import ToolBoundary
from trajectory import sql_measurements


async def test_actual_mcp_dispatch_records_success_error_envelopes_and_schema_reads():
    events = []
    policy = SimpleNamespace(
        project_id=1,
        review=None,
        log=lambda kind, **fields: events.append({"kind": kind, **fields}),
    )
    mcp = FastMCP("audit-test")

    @mcp.tool
    async def executeSql(sql: str) -> dict:
        if "broken" in sql:
            return {"error": {"message": "SQL failed"}}
        return {"columns": ["count"], "rows": [[1]]}

    @mcp.tool
    async def describeSqlSchema() -> str:
        return "CREATE TABLE traces (id INTEGER)"

    mcp.add_middleware(ToolBoundary(policy))
    async with Client(mcp) as client:
        await client.call_tool("executeSql", {"sql": "SELECT count(*) FROM TRACES"})
        await client.call_tool("executeSql", {"sql": "SELECT broken FROM traces"})
        await client.call_tool("describeSqlSchema", {})
    assert sql_measurements(events) == {
        "sql_attempted": 2,
        "sql_succeeded": 1,
        "schema_inspected": 1,
        "sql_measurement_complete": 1,
    }
    assert not any(event["kind"] == "denied" for event in events)
