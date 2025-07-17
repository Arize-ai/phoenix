from datetime import datetime, timezone

from llama_index.core.llms.llm import LLM
from llama_index.core.prompts.base import PromptTemplate


async def generate_report_from_context(query: str, context: str, llm: LLM) -> str:
    prompt = PromptTemplate(
        """Information:
--------------------------------
{context}
--------------------------------
Using the above information, answer the following query or task: "{question}" in a detailed
report -- The report should focus on the answer to the query, should be well structured,
informative, in-depth, and comprehensive, with facts and numbers if available and at least
{total_words} words. You should strive to write the report as long as you can using all relevant
and necessary information provided.

Please follow all of the following guidelines in your report:
- You MUST determine your own concrete and valid opinion based on the given information. Do NOT
defer to general and meaningless conclusions.
- You MUST write the report with markdown syntax and {report_format} format.
- You MUST prioritize the relevance, reliability, and significance of the sources you use. Choose
trusted sources over less reliable ones.
- You must also prioritize new articles over older articles if the source can be trusted.
- Use in-text citation references in {report_format} format and make it with markdown hyperlink
placed at the end of the sentence or paragraph that references them like this:
([in-text citation](url)).
- Don't forget to add a reference list at the end of the report in {report_format} format and full
url links without hyperlinks.
- You MUST write all used source urls at the end of the report as references, and make sure to not
add duplicated sources, but only one reference for each. Every url should be hyperlinked:
[url website](url)
Additionally, you MUST include hyperlinks to the relevant URLs wherever they are referenced in the
report:

eg: Author, A. A. (Year, Month Date). Title of web page. Website Name. [url website](url)

Please do your best, this is very important to my career.
Assume that the current date is {date_today}.
"""
    )
    response = await llm.apredict(
        prompt,
        context=context,
        question=query,
        total_words=1000,
        report_format="APA",
        date_today=datetime.now(timezone.utc).strftime("%B %d, %Y"),
    )

    print("\n> Done generating report\n")

    return response
