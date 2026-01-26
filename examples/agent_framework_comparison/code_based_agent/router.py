import json
import os
import sys

sys.path.insert(1, os.path.join(sys.path[0], ".."))

from dotenv import load_dotenv
from openai import OpenAI
from openinference.instrumentation import using_prompt_template
from openinference.semconv.trace import SpanAttributes
from opentelemetry import trace
from opentelemetry.trace.propagation.tracecontext import TraceContextTextMapPropagator
from prompt_templates.router_template import SYSTEM_PROMPT

from skills.skill_map import SkillMap

load_dotenv()

client = OpenAI()
skill_map = SkillMap()


# Define the router function
def router(messages, parent_context):
    tracer = trace.get_tracer(__name__)
    propagator = TraceContextTextMapPropagator()
    context = propagator.extract(parent_context)

    with tracer.start_as_current_span("router_call", context=context) as span:
        span.set_attribute(SpanAttributes.OPENINFERENCE_SPAN_KIND, "CHAIN")
        span.set_attribute(SpanAttributes.INPUT_VALUE, str(messages))
        span.set_attribute(SpanAttributes.INPUT_MIME_TYPE, "application/json")

        if not any(
            isinstance(message, dict) and message.get("role") == "system" for message in messages
        ):
            system_prompt = {"role": "system", "content": SYSTEM_PROMPT}
            messages.append(system_prompt)

        with using_prompt_template(template=SYSTEM_PROMPT, version="v0.1"):
            response = client.chat.completions.create(
                model="gpt-4o",
                messages=messages,
                tools=skill_map.get_combined_function_description_for_openai(),
            )

        messages.append(response.choices[0].message)
        tool_calls = response.choices[0].message.tool_calls
        if tool_calls:
            span.set_attribute(
                SpanAttributes.OUTPUT_VALUE, str(response.choices[0].message.tool_calls)
            )
            handle_tool_calls(tool_calls, messages, tracer)
            new_context = {}
            propagator.inject(new_context)
            return router(messages, new_context)
        else:
            span.set_attribute(
                SpanAttributes.OUTPUT_VALUE, str(response.choices[0].message.content)
            )
            return response.choices[0].message.content


def handle_tool_calls(tool_calls, messages, tracer):
    for tool_call in tool_calls:
        function_name = tool_call.function.name
        arguments = tool_call.function.arguments

        try:
            arguments = json.loads(arguments)
        except json.JSONDecodeError:
            print("Error: Invalid JSON, treating arguments as string")

        try:
            function_to_call = skill_map.get_function_callable_by_name(function_name)
        except KeyError:
            function_result = "Error: Unknown function call"

        with tracer.start_as_current_span(
            function_name, attributes={"function_name": function_name}
        ) as span:
            span.set_attribute(SpanAttributes.OPENINFERENCE_SPAN_KIND, "TOOL")
            span.set_attribute(SpanAttributes.TOOL_NAME, function_name)
            span.set_attribute(SpanAttributes.TOOL_PARAMETERS, str(arguments))

            span.set_attribute(SpanAttributes.INPUT_VALUE, str(arguments))
            function_result = function_to_call(arguments)
            span.set_attribute(SpanAttributes.OUTPUT_VALUE, function_result)

        # Append the result to the message history
        messages.append({"role": "tool", "content": function_result, "tool_call_id": tool_call.id})
