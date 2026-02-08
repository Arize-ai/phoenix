import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from agent_framework_comparison.db.database import get_schema, get_table, run_query
from openai import OpenAI
from openinference.instrumentation import using_prompt_template
from openinference.semconv.trace import SpanAttributes
from opentelemetry import trace
from prompt_templates.sql_generator_template import SYSTEM_PROMPT

from skills.skill import Skill


class GenerateSQLQuery(Skill):
    def __init__(self):
        super().__init__(
            self.NAME, self.SQL_GENERATOR_FUNCTION_DICT, self.generate_and_run_sql_query
        )
        self.table = get_table()
        self.schema = get_schema()

    NAME = "generate_and_run_sql_query"
    SQL_GENERATOR_FUNCTION_DICT = {
        "type": "function",
        "function": {
            "name": NAME,
            "description": (
                "Generates SQL queries based on the prompt. "
                f"This tool has access to the following table: {get_table()}."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "prompt": {
                        "type": "string",
                        "description": (
                            "The prompt to generate an SQL query from. "
                            "This prompt should never be an SQL query."
                        ),
                    },
                    "with_retries": {
                        "type": "boolean",
                        "description": (
                            "Whether to retry the query generation if it fails. Defaults to True."
                        ),
                    },
                },
                "required": ["prompt"],
            },
        },
    }

    # Define the SQL generator function
    def generate_and_run_sql_query(self, args, with_retries=True):
        """Generates and runs an SQL query based on the prompt.

        Args:
            args (dict): A dictionary containing the prompt to
            generate an SQL query from.
            with_retries (bool, optional): Whether to retry the
            query generation if it fails. Defaults to True.

        Returns:
            str: The result of the SQL query.
        """

        if isinstance(args, dict) and "prompt" in args:
            prompt = args["prompt"]
        elif isinstance(args, str):
            prompt = args
        else:
            return "Invalid input: expected a dictionary with 'prompt' key or a string."

        client = OpenAI()

        with using_prompt_template(
            template=SYSTEM_PROMPT,
            variables={"SCHEMA": self.schema, "TABLE": self.table},
            version="v0.1",
        ):
            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "system",
                        "content": SYSTEM_PROMPT.format(SCHEMA=self.schema, TABLE=self.table),
                    },
                    {"role": "user", "content": prompt},
                ],
            )

        sql_query = response.choices[0].message.content

        tracer = trace.get_tracer(__name__)
        with tracer.start_as_current_span("run_sql_query") as span:
            span.set_attribute(SpanAttributes.OPENINFERENCE_SPAN_KIND, "CHAIN")
            span.set_attribute(SpanAttributes.INPUT_VALUE, sql_query)
            sanitized_query = self._sanitize_query(sql_query)
            results = str(run_query(sanitized_query))
            span.set_attribute(SpanAttributes.OUTPUT_VALUE, results)
            if (
                with_retries
                and isinstance(results, str)
                and results.startswith("An error occurred")
            ):
                if not hasattr(self, "retry_count"):
                    self.retry_count = 0
                self.retry_count += 1
                if self.retry_count <= 2:
                    prompt = (
                        f"The following SQL query failed: {sql_query} "
                        f"with the following error: {results}. "
                        f"Please try again. Here is the original prompt: {prompt}"
                    )

                    return self.generate_and_run_sql_query(prompt)
                else:
                    self.retry_count = 0
                    return "Failed to generate a valid SQL query after 2 retries."
            return results

    # In a real world scenario, we would want to sanitize the query to remove any potential SQL
    # injection vulnerabilities. However, for the sake of this example, we will just remove the
    # triple backticks.
    def _sanitize_query(self, query):
        query = query.strip()
        if query.startswith("```") and query.endswith("```"):
            query = query[3:-3].strip()
        elif query.startswith("```"):
            query = query[3:].strip()
        elif query.endswith("```"):
            query = query[:-3].strip()
        return query
