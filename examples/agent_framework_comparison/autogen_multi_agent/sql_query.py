import os
import sys
from typing import Annotated

sys.path.insert(1, os.path.join(sys.path[0], ".."))

from db.database import run_query
from openinference.semconv.trace import SpanAttributes
from opentelemetry import trace
from pydantic import BaseModel, Field


class SQLQueryInput(BaseModel):
    sql_query: Annotated[
        str, Field(description="The SQL query to retrieve dataset for data analysis.")
    ]


def run_sql_query(
    input: Annotated[SQLQueryInput, "Input to the SQL query executor."],
) -> str:
    def _sanitize_query(query):
        query = query.strip()
        if query.startswith("```") and query.endswith("```"):
            query = query[3:-3].strip()
        elif query.startswith("```"):
            query = query[3:].strip()
        elif query.endswith("```"):
            query = query[:-3].strip()
        return query

    if isinstance(input, SQLQueryInput):
        sql_query = input.sql_query.strip()
    else:
        return "Invalid input: expected SQLQueryInput model."

    tracer = trace.get_tracer(__name__)
    with tracer.start_as_current_span("run_sql_query") as span:
        span.set_attribute(SpanAttributes.OPENINFERENCE_SPAN_KIND, "CHAIN")
        span.set_attribute(SpanAttributes.INPUT_VALUE, sql_query)

        sanitized_query = _sanitize_query(sql_query)
        results = str(run_query(sanitized_query))

        span.set_attribute(SpanAttributes.OUTPUT_VALUE, results)
        return results
