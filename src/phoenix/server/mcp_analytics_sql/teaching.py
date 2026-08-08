from __future__ import annotations

import logging
from typing import Literal, Optional

from phoenix.server.mcp_analytics_sql.ddl import render_schema_ddl, validate_ddl

logger = logging.getLogger(__name__)

DetailLevel = Literal["brief", "detailed", "full"]

BRIEF_BYTE_BUDGET = 8_192
DETAILED_BYTE_BUDGET = 32_768

FULL_EXAMPLES = {
    "attribute_shape_sampling_sqlite": (
        "SELECT key, json_each.type AS shape, COUNT(*) "
        "FROM spans, json_each(attributes) GROUP BY key, shape ORDER BY 3 DESC"
    ),
    "attribute_shape_sampling_postgresql": (
        "SELECT key, jsonb_typeof(value) AS shape, COUNT(*) "
        "FROM spans, jsonb_each(attributes) GROUP BY key, shape ORDER BY 3 DESC"
    ),
    # What is addressable inside one span's attributes, and how large each part
    # is. The key space is undeclared, so this is how a caller finds out what
    # paths exist before writing one -- including keys that contain a dot and
    # are therefore siblings of the object they appear to be nested in.
    "attribute_keys_of_one_span_sqlite": (
        "SELECT je.key, je.type AS shape, length(je.value) AS bytes "
        "FROM spans s, json_each(s.attributes) je WHERE s.span_id = 'SPAN_ID'"
    ),
    # A trace's shape: every span with its parent, in order. The parent link is
    # what makes a trace navigable -- a sibling of the span an evaluator flagged
    # is where the cause usually is, and a flat list cannot show that.
    "trace_structure_sqlite": (
        "SELECT s.span_id, s.parent_id, s.name, s.span_kind, s.start_time "
        "FROM spans s JOIN traces t ON t.id = s.trace_rowid "
        "WHERE t.trace_id = 'TRACE_ID' ORDER BY s.start_time"
    ),
    "trace_structure_postgresql": (
        "SELECT s.span_id, s.parent_id, s.name, s.span_kind, s.start_time "
        "FROM spans s JOIN traces t ON t.id = s.trace_rowid "
        "WHERE t.trace_id = 'TRACE_ID' ORDER BY s.start_time"
    ),
    "attribute_keys_of_one_span_postgresql": (
        "SELECT je.key, jsonb_typeof(je.value) AS shape, length(je.value::text) AS bytes "
        "FROM spans s, jsonb_each(s.attributes) je WHERE s.span_id = 'SPAN_ID'"
    ),
}


def describe_sql_schema(
    *,
    area: Optional[str] = None,
    tables: Optional[list[str]] = None,
    detail: DetailLevel = "brief",
    search: Optional[str] = None,
    dialect: str = "postgresql",
) -> str:
    """Render the catalog as text, and record what it cost.

    Text rather than a JSON envelope because nothing parses this: the consumer
    is a model, and a wrapper only pays for structure no reader uses. The
    envelope also charged for itself, since JSON escapes every newline in a
    document that is mostly newlines -- 174 tokens at `detailed`, about 7%.

    Discovery is a large share of the tokens a caller spends before writing any
    SQL, yet it leaves no trace server-side, so its cost can only be measured
    from the client by whoever thought to look. Logging the size makes it
    observable from here.
    """
    text = _describe_sql_schema(
        area=area, tables=tables, detail=detail, search=search, dialect=dialect
    )
    logger.debug(
        "analytics sql: describeSqlSchema detail=%s area=%s tables=%s -> %d bytes",
        detail,
        area or "all",
        ",".join(tables) if tables else "all",
        len(text.encode("utf-8")),
    )
    return text


def _describe_sql_schema(
    *,
    area: Optional[str] = None,
    tables: Optional[list[str]] = None,
    detail: DetailLevel = "brief",
    search: Optional[str] = None,
    dialect: str = "postgresql",
) -> str:
    # The schema is rendered as DDL rather than as a JSON transcript of itself.
    # It is the form the caller writes back, and it carries dialect-real types
    # where JSON could only carry the abstraction ("datetime" for both backends,
    # when one is TIMESTAMP and the other TIMESTAMP WITH TIME ZONE).
    #
    # Validated before it is returned. A generator can emit text that reads like
    # DDL and is not -- a comment swallowing the comma after it did exactly that
    # here -- and the caller cannot tell, because it is prose to them.
    schema_ddl = render_schema_ddl(
        area=area, tables=tables, detail=detail, search=search, dialect=dialect
    )
    validate_ddl(schema_ddl, dialect)
    # An empty rendering means the filters matched nothing, and silence does not
    # say which filter was wrong. A misspelled table, a denied one, an unknown
    # area and a search with no hits all produced the same blank response, so a
    # caller could not tell a typo from an empty deployment.
    if not schema_ddl.strip():
        asked = [
            f"area={area!r}" if area else "",
            f"tables={tables!r}" if tables else "",
            f"search={search!r}" if search else "",
        ]
        filters = ", ".join(a for a in asked if a) or "this request"
        return (
            f"-- No allowlisted table matched {filters}. Call describeSqlSchema "
            "with no arguments to list every table available."
        )
    sections = [schema_ddl]

    if detail == "full":
        key = (
            "attribute_shape_sampling_postgresql"
            if dialect == "postgresql"
            else "attribute_shape_sampling_sqlite"
        )
        sections.append(f"-- what is inside `attributes`, and how often:\n{FULL_EXAMPLES[key]};")

    text = "\n\n".join(section for section in sections if section)

    # The budget is a signal to whoever tunes this surface, so it is stated in
    # the document rather than raised: a caller who asked for `detailed` still
    # wants the schema, and losing it to a size complaint helps nobody.
    budget = BRIEF_BYTE_BUDGET if detail == "brief" else DETAILED_BYTE_BUDGET
    if detail in ("brief", "detailed") and len(text.encode("utf-8")) > budget:
        text += f"\n\n-- note: {detail} schema exceeds its {budget} byte budget"
    return text
