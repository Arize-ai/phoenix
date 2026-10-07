"""Which Phoenix surface answers which question.

Agents reach Phoenix data two ways: one REST tool per endpoint, and a read-only
analytics SQL pair. Left to the tool list alone they over-reach for SQL on
single-entity lookups and page through REST results to count. The rule is stated in
``PHOENIX_MCP_DATA_ACCESS_INSTRUCTIONS.xml`` beside the other prompts and goes out
whole as the MCP server's ``initialize`` instructions. Its two sentences are repeated
below, on purpose, for the SQL tools and the code-mode ``execute`` tool, where a
client that skipped the instructions still sees them. Keep the two copies the same.
"""

from phoenix.server.agents.prompts.static_prompts import read_static_prompt

DATA_ACCESS_INSTRUCTIONS = read_static_prompt("tools/PHOENIX_MCP_DATA_ACCESS_INSTRUCTIONS.xml")

REST_WHEN = (
    "Use the REST tool for a resource when the question identifies one thing and wants "
    "its fields or what hangs off it, even as a count or a list: a trace, span, session, "
    "project, dataset, example, experiment, run, prompt, evaluator, annotation, or setting "
    "named by id, by name, or by position such as the latest or the first. The REST "
    "object is the resolved view, with templates, output configs, statuses, and formatted "
    "errors that the tables hold as raw JSON or not at all."
)

SQL_WHEN = (
    "Use SQL when the answer is computed over many traces, spans, sessions, runs, or "
    "examples at once: a count, sum, average, percentile, ratio, distribution, ranking, "
    "group-by, time window, or a join across spans, traces, sessions, datasets, "
    "experiments, or costs. Do not page through REST results and aggregate them in code; "
    "one statement does it."
)

EXECUTE_SQL_DESCRIPTION = f"""Run one read-only SQL statement over the allowlisted Phoenix tables.

{REST_WHEN} {SQL_WHEN}

A statement may be at most 2 KiB of UTF-8; split longer work. The result holds
`columns`, `rows`, `row_count_is_partial` (the authoritative truncation flag),
`applied`, and `notes`, or an `error` envelope when the SQL is refused: check for
`error` before reading `rows`. Preserve any error in your summary. `estimated_rows`
is available only on PostgreSQL and is a planner estimate, not a count. Code-mode
`call_tool` returns the envelope as a dictionary, so do not `json.loads` it. With
`validate_only=True` the statement is checked but returns no rows."""

DESCRIBE_SQL_SCHEMA_DESCRIPTION = (
    "Return the allowlisted analytics SQL schema for telemetry, datasets, experiments, "
    "evaluators, and prompts, for writing `executeSql` statements. Call it once a question "
    "needs SQL (an answer computed across many rows); for the fields of one identified "
    "entity, call that resource's REST tool instead."
)

EXECUTE_ROUTING_NOTE = (
    "For one identified trace, span, session, project, dataset, experiment, or prompt, call "
    "its REST tool (`getSpans`, `getSession`, `getProject`, `getDataset`, `getExperiment`, "
    "`getPromptVersionLatest`, and the rest, found with `search`); choose `executeSql` only "
    "for answers computed over many of them at once."
)

__all__ = [
    "DATA_ACCESS_INSTRUCTIONS",
    "DESCRIBE_SQL_SCHEMA_DESCRIPTION",
    "EXECUTE_ROUTING_NOTE",
    "EXECUTE_SQL_DESCRIPTION",
    "REST_WHEN",
    "SQL_WHEN",
]
