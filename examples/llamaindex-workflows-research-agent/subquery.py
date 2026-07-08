from datetime import datetime, timezone

from llama_index.core.llms.llm import LLM
from llama_index.core.prompts.base import PromptTemplate

SUB_QUERY_PROMPT = PromptTemplate(
    "Write {max_iterations} google search queries to search online that form an objective opinion "
    'from the following task: "{task}"\n'
    f"Assume the current date is {datetime.now(timezone.utc).strftime('%B %d, %Y')} if required.\n"
    "You must respond with the search queries separated by comma in the following format: query 1, "
    "query 2, query 3\n"
    "{max_iterations} google search queries for {task} (separated by comma): "
)


async def get_sub_queries(
    query: str,
    llm: LLM,
    num_sub_queries: int = 3,
):
    """
    Gets the sub queries
    Args:
        query: original query
        llm: LLM to generate sub queries
    Returns:
        sub_queries: List of sub queries

    """
    response = await llm.apredict(
        SUB_QUERY_PROMPT,
        task=query,
        max_iterations=num_sub_queries,
    )
    sub_queries = list(map(lambda x: x.strip().strip('"').strip("'"), response.split(",")))

    return sub_queries
