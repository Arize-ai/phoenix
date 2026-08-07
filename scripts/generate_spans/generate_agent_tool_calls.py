"""Agent traces that exercise tool calling and the agent graph attributes.

Every trace is one agent run: a root ``AGENT`` span containing a ReAct-style loop of
``LLM`` spans that request tools and ``TOOL`` spans that answer them. The ``tool_call.id``
emitted by an LLM span is repeated as ``tool.id`` on the ``TOOL`` span it triggers, so the
UI can correlate a request with its result.
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timedelta

from opentelemetry.trace import StatusCode

try:
    from ._shared import (
        Annotations,
        Generator,
        add_common_arguments,
        duration_for,
        llm_attributes,
        message_attributes,
        ns,
        positive_int,
        probability,
        utc_now,
    )
except ImportError:  # Support direct execution from this directory.
    from _shared import (
        Annotations,
        Generator,
        add_common_arguments,
        duration_for,
        llm_attributes,
        message_attributes,
        ns,
        positive_int,
        probability,
        utc_now,
    )

AGENT_NAME = "support-copilot"
SYSTEM_PROMPT = "You are a support copilot. Use the available tools before answering."
TASKS = (
    "Why was this customer charged twice last month?",
    "Summarize the open issues for account 4471 and draft a reply.",
    "Find the deployment that introduced the latency regression.",
    "Check whether this workspace is over its ingestion quota.",
)
FINAL_ANSWERS = (
    "The duplicate charge came from a retried invoice; a refund has been issued.",
    "Two issues are open; the drafted reply is ready for review.",
    "The regression started with the 2.14.0 deploy that changed the retry policy.",
    "The workspace is at 82% of its ingestion quota and is not throttled.",
)

# Each tool carries the JSON schema an SDK would send to the model, plus a canned result.
TOOLS = (
    {
        "name": "search_knowledge_base",
        "description": "Search the support knowledge base for relevant articles.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Natural language query."},
                "top_k": {"type": "integer", "default": 3},
            },
            "required": ["query"],
        },
        "arguments": {"query": "duplicate charge refund policy", "top_k": 3},
        "result": "3 articles matched; the refund policy article is the closest.",
        "latency": (0.25, 0.90),
        "failure_weight": 0.8,
    },
    {
        "name": "lookup_account",
        "description": "Fetch billing and plan details for an account.",
        "parameters": {
            "type": "object",
            "properties": {"account_id": {"type": "string"}},
            "required": ["account_id"],
        },
        "arguments": {"account_id": "4471"},
        "result": '{"plan": "team", "status": "active", "invoices": 2}',
        # A cached record lookup: the fast, boring, reliable one.
        "latency": (0.03, 0.18),
        "failure_weight": 0.3,
    },
    {
        "name": "run_sql_query",
        "description": "Run a read-only SQL query against the analytics warehouse.",
        "parameters": {
            "type": "object",
            "properties": {
                "sql": {"type": "string"},
                "limit": {"type": "integer", "default": 100},
            },
            "required": ["sql"],
        },
        "arguments": {"sql": "select * from invoices where account_id = '4471'", "limit": 100},
        "result": "2 rows returned; both invoices reference the same subscription period.",
        # A warehouse query: an order of magnitude slower than the rest, and prone to timeouts.
        "latency": (0.90, 4.50),
        "failure_weight": 1.8,
    },
    {
        "name": "send_email",
        "description": "Send an email to the customer contact on file.",
        "parameters": {
            "type": "object",
            "properties": {
                "to": {"type": "string", "format": "email"},
                "subject": {"type": "string"},
                "body": {"type": "string"},
            },
            "required": ["to", "subject", "body"],
        },
        "arguments": {
            "to": "customer@example.com",
            "subject": "Your duplicate charge",
            "body": "We issued a refund for the duplicate invoice.",
        },
        "result": "queued",
        # A third-party API: quick when it works, and the least dependable thing here.
        "latency": (0.15, 0.70),
        "failure_weight": 2.4,
    },
)

# Chance a run fails its task even when every tool call succeeded — bad plan, wrong tool, or a
# correct-looking answer that misses the point. Without it, tool errors become the only way a
# run can fail, which no real agent trace looks like.
BASELINE_FAILURE_RATE = 0.12

TOOL_FAILURES = (
    "upstream billing API returned 503",
    "query exceeded the 30s statement timeout",
    "tool call arguments failed schema validation",
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Generate agent traces with tool calls, tool results, and graph nodes."
    )
    add_common_arguments(parser, default_project="agent-tool-calls")
    parser.add_argument(
        "--traces",
        type=positive_int,
        default=25,
        help="Number of agent runs to generate (default: 25).",
    )
    parser.add_argument(
        "--max-steps",
        type=positive_int,
        default=4,
        help="Maximum tool-calling steps before the agent answers (default: 4).",
    )
    parser.add_argument(
        "--parallel-tool-calls",
        type=positive_int,
        default=2,
        help="Maximum tool calls a single LLM step may request at once (default: 2).",
    )
    parser.add_argument(
        "--tool-error-rate",
        type=probability,
        default=0.12,
        help="Probability that a tool call fails and is retried (default: 0.12).",
    )
    parser.add_argument(
        "--tool-retry-success-rate",
        type=probability,
        default=0.75,
        help="Probability that the retry after a failed tool call succeeds (default: 0.75).",
    )
    parser.add_argument(
        "--sessions",
        type=positive_int,
        default=5,
        help="Number of distinct sessions the runs are spread across (default: 5).",
    )
    parser.add_argument(
        "--annotation-rate",
        type=probability,
        default=1.0,
        help="Fraction of runs receiving a trace-level task_completion annotation (default: 1.0).",
    )
    return parser


def _tool_definitions() -> dict[str, object]:
    """Advertise the tool catalog the way an SDK reports it on every LLM span."""
    attributes: dict[str, object] = {}
    for index, tool in enumerate(TOOLS):
        attributes[f"llm.tools.{index}.tool.json_schema"] = json.dumps(
            {
                "type": "function",
                "function": {
                    "name": tool["name"],
                    "description": tool["description"],
                    "parameters": tool["parameters"],
                },
            }
        )
    return attributes


def _tool_span(
    generator: Generator,
    node_id: str,
    tool: dict[str, object],
    call: dict[str, object],
    result: str,
    *,
    failed: bool,
    attempt: int,
    start: datetime | None = None,
    duration: float = 0.0,
) -> None:
    """Emit one TOOL span. `attempt` distinguishes the retry from the original call.

    `start` and `duration` are supplied when a step requested several calls at once, so their
    spans genuinely overlap in the waterfall instead of running end to end.
    """
    times = {}
    if start is not None:
        times = {"start_time": ns(start), "end_time": ns(start + timedelta(seconds=duration))}
    with generator.span(
        str(tool["name"]),
        "TOOL",
        attributes={
            "tool.name": tool["name"],
            "tool.description": tool["description"],
            "tool.parameters": json.dumps(tool["parameters"]),
            "tool.id": call["id"],
            "input.value": json.dumps(call["arguments"]),
            "input.mime_type": "application/json",
            "output.value": result,
            "metadata": json.dumps({"attempt": attempt}),
            **_graph_node(f"tool-{tool['name']}", str(tool["name"]), node_id),
        },
        status=StatusCode.ERROR if failed else StatusCode.OK,
        **times,
    ) as span:
        if failed:
            span.record_exception(RuntimeError(result))


def _graph_node(node_id: str, name: str, parent_id: str | None) -> dict[str, object]:
    attributes: dict[str, object] = {"graph.node.id": node_id, "graph.node.name": name}
    if parent_id is not None:
        attributes["graph.node.parent_id"] = parent_id
    return attributes


def _plan_run(generator: Generator, args: argparse.Namespace, run_index: int) -> dict:
    """Decide everything about a run before emitting any of it.

    The AGENT span needs its end time up front, and that end is the sum of the work inside it,
    so the steps have to be drawn first. Emitting as we went left the LLM spans on wall clock
    while their tool calls had real durations — the slowest part of each step rendering as a
    hairline beside the work it was waiting on.
    """
    steps = []
    for step in range(generator.rng.randint(1, args.max_steps)):
        chosen = generator.rng.sample(TOOLS, generator.rng.randint(1, args.parallel_tool_calls))
        calls = []
        for index, tool in enumerate(chosen):
            # Weighting by tool is what lets the data answer "which tool is unreliable?".
            # A flat rate makes every tool look interchangeable, which no real system is.
            failed = generator.rng.random() < min(
                0.9, args.tool_error_rate * float(tool["failure_weight"])
            )
            call = {
                "id": f"call_{run_index + 1}_{step + 1}_{index}",
                "name": tool["name"],
                "arguments": tool["arguments"],
                "tool": tool,
                "failed": failed,
                "result": generator.rng.choice(TOOL_FAILURES) if failed else str(tool["result"]),
                "duration": generator.rng.uniform(*tool["latency"]),
                "retry": None,
            }
            if failed:
                recovered = generator.rng.random() < args.tool_retry_success_rate
                call["retry"] = {
                    "failed": not recovered,
                    "result": str(tool["result"])
                    if recovered
                    else generator.rng.choice(TOOL_FAILURES),
                    "duration": generator.rng.uniform(*tool["latency"]),
                }
            calls.append(call)
        attributes = llm_attributes(generator.rng, input_value=TASKS[run_index % len(TASKS)])
        steps.append(
            {
                "calls": calls,
                "attributes": attributes,
                "duration": duration_for(
                    generator.rng, int(attributes.get("llm.token_count.completion", 0))
                ),
                # Calls dispatched together finish together, so the step waits for the slowest.
                "fan_out": max(
                    call["duration"] + (call["retry"]["duration"] if call["retry"] else 0.0)
                    for call in calls
                ),
            }
        )
    answer = FINAL_ANSWERS[run_index % len(TASKS)]
    final_attributes = llm_attributes(
        generator.rng, input_value=TASKS[run_index % len(TASKS)], output_value=answer
    )
    final_duration = duration_for(
        generator.rng, int(final_attributes.get("llm.token_count.completion", 0))
    )
    # A millisecond of slack for the agent's own bookkeeping after the last child. Without it
    # accumulated timedeltas can land a few hundred nanoseconds past a parent end computed as
    # a single float sum, and children escape the parent's window by rounding alone.
    total = sum(s["duration"] + s["fan_out"] for s in steps) + final_duration + 0.001
    return {
        "steps": steps,
        "final_attributes": final_attributes,
        "final_duration": final_duration,
        "total": total,
        "answer": answer,
    }


def _run_agent(
    generator: Generator,
    args: argparse.Namespace,
    annotations: Annotations,
    run_index: int,
) -> tuple[int, int]:
    """Emit one agent run and report ``(tool_calls, tool_failures)`` for the summary."""
    task_index = run_index % len(TASKS)
    task = TASKS[task_index]
    session_id = f"agent-session-{run_index % args.sessions + 1}"
    conversation: list[dict[str, object]] = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": task},
    ]
    plan = _plan_run(generator, args, run_index)
    tool_calls_made = 0
    tool_failures = 0
    cursor = utc_now() - timedelta(seconds=plan["total"])

    with generator.span(
        f"agent-run-{run_index + 1}",
        "AGENT",
        attributes={
            "agent.name": AGENT_NAME,
            "session.id": session_id,
            "user.id": f"user-{run_index % 17 + 1}",
            "input.value": task,
            "output.value": plan["answer"],
            "metadata": json.dumps({"fixture": "agent-tool-calls", "task": task_index}),
            **_graph_node("agent", AGENT_NAME, None),
        },
        start_time=ns(cursor),
        end_time=ns(cursor + timedelta(seconds=plan["total"])),
        root=True,
    ) as root:
        for step, planned in enumerate(plan["steps"]):
            calls = planned["calls"]
            assistant_message = {
                "role": "assistant",
                "tool_calls": [
                    {key: call[key] for key in ("id", "name", "arguments")} for call in calls
                ],
            }
            node_id = f"llm-step-{step + 1}"
            with generator.span(
                node_id,
                "LLM",
                attributes={
                    **planned["attributes"],
                    "llm.invocation_parameters": json.dumps(
                        {"temperature": 0.0, "tool_choice": "auto"}
                    ),
                    "llm.finish_reason": "tool_calls",
                    **_tool_definitions(),
                    **message_attributes(conversation, "llm.input_messages"),
                    **message_attributes([assistant_message], "llm.output_messages"),
                    **_graph_node(node_id, f"step {step + 1}", "agent"),
                },
                start_time=ns(cursor),
                end_time=ns(cursor + timedelta(seconds=planned["duration"])),
            ):
                pass
            conversation.append(assistant_message)
            cursor += timedelta(seconds=planned["duration"])

            # Calls the model requested together share a start, so their spans overlap.
            fan_out_start = cursor
            for call in calls:
                tool_calls_made += 1
                tool_failures += call["failed"]
                _tool_span(
                    generator,
                    node_id,
                    call["tool"],
                    call,
                    call["result"],
                    failed=call["failed"],
                    attempt=1,
                    start=fan_out_start,
                    duration=call["duration"],
                )
                result = call["result"]
                if call["retry"]:
                    retry = call["retry"]
                    tool_calls_made += 1
                    tool_failures += retry["failed"]
                    _tool_span(
                        generator,
                        node_id,
                        call["tool"],
                        call,
                        retry["result"],
                        failed=retry["failed"],
                        attempt=2,
                        start=fan_out_start + timedelta(seconds=call["duration"]),
                        duration=retry["duration"],
                    )
                    result = retry["result"]
                conversation.append({"role": "tool", "content": result, "tool_call_id": call["id"]})
            cursor += timedelta(seconds=planned["fan_out"])

        with generator.span(
            "llm-final-answer",
            "LLM",
            attributes={
                **plan["final_attributes"],
                "llm.finish_reason": "stop",
                **_tool_definitions(),
                **message_attributes(conversation, "llm.input_messages"),
                **message_attributes(
                    [{"role": "assistant", "content": plan["answer"]}], "llm.output_messages"
                ),
                **_graph_node("llm-final", "final answer", "agent"),
            },
            start_time=ns(cursor),
            end_time=ns(cursor + timedelta(seconds=plan["final_duration"])),
        ):
            pass

    # Task completion is a property of the whole run, not of any one span — and a run whose
    # tools kept failing is likelier to have failed the task. The baseline term matters: agents
    # also fail for reasons no span records (bad plan, wrong tool chosen), so a clean run must
    # not be a guaranteed success or the fixture implies tool errors are the only failure mode.
    failure_chance = min(0.85, BASELINE_FAILURE_RATE + 0.25 * tool_failures)
    completed = generator.rng.random() > failure_chance
    if generator.rng.random() < args.annotation_rate:
        annotations.add_trace(
            root,
            "task_completion",
            score=1.0 if completed else 0.0,
            label="completed" if completed else "incomplete",
            metadata={"tool_failures": tool_failures, "steps": len(plan["steps"])},
        )
    return tool_calls_made, tool_failures


def generate(args: argparse.Namespace) -> tuple[Generator, Annotations, int, int]:
    """Return the generator, the annotation buffer, and tool-call totals."""
    generator = Generator.from_args(args)
    annotations = Annotations(
        endpoint=args.endpoint,
        dry_run=args.dry_run,
        enabled=args.annotation_rate > 0,
    )
    tool_calls = 0
    tool_failures = 0
    try:
        for run_index in range(args.traces):
            calls, failures = _run_agent(generator, args, annotations, run_index)
            tool_calls += calls
            tool_failures += failures
        annotations.flush()
    except BaseException:
        generator.close()
        raise
    return generator, annotations, tool_calls, tool_failures


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    generator, annotations, tool_calls, tool_failures = generate(args)
    generator.close()
    generator.print_summary()
    print(f"tool_calls={tool_calls}")
    print(f"tool_failures={tool_failures}")
    print(f"trace_annotations={annotations.trace_count}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
