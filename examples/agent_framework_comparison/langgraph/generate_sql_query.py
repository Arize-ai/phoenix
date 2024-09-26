import os
import sys

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from openinference.instrumentation import using_prompt_template

sys.path.insert(1, os.path.join(sys.path[0], ".."))

from db.database import get_schema, get_table, run_query
from prompt_templates.sql_generator_template import SYSTEM_PROMPT


@tool
def generate_and_run_sql_query(original_prompt: str):
    """Generates and runs an SQL query based on the prompt.

    Args:
        original_prompt (str): A string containing the original user prompt.

    Returns:
        str: The result of the SQL query.
    """
    return _generate_and_run_sql_query(original_prompt, retry=True)


def _generate_and_run_sql_query(original_prompt: str, retry: bool = False):
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

    table = get_table()
    schema = get_schema()

    with using_prompt_template(
        template=SYSTEM_PROMPT,
        variables={"SCHEMA": schema, "TABLE": table},
        version="v0.1",
    ):
        model = ChatOpenAI(model="gpt-4o")
        messages = [
            SystemMessage(content=SYSTEM_PROMPT.format(SCHEMA=schema, TABLE=table)),
            HumanMessage(content=original_prompt),
        ]
        response = model.invoke(messages)

    sql_query = response.content

    sanitized_query = _sanitize_query(sql_query)
    results = str(run_query(sanitized_query))
    if "An error occurred" in results and retry:
        retry_str = (
            f"\n I've already tried this query: {sql_query} \n"
            f"and got this error: {results} \n Please try again."
        )
        return _generate_and_run_sql_query(original_prompt + retry_str, retry=False)
    return results
