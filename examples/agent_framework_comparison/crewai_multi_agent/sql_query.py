import os
import sys
from typing import Type

sys.path.insert(1, os.path.join(sys.path[0], ".."))

from crewai_tools import BaseTool
from db.database import run_query
from openinference.semconv.trace import SpanAttributes
from opentelemetry import trace
from pydantic import BaseModel, Field


class SQLQueryInput(BaseModel):
    """Input for SQLQueryTool."""

    sql_query: str = Field(description="The SQL query to retrieve dataset for data analysis.")


class SQLQueryTool(BaseTool):
    name: str = "SQL Query Executor Tool"
    description: str = "A tool that can be used to run SQL query on the database."
    args_schema: Type[BaseModel] = SQLQueryInput

    def _sanitize_query(self, query: str) -> str:
        query = query.strip()
        if query.startswith("```") and query.endswith("```"):
            query = query[3:-3].strip()
        elif query.startswith("```"):
            query = query[3:].strip()
        elif query.endswith("```"):
            query = query[:-3].strip()
        return query

    def _run(self, sql_query: str) -> str:
        tracer = trace.get_tracer(__name__)
        with tracer.start_as_current_span("run_sql_query") as span:
            span.set_attribute(SpanAttributes.OPENINFERENCE_SPAN_KIND, "CHAIN")
            span.set_attribute(SpanAttributes.INPUT_VALUE, sql_query)

            sanitized_query = self._sanitize_query(sql_query)
            results = str(run_query(sanitized_query))

            span.set_attribute(SpanAttributes.OUTPUT_VALUE, results)
            return results
