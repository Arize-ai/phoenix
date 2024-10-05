# Some frameworks (Autogen and Langchain) can't handle the self argument in the function definition.
# In those cases, we can't use a class-based approach to define the skill.
# Instead, we can define the skill as a function.
#
# This class is an alternative to the generate_sql_query.py file

from openinference.instrumentation import using_prompt_template
from db.database import get_schema, get_table, run_query
from prompt_templates.sql_generator_template import SYSTEM_PROMPT
from openinference.semconv.trace import SpanAttributes
from opentelemetry import trace
from openai import OpenAI
from pydantic import BaseModel, Field
from typing import Annotated

# Autogen requires a pydantic function to be used as the input type.
class SQLQueryInput(BaseModel):
    prompt: Annotated[str, Field(description="The original, unchanged user prompt.")]


def generate_and_run_sql_query(
    input: Annotated[SQLQueryInput, "Input to the SQL query generator and executor."]
) -> str:
    """Generates and runs an SQL query based on the prompt.

    Args:
        input (SQLQueryInput): The input containing the original user prompt under the 'prompt' key.
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
    
    def _generate_sql_query(prompt):
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
                        "content": SYSTEM_PROMPT.format(
                            SCHEMA=schema, TABLE=table
                        ),
                    },
                    {"role": "user", "content": prompt},
                ],
            )

            sql_query = response.choices[0].message.content
            return sql_query

    tracer = trace.get_tracer(__name__)
    sql_query = _generate_sql_query(input.prompt)

    with tracer.start_as_current_span("run_sql_query") as span:
        span.set_attribute(SpanAttributes.OPENINFERENCE_SPAN_KIND, "CHAIN")
        span.set_attribute(SpanAttributes.INPUT_VALUE, sql_query)
        
        sanitized_query = _sanitize_query(sql_query)
        results = str(run_query(sanitized_query))
        
        # If the query fails, retry once:
        if results.startswith("An error occurred"):
            prompt = (
                f"The following SQL query failed: {sql_query} with the following error: {results}. "
                f"Please try again. Here is the original prompt: {input.prompt}"
            )
            sql_query = _generate_sql_query(prompt)
            results = str(run_query(sanitized_query))
            
        span.set_attribute(SpanAttributes.OUTPUT_VALUE, results)
        return results
