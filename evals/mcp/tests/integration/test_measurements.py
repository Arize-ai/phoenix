from fastmcp import Client, FastMCP

from measurements import sql_measurements
from target import ToolMeasurements


async def test_actual_mcp_dispatch_records_success_error_envelopes_and_schema_reads():
    events = []
    mcp = FastMCP("audit-test")

    @mcp.tool
    async def executeSql(sql: str, validate_only: bool = False) -> dict:
        if "broken" in sql:
            return {"error": {"message": "SQL failed"}}
        return {"columns": ["count"], "rows": [[1]]}

    @mcp.tool
    async def describeSqlSchema() -> str:
        return "CREATE TABLE traces (id INTEGER)"

    mcp.add_middleware(ToolMeasurements(lambda **event: events.append(event)))
    async with Client(mcp) as client:
        await client.call_tool("executeSql", {"sql": "SELECT count(*) FROM TRACES"})
        await client.call_tool("executeSql", {"sql": "SELECT broken FROM traces"})
        await client.call_tool("executeSql", {"sql": "SELECT 1", "validate_only": True})
        await client.call_tool("describeSqlSchema", {})
    assert sql_measurements(events) == {
        "sql_attempted": 3,
        "sql_succeeded": 1,
        "schema_inspected": 1,
        "sql_measurement_complete": 1,
    }
    assert not any(event["kind"] == "denied" for event in events)
