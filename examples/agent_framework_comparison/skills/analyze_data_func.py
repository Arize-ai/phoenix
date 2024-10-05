# Some frameworks (Autogen and Langchain) can't handle the self argument in the function definition.
# In those cases, we can't use a class-based approach to define the skill.
# Instead, we can define the skill as a function.
#
# This class is an alternative to the analyze_data.py file

from typing import Annotated
from pydantic import BaseModel, Field
import json
from openai import OpenAI
from openinference.instrumentation import using_prompt_template
from openinference.semconv.trace import SpanAttributes
from opentelemetry import trace
from prompt_templates.data_analysis_template import PROMPT_TEMPLATE, SYSTEM_PROMPT

# Autogen requires a pydantic function to be used as the input type.
class DataAnalyzerInput(BaseModel):
    prompt: Annotated[str, Field(description="The original user prompt that the data is based on.")]
    data: Annotated[str, Field(description="The data to analyze.")]

def data_analyzer(input: Annotated[DataAnalyzerInput, "Input to the data analyzer."]):
    """Provides insights, trends, or analysis based on the data and prompt.

    Args:
        input (DataAnalyzerInput): The input containing the data to analyze and
        the original user prompt that the data is based on. Contains the keys 'prompt' and 'data'.

    Returns:
        str: The analysis result.
    """

    client = OpenAI()

    tracer = trace.get_tracer(__name__)
    with tracer.start_as_current_span("data_analysis_tool") as span:
        span.set_attribute(SpanAttributes.OPENINFERENCE_SPAN_KIND, "CHAIN")
        span.set_attribute(
            SpanAttributes.INPUT_VALUE,
            PROMPT_TEMPLATE.format(PROMPT=input.prompt, DATA=input.data),
        )
        with using_prompt_template(
            template=PROMPT_TEMPLATE,
            variables={"PROMPT": input.prompt, "DATA": input.data},
            version="v0.1",
        ):
            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": PROMPT_TEMPLATE.format(PROMPT=input.prompt, DATA=input.data),
                    },
                ],
            )
        analysis_result = response.choices[0].message.content
        span.set_attribute(SpanAttributes.OUTPUT_VALUE, analysis_result)
        return analysis_result