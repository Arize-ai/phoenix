import os
import sys

from langchain_core.tools import tool
from openai import OpenAI
from openinference.instrumentation import using_prompt_template
from openinference.semconv.trace import SpanAttributes
from opentelemetry import trace

sys.path.insert(1, os.path.join(sys.path[0], ".."))

from db.database import get_schema, get_table, run_query
from prompt_templates.sql_generator_template import SYSTEM_PROMPT


@tool
def generate_and_run_sql_query(query: str):
    """Generates and runs an SQL query based on the prompt.

    Args:
        query (str): A string containing the original user prompt.

    Returns:
        str: The result of the SQL query.
    """

    def _sanitize_query(query):
        # Remove triple backticks from the query if present
        query = query.strip()
        if query.startswith("```") and query.endswith("```"):
            query = query[3:-3].strip()
        elif query.startswith("```"):
            query = query[3:].strip()
        elif query.endswith("```"):
            query = query[:-3].strip()
        return query

    if isinstance(query, dict) and "prompt" in query:
        prompt = query["prompt"]
    elif isinstance(query, str):
        prompt = query
    else:
        return "Invalid input: expected a dictionary with 'prompt' key or a string."

    client = OpenAI()
    table = get_table()
    schema = get_schema()

    with using_prompt_template(
        template=SYSTEM_PROMPT,
        variables={"SCHEMA": schema, "TABLE": table},
        version="v0.1",
    ):
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "system",
                    "content": SYSTEM_PROMPT.format(SCHEMA=schema, TABLE=table),
                },
                {"role": "user", "content": prompt},
            ],
        )

    sql_query = response.choices[0].message.content

    tracer = trace.get_tracer(__name__)
    with tracer.start_as_current_span("run_sql_query") as span:
        span.set_attribute(SpanAttributes.OPENINFERENCE_SPAN_KIND, "CHAIN")
        span.set_attribute(SpanAttributes.INPUT_VALUE, sql_query)
        sanitized_query = _sanitize_query(sql_query)
        results = str(run_query(sanitized_query))
        span.set_attribute(SpanAttributes.OUTPUT_VALUE, results)
        return results
