"""
Example: Evaluating a tool-calling agent's trajectory with experiments

This example simulates a simple tool-calling agent that answers questions by
dispatching to the right tool (get_weather, get_time). It then uses Phoenix
experiments to verify the agent called the correct tool for each question by
inspecting the trace spans.

Flow:
1. Define the agent's tools (traced with OpenTelemetry so spans are recorded)
2. Create a dataset of questions with expected tool calls
3. Run the agent against each dataset example as an experiment
4. Evaluate by fetching spans from each run's trace to check tool usage

Prerequisites:
- Phoenix server running on http://localhost:6006
- pip install arize-phoenix-client arize-phoenix-otel openinference-semconv
"""

import time
from datetime import datetime, timezone
from typing import Any

import phoenix.otel
from openinference.semconv.trace import OpenInferenceSpanKindValues, SpanAttributes
from opentelemetry import trace

from phoenix.client import Client
from phoenix.client.resources.experiments.evaluators import create_evaluator

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------
# Register the global tracer provider so that tool spans are exported to Phoenix.
# The experiment runner creates its own tracer for the root span, but any child
# spans created inside the task (our tool functions) use the global tracer.
# OTel context propagation ensures they share the same trace_id.
#
# Both register() and Client() default to http://localhost:6006. Override via
# PHOENIX_COLLECTOR_ENDPOINT / PHOENIX_PORT environment variables if needed.

phoenix.otel.register()
tracer = trace.get_tracer(__name__)
client = Client()

# ---------------------------------------------------------------------------
# Step 1: Define the agent's tools
# ---------------------------------------------------------------------------
# Each tool is wrapped in an OpenTelemetry span with the TOOL span kind so that
# calling it creates a TOOL span in the active trace. This is what lets us
# inspect tool usage after the fact.

OPENINFERENCE_SPAN_KIND = SpanAttributes.OPENINFERENCE_SPAN_KIND
TOOL = OpenInferenceSpanKindValues.TOOL.value


def get_weather(location: str) -> dict[str, Any]:
    with tracer.start_as_current_span("get_weather") as span:
        span.set_attribute(OPENINFERENCE_SPAN_KIND, TOOL)
        span.set_attribute("tool.parameters", f'{{"location": "{location}"}}')
        result = {
            "location": location,
            "temperature": 72,
            "condition": "sunny",
        }
        return result


def get_time(tz: str) -> dict[str, Any]:
    with tracer.start_as_current_span("get_time") as span:
        span.set_attribute(OPENINFERENCE_SPAN_KIND, TOOL)
        span.set_attribute("tool.parameters", f'{{"timezone": "{tz}"}}')
        result = {
            "timezone": tz,
            "time": datetime.now(timezone.utc).strftime("%I:%M %p"),
        }
        return result


# ---------------------------------------------------------------------------
# Step 2: Define the agent
# ---------------------------------------------------------------------------
# A minimal tool-calling agent: it reads the user question, decides which tool
# to call, invokes it, and returns a natural-language answer.


def run_agent(question: str) -> str:
    q = question.lower()
    if "weather" in q:
        city = question.split("in ")[-1].rstrip("?").strip()
        result = get_weather(city)
        return (
            f"The weather in {result['location']} is "
            f"{result['temperature']}F and {result['condition']}."
        )
    if "time" in q:
        tz = "Asia/Tokyo" if "tokyo" in q else "UTC"
        result = get_time(tz)
        return f"The time in {result['timezone']} is {result['time']}."
    return "I don't know how to answer that."


# ---------------------------------------------------------------------------
# Step 3: Build the evaluator
# ---------------------------------------------------------------------------
# After each experiment run, we fetch the TOOL spans from its trace and check
# whether the expected tool was called. This validates the agent's routing
# logic end-to-end.
#
# We use a factory function (like the TS example) because the evaluator needs
# the project name to query spans, and the experiment auto-generates its project
# name at runtime. The evaluator receives `trace_id` automatically because it's
# declared as a parameter name — the experiment framework binds it from the
# task run's trace.


def create_tool_call_evaluator(project_name: str) -> Any:
    """Create an evaluator that checks whether the expected tool was called."""

    @create_evaluator(kind="CODE", name="has-expected-tool-call")
    def tool_call_evaluator(expected: dict[str, Any], trace_id: str) -> dict[str, Any]:
        if not trace_id:
            return {
                "label": "no trace",
                "score": 0,
                "explanation": "No trace ID available for this task run",
            }

        # Fetch only TOOL spans from this experiment run's trace
        tool_spans = client.spans.get_spans(
            project_identifier=project_name,
            trace_ids=[trace_id],
            span_kind="TOOL",
        )

        expected_tool = (expected or {}).get("expected_tool", "")
        tool_names = [s["name"] for s in tool_spans]
        found = any(expected_tool in name for name in tool_names)

        return {
            "label": "tool called" if found else "no tool call",
            "score": 1 if found else 0,
            "explanation": (
                f"Found tool spans: {tool_names}"
                if found
                else f"Expected '{expected_tool}' but found: {tool_names or 'none'}"
            ),
            "metadata": {"tool_span_count": len(tool_spans), "tool_names": tool_names},
        }

    return tool_call_evaluator


# ---------------------------------------------------------------------------
# Step 4: Run the experiment and evaluate
# ---------------------------------------------------------------------------


def main() -> None:
    # 4a. Create a dataset of questions, each annotated with which tool the
    #     agent should call.
    dataset = client.datasets.create_dataset(
        name="tool-call-example-dataset",
        dataset_description="Questions that require tool use",
        inputs=[
            {"question": "What is the weather in San Francisco?"},
            {"question": "What time is it in Tokyo?"},
            {"question": "What is the weather in London?"},
        ],
        outputs=[
            {"expected_tool": "get_weather"},
            {"expected_tool": "get_time"},
            {"expected_tool": "get_weather"},
        ],
    )

    # 4b. Run the agent against every dataset example. We don't pass evaluators
    #     here because we need spans to be fully ingested before evaluating.
    #     The task receives `input` (the input dict from each dataset example).
    experiment = client.experiments.run_experiment(
        dataset=dataset,
        task=lambda input: run_agent(input["question"]),
    )

    project_name = experiment["project_name"]
    print(f"\nProject: {project_name}")
    print("\n--- Experiment Runs ---")
    for run in experiment["task_runs"]:
        print(
            f"  example={run['dataset_example_id']}"
            f"  trace_id={run.get('trace_id', 'N/A')}"
            f"  output={str(run['output'])[:80]}"
        )

    # 4c. Brief pause to let Phoenix finish ingesting the exported spans.
    #     The experiment's task spans are exported via OTLP, and Phoenix needs
    #     a moment to process them before they're queryable.
    print("\nWaiting for span ingestion...")
    time.sleep(3)

    # 4d. Evaluate: fetch spans from each run's trace and verify tool usage.
    assert project_name is not None
    evaluated = client.experiments.evaluate_experiment(
        experiment=experiment,
        evaluators=[create_tool_call_evaluator(project_name)],
    )

    print("\n--- Evaluation Results ---")
    for eval_run in evaluated["evaluation_runs"]:
        result = eval_run.result
        if result is None:
            print(f"  [{eval_run.name}]  error={eval_run.error}")
            continue
        # result may be a single EvaluationResult or a sequence
        if isinstance(result, dict):
            print(
                f"  [{eval_run.name}]"
                f"  label={result.get('label')}"
                f"  score={result.get('score')}"
                f"  explanation={result.get('explanation')}"
            )


if __name__ == "__main__":
    main()
