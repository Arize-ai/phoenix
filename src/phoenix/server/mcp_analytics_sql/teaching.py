from __future__ import annotations

import logging
from typing import Optional

from phoenix.server.mcp_analytics_sql.ddl import DetailLevel, render_schema_ddl, validate_ddl

logger = logging.getLogger(__name__)


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
    return schema_ddl
