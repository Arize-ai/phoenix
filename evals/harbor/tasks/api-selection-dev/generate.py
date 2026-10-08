#!/usr/bin/env python3
"""Stamp the HTTP-answered api-selection tasks from SPECS.

    python3 evals/harbor/tasks/api-selection-dev/generate.py

Each spec becomes instruction.md, task.toml, tests/expected.json, tests/reference.json, and
solution/solve.py under
api-selection-dev or, for the slugs in TEST, api-selection-test. The shared files (.gitignore,
tests/test.sh, solution/solve.sh, and everything in task.toml but the [task] block and the
domain) are copied from a SQL-answered task so the layout test keeps them identical. The
oracles read Phoenix through the REST and GraphQL APIs via harbor_verifiers.phoenix_api; none
of them uses SQL, so every expected.json says ``"expected_api": "http"``. QUESTIONS-api.md
beside this file is the reviewed list the specs were written from; the SQL-answered tasks are
hand-written and listed in QUESTIONS-sql.md.
"""

from __future__ import annotations

import json
import re
import shutil
import stat
import subprocess
from pathlib import Path
from typing import TypedDict

HERE = Path(__file__).resolve().parent
REFERENCE = HERE / "empty-projects"
TEST_DIR = HERE.parent / "api-selection-test"
SOURCE = (
    "solution/solve.py against the sql-benchmark fixture through the Phoenix REST and GraphQL "
    "APIs; cross-checked with sqlite3 on the scrubbed dump on 2026-10-05"
)

# The slugs stamped into api-selection-test; everything else goes to api-selection-dev.
TEST = frozenset(
    {
        "config-count",
        "config-type",
        "config-values",
        "dataset-deleted-example",
        "dataset-evaluators",
        "dataset-example-count",
        "dataset-example-splits",
        "dataset-experiment-count",
        "dataset-unnamed",
        "dataset-versions",
        "default-retention-policy",
        "evaluator-builtins",
        "evaluator-datasets",
        "evaluator-language-sandbox",
        "evaluator-llm-prompt",
        "experiment-baseline-chain",
        "experiment-by-name-id",
        "experiment-description",
        "experiment-e2e-metadata",
        "experiment-failed-examples",
        "experiment-hypothesis",
        "experiment-observation",
        "experiment-regression-sha",
        "experiment-repetitions",
        "experiment-run-output",
        "experiment-split",
        "experiment-unannotated-run",
        "model-pattern",
        "model-price-types",
        "no-dataset-labels",
        "no-such-trace",
        "project-annotation-configs",
        "project-by-id",
        "project-colors",
        "project-description",
        "project-retention-policy",
        "prompt-by-tag",
        "prompt-labels",
        "prompt-luna-fix",
        "prompt-metadata",
        "prompt-tags",
        "prompt-tools",
        "sandbox-providers",
        "session-annotations",
        "session-by-id",
        "session-error-count",
        "session-list-for-project",
        "session-out-of-bounds-score",
        "span-by-id",
        "span-children",
        "span-cumulative-tokens",
        "span-exception-event",
        "span-in-dataset",
        "span-tokens",
        "split-definition",
        "trace-feedback-positive",
        "trace-latency",
        "trace-status",
        "trace-tools-in-order",
        "traces-in-small-project",
        "users-and-roles",
    }
)

SOLVE = '''#!/usr/bin/env python3
"""{description}"""

import json  # noqa: F401
from collections import Counter  # noqa: F401

from harbor_verifiers.phoenix_api import (  # noqa: F401
    attribute,
    dataset_id,
    experiment_by_name,
    experiment_runs,
    generative_models,
    graphql,
    rest,
    rest_pages,
    rowid,
    utc,
    write_answer,
)

{code}'''


class Spec(TypedDict):
    slug: str
    domain: str
    description: str
    question: str
    reference: str
    notes: str
    code: str


def spec(
    slug: str, domain: str, description: str, question: str, reference: str, notes: str, code: str
) -> Spec:
    return {
        "slug": slug,
        "domain": domain,
        "description": description,
        "question": question,
        "reference": reference,
        "notes": notes,
        # GraphQL fragments spliced into f-string snippets keep their doubled braces;
        # the generated code never needs a literal double brace, so collapse them.
        "code": code.strip("\n").replace("{{", "{").replace("}}", "}") + "\n",
    }


TRACE_Q = "query($t: String!) { getTraceByOtelId(traceId: $t) { %s } }"
SPAN_Q = "query($s: String!) { getSpanByOtelId(spanId: $s) { %s } }"
SESSION_Q = "query($s: String!) { getProjectSessionById(sessionId: $s) { %s } }"
NODE_Q = "query($id: ID!) { node(id: $id) { ... on %s { %s } } }"

SPECS: list[Spec] = [
    # ---------------------------------------------------------------- projects
    spec(
        "project-description",
        "projects",
        "Description of a named project",
        "What is the description of the project named dataset-evaluator-a629a8ba9fc497a33297f9d8?",
        "Traces for dataset evaluator: safe_sql_exact_match on dataset: banking_saas_dataset_clean",
        "The reply must give the description text; naming the evaluator and dataset in it is the point.",
        """
project = rest("/projects/dataset-evaluator-a629a8ba9fc497a33297f9d8")["data"]
write_answer(f"{project['name']}: {project['description']}")
""",
    ),
    spec(
        "project-node-id",
        "projects",
        "Phoenix id of a named project",
        "What is the Phoenix id of the project mobile-review-queue?",
        "UHJvamVjdDoxMjc=",
        "That id decodes to Project:127. Accept the id with or without the decoded form.",
        """
write_answer(rest("/projects/mobile-review-queue")["data"]["id"])
""",
    ),
    spec(
        "project-by-id",
        "projects",
        "Project name and trace count for a Phoenix id",
        "Which project has the id UHJvamVjdDoz, and how many traces does it hold?",
        "pxi_dev, 1137 traces",
        "Both the name and the trace count are required.",
        f"""
project = graphql({NODE_Q % ("Project", "name traceCount")!r}, {{"id": "UHJvamVjdDoz"}})["node"]
write_answer(f"{{project['name']}} with {{project['traceCount']}} traces")
""",
    ),
    spec(
        "project-colors",
        "projects",
        "Gradient colours of a project",
        "What gradient start and end colours does the playground project use?",
        "start #5bdbff, end #1c76fc",
        "These are the defaults; no project in the fixture overrides them. Both colours are required.",
        """
project = graphql(
    '{ getProjectByName(name: "playground") { gradientStartColor gradientEndColor } }'
)["getProjectByName"]
write_answer(f"start {project['gradientStartColor']}, end {project['gradientEndColor']}")
""",
    ),
    spec(
        "project-annotation-configs",
        "projects",
        "Annotation configs attached to a project",
        "Which annotation configs are attached to the mobile-review-queue project?",
        "user_feedback, response_quality, review_summary, px-mobile-verify-config, resolution_outcome",
        "All five names are required, in any order.",
        """
names = sorted(c["name"] for c in rest_pages("/projects/mobile-review-queue/annotation_configs"))
write_answer(f"{len(names)} configs: " + ", ".join(names))
""",
    ),
    spec(
        "project-single-config",
        "projects",
        "The one annotation config on pxi_dev",
        "The pxi_dev project has exactly one annotation config attached. What is it called and which direction does it optimise?",
        "Slow, MINIMIZE (labels fast = 0 and slow = 1)",
        "The name and the direction are required; the labels are a bonus.",
        """
(config,) = rest_pages("/projects/pxi_dev/annotation_configs")
values = ", ".join(f"{v['label']} = {v['score']:g}" for v in config["values"])
write_answer(f"{config['name']}: {config['optimization_direction']} ({values})")
""",
    ),
    spec(
        "project-retention-policy",
        "projects",
        "Trace retention policy of a project",
        "Which trace retention policy applies to pxi_dev, and what is its schedule?",
        "the Default policy, cron 0 0 * * 0, max_days 0 (it never deletes)",
        "No project in the fixture has its own policy. The policy name and the cron expression are required.",
        """
policy = graphql(
    '{ getProjectByName(name: "pxi_dev") { traceRetentionPolicy { name cronExpression'
    " rule { __typename ... on TraceRetentionRuleMaxDays { maxDays }"
    " ... on TraceRetentionRuleMaxCount { maxCount } } } } }"
)["getProjectByName"]["traceRetentionPolicy"]
rule = {k: v for k, v in policy["rule"].items() if k != "__typename"}
days = rule.get("maxDays")
text = f"max_days {days:g}" + (" (never deletes)" if days == 0 else "") if days is not None else str(rule)
write_answer(f"{policy['name']} policy, cron {policy['cronExpression']}, rule {text}")
""",
    ),
    spec(
        "project-session-count",
        "projects",
        "Number of sessions in a project",
        "How many sessions does mobile-review-queue have?",
        "6",
        "",
        """
count = graphql('{ getProjectByName(name: "mobile-review-queue") { sessionCount } }')
write_answer(str(count["getProjectByName"]["sessionCount"]))
""",
    ),
    spec(
        "project-annotation-names",
        "projects",
        "Span annotation names in a project",
        "Which span annotation names exist in the project openinference-tanstack-ai-verify-20260521?",
        "groundedness, quality, test, trace_quality",
        "All four names are required, in any order.",
        """
names = graphql(
    '{ getProjectByName(name: "openinference-tanstack-ai-verify-20260521") { spanAnnotationNames } }'
)["getProjectByName"]["spanAnnotationNames"]
write_answer(", ".join(sorted(names)))
""",
    ),
    spec(
        "project-first-trace",
        "projects",
        "First and last trace times of a project",
        "When did the pxi_agent_tony project receive its first and last trace? Give both times in UTC.",
        "first 2026-04-06 20:15:34 UTC, last 2026-04-17 14:33:31 UTC",
        "Accept either time to the minute; the project summary rounds them.",
        """
first = rest("/projects/pxi_agent_tony/traces", sort="start_time", order="asc", limit=1)
last = rest("/projects/pxi_agent_tony/traces", sort="start_time", order="desc", limit=1)
write_answer(
    f"first trace {utc(first['data'][0]['start_time'])}, "
    f"last trace {utc(last['data'][0]['start_time'])}"
)
""",
    ),
    spec(
        "hidden-project-description",
        "projects",
        "Description of a hidden experiment project",
        "The hidden project Experiment-e2b97126b637414e0545df8d belongs to a playground experiment. What does its description say?",
        "Traces from prompt playground",
        "The project list hides Experiment- projects; it must be fetched by name.",
        """
project = rest("/projects/Experiment-e2b97126b637414e0545df8d")["data"]
write_answer(str(project["description"]))
""",
    ),
    # ------------------------------------------------------------------ traces
    spec(
        "trace-root-input",
        "traces",
        "User input of a trace",
        "What did the user ask in trace 53e43018f088a7d5242e29712b3e3351?",
        "how does tracing work",
        "The trace is in pxi_agent_tony with root span pxiAgent Turn.",
        f"""
trace = graphql({TRACE_Q % "project {{ name }} rootSpan {{ name input {{ value }} }}"!r},
                {{"t": "53e43018f088a7d5242e29712b3e3351"}})["getTraceByOtelId"]
root = trace["rootSpan"]
write_answer(f"{{root['input']['value']}} (project {{trace['project']['name']}}, root span {{root['name']}})")
""",
    ),
    spec(
        "trace-span-count",
        "traces",
        "Span count and root span of a trace",
        "How many spans does trace 90122be24041d5549b6d109614dd459f have, and what is its root span called?",
        "17 spans, root span IncidentCopilot",
        "Both facts are required.",
        f"""
trace = graphql({TRACE_Q % "numSpans rootSpan {{ name }}"!r},
                {{"t": "90122be24041d5549b6d109614dd459f"}})["getTraceByOtelId"]
write_answer(f"{{trace['numSpans']}} spans, root span {{trace['rootSpan']['name']}}")
""",
    ),
    spec(
        "trace-tools-in-order",
        "tools",
        "Tool calls of a trace in order",
        "List the tools that trace 90122be24041d5549b6d109614dd459f called, in the order they ran.",
        "search_logs, get_metrics, get_metrics, get_config_diff, create_incident_action, get_metrics",
        "Six tool calls over four distinct tools. The order matters; repeated get_metrics calls must appear.",
        """
spans = rest_pages(
    "/projects/incident-copilot/spans", trace_id="90122be24041d5549b6d109614dd459f", limit=1000
)
tools = [s["name"] for s in sorted(spans, key=lambda s: s["start_time"]) if s["span_kind"].upper() == "TOOL"]
write_answer(", ".join(tools) + f" ({len(tools)} tool calls, {len(set(tools))} distinct tools)")
""",
    ),
    spec(
        "trace-session",
        "traces",
        "Session of a trace",
        "Which session does trace 9128cef0af42a378c2123858a6a1ce26 belong to?",
        "c07e3780-9929-40ff-9465-9e8b30eb1656",
        "Accept a prefix of the session id.",
        f"""
trace = graphql({TRACE_Q % "session {{ sessionId }}"!r},
                {{"t": "9128cef0af42a378c2123858a6a1ce26"}})["getTraceByOtelId"]
write_answer(trace["session"]["sessionId"])
""",
    ),
    spec(
        "trace-status",
        "traces",
        "Error message and model of a failed trace",
        "Trace 914e1f100fba1951ff06323e13f514cb failed. What was the status message, and which model was being called?",
        "status message 'model timeout'; model gpt-4o-mini",
        "Both the message and the model are required. The error sits on the root handle_user_message span and its chat_completion child.",
        f"""
spans = [
    e["node"]
    for e in graphql(
        {TRACE_Q % "spans(first: 100) {{ edges {{ node {{ name statusCode statusMessage attributes }} }} }}"!r},
        {{"t": "914e1f100fba1951ff06323e13f514cb"}},
    )["getTraceByOtelId"]["spans"]["edges"]
]
errors = [s for s in spans if s["statusCode"] == "ERROR"]
models = sorted({{attribute(s["attributes"], "llm.model_name") for s in spans}} - {{None}})
write_answer(
    f"status message {{errors[0]['statusMessage']!r}} on {{', '.join(s['name'] for s in errors)}}; "
    f"model {{', '.join(models)}}"
)
""",
    ),
    spec(
        "trace-user",
        "traces",
        "User id recorded on a trace",
        "Which user id is recorded on trace 90122be24041d5549b6d109614dd459f?",
        "oncall@example.com",
        "",
        f"""
trace = graphql({TRACE_Q % "userId"!r}, {{"t": "90122be24041d5549b6d109614dd459f"}})
write_answer(str(trace["getTraceByOtelId"]["userId"]))
""",
    ),
    spec(
        "trace-latency",
        "traces",
        "End-to-end latency of a trace",
        "How long did trace 660d6a9fe57e74b3b64d7e075d20ec78 take end to end?",
        "1.6 seconds (1600 ms)",
        "Accept 1.6 s or 1600 ms with any rounding of the exact value.",
        f"""
trace = graphql({TRACE_Q % "latencyMs"!r}, {{"t": "660d6a9fe57e74b3b64d7e075d20ec78"}})
ms = trace["getTraceByOtelId"]["latencyMs"]
write_answer(f"{{ms / 1000:g}} seconds ({{ms:g}} ms)")
""",
    ),
    spec(
        "trace-feedback",
        "annotations",
        "User feedback annotation on a trace",
        "What user feedback was left on trace f5c12f6ca357b515bd3fa701306cb760?",
        "user_feedback = negative (score 0), by a human, via the API",
        "The label negative is required; the score, annotator kind, and source are a bonus.",
        """
annotations = rest_pages(
    "/projects/pxi_dev/trace_annotations", trace_ids="f5c12f6ca357b515bd3fa701306cb760", limit=100
)
write_answer(
    "; ".join(
        f"{a['name']} = {a['result']['label']} (score {a['result']['score']:g}, "
        f"{a['annotator_kind']}, via {a['source']})"
        for a in annotations
    )
)
""",
    ),
    spec(
        "trace-feedback-positive",
        "annotations",
        "Traces with positive user feedback in a project",
        "Which traces in pxi_dev carry a positive user_feedback trace annotation?",
        "9128cef0af42a378c2123858a6a1ce26, c1aa1d2d47fd1f75747e4ad49806cb18, 932f37bdd82dc95707c82a361910d6fc",
        "Three traces. Accept prefixes of the trace ids. The fourth pxi_dev feedback annotation, on f5c12f6c..., is negative and must not be listed.",
        """
traces = rest_pages(
    "/projects/pxi_dev/traces",
    filter="trace_annotations['user_feedback'].label == 'positive'",
    sort="start_time",
    order="asc",
    limit=1000,
)
write_answer(f"{len(traces)} traces: " + ", ".join(t["trace_id"] for t in traces))
""",
    ),
    spec(
        "trace-errors-by-type",
        "traces",
        "Failed tool calls in a trace",
        "Trace 176fcc3d88b18dabbf8db3449e53ebf2 has three failed tool calls. Which tools were they and what did the errors say?",
        "read_prompt_instance, read_prompt_tools, and add_prompt_instance, each failing with 'Unknown tool: <name>'",
        "All three tool names are required.",
        f"""
spans = [
    e["node"]
    for e in graphql(
        {TRACE_Q % "spans(first: 100) {{ edges {{ node {{ name statusCode statusMessage }} }} }}"!r},
        {{"t": "176fcc3d88b18dabbf8db3449e53ebf2"}},
    )["getTraceByOtelId"]["spans"]["edges"]
]
errors = [s for s in spans if s["statusCode"] == "ERROR"]
write_answer("; ".join(f"{{s['name']}}: {{s['statusMessage']}}" for s in errors))
""",
    ),
    spec(
        "trace-exception",
        "traces",
        "Exception recorded on a trace",
        "What exception is recorded on trace 72408774085db31572128f7e60b4f76d?",
        "pydantic_ai.exceptions.ModelHTTPError: status 400, the requested model gpt-5.4-fast does not exist",
        "The exception type or the gpt-5.4-fast message is enough; it is on span b3a8817291c015dc (pxiCompletion Turn).",
        f"""
spans = [
    e["node"]
    for e in graphql(
        {TRACE_Q % "spans(first: 100) {{ edges {{ node {{ spanId name events {{ name attributes }} }} }} }}"!r},
        {{"t": "72408774085db31572128f7e60b4f76d"}},
    )["getTraceByOtelId"]["spans"]["edges"]
]
found = [
    (s, ev["attributes"]) for s in spans for ev in s["events"] if ev["name"] == "exception"
]
write_answer(
    "; ".join(
        f"{{a.get('exception.type')}} on span {{s['spanId']}} ({{s['name']}}): "
        f"{{str(a.get('exception.message'))[:160]}}"
        for s, a in found
    )
)
""",
    ),
    spec(
        "trace-root-output",
        "traces",
        "Final answer of a trace",
        "What was the assistant's final answer in trace 8b3f5b1f7b0fac4b6a24eb131210b072?",
        "Q2 revenue grew 18% QoQ, driven by (1) enterprise expansion in EMEA, (2) the new usage-based pricing tier, and (3) reduced churn",
        "Accept any reply that quotes or faithfully paraphrases the three drivers.",
        f"""
trace = graphql({TRACE_Q % "rootSpan {{ output {{ value }} }}"!r},
                {{"t": "8b3f5b1f7b0fac4b6a24eb131210b072"}})["getTraceByOtelId"]
write_answer(trace["rootSpan"]["output"]["value"][:400])
""",
    ),
    spec(
        "traces-in-small-project",
        "traces",
        "Traces of a small project with their first messages",
        "List the traces in the project assistant_agent together with the user's first message in each.",
        "7cd98be451fa66759a18a1697aa597b4 ('test') and ff59da78f0cf706cd274464abcceab09 ('Explain what this span is doing.')",
        "Two traces. Accept prefixes of the ids.",
        f"""
traces = rest_pages("/projects/assistant_agent/traces", sort="start_time", order="asc", limit=1000)
parts = []
for trace in traces:
    root = graphql({TRACE_Q % "rootSpan {{ input {{ value }} }}"!r}, {{"t": trace["trace_id"]}})
    parts.append(f"{{trace['trace_id']}} ({{root['getTraceByOtelId']['rootSpan']['input']['value'][:80]!r}})")
write_answer(f"{{len(traces)}} traces: " + "; ".join(parts))
""",
    ),
    # ------------------------------------------------------------------- spans
    spec(
        "span-by-id",
        "traces",
        "Name, kind, and project of a span",
        "What is span c131b0bee8049eb2 called, what kind of span is it, and which project is it in?",
        "execute_tool searchProducts, a TOOL span, in project openinference-tanstack-ai-verify-20260521",
        "All three facts are required.",
        f"""
span = graphql({SPAN_Q % "name spanKind trace {{ traceId project {{ name }} }}"!r},
               {{"s": "c131b0bee8049eb2"}})["getSpanByOtelId"]
write_answer(
    f"{{span['name']}}, a {{span['spanKind'].upper()}} span, in project {{span['trace']['project']['name']}} "
    f"(trace {{span['trace']['traceId']}})"
)
""",
    ),
    spec(
        "span-parent",
        "traces",
        "Parent of a span",
        "What is the parent span of span ff3951eaa75f533d?",
        "span 6a41eb4766c2bb30, named PXIAgent.iter (an AGENT span), in trace 7c01787fd51ef4dd971f2791d2122f57",
        "The parent span id 6a41eb4766c2bb30 or the name PXIAgent.iter is required.",
        f"""
child = graphql({SPAN_Q % "parentId trace {{ traceId }}"!r}, {{"s": "ff3951eaa75f533d"}})["getSpanByOtelId"]
parent = graphql({SPAN_Q % "name spanKind"!r}, {{"s": child["parentId"]}})["getSpanByOtelId"]
write_answer(
    f"span {{child['parentId']}}, {{parent['name']}} ({{parent['spanKind'].upper()}}), "
    f"in trace {{child['trace']['traceId']}}"
)
""",
    ),
    spec(
        "span-children",
        "traces",
        "Direct children of a span",
        "Which spans are direct children of span 6a41eb4766c2bb30?",
        "ff3951eaa75f533d (bash, a TOOL span) and 59d57ef5e5e67f05 (gpt-5.4, an LLM span)",
        "Both children are required; ids or names suffice.",
        f"""
span = graphql(
    {SPAN_Q % "descendants(maxDepth: 1, first: 50) {{ edges {{ node {{ spanId name spanKind }} }} }}"!r},
    {{"s": "6a41eb4766c2bb30"}},
)["getSpanByOtelId"]
children = [e["node"] for e in span["descendants"]["edges"]]
write_answer(", ".join(f"{{c['spanId']}} ({{c['name']}}, {{c['spanKind'].upper()}})" for c in children))
""",
    ),
    spec(
        "span-tokens",
        "llm-usage",
        "Token counts and model of an LLM span",
        "How many prompt and completion tokens did span 24aed90fbeebb7c2 use, and which model served it?",
        "26,179 prompt tokens, 312 completion tokens, model gpt-5.4-2026-03-05",
        "All three values are required.",
        f"""
span = graphql({SPAN_Q % "tokenCountPrompt tokenCountCompletion attributes"!r},
               {{"s": "24aed90fbeebb7c2"}})["getSpanByOtelId"]
write_answer(
    f"{{span['tokenCountPrompt']}} prompt tokens, {{span['tokenCountCompletion']}} completion tokens, "
    f"model {{attribute(span['attributes'], 'llm.model_name')}}"
)
""",
    ),
    spec(
        "span-llm-tokens-small",
        "llm-usage",
        "Token counts of the LLM span in a trace",
        "What were the token counts on the LLM span in trace 660d6a9fe57e74b3b64d7e075d20ec78, and which model was used?",
        "812 prompt, 96 completion, 908 total, model gpt-4o-mini (span 2087f6356fdb5a18)",
        "The prompt and completion counts and the model are required.",
        f"""
spans = [
    e["node"]
    for e in graphql(
        {TRACE_Q % "spans(first: 100) {{ edges {{ node {{ spanId spanKind tokenCountPrompt tokenCountCompletion tokenCountTotal attributes }} }} }}"!r},
        {{"t": "660d6a9fe57e74b3b64d7e075d20ec78"}},
    )["getTraceByOtelId"]["spans"]["edges"]
]
(llm,) = [s for s in spans if s["spanKind"].lower() == "llm"]
write_answer(
    f"{{llm['tokenCountPrompt']}} prompt, {{llm['tokenCountCompletion']}} completion, "
    f"{{llm['tokenCountTotal']}} total, model {{attribute(llm['attributes'], 'llm.model_name')}} "
    f"(span {{llm['spanId']}})"
)
""",
    ),
    spec(
        "span-tool-command",
        "tools",
        "Command and failure of a bash span",
        "What command did the bash span 0e5512ce48261dcc try to run, and why did it fail?",
        "a phoenix-gql mutation patching project UHJvamVjdDoxMjY= with the description 'blah blah blah blah'; it failed with ApprovalRequired",
        "The ApprovalRequired status and the gist of the command (phoenix-gql patching a project description) are required.",
        f"""
span = graphql({SPAN_Q % "statusMessage input {{ value }}"!r}, {{"s": "0e5512ce48261dcc"}})["getSpanByOtelId"]
command = json.loads(span["input"]["value"])
write_answer(
    f"status {{span['statusMessage'].strip(': ')}}; summary {{command.get('summary')!r}}; "
    f"command {{command.get('command', '')[:200]!r}}"
)
""",
    ),
    spec(
        "span-exception-event",
        "traces",
        "Exception event on a tool span",
        "What does the exception event on span f8458c42e0719727 say?",
        "Location 'Macomb, Michigan' not found",
        "The span is execute_tool weatherTool in the default project; the exception type is Error.",
        f"""
span = graphql({SPAN_Q % "name events {{ name attributes }}"!r}, {{"s": "f8458c42e0719727"}})["getSpanByOtelId"]
events = [e["attributes"] for e in span["events"] if e["name"] == "exception"]
write_answer(
    "; ".join(f"{{a.get('exception.type')}}: {{a.get('exception.message')}}" for a in events)
    + f" (span {{span['name']}})"
)
""",
    ),
    spec(
        "span-annotations",
        "annotations",
        "Annotations on a span",
        "Which annotations are on span 6a41eb4766c2bb30? Give their labels and scores.",
        "issue = major (0.28), quality = poor (0.25), and test = test with no score",
        "All three annotation names are required; the labels and scores are a bonus.",
        """
annotations = rest_pages(
    "/projects/pxi_dev/span_annotations", span_ids="6a41eb4766c2bb30", limit=100
)
parts = []
for a in sorted(annotations, key=lambda a: a["name"]):
    score = a["result"]["score"]
    parts.append(f"{a['name']} = {a['result']['label']} ({'no score' if score is None else score})")
write_answer("; ".join(parts))
""",
    ),
    spec(
        "span-annotation-explanation",
        "annotations",
        "Explanation of a span annotation",
        "What explanation accompanies the quality annotation on span c131b0bee8049eb2?",
        "label good, score 0.9: 'Tool execution succeeded with very low latency and returned a relevant stationery result that supported the final recommendation'",
        "The explanation's opening sentence is required; the label and score are a bonus.",
        """
annotations = rest_pages(
    "/projects/openinference-tanstack-ai-verify-20260521/span_annotations",
    span_ids="c131b0bee8049eb2",
    include_annotation_names="quality",
    limit=100,
)
(a,) = annotations
write_answer(f"label {a['result']['label']}, score {a['result']['score']}: {a['result']['explanation']}")
""",
    ),
    spec(
        "root-span-notes",
        "annotations",
        "Notes on the root span of a trace",
        "What notes were left on the root span of trace 660d6a9fe57e74b3b64d7e075d20ec78?",
        "one note: 'The assistant gave a plausible billing explanation, but it did not answer the user's double-charge concern with a concrete explanation'",
        "The note's opening clause is required.",
        f"""
trace = graphql({TRACE_Q % "rootSpan {{ spanId spanNotes {{ explanation }} }}"!r},
                {{"t": "660d6a9fe57e74b3b64d7e075d20ec78"}})["getTraceByOtelId"]
notes = [n["explanation"] for n in trace["rootSpan"]["spanNotes"]]
write_answer(f"{{len(notes)}} note(s) on span {{trace['rootSpan']['spanId']}}: " + " | ".join(notes))
""",
    ),
    spec(
        "span-in-dataset",
        "traces",
        "Dataset membership of a span",
        "Is span 1b91cd85d269b2b3 part of a dataset? If so, which one?",
        "yes, the dataset High Token Count Spans (>20k)",
        "The dataset name is required.",
        f"""
span = graphql({SPAN_Q % "containedInDataset"!r}, {{"s": "1b91cd85d269b2b3"}})["getSpanByOtelId"]
datasets = graphql(
    "{{ datasets(first: 50) {{ edges {{ node {{ name"
    " examples(first: 100) {{ edges {{ node {{ id span {{ spanId }} }} }} }} }} }} }} }}"
)["datasets"]["edges"]
hits = [
    (d["node"]["name"], e["node"]["id"])
    for d in datasets
    for e in d["node"]["examples"]["edges"]
    if e["node"]["span"] and e["node"]["span"]["spanId"] == "1b91cd85d269b2b3"
]
write_answer(
    ("yes: " if span["containedInDataset"] else "no: ")
    + "; ".join(f"dataset {{name}} (example {{example}})" for name, example in hits)
)
""",
    ),
    spec(
        "span-cumulative-tokens",
        "llm-usage",
        "Cumulative token count of a root span",
        "What is the cumulative total token count on the root span of trace ff59da78f0cf706cd274464abcceab09?",
        "104,529 tokens (103,788 prompt and 741 completion)",
        "The total is required.",
        f"""
trace = graphql(
    {TRACE_Q % "numSpans rootSpan {{ spanId cumulativeTokenCountTotal cumulativeTokenCountPrompt cumulativeTokenCountCompletion }}"!r},
    {{"t": "ff59da78f0cf706cd274464abcceab09"}},
)["getTraceByOtelId"]
root = trace["rootSpan"]
write_answer(
    f"{{root['cumulativeTokenCountTotal']:g}} tokens ({{root['cumulativeTokenCountPrompt']:g}} prompt and "
    f"{{root['cumulativeTokenCountCompletion']:g}} completion) on span {{root['spanId']}}; "
    f"the trace has {{trace['numSpans']}} spans"
)
""",
    ),
    spec(
        "span-status-propagated",
        "traces",
        "Where the error status sits in a failed trace",
        "In trace 914e1f100fba1951ff06323e13f514cb, does the root span itself carry the error status, or only a child span?",
        "both: the root span 328b89964b1a9bd4 (handle_user_message) and its child 769e6730ffc47aa6 (chat_completion) are both ERROR with 'model timeout'",
        "The reply must say the root span itself is marked ERROR, not only the child.",
        f"""
spans = [
    e["node"]
    for e in graphql(
        {TRACE_Q % "spans(first: 100) {{ edges {{ node {{ spanId name parentId statusCode propagatedStatusCode statusMessage }} }} }}"!r},
        {{"t": "914e1f100fba1951ff06323e13f514cb"}},
    )["getTraceByOtelId"]["spans"]["edges"]
]
parts = [
    f"{{'root' if s['parentId'] is None else 'child'}} span {{s['spanId']}} ({{s['name']}}): "
    f"own status {{s['statusCode']}}, propagated {{s['propagatedStatusCode']}}, message {{s['statusMessage']!r}}"
    for s in sorted(spans, key=lambda s: s["parentId"] is not None)
]
write_answer("; ".join(parts))
""",
    ),
    # ---------------------------------------------------------------- sessions
    spec(
        "session-by-id",
        "sessions",
        "Trace count and first input of a session",
        "How many traces are in session support-billing-0142, and what was the first user input?",
        "2 traces; first input 'Why was I charged twice this month?'",
        "Both facts are required.",
        f"""
session = graphql({SESSION_Q % "numTraces firstInput {{ value }}"!r},
                  {{"s": "support-billing-0142"}})["getProjectSessionById"]
write_answer(f"{{session['numTraces']}} traces; first input {{session['firstInput']['value']!r}}")
""",
    ),
    spec(
        "session-last-output",
        "sessions",
        "Last assistant output of a session",
        "What was the last assistant output in session onboarding-walkthrough-77?",
        "That usually means the role lacks USAGE on the warehouse. Run: GRANT USAGE ON WAREHOUSE compute_wh TO ROLE readonly_role",
        "The session has 3 traces. The GRANT USAGE advice is required.",
        f"""
session = graphql({SESSION_Q % "numTraces lastOutput {{ value }}"!r},
                  {{"s": "onboarding-walkthrough-77"}})["getProjectSessionById"]
write_answer(f"{{session['lastOutput']['value']}} ({{session['numTraces']}} traces)")
""",
    ),
    spec(
        "session-cross-project",
        "sessions",
        "A session whose traces span two projects",
        "Session incident-2026-08-06-checkout has traces in two projects. Which projects, and how many traces in each?",
        "8 traces in total: 4 in takehome-fixture and 4 in incident-copilot",
        "Both project names and the per-project counts are required.",
        f"""
session = graphql(
    {SESSION_Q % "numTraces project {{ name }} traces(first: 100) {{ edges {{ node {{ project {{ name }} }} }} }}"!r},
    {{"s": "incident-2026-08-06-checkout"}},
)["getProjectSessionById"]
counts = Counter(e["node"]["project"]["name"] for e in session["traces"]["edges"])
write_answer(
    f"{{session['numTraces']}} traces in total: "
    + ", ".join(f"{{n}} in {{name}}" for name, n in counts.most_common())
    + f" (the session itself belongs to {{session['project']['name']}})"
)
""",
    ),
    spec(
        "session-annotations",
        "annotations",
        "Annotations on a session",
        "What annotations does session chaotic-eval-run-51 have?",
        "response_quality 9.0 and response_quality 4.0 (two separate annotations), user_feedback = positive (1.0), resolution_outcome = resolved (1.0)",
        "The three annotation names are required; mentioning both response_quality scores is a bonus.",
        """
annotations = rest_pages(
    "/projects/mobile-review-queue/session_annotations", session_ids="chaotic-eval-run-51", limit=100
)
parts = []
for a in sorted(annotations, key=lambda a: (a["name"], a["created_at"])):
    label, score = a["result"]["label"], a["result"]["score"]
    parts.append(f"{a['name']} = {label or 'no label'} ({'no score' if score is None else score})")
write_answer("; ".join(parts))
""",
    ),
    spec(
        "session-note",
        "annotations",
        "Note on a session",
        "What note was left on session fresh-unreviewed-session-x?",
        "Verified on Pixel 9 - answer matches beta docs.",
        "",
        """
notes = rest_pages(
    "/projects/mobile-review-queue/session_annotations",
    session_ids="fresh-unreviewed-session-x",
    include_annotation_names="note",
    limit=100,
)
write_answer(" | ".join(str(a["result"]["explanation"]) for a in notes))
""",
    ),
    spec(
        "session-out-of-bounds-score",
        "annotations",
        "Session score outside its config bounds",
        "The response_quality annotation config allows scores from 1 to 5. Which session in mobile-review-queue has a response_quality score outside that range, and what is the score?",
        "rag-quarterly-report-3 with a score of 42; chaotic-eval-run-51 also has an out-of-range 9.0",
        "rag-quarterly-report-3 with 42 is required; chaotic-eval-run-51 with 9.0 is also correct and may be included.",
        """
config = rest("/annotation_configs/response_quality")["data"]
low, high = config["lower_bound"], config["upper_bound"]
sessions = [s["session_id"] for s in rest_pages("/projects/mobile-review-queue/sessions", limit=100)]
annotations = rest_pages(
    "/projects/mobile-review-queue/session_annotations",
    session_ids=sessions,
    include_annotation_names="response_quality",
    limit=1000,
)
outside = sorted(
    (a["session_id"], a["result"]["score"])
    for a in annotations
    if a["result"]["score"] is not None and not low <= a["result"]["score"] <= high
)
write_answer(
    f"bounds {low:g} to {high:g}; outside: "
    + ", ".join(f"{session} ({score:g})" for session, score in outside)
)
""",
    ),
    spec(
        "session-error-count",
        "sessions",
        "Traces that errored in a session",
        "How many traces in session chaotic-eval-run-51 ended in error, and which?",
        "1 of 2: trace 914e1f100fba1951ff06323e13f514cb",
        "Accept a prefix of the trace id.",
        f"""
session = graphql(
    {SESSION_Q % "numTraces numTracesWithError traces(first: 100) {{ edges {{ node {{ traceId errorCount }} }} }}"!r},
    {{"s": "chaotic-eval-run-51"}},
)["getProjectSessionById"]
errored = [e["node"]["traceId"] for e in session["traces"]["edges"] if e["node"]["errorCount"]]
write_answer(f"{{session['numTracesWithError']}} of {{session['numTraces']}}: " + ", ".join(errored))
""",
    ),
    spec(
        "session-list-for-project",
        "sessions",
        "Sessions of a project in chronological order",
        "List the session ids in mobile-review-queue in chronological order.",
        "support-billing-0142, onboarding-walkthrough-77, agent-refund-flow-9, rag-quarterly-report-3, chaotic-eval-run-51, fresh-unreviewed-session-x",
        "All six in this order.",
        """
sessions = rest_pages("/projects/mobile-review-queue/sessions", order="asc", limit=100)
write_answer(", ".join(s["session_id"] for s in sorted(sessions, key=lambda s: s["start_time"])))
""",
    ),
    spec(
        "session-pxi-length",
        "sessions",
        "Length and span of a pxi_dev session",
        "How many traces does the pxi_dev session c07e3780-9929-40ff-9465-9e8b30eb1656 contain, and when did it start and end (UTC)?",
        "20 traces, from 2026-04-17 19:53:21 UTC to 2026-04-20 19:06:26 UTC",
        "The trace count and both dates (to the minute) are required; the final turn's input was 'summarize'.",
        f"""
session = graphql({SESSION_Q % "numTraces startTime endTime"!r},
                  {{"s": "c07e3780-9929-40ff-9465-9e8b30eb1656"}})["getProjectSessionById"]
write_answer(
    f"{{session['numTraces']}} traces, from {{utc(session['startTime'])}} to {{utc(session['endTime'])}}"
)
""",
    ),
    spec(
        "session-user",
        "sessions",
        "User id of a session",
        "Which user id is attached to session incident-2026-08-06-checkout?",
        "oncall@example.com",
        "",
        f"""
session = graphql({SESSION_Q % "userId"!r}, {{"s": "incident-2026-08-06-checkout"}})
write_answer(str(session["getProjectSessionById"]["userId"]))
""",
    ),
    # ------------------------------------------------------- annotation configs
    spec(
        "config-type",
        "annotations",
        "Type and description of an annotation config",
        "What type is the review_summary annotation config, and what is its description?",
        "FREEFORM; 'Free-text reviewer summary of the session.'",
        "Both are required.",
        """
config = rest("/annotation_configs/review_summary")["data"]
write_answer(f"{config['type']}; {config['description']!r}")
""",
    ),
    spec(
        "config-bounds",
        "annotations",
        "Bounds and direction of a continuous config",
        "What are the bounds and the optimisation direction of the response_quality annotation config?",
        "continuous, from 1.0 to 5.0, MAXIMIZE",
        "The bounds and direction are required.",
        """
config = rest("/annotation_configs/response_quality")["data"]
write_answer(
    f"{config['type']}, from {config['lower_bound']:g} to {config['upper_bound']:g}, "
    f"{config['optimization_direction']}"
)
""",
    ),
    spec(
        "config-values",
        "annotations",
        "Labels and scores of a categorical config",
        "What labels and scores does the px-mobile-verify-config annotation config define?",
        "pass = 1.0 and fail = 0.0 (categorical, MAXIMIZE, described as 'verification config')",
        "Both labels with their scores are required.",
        """
config = rest("/annotation_configs/px-mobile-verify-config")["data"]
values = ", ".join(f"{v['label']} = {v['score']:g}" for v in config["values"])
write_answer(
    f"{values} ({config['type']}, {config['optimization_direction']}, "
    f"described as {config['description']!r})"
)
""",
    ),
    spec(
        "config-count",
        "annotations",
        "Number of annotation configs and the undescribed one",
        "How many annotation configs exist, and which one has no description?",
        "6 configs; Slow has no description",
        "Both facts are required.",
        """
configs = rest_pages("/annotation_configs", limit=100)
missing = [c["name"] for c in configs if not c.get("description")]
write_answer(f"{len(configs)} configs; without a description: {', '.join(missing) or 'none'}")
""",
    ),
    spec(
        "config-unattached",
        "annotations",
        "Whether every annotation config is attached to a project",
        "Is every annotation config attached to at least one project? Which project uses each?",
        "yes: five are attached to mobile-review-queue (user_feedback, response_quality, review_summary, px-mobile-verify-config, resolution_outcome) and Slow is attached to pxi_dev",
        "The answer yes plus the two project names is required.",
        """
configs = {c["name"] for c in rest_pages("/annotation_configs", limit=100)}
attached: dict[str, list[str]] = {}
for project in rest_pages("/projects", limit=100):
    for config in rest_pages(f"/projects/{project['id']}/annotation_configs", limit=100):
        attached.setdefault(config["name"], []).append(project["name"])
unattached = sorted(configs - set(attached))
write_answer(
    ("yes, every config is attached: " if not unattached else f"no, unattached: {unattached}; ")
    + "; ".join(f"{name} -> {', '.join(sorted(set(p)))}" for name, p in sorted(attached.items()))
)
""",
    ),
    # ---------------------------------------------------------------- datasets
    spec(
        "dataset-by-name",
        "datasets",
        "Description and id of a dataset",
        "What is the description and the Phoenix id of the dataset github-support-triage-tool-routing?",
        "'Hand-authored golden routing cases for the first tool selected by the GitHub support-ticket triage agent.'; id RGF0YXNldDoyMA==",
        "Both the description and the id are required.",
        """
(dataset,) = [
    d for d in rest("/datasets", name="github-support-triage-tool-routing")["data"]
    if d["name"] == "github-support-triage-tool-routing"
]
write_answer(f"{dataset['description']!r}; id {dataset['id']}")
""",
    ),
    spec(
        "dataset-example-count",
        "datasets",
        "Example count of a dataset",
        "How many examples are in the dataset set_spans_filter?",
        "48",
        "",
        """
write_answer(str(rest(f"/datasets/{dataset_id('set_spans_filter')}")["data"]["example_count"]))
""",
    ),
    spec(
        "dataset-versions",
        "datasets",
        "Version count of a dataset",
        "How many versions does the dataset PXI E2E Agent Tests have?",
        "7",
        "The versions are ids 8 through 14.",
        """
versions = rest_pages(f"/datasets/{dataset_id('PXI E2E Agent Tests')}/versions", limit=100)
write_answer(f"{len(versions)} versions")
""",
    ),
    spec(
        "dataset-version-description",
        "datasets",
        "What the second version of a dataset changed",
        "What does the second version of the dataset High Token Count Spans (>20k) say it changed?",
        "Patched: output = token counts (total, prompt, completion)",
        "The first version was described as 'Spans with >20k total tokens'.",
        """
versions = sorted(
    rest_pages(f"/datasets/{dataset_id('High Token Count Spans (>20k)')}/versions", limit=100),
    key=lambda v: v["created_at"],
)
write_answer(f"second version: {versions[1]['description']!r} (first: {versions[0]['description']!r})")
""",
    ),
    spec(
        "dataset-example-by-index",
        "datasets",
        "Metadata of a dataset example found by its input",
        "In the dataset phoenix-issue-triage-initial-responses, one example's issue is just a GitHub URL. What are that example's case name and should_ask_question flag?",
        "case url_without_access, should_ask_question true",
        "Both metadata values are required. The example id is RGF0YXNldEV4YW1wbGU6MTEz.",
        """
examples = rest(f"/datasets/{dataset_id('phoenix-issue-triage-initial-responses')}/examples")
(example,) = [
    e for e in examples["data"]["examples"]
    if str(e["input"].get("issue", "")).startswith("https://github.com/")
]
meta = example["metadata"]
write_answer(
    f"case {meta['case']}, should_ask_question {str(meta['should_ask_question']).lower()} "
    f"(example {example['node_id']})"
)
""",
    ),
    spec(
        "dataset-example-output",
        "datasets",
        "Expected output of a routing example",
        "In the dataset github-support-triage-tool-routing, what is the expected output for the example about issue acme/widget#2128?",
        "expected_tool apply_github_triage (scenario apply_confirmed_duplicate)",
        "apply_github_triage is required.",
        """
examples = rest(f"/datasets/{dataset_id('github-support-triage-tool-routing')}/examples")
(example,) = [e for e in examples["data"]["examples"] if "acme/widget#2128" in e["input"]["ticket"]]
write_answer(f"{json.dumps(example['output'])} (scenario {example['metadata'].get('scenario')})")
""",
    ),
    spec(
        "dataset-example-splits",
        "datasets",
        "Split membership of an example",
        "Which split is the banking_saas_dataset_clean example 'Show me John Smith's recent transactions' in?",
        "refusal",
        "The example id is RGF0YXNldEV4YW1wbGU6MTQ1.",
        f"""
dataset = graphql(
    {NODE_Q % ("Dataset", "examples(first: 100) {{ edges {{ node {{ id datasetSplits {{ name }} revision {{ input }} }} }} }}")!r},
    {{"id": dataset_id("banking_saas_dataset_clean")}},
)["node"]
(example,) = [
    e["node"]
    for e in dataset["examples"]["edges"]
    if "John Smith" in json.dumps(e["node"]["revision"]["input"])
]
write_answer(", ".join(s["name"] for s in example["datasetSplits"]) + f" (example {{example['id']}})")
""",
    ),
    spec(
        "dataset-split-sizes",
        "datasets",
        "Split sizes of a dataset",
        "How many examples of banking_saas_dataset_clean are in each split?",
        "happy path 15, refusal 13",
        "Both counts are required.",
        """
splits = rest_pages(f"/datasets/{dataset_id('banking_saas_dataset_clean')}/splits", limit=100)
write_answer(", ".join(f"{s['name']} {s['example_count']}" for s in sorted(splits, key=lambda s: s["name"])))
""",
    ),
    spec(
        "split-definition",
        "datasets",
        "Definition and total size of a split",
        "What colour and description does the refusal split have, and how many examples does it hold across all datasets?",
        "colour #808080, no description, 52 examples (13 in each of the four banking datasets)",
        "The colour and the total of 52 are required.",
        """
(split,) = [
    e["node"]
    for e in graphql("{ datasetSplits { edges { node { name color description } } } }")["datasetSplits"]["edges"]
    if e["node"]["name"] == "refusal"
]
per_dataset = {}
for dataset in rest_pages("/datasets", limit=100):
    for s in rest_pages(f"/datasets/{dataset['id']}/splits", limit=100):
        if s["name"] == "refusal":
            per_dataset[dataset["name"]] = s["example_count"]
write_answer(
    f"colour {split['color']}, description {split['description'] or 'none'}, "
    f"{sum(per_dataset.values())} examples across {len(per_dataset)} datasets "
    f"({', '.join(f'{k} {v}' for k, v in sorted(per_dataset.items()))})"
)
""",
    ),
    spec(
        "dataset-deleted-example",
        "datasets",
        "Example deleted and added between dataset versions",
        "The dataset banking_saas_dataset_auto_ids has three versions. Which version deleted an example, what did that same version add, and what did the version after it change?",
        "the second version (id 4) deleted one example and added 'Show me my current account balance!'; the third version (id 5) patched that example's input to 'Show me my current account balance!!!!!'",
        "The reply must say the second version deleted one example and added one, and that the third version patched the added one. Exact example ids are a bonus.",
        f"""
did = dataset_id("banking_saas_dataset_auto_ids")
versions = sorted(
    (e["node"] for e in graphql({NODE_Q % ("Dataset", "versions(first: 50) {{ edges {{ node {{ id }} }} }}")!r}, {{"id": did}})["node"]["versions"]["edges"]),
    key=lambda v: rowid(v["id"]),
)
EXAMPLES = (
    "query($id: ID!, $v: ID!) {{ node(id: $id) {{ ... on Dataset {{ examples(datasetVersionId: $v, first: 100)"
    " {{ edges {{ node {{ id revision(datasetVersionId: $v) {{ input revisionKind }} }} }} }} }} }} }}"
)
def examples(version_id):
    page = graphql(EXAMPLES, {{"id": did, "v": version_id}})["node"]["examples"]["edges"]
    return {{e["node"]["id"]: e["node"]["revision"] for e in page}}
first, second, third = (examples(v["id"]) for v in versions[:3])
deleted = sorted(set(first) - set(second))
created = sorted(set(second) - set(first))
patched = [i for i in created if i in third and third[i]["input"] != second[i]["input"]]
text = lambda rev: json.dumps(rev["input"])[:120]  # noqa: E731
write_answer(
    f"version {{rowid(versions[1]['id'])}} deleted {{', '.join(deleted) or 'nothing'}} and created "
    + ", ".join(f"{{i}} ({{text(second[i])}})" for i in created)
    + f"; version {{rowid(versions[2]['id'])}} patched "
    + (", ".join(f"{{i}} to {{text(third[i])}}" for i in patched) or "nothing")
)
""",
    ),
    spec(
        "dataset-example-revision-history",
        "datasets",
        "Revision history of a dataset example",
        "In the dataset PXI E2E Agent Tests, how many times has the docs-smoke example (the one about the project-name environment variable) been revised, and what is its current prompt?",
        "4 revisions; the current prompt is 'How do I change the default project name' (scenario pxi-docs-smoke:tracing-project-env-var-v1)",
        "The count of 4 and the current prompt text are required.",
        f"""
did = dataset_id("PXI E2E Agent Tests")
versions = sorted(
    (e["node"]["id"] for e in graphql({NODE_Q % ("Dataset", "versions(first: 50) {{ edges {{ node {{ id }} }} }}")!r}, {{"id": did}})["node"]["versions"]["edges"]),
    key=rowid,
)
current = graphql({NODE_Q % ("Dataset", "examples(first: 100) {{ edges {{ node {{ id revision {{ input metadata }} }} }} }}")!r}, {{"id": did}})["node"]
(example,) = [
    e["node"] for e in current["examples"]["edges"]
    if "PHOENIX_PROJECT_NAME" in json.dumps(e["node"]["revision"]) or "project name" in json.dumps(e["node"]["revision"]["input"])
]
REVISION = "query($id: ID!, $v: ID!) {{ node(id: $id) {{ ... on DatasetExample {{ revision(datasetVersionId: $v) {{ input metadata }} }} }} }}"
seen = []
for version in versions:
    revision = graphql(REVISION, {{"id": example["id"], "v": version}})["node"]["revision"]
    if not seen or revision != seen[-1]:
        seen.append(revision)
write_answer(
    f"{{len(seen)}} revisions; current prompt {{seen[-1]['input'].get('prompt')!r}} "
    f"(scenario {{seen[-1]['metadata'].get('scenario')}}, example {{example['id']}})"
)
""",
    ),
    spec(
        "dataset-example-source-span",
        "datasets",
        "Source span of a dataset example",
        "Which span was the first example of the dataset High Token Count Spans (>20k) created from, and what total token count does the example's output record?",
        "span 1b91cd85d269b2b3 (pxiCompletion Turn, trace 22c05aacaf5197b71e6affb69ca325d0); 27,703 total tokens",
        "The span id and the token count are required.",
        f"""
dataset = graphql(
    {NODE_Q % ("Dataset", "examples(first: 100) {{ edges {{ node {{ id span {{ spanId name trace {{ traceId }} }} revision {{ output }} }} }} }}")!r},
    {{"id": dataset_id("High Token Count Spans (>20k)")}},
)["node"]
example = min((e["node"] for e in dataset["examples"]["edges"]), key=lambda e: rowid(e["id"]))
span = example["span"]
write_answer(
    f"span {{span['spanId']}} ({{span['name']}}, trace {{span['trace']['traceId']}}); "
    f"{{example['revision']['output'].get('token_count_total')}} total tokens (example {{example['id']}})"
)
""",
    ),
    spec(
        "dataset-evaluators",
        "datasets",
        "Evaluators attached to a dataset",
        "Which evaluators are attached to the dataset banking_saas_dataset?",
        "refusal_detection, refusal_detection_fixed, no_sql_in_output",
        "All three names are required.",
        f"""
dataset = graphql(
    {NODE_Q % ("Dataset", "datasetEvaluators(first: 50) {{ edges {{ node {{ name }} }} }}")!r},
    {{"id": dataset_id("banking_saas_dataset")}},
)["node"]
write_answer(", ".join(sorted(e["node"]["name"] for e in dataset["datasetEvaluators"]["edges"])))
""",
    ),
    spec(
        "dataset-evaluator-project",
        "datasets",
        "Project collecting a dataset evaluator's traces",
        "Which project collects the traces of the safe_sql_exact_match evaluator on banking_saas_dataset_clean, and how many traces does it hold?",
        "dataset-evaluator-a629a8ba9fc497a33297f9d8 with 118 traces",
        "The project name is required.",
        f"""
dataset = graphql(
    {NODE_Q % ("Dataset", "datasetEvaluators(first: 50) {{ edges {{ node {{ name project {{ name traceCount }} }} }} }}")!r},
    {{"id": dataset_id("banking_saas_dataset_clean")}},
)["node"]
(evaluator,) = [e["node"] for e in dataset["datasetEvaluators"]["edges"] if e["node"]["name"] == "safe_sql_exact_match"]
write_answer(f"{{evaluator['project']['name']}} with {{evaluator['project']['traceCount']}} traces")
""",
    ),
    spec(
        "dataset-created-by",
        "datasets",
        "Creator of a dataset",
        "Who created the dataset banking_saas_dataset, and is any other dataset attributed to a user?",
        "admin; no, it is the only dataset with a recorded creator",
        "Both parts are required.",
        """
datasets = [
    e["node"]
    for e in graphql("{ datasets(first: 100) { edges { node { name createdBy { username } } } } }")["datasets"]["edges"]
]
attributed = {d["name"]: d["createdBy"]["username"] for d in datasets if d["createdBy"]}
others = {k: v for k, v in attributed.items() if k != "banking_saas_dataset"}
write_answer(
    f"banking_saas_dataset was created by {attributed.get('banking_saas_dataset')}; "
    + (f"other attributed datasets: {others}" if others else "no other dataset has a recorded creator")
)
""",
    ),
    spec(
        "dataset-unnamed",
        "datasets",
        "Datasets with auto-generated names",
        "Two datasets have auto-generated timestamp names. What are they and how many examples does each hold?",
        "Dataset 2026-08-14T17:33:46.188Z and Dataset 2026-08-14T21:05:29.362Z, one example each",
        "Both names are required.",
        """
datasets = [d for d in rest_pages("/datasets", limit=100) if d["name"].startswith("Dataset 20")]
write_answer("; ".join(f"{d['name']} ({d['example_count']} example)" for d in sorted(datasets, key=lambda d: d["name"])))
""",
    ),
    spec(
        "dataset-experiment-count",
        "datasets",
        "Experiment count of a dataset",
        "How many experiments have run on the dataset PXI E2E Agent Tests?",
        "77",
        "",
        f"""
dataset = graphql({NODE_Q % ("Dataset", "experimentCount")!r}, {{"id": dataset_id("PXI E2E Agent Tests")}})
write_answer(str(dataset["node"]["experimentCount"]))
""",
    ),
    spec(
        "dataset-example-external-id",
        "datasets",
        "Example found by its pytest node id and the version that added it",
        "Which example in the dataset experiment_observations has a pytest node id ending in compare-only-no-patch, and in which of the dataset's versions was it added?",
        "example RGF0YXNldEV4YW1wbGU6MTg2, added in the third version (id 38)",
        "The reply must identify the example (by id or by its pytest node id) and say it arrived in the third and latest version.",
        f"""
did = dataset_id("experiment_observations")
examples = rest(f"/datasets/{{did}}/examples")["data"]["examples"]
(example,) = [e for e in examples if str(e["metadata"].get("pytest_nodeid", "")).rstrip("]").endswith("compare-only-no-patch")]
versions = sorted(
    (e["node"]["id"] for e in graphql({NODE_Q % ("Dataset", "versions(first: 50) {{ edges {{ node {{ id }} }} }}")!r}, {{"id": did}})["node"]["versions"]["edges"]),
    key=rowid,
)
MEMBERS = "query($id: ID!, $v: ID!) {{ node(id: $id) {{ ... on Dataset {{ examples(datasetVersionId: $v, first: 100) {{ edges {{ node {{ id }} }} }} }} }} }}"
for index, version in enumerate(versions, start=1):
    members = {{e["node"]["id"] for e in graphql(MEMBERS, {{"id": did, "v": version}})["node"]["examples"]["edges"]}}
    if example["node_id"] in members:
        break
write_answer(f"example {{example['node_id']}}, added in version {{index}} of {{len(versions)}} (version id {{rowid(version)}})")
""",
    ),
    # ------------------------------------------------------------- experiments
    spec(
        "experiment-by-id",
        "experiments",
        "Name and dataset of an experiment id",
        "What is experiment RXhwZXJpbWVudDoxMzY= called, and on which dataset did it run?",
        "Luna first-tool routing — validated evaluator, on github-support-triage-tool-routing",
        "Both the name and the dataset are required.",
        """
experiment = rest("/experiments/RXhwZXJpbWVudDoxMzY=")["data"]
dataset = rest(f"/datasets/{experiment['dataset_id']}")["data"]
write_answer(f"{experiment['name']}, on dataset {dataset['name']}")
""",
    ),
    spec(
        "experiment-description",
        "experiments",
        "Description of a named experiment",
        "What is the description of the experiment safe-sql prompt v3 authorization fix?",
        "Adds one authorization clarification for the user's own external transfers.",
        "",
        """
experiment = experiment_by_name("banking_saas_dataset_clean", "safe-sql prompt v3 authorization fix")
write_answer(str(experiment["description"]))
""",
    ),
    spec(
        "experiment-hypothesis",
        "experiments",
        "Hypothesis and baseline of an experiment",
        "What hypothesis is recorded in the metadata of the experiment safe-sql prompt v4 disambiguation, and which experiment is its baseline?",
        "'Explicit override mappings for paycheck, external transfers, and system-wide balances will yield 28/28 exact matches.'; baseline RXhwZXJpbWVudDoxMDc= (safe-sql prompt v3 authorization fix)",
        "The hypothesis and the baseline (by id or name) are required.",
        """
experiment = experiment_by_name("banking_saas_dataset_clean", "safe-sql prompt v4 disambiguation")
baseline_id = experiment["metadata"]["baseline_experiment_id"]
baseline = rest(f"/experiments/{baseline_id}")["data"]
write_answer(f"{experiment['metadata']['hypothesis']!r}; baseline {baseline_id} ({baseline['name']})")
""",
    ),
    spec(
        "experiment-observation",
        "experiments",
        "Observation appended to an experiment's metadata",
        "What observation did PXI append to the metadata of the experiment safe-sql prompt v4 disambiguation, and when?",
        "at 2026-08-11T15:10:35-04:00, by pxi: 'Hypothesis confirmed: 28/28 examples passed safe_sql_exact_match with zero run or evaluator errors.'",
        "The timestamp (any format) and the 'hypothesis confirmed, 28/28' gist are required.",
        """
experiment = experiment_by_name("banking_saas_dataset_clean", "safe-sql prompt v4 disambiguation")
(observation,) = experiment["metadata"]["observations"]
write_answer(f"at {observation['at']}, by {observation['by']}: {observation['note'][:300]!r}")
""",
    ),
    spec(
        "experiment-baseline-chain",
        "experiments",
        "Baseline chain of an experiment",
        "Starting from the experiment Luna first-tool routing — validated evaluator, follow the baseline_experiment_id links in its metadata back to the first experiment. List the chain.",
        "RXhwZXJpbWVudDoxMzY= (validated evaluator) -> RXhwZXJpbWVudDoxMzU= (strict schema fixed) -> RXhwZXJpbWVudDoxMzQ= (corrected credentials) -> RXhwZXJpbWVudDoxMzM= (baseline, no further link)",
        "All four experiments in this order, by id or name.",
        """
experiment = experiment_by_name("github-support-triage-tool-routing", "Luna first-tool routing — validated evaluator")
chain = []
while experiment:
    chain.append(f"{experiment['id']} ({experiment['name']})")
    baseline = experiment["metadata"].get("baseline_experiment_id")
    experiment = rest(f"/experiments/{baseline}")["data"] if baseline else None
write_answer(" -> ".join(chain))
""",
    ),
    spec(
        "experiment-project",
        "experiments",
        "Project holding an experiment's traces",
        "Which project holds the traces of experiment RXhwZXJpbWVudDoxMDg=?",
        "Experiment-e2b97126b637414e0545df8d",
        "",
        """
write_answer(str(rest("/experiments/RXhwZXJpbWVudDoxMDg=")["data"]["project_name"]))
""",
    ),
    spec(
        "experiment-dataset-version",
        "experiments",
        "Dataset version an experiment ran against",
        "Which dataset version did the experiment Luna first-tool routing baseline run against, and what is that version's description?",
        "version RGF0YXNldFZlcnNpb246NDU= : 'Added 12 example(s) via the assistant'",
        "The description is required; the version id is a bonus.",
        """
experiment = experiment_by_name("github-support-triage-tool-routing", "Luna first-tool routing baseline")
(version,) = [
    v for v in rest_pages(f"/datasets/{experiment['dataset_id']}/versions", limit=100)
    if v["version_id"] == experiment["dataset_version_id"]
]
write_answer(f"version {version['version_id']}: {version['description']!r}")
""",
    ),
    spec(
        "experiment-run-output",
        "experiments",
        "Output and verdict of one experiment run",
        "In the experiment safe-sql prompt v3 authorization fix, what did the model answer for the example 'Did I receive my paycheck this week?', and did that run pass?",
        "it answered 'REFUSED: Query attempts to access other users' data.' and failed (safe_sql_exact_match 0)",
        "The refusal text and the fail verdict are required.",
        """
experiment = experiment_by_name("banking_saas_dataset_clean", "safe-sql prompt v3 authorization fix")
(run,) = [
    r for r in experiment_runs(experiment["id"])
    if "Did I receive my paycheck this week?" in json.dumps(r["example"]["revision"]["input"])
]
output = run["output"]
output = output.get("task_output", output)  # REST and GraphQL unwrap the task output
answer = output["messages"][0]["content"]
verdicts = ", ".join(f"{a['name']} {a['label']} ({a['score']:g})" for a in run["annotations"])
write_answer(f"it answered {answer!r}; {verdicts}")
""",
    ),
    spec(
        "experiment-run-explanation",
        "experiments",
        "Why one experiment run failed its evaluator",
        "In the experiment Luna first-tool routing — validated evaluator, why did the run for the ticket about dark mode making diff text unreadable fail its evaluation?",
        "Expected first tool search_github_issues, but observed get_github_issue.",
        "The expected-versus-observed tool pair is required.",
        """
experiment = experiment_by_name("github-support-triage-tool-routing", "Luna first-tool routing — validated evaluator")
(run,) = [r for r in experiment_runs(experiment["id"]) if "Dark mode" in r["example"]["revision"]["input"]["ticket"]]
write_answer("; ".join(f"{a['name']} {a['label']}: {a['explanation']}" for a in run["annotations"]) + f" (run {run['id']})")
""",
    ),
    spec(
        "experiment-failed-examples",
        "experiments",
        "Scenarios that failed an experiment's evaluator",
        "Which scenarios failed the first_tool_matches_expected evaluation in the experiment Luna first-tool routing — validated evaluator?",
        "duplicate_search_visual_regression, apply_reviewed_docs_triage, apply_confirmed_duplicate (3 of 12)",
        "All three scenario names are required.",
        """
experiment = experiment_by_name("github-support-triage-tool-routing", "Luna first-tool routing — validated evaluator")
runs = experiment_runs(experiment["id"])
failed = sorted(
    r["example"]["revision"]["metadata"]["scenario"]
    for r in runs
    if any(a["name"] == "first_tool_matches_expected" and a["score"] == 0 for a in r["annotations"])
)
write_answer(f"{len(failed)} of {len(runs)}: " + ", ".join(failed))
""",
    ),
    spec(
        "experiment-run-trace",
        "experiments",
        "Trace produced by one experiment run",
        "Which trace did the run for 'Did I receive my paycheck this week?' in the experiment safe-sql prompt v4 disambiguation produce, and in which project is it?",
        "trace 8ff53c090a79d9b5bc27a381fd49a6c1 in project Experiment-e2b97126b637414e0545df8d",
        "Accept a prefix of the trace id; the project name is required.",
        """
experiment = experiment_by_name("banking_saas_dataset_clean", "safe-sql prompt v4 disambiguation")
(run,) = [
    r for r in experiment_runs(experiment["id"])
    if "Did I receive my paycheck this week?" in json.dumps(r["example"]["revision"]["input"])
]
write_answer(f"trace {run['traceId']} in project {experiment['project_name']}")
""",
    ),
    spec(
        "experiment-run-error",
        "experiments",
        "Error every run of an experiment hit",
        "What error did the runs of the experiment Luna first-tool routing baseline hit?",
        "all 5 runs failed with a 401: 'Incorrect API key provided: 1234'",
        "The 401 or the incorrect-API-key message is required.",
        """
experiment = experiment_by_name("github-support-triage-tool-routing", "Luna first-tool routing baseline")
runs = rest_pages(f"/experiments/{experiment['id']}/runs", limit=100)
errors = Counter(str(r["error"])[:120] for r in runs if r["error"])
write_answer(f"{sum(errors.values())} of {len(runs)} runs errored: " + "; ".join(f"{n} x {e!r}" for e, n in errors.most_common()))
""",
    ),
    spec(
        "experiment-run-error-schema",
        "experiments",
        "Error that stopped the corrected-credentials experiment",
        "What error stopped the experiment Luna first-tool routing — corrected credentials?",
        "a 400: invalid schema for the function search_github_issues, 'required' must be supplied (all 5 runs)",
        "The invalid-schema message for search_github_issues is required.",
        """
experiment = experiment_by_name("github-support-triage-tool-routing", "Luna first-tool routing — corrected credentials")
runs = rest_pages(f"/experiments/{experiment['id']}/runs", limit=100)
errors = Counter(str(r["error"])[:160] for r in runs if r["error"])
write_answer(f"{sum(errors.values())} of {len(runs)} runs errored: " + "; ".join(f"{n} x {e!r}" for e, n in errors.most_common()))
""",
    ),
    spec(
        "experiment-llm-eval-explanation",
        "experiments",
        "LLM judge explanation on one experiment run",
        "In experiment RXhwZXJpbWVudDoxMDE=, what did the initial_response_alignment judge say about the run for the url_without_access case?",
        "label false (0.0): 'The assistant incorrectly claims it can retrieve details from the provided URL despite its inability to access external URLs'",
        "The false label and the gist of the explanation are required.",
        """
(run,) = [
    r for r in experiment_runs("RXhwZXJpbWVudDoxMDE=")
    if r["example"]["revision"]["metadata"].get("case") == "url_without_access"
]
write_answer("; ".join(f"{a['name']} {a['label']} ({a['score']:g}): {a['explanation']}" for a in run["annotations"]))
""",
    ),
    spec(
        "experiment-unannotated-run",
        "experiments",
        "Run without an evaluation in an experiment",
        "In experiment RXhwZXJpbWVudDoxMDE=, which example's run has no evaluation, and what does the experiment's job log say went wrong?",
        "the sufficient_python_report case (example RGF0YXNldEV4YW1wbGU6MTE1, trace 92e91e256d387a0a295bf9e8fb868f7e); the job log records a ReadTimeout task error",
        "The case name and the ReadTimeout are required.",
        f"""
runs = [r for r in experiment_runs("RXhwZXJpbWVudDoxMDE=") if not r["annotations"]]
job = graphql(
    {NODE_Q % ("Experiment", "job {{ status errors(first: 50) {{ edges {{ node {{ category level message }} }} }} }}")!r},
    {{"id": "RXhwZXJpbWVudDoxMDE="}},
)["node"]["job"]
logs = "; ".join(f"{{e['node']['category']}} {{e['node']['level']}} {{e['node']['message']}}" for e in job["errors"]["edges"])
write_answer(
    "; ".join(
        f"case {{r['example']['revision']['metadata'].get('case')}} (example {{r['example']['id']}}, trace {{r['traceId']}})"
        for r in runs
    )
    + f"; job log: {{logs}}"
)
""",
    ),
    spec(
        "experiment-job-status",
        "experiments",
        "Job status and last error of an experiment",
        "What is the job status of experiment RXhwZXJpbWVudDoxMzM=, and what was its last error?",
        "ERROR; the job log holds 5 AuthenticationError task errors and the circuit breaker tripped on them",
        "The ERROR status and AuthenticationError are required; either the task error or the circuit-breaker message counts as the last error.",
        f"""
job = graphql(
    {NODE_Q % ("Experiment", "job {{ status lastError {{ message }} errors(first: 50) {{ edges {{ node {{ category message }} }} }} }}")!r},
    {{"id": "RXhwZXJpbWVudDoxMzM="}},
)["node"]["job"]
counts = Counter(f"{{e['node']['category']}} {{e['node']['message']}}" for e in job["errors"]["edges"])
write_answer(
    f"{{job['status']}}; last error {{job['lastError']['message']!r}}; "
    + ", ".join(f"{{n}} x {{m}}" for m, n in counts.most_common())
)
""",
    ),
    spec(
        "experiment-job-model",
        "experiments",
        "Model and prompt version an experiment job ran",
        "Which model and which prompt version did the job for experiment RXhwZXJpbWVudDoxMzY= run?",
        "gpt-5.6-luna (OpenAI) with prompt version UHJvbXB0VmVyc2lvbjoxNQ==, the first version of github-support-ticket-triage-agent",
        "The model and the prompt version id are required. The fixed second version was saved after this experiment, so version 16 is wrong.",
        f"""
job = graphql(
    {NODE_Q % ("Experiment", "job {{ taskConfig {{ prompt {{ modelName modelProvider promptVersion {{ id sequenceNumber }} }} }} }}")!r},
    {{"id": "RXhwZXJpbWVudDoxMzY="}},
)["node"]["job"]
prompt = job["taskConfig"]["prompt"]
version = prompt["promptVersion"]
write_answer(
    f"{{prompt['modelName']}} ({{prompt['modelProvider']}}) with prompt version {{version['id']}} "
    f"(sequence number {{version['sequenceNumber']}})"
)
""",
    ),
    spec(
        "experiment-job-template-error",
        "experiments",
        "Playground experiments that tripped on a template error",
        "Two playground-experiment runs on the dataset banking_saas_dataset ended with the job in ERROR. Which experiments were they, and what tripped them?",
        "experiments RXhwZXJpbWVudDo5MA== and RXhwZXJpbWVudDo5MQ==, both stopped by TemplateFormatterError (the task circuit breaker tripped)",
        "Both experiment ids and TemplateFormatterError are required.",
        f"""
dataset = graphql(
    {NODE_Q % ("Dataset", "experimentJobs(first: 100) {{ edges {{ node {{ status experiment {{ id name }} lastError {{ message }} }} }} }}")!r},
    {{"id": dataset_id("banking_saas_dataset")}},
)["node"]
failed = [e["node"] for e in dataset["experimentJobs"]["edges"] if e["node"]["status"] == "ERROR"]
write_answer(
    "; ".join(
        f"{{j['experiment']['id']}} ({{j['experiment']['name']}}): {{j['lastError']['message'] if j['lastError'] else 'no error'}}"
        for j in sorted(failed, key=lambda j: rowid(j["experiment"]["id"]))
    )
)
""",
    ),
    spec(
        "experiment-eval-error",
        "experiments",
        "Why an experiment stopped early and how its rerun scored",
        "The experiment safe-sql prompt v1 ran only 6 of 28 examples. Why did it stop, and how did the rerun safe-sql prompt v1 rerun do?",
        "it stopped on 'Circuit breaker tripped (eval): Exception' after 5 evaluator errors; the rerun completed all 28 and 12 passed",
        "The evaluator circuit breaker and the rerun's 28 runs with 12 passing are required.",
        f"""
first = experiment_by_name("banking_saas_dataset_clean", "safe-sql prompt v1")
rerun = experiment_by_name("banking_saas_dataset_clean", "safe-sql prompt v1 rerun")
job = graphql(
    {NODE_Q % ("Experiment", "runCount job {{ status lastError {{ message }} errors(first: 50) {{ edges {{ node {{ category message }} }} }} }}")!r},
    {{"id": first["id"]}},
)["node"]
summary = graphql(
    {NODE_Q % ("Experiment", "runCount annotationSummaries {{ annotationName meanScore count }}")!r},
    {{"id": rerun["id"]}},
)["node"]
(scores,) = summary["annotationSummaries"]
logs = [e["node"] for e in job["job"]["errors"]["edges"]]
breaker = [log["message"] for log in logs if log["category"] == "EXPERIMENT"]
evals = [log for log in logs if log["category"] == "EVAL"]
write_answer(
    f"v1 ran {{job['runCount']}} examples and stopped: {{'; '.join(breaker)}} after {{len(evals)}} "
    f"evaluator errors ({{', '.join(sorted({{log['message'] for log in evals}}))}}); the rerun completed "
    f"{{summary['runCount']}} and {{round(scores['meanScore'] * scores['count'])}} passed {{scores['annotationName']}}"
)
""",
    ),
    spec(
        "experiment-split",
        "experiments",
        "Dataset split an experiment ran on",
        "Which dataset split did experiment RXhwZXJpbWVudDo5Mw== run on?",
        "refusal",
        "",
        f"""
experiment = graphql({NODE_Q % ("Experiment", "datasetSplits {{ edges {{ node {{ name }} }} }}")!r}, {{"id": "RXhwZXJpbWVudDo5Mw=="}})
write_answer(", ".join(e["node"]["name"] for e in experiment["node"]["datasetSplits"]["edges"]) or "none")
""",
    ),
    spec(
        "experiment-evaluators",
        "experiments",
        "Dataset evaluators attached to an experiment",
        "Which dataset evaluators were attached to experiment RXhwZXJpbWVudDoxMDE=?",
        "initial_response_alignment only",
        "",
        f"""
job = graphql(
    {NODE_Q % ("Experiment", "job {{ datasetEvaluators(first: 50) {{ edges {{ node {{ name }} }} }} }}")!r},
    {{"id": "RXhwZXJpbWVudDoxMDE="}},
)["node"]["job"]
names = [e["node"]["name"] for e in job["datasetEvaluators"]["edges"]]
write_answer(", ".join(names) + (" only" if len(names) == 1 else ""))
""",
    ),
    spec(
        "experiment-e2e-metadata",
        "experiments",
        "Models recorded on an end-to-end experiment",
        "Which assistant model and judge model did the experiment pxi-e2e-docs-smoke-2026-05-04T14-34-34-020Z use?",
        "assistant gpt-4.1-mini, judge gpt-4.1 (Playwright project chromium)",
        "Both models are required.",
        """
experiment = experiment_by_name("PXI E2E Agent Tests", "pxi-e2e-docs-smoke-2026-05-04T14-34-34-020Z")
meta = experiment["metadata"]
write_answer(
    f"assistant {meta.get('assistantModel')}, judge {meta.get('judgeModel')} "
    f"(Playwright project {meta.get('playwrightProject')})"
)
""",
    ),
    spec(
        "experiment-e2e-outcome",
        "experiments",
        "Judge verdict on an end-to-end experiment run",
        "What did the pxi_outcome judge say about the single run of the experiment pxi-e2e-docs-smoke-2026-05-04T14-34-34-020Z?",
        "pass (1.0): 'The answer correctly identifies PHOENIX_PROJECT_NAME as the environment variable for setting the Phoenix tracing project name'",
        "The pass label and the PHOENIX_PROJECT_NAME gist are required.",
        """
experiment = experiment_by_name("PXI E2E Agent Tests", "pxi-e2e-docs-smoke-2026-05-04T14-34-34-020Z")
(run,) = experiment_runs(experiment["id"])
write_answer("; ".join(f"{a['name']} {a['label']} ({a['score']:g}): {a['explanation']}" for a in run["annotations"]))
""",
    ),
    spec(
        "experiment-regression-sha",
        "experiments",
        "Git commit recorded on a regression experiment",
        "Which git commit is recorded in the metadata of the experiment set_span-64502b8e, and how many runs did it have?",
        "0dc26e61a087b221da2d825440da9602828d2642 (model gpt-5.4), 48 runs",
        "The commit sha (or a prefix) and the run count are required.",
        f"""
experiment = experiment_by_name("set_spans_filter", "set_span-64502b8e")
count = graphql({NODE_Q % ("Experiment", "runCount")!r}, {{"id": experiment["id"]}})["node"]["runCount"]
write_answer(f"{{experiment['metadata'].get('git_sha')}} (model {{experiment['metadata'].get('model')}}), {{count}} runs")
""",
    ),
    spec(
        "experiment-repetitions",
        "experiments",
        "Repetitions of an experiment",
        "How many repetitions did the experiment safe-sql prompt v4 disambiguation use?",
        "1",
        "",
        """
write_answer(str(experiment_by_name("banking_saas_dataset_clean", "safe-sql prompt v4 disambiguation")["repetitions"]))
""",
    ),
    spec(
        "experiment-by-name-id",
        "experiments",
        "Phoenix id of a named experiment",
        "What is the Phoenix id of the experiment named safe-sql prompt v1 rerun?",
        "RXhwZXJpbWVudDoxMDU=",
        "That id decodes to Experiment:105.",
        """
write_answer(str(experiment_by_name("banking_saas_dataset_clean", "safe-sql prompt v1 rerun")["id"]))
""",
    ),
    # -------------------------------------------------------------- evaluators
    spec(
        "evaluator-kinds",
        "evaluators",
        "Evaluator counts by kind",
        "How many evaluators exist, by kind, counting the built-in ones?",
        "11 in total: 5 built-in, 5 code, 1 LLM",
        "The custom list has 6 (5 code and 1 LLM); the 5 built-ins are listed separately. The total of 11 with the breakdown is required.",
        """
custom = [e["node"] for e in graphql("{ evaluators(first: 100) { edges { node { kind name } } } }")["evaluators"]["edges"]]
builtin = graphql("{ builtInEvaluators { name } }")["builtInEvaluators"]
counts = Counter(e["kind"] for e in custom)
write_answer(
    f"{len(custom) + len(builtin)} in total: {len(builtin)} built-in, "
    + ", ".join(f"{n} {kind}" for kind, n in sorted(counts.items()))
)
""",
    ),
    spec(
        "evaluator-builtins",
        "evaluators",
        "Names of the built-in evaluators",
        "List the built-in evaluators.",
        "contains, exact_match, regex, levenshtein_distance, json_distance",
        "All five are required.",
        """
write_answer(", ".join(sorted(e["name"] for e in graphql("{ builtInEvaluators { name } }")["builtInEvaluators"])))
""",
    ),
    spec(
        "evaluator-description",
        "evaluators",
        "How two refusal evaluators differ",
        "According to their descriptions, what does the evaluator refusal_detection_fixed detect that refusal_detection does not?",
        "structured or programmatic refusal patterns such as 'REFUSED:', 'unauthorized', and 'permission denied', in addition to conversational refusal phrases",
        "The reply must mention the structured patterns (REFUSED:, unauthorized, or permission denied).",
        """
evaluators = {
    e["node"]["name"]: e["node"]["description"]
    for e in graphql("{ evaluators(first: 100) { edges { node { name description } } } }")["evaluators"]["edges"]
}
write_answer(
    f"refusal_detection: {evaluators['refusal_detection']!r}; "
    f"refusal_detection_fixed: {evaluators['refusal_detection_fixed']!r}"
)
""",
    ),
    spec(
        "evaluator-language-sandbox",
        "evaluators",
        "Language, sandbox, and version count of a code evaluator",
        "Which language and sandbox does the evaluator safe_sql_exact_match run in, and how many code versions does it have?",
        "Python in the default-monty-python sandbox (MONTY), 2 versions",
        "The other code evaluators use the webassembly (WASM) sandbox and have one version. The sandbox name and the version count are required.",
        """
(evaluator,) = [
    e["node"]
    for e in graphql(
        "{ evaluators(first: 100) { edges { node { name ... on CodeEvaluator {"
        " language versionCount sandboxConfig { name provider { backendType } } } } } } }"
    )["evaluators"]["edges"]
    if e["node"]["name"] == "safe_sql_exact_match"
]
sandbox = evaluator["sandboxConfig"]
write_answer(
    f"{evaluator['language']} in the {sandbox['name']} sandbox ({sandbox['provider']['backendType']}), "
    f"{evaluator['versionCount']} versions"
)
""",
    ),
    spec(
        "evaluator-llm-prompt",
        "evaluators",
        "Prompt and tag behind an LLM evaluator",
        "Which prompt and prompt version tag does the LLM evaluator initial_response_alignment use?",
        "prompt initial_response_alignment-evaluator-2d262223 (UHJvbXB0Ojk=), tag initial_response_alignment-evaluator-b89a1ffc on version UHJvbXB0VmVyc2lvbjoxNA==",
        "The prompt name and the tag name are required.",
        """
(evaluator,) = [
    e["node"]
    for e in graphql(
        "{ evaluators(first: 100) { edges { node { name ... on LLMEvaluator {"
        " prompt { id name } promptVersionTag { name promptVersionId } } } } } }"
    )["evaluators"]["edges"]
    if e["node"]["name"] == "initial_response_alignment"
]
tag = evaluator["promptVersionTag"]
write_answer(
    f"prompt {evaluator['prompt']['name']} ({evaluator['prompt']['id']}), "
    f"tag {tag['name']} on version {tag['promptVersionId']}"
)
""",
    ),
    spec(
        "evaluator-output-config",
        "evaluators",
        "Output labels of a code evaluator",
        "What labels does the evaluator no_sql_in_output emit, and which label is the better outcome?",
        "pass = 1.0 and fail = 0.0; it maximises, so pass is better",
        "Both labels and the direction (or that pass is better) are required.",
        """
(evaluator,) = [
    e["node"]
    for e in graphql(
        "{ evaluators(first: 100) { edges { node { name ... on CodeEvaluator { datasetEvaluators {"
        " dataset { name } outputConfigs { ... on CategoricalAnnotationConfig {"
        " optimizationDirection values { label score } } } } } } } } }"
    )["evaluators"]["edges"]
    if e["node"]["name"] == "no_sql_in_output"
]
# Output configs live on the per-dataset attachment, not on the code evaluator itself.
(attachment,) = evaluator["datasetEvaluators"]
(config,) = attachment["outputConfigs"]
values = ", ".join(f"{v['label']} = {v['score']:g}" for v in config["values"])
best = max(config["values"], key=lambda v: v["score"] if config["optimizationDirection"] == "MAXIMIZE" else -v["score"])
write_answer(f"{values}; direction {config['optimizationDirection']}, so {best['label']} is better")
""",
    ),
    spec(
        "evaluator-direction-none",
        "evaluators",
        "Dataset evaluators without an optimisation direction",
        "Which dataset evaluators on banking_saas_dataset declare no optimisation direction?",
        "refusal_detection and refusal_detection_fixed",
        "Both names are required; no_sql_in_output maximises and must not be listed.",
        f"""
dataset = graphql(
    {NODE_Q % ("Dataset", "datasetEvaluators(first: 50) {{ edges {{ node {{ name outputConfigs {{ ... on CategoricalAnnotationConfig {{ optimizationDirection }} ... on ContinuousAnnotationConfig {{ optimizationDirection }} }} }} }} }}")!r},
    {{"id": dataset_id("banking_saas_dataset")}},
)["node"]
none = sorted(
    e["node"]["name"]
    for e in dataset["datasetEvaluators"]["edges"]
    if all(c.get("optimizationDirection") == "NONE" for c in e["node"]["outputConfigs"])
)
write_answer(", ".join(none) or "none")
""",
    ),
    spec(
        "evaluator-datasets",
        "evaluators",
        "Datasets using an evaluator",
        "Which datasets use the evaluator first_tool_matches_expected?",
        "github-support-triage-tool-routing only",
        "",
        """
(evaluator,) = [
    e["node"]
    for e in graphql(
        "{ evaluators(first: 100) { edges { node { name datasets(first: 50) { edges { node { name } } } } } } }"
    )["evaluators"]["edges"]
    if e["node"]["name"] == "first_tool_matches_expected"
]
names = [e["node"]["name"] for e in evaluator["datasets"]["edges"]]
write_answer(", ".join(names) + (" only" if len(names) == 1 else ""))
""",
    ),
    spec(
        "evaluator-levenshtein-type",
        "evaluators",
        "Output type of a built-in evaluator",
        "Is the built-in evaluator levenshtein_distance categorical or continuous, and which direction is better?",
        "continuous, MINIMIZE (lower bound 0, so lower is better)",
        "Continuous and minimize are required.",
        """
(evaluator,) = [
    e
    for e in graphql(
        "{ builtInEvaluators { name outputConfigs { __typename"
        " ... on ContinuousAnnotationConfig { optimizationDirection lowerBound upperBound }"
        " ... on CategoricalAnnotationConfig { optimizationDirection } } } }"
    )["builtInEvaluators"]
    if e["name"] == "levenshtein_distance"
]
(config,) = evaluator["outputConfigs"]
write_answer(
    f"{config['__typename'].replace('AnnotationConfig', '').lower()}, {config['optimizationDirection']} "
    f"(lower bound {config.get('lowerBound')}, upper bound {config.get('upperBound')})"
)
""",
    ),
    # ----------------------------------------------------------------- prompts
    spec(
        "prompt-count",
        "prompts",
        "Number of stored prompts",
        "How many prompts are stored?",
        "10",
        "",
        """
write_answer(str(len(rest_pages("/prompts", limit=100))))
""",
    ),
    spec(
        "prompt-latest-version",
        "prompts",
        "Model and note of a prompt's latest version",
        "What model does the latest version of the prompt pxi-system-prompt target, and what does its version note say?",
        "gpt-4o (OpenAI); 'Improved version: added Tool Call Efficiency Rules section, consolidated sandbox docs, removed redundant prose'",
        "Both the model and the note are required.",
        """
version = rest("/prompts/pxi-system-prompt/latest")["data"]
write_answer(f"{version['model_name']} ({version['model_provider']}); {version['description']!r}")
""",
    ),
    spec(
        "prompt-version-count",
        "prompts",
        "Version count of a prompt and what the second changed",
        "How many versions does the prompt secure-sql-generation-assistant-for-a-banking-saas-application-given-a-n_36 have, and what did the second version change?",
        "2 versions; the second: 'Disambiguate refusal reasons: route PII about other people/customers (names, SSNs, balances, contact info) to other users' data; reserve unauthorized system data for passwords/schema/admin. Fixes SSN misclassification - 13/13 on the refusal split.'",
        "The count and the gist of the second version's note (refusal-reason disambiguation, 13/13 on the refusal split) are required.",
        """
name = "secure-sql-generation-assistant-for-a-banking-saas-application-given-a-n_36"
versions = sorted(rest_pages(f"/prompts/{name}/versions", limit=100), key=lambda v: rowid(v["id"]))
write_answer(f"{len(versions)} versions; the second: {versions[1]['description']!r}")
""",
    ),
    spec(
        "prompt-by-tag",
        "prompts",
        "Prompt version carrying a tag",
        "Which prompt version carries the tag staging, and on which prompt is it?",
        "version UHJvbXB0VmVyc2lvbjoxNA== of the prompt initial_response_alignment-evaluator-2d262223; the tag is described as 'The version deployed to staging'",
        "The prompt name is required; the version id is a bonus.",
        """
prompts = rest_pages("/prompts", limit=100)
hits = []
for prompt in prompts:
    version = rest(f"/prompts/{prompt['id']}/tags/staging", missing_ok=True)
    if version:
        tags = rest_pages(f"/prompt_versions/{version['data']['id']}/tags", limit=100)
        (tag,) = [t for t in tags if t["name"] == "staging"]
        hits.append(f"version {version['data']['id']} of {prompt['name']} ({tag.get('description')!r})")
write_answer("; ".join(hits) or "no version carries the staging tag")
""",
    ),
    spec(
        "prompt-tags",
        "prompts",
        "All prompt version tags",
        "How many prompt version tags exist in total, and on which prompt and version are they?",
        "2 tags (staging and initial_response_alignment-evaluator-b89a1ffc), both on version UHJvbXB0VmVyc2lvbjoxNA== of initial_response_alignment-evaluator-2d262223",
        "The count of 2 and the prompt name are required.",
        """
prompts = [
    e["node"]
    for e in graphql("{ prompts(first: 100) { edges { node { name versionTags { name promptVersionId } } } } }")["prompts"]["edges"]
]
tags = [(p["name"], t["name"], t["promptVersionId"]) for p in prompts for t in p["versionTags"]]
write_answer(
    f"{len(tags)} tags: "
    + "; ".join(f"{tag} on version {version} of {prompt}" for prompt, tag, version in sorted(tags))
)
""",
    ),
    spec(
        "prompt-tools",
        "prompts",
        "Tools defined by a prompt",
        "Which tools does the latest version of the prompt github-support-ticket-triage-agent define?",
        "get_github_issue, search_github_issues, apply_github_triage",
        "All three are required.",
        """
version = rest("/prompts/github-support-ticket-triage-agent/latest")["data"]
write_answer(", ".join(t["function"]["name"] for t in version["tools"]["tools"]))
""",
    ),
    spec(
        "prompt-tool-description",
        "prompts",
        "Description of one tool in a prompt",
        "How does the prompt github-support-ticket-triage-agent describe its get_github_issue tool?",
        "Fetch a GitHub issue and its recent comments before classifying or changing it.",
        "",
        """
version = rest("/prompts/github-support-ticket-triage-agent/latest")["data"]
(tool,) = [t for t in version["tools"]["tools"] if t["function"]["name"] == "get_github_issue"]
write_answer(str(tool["function"]["description"]))
""",
    ),
    spec(
        "prompt-model-change",
        "prompts",
        "Model change between two prompt versions",
        "The prompt phoenix-issue-reproduction-and-triage-agent-your-job-is-to-turn-an-unstr_4 changed model between its versions. From which model to which, and what did the version note say?",
        "from gpt-4o-mini to gpt-5.6-sol; the note says 'update default model'",
        "Both models are required.",
        """
name = "phoenix-issue-reproduction-and-triage-agent-your-job-is-to-turn-an-unstr_4"
versions = sorted(rest_pages(f"/prompts/{name}/versions", limit=100), key=lambda v: rowid(v["id"]))
write_answer(
    " -> ".join(v["model_name"] for v in versions)
    + "; notes: "
    + "; ".join(repr(v["description"] or "") for v in versions)
)
""",
    ),
    spec(
        "prompt-template-format",
        "prompts",
        "Template format and opening of a prompt",
        "What template format does the prompt named banking use, and how does its system message begin?",
        "MUSTACHE, a chat template; it begins 'You are a chatbot that translates natural language queries in postgres sql queries for a single user of banking application.'",
        "The format and the opening sentence are required.",
        """
version = rest("/prompts/banking/latest")["data"]
first = version["template"]["messages"][0]
text = first["content"][0]["text"] if isinstance(first["content"], list) else first["content"]
write_answer(f"{version['template_format']}, a {version['template_type']} template; it begins {text[:200]!r}")
""",
    ),
    spec(
        "prompt-labels",
        "prompts",
        "Prompt labels and where they are applied",
        "Which prompt carries the label evaluator, and what colour and description does that label have?",
        "initial_response_alignment-evaluator-2d262223; colour #4ecf50; 'Automatically assigned to prompts created for LLM evaluators'",
        "The prompt name and the colour are required.",
        """
labels = [e["node"] for e in graphql("{ promptLabels { edges { node { name color description } } } }")["promptLabels"]["edges"]]
prompts = [e["node"] for e in graphql("{ prompts(first: 100) { edges { node { name labels { name } } } } }")["prompts"]["edges"]]
(label,) = [item for item in labels if item["name"] == "evaluator"]
tagged = [p["name"] for p in prompts if any(item["name"] == "evaluator" for item in p["labels"])]
write_answer(f"{', '.join(tagged)}; colour {label['color']}; {label['description']!r}")
""",
    ),
    spec(
        "prompt-metadata",
        "prompts",
        "Prompts that carry metadata",
        "Which prompts have metadata, and what source do they record?",
        "approximate-system-prompt-v1 and approximate-system-prompt-v2, both with source PXI-generated",
        "Both prompt names and the source are required.",
        """
prompts = [p for p in rest_pages("/prompts", limit=100) if p["metadata"]]
write_answer("; ".join(f"{p['name']}: {json.dumps(p['metadata'])}" for p in sorted(prompts, key=lambda p: p["name"])))
""",
    ),
    spec(
        "prompt-luna-fix",
        "prompts",
        "Note on the latest version of the triage prompt",
        "What does the latest version of the prompt github-support-ticket-triage-agent say about why it was saved, and which model does it target?",
        "'Fix strict search tool schema validated by the completed Luna routing experiment.'; model gpt-5.6-luna",
        "Both are required.",
        """
version = rest("/prompts/github-support-ticket-triage-agent/latest")["data"]
write_answer(f"{version['description']!r}; model {version['model_name']}")
""",
    ),
    spec(
        "prompt-created-order",
        "prompts",
        "Most recently created prompt",
        "Which prompt was created most recently, and when (UTC)?",
        "github-support-ticket-triage-agent, 2026-08-31 01:43:58 UTC",
        "The name is required; accept the time to the minute.",
        """
prompts = [e["node"] for e in graphql("{ prompts(first: 100) { edges { node { name createdAt } } } }")["prompts"]["edges"]]
latest = max(prompts, key=lambda p: p["createdAt"])
write_answer(f"{latest['name']}, {utc(latest['createdAt'])}")
""",
    ),
    # --------------------------------------------------- users, models, settings
    spec(
        "users-and-roles",
        "settings",
        "Users and their roles",
        "Which users exist, and what role does each have?",
        "system (SYSTEM), admin (ADMIN), user-7d7113 (ADMIN); all use local authentication",
        "All three usernames with their roles are required.",
        """
users = rest_pages("/users", limit=100)
write_answer(
    "; ".join(f"{u['username']} has role {u['role']}" for u in sorted(users, key=lambda u: rowid(u["id"])))
    + "; authentication: " + ", ".join(sorted({u["auth_method"].lower() for u in users}))
)
""",
    ),
    spec(
        "user-roles-available",
        "settings",
        "Assignable user roles",
        "Which user roles can be assigned in this Phoenix?",
        "ADMIN, MEMBER, VIEWER",
        "SYSTEM exists only for the built-in system user and is not offered; a reply that lists it as well is still acceptable.",
        """
write_answer(", ".join(sorted(r["name"] for r in graphql("{ userRoles { name } }")["userRoles"])))
""",
    ),
    spec(
        "model-price",
        "llm-usage",
        "Token prices of a model",
        "What are the input and output token prices for the model gpt-5.6-sol?",
        "$4.00 per million input tokens and $20.00 per million output tokens (cache read $0.40, cache write $5.00)",
        "Input and output prices in any consistent unit (per token or per million) are required.",
        """
(model,) = [m for m in generative_models() if m["name"] == "gpt-5.6-sol"]
write_answer(
    "; ".join(
        f"{p['tokenType']} ({p['kind']}): ${p['costPerMillionTokens']:g} per million"
        for p in sorted(model["tokenPrices"], key=lambda p: p["tokenType"])
    )
)
""",
    ),
    spec(
        "model-price-cheaper",
        "llm-usage",
        "Compare two models' input prices",
        "Is gpt-5.6-luna cheaper than gpt-4o-mini on input tokens?",
        "no: gpt-5.6-luna costs $0.20 per million input tokens and gpt-4o-mini $0.15",
        "The answer no with both prices is required.",
        """
prices = {}
for model in generative_models():
    if model["name"] in ("gpt-5.6-luna", "gpt-4o-mini"):
        (price,) = [p for p in model["tokenPrices"] if p["tokenType"] == "input"]
        prices[model["name"]] = price["costPerMillionTokens"]
cheaper = prices["gpt-5.6-luna"] < prices["gpt-4o-mini"]
write_answer(
    f"{'yes' if cheaper else 'no'}: gpt-5.6-luna costs ${prices['gpt-5.6-luna']:g} per million input tokens "
    f"and gpt-4o-mini ${prices['gpt-4o-mini']:g}"
)
""",
    ),
    spec(
        "model-price-types",
        "llm-usage",
        "Priced token types of a model",
        "Which token types are priced for the model gpt-4o?",
        "input, output, and cache_read (no cache_write price)",
        "All three types are required.",
        """
(model,) = [m for m in generative_models() if m["name"] == "gpt-4o"]
write_answer(", ".join(sorted(p["tokenType"] for p in model["tokenPrices"])))
""",
    ),
    spec(
        "model-count",
        "llm-usage",
        "Number of registered models",
        "Are any of the generative models registered for cost tracking user-defined, or are they all built-in? How many are there?",
        "all built-in, none user-defined (401 models on this server)",
        "That none of them is custom is what is graded. The count comes from the server's built-in price table and changes with the Phoenix version, so accept any count.",
        """
models = generative_models()
kinds = Counter(m["kind"] for m in models)
write_answer(f"{len(models)} models: " + ", ".join(f"{n} {kind}" for kind, n in sorted(kinds.items())))
""",
    ),
    spec(
        "model-pattern",
        "llm-usage",
        "Name pattern of a built-in model",
        "What name pattern matches the built-in model gpt-5.4-2026-03-05?",
        "gpt-5\\.4-2026-03-05",
        "The pattern with the escaped dot is the exact value; accept it with or without the backslash.",
        """
(model,) = [m for m in generative_models() if m["name"] == "gpt-5.4-2026-03-05"]
write_answer(model["namePattern"])
""",
    ),
    spec(
        "default-retention-policy",
        "settings",
        "The default trace retention policy",
        "What is the default trace retention policy?",
        "Default, cron 0 0 * * 0, max_days 0 (never deletes)",
        "The cron expression and the max_days rule are required.",
        """
policy = graphql(
    "{ defaultProjectTraceRetentionPolicy { name cronExpression rule { __typename"
    " ... on TraceRetentionRuleMaxDays { maxDays } ... on TraceRetentionRuleMaxCount { maxCount } } } }"
)["defaultProjectTraceRetentionPolicy"]
rule = {k: v for k, v in policy["rule"].items() if k != "__typename"}
days = rule.get("maxDays")
text = f"max_days {days:g}" + (" (never deletes)" if days == 0 else "") if days is not None else str(rule)
write_answer(f"{policy['name']}, cron {policy['cronExpression']}, rule {text}")
""",
    ),
    spec(
        "sandbox-providers",
        "settings",
        "Sandbox providers and configs",
        "Which sandbox providers are enabled, and which sandbox configs exist?",
        "7 providers, all enabled (WASM, E2B, DAYTONA, VERCEL, DENO, MODAL, MONTY); 3 configs: webassembly (WASM, Python), default-deno-typescript (DENO, TypeScript), default-monty-python (MONTY, Python), each with a 300 s timeout",
        "The three config names are required; the provider list is a bonus.",
        """
providers = graphql("{ sandboxProviders { backendType enabled configs { name language timeout } } }")["sandboxProviders"]
enabled = [p["backendType"] for p in providers if p["enabled"]]
configs = [(c["name"], p["backendType"], c["language"], c["timeout"]) for p in providers for c in p["configs"]]
write_answer(
    f"{len(enabled)} of {len(providers)} providers enabled ({', '.join(enabled)}); {len(configs)} configs: "
    + ", ".join(f"{n} ({b}, {lang}, {t} s)" for n, b, lang, t in sorted(configs))
)
""",
    ),
    spec(
        "trace-recording-setting",
        "settings",
        "Assistant trace-recording setting",
        "Does the assistant trace-recording setting allow remote export of PXI traces?",
        "yes; both local trace recording and remote export are allowed",
        "The answer yes is required.",
        """
config = graphql("{ agentsConfig { allowLocalTraces allowRemoteExport } }")["agentsConfig"]
write_answer(
    f"{'yes' if config['allowRemoteExport'] else 'no'}; allowLocalTraces {config['allowLocalTraces']}, "
    f"allowRemoteExport {config['allowRemoteExport']}"
)
""",
    ),
    # ---------------------------------------------------- zero-answer controls
    spec(
        "no-such-trace",
        "traces",
        "Lookup of a trace that does not exist",
        "What is the root span of trace 00000000000000000000000000000000?",
        "there is no trace with that id",
        "The reply must say the trace does not exist rather than invent a span.",
        f"""
trace = graphql({TRACE_Q % "rootSpan {{ name }}"!r}, {{"t": "00000000000000000000000000000000"}})["getTraceByOtelId"]
write_answer("there is no trace with that id" if trace is None else f"root span {{trace['rootSpan']['name']}}")
""",
    ),
    spec(
        "no-such-prompt",
        "prompts",
        "Lookup of a prompt that does not exist",
        "What model does the prompt customer-support-agent use?",
        "no prompt named customer-support-agent exists",
        "The reply must say the prompt does not exist rather than name a model.",
        """
version = rest("/prompts/customer-support-agent/latest", missing_ok=True)
write_answer(
    "no prompt named customer-support-agent exists" if version is None else version["data"]["model_name"]
)
""",
    ),
    spec(
        "no-trace-annotations",
        "annotations",
        "A project without trace annotations",
        "What trace annotations exist in the project mobile-review-queue?",
        "none; its feedback is recorded as session and span annotations, not trace annotations",
        "The reply must say there are no trace annotations.",
        """
project = graphql(
    '{ getProjectByName(name: "mobile-review-queue") { traceAnnotationNames sessionAnnotationNames spanAnnotationNames } }'
)["getProjectByName"]
write_answer(
    ("none" if not project["traceAnnotationNames"] else ", ".join(project["traceAnnotationNames"]))
    + f"; session annotations: {', '.join(project['sessionAnnotationNames']) or 'none'}; "
    f"span annotations: {', '.join(project['spanAnnotationNames']) or 'none'}"
)
""",
    ),
    spec(
        "no-custom-providers",
        "settings",
        "Custom model providers",
        "Which custom model providers are configured?",
        "none",
        "",
        """
providers = rest_pages("/custom_model_providers", limit=100)
write_answer("none" if not providers else ", ".join(p.get("name", str(p)) for p in providers))
""",
    ),
    spec(
        "no-dataset-labels",
        "datasets",
        "Labels on a dataset",
        "Which labels does the dataset save_prompt carry?",
        "none; no dataset labels exist",
        "",
        """
labels = rest(f"/datasets/{dataset_id('save_prompt')}/labels")["data"]
write_answer("none" if not labels else ", ".join(label["name"] for label in labels))
""",
    ),
]


def copy_shared(task: Path) -> None:
    for name in (".gitignore", "tests/test.sh", "solution/solve.sh"):
        target = task / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(REFERENCE / name, target)
        target.chmod((REFERENCE / name).stat().st_mode)


def task_toml(item: Spec) -> str:
    header, _, metadata, shared = (REFERENCE / "task.toml").read_text().split("\n\n", 3)
    task = f'[task]\nname = "phoenix/{item["slug"]}"\ndescription = "{item["description"]}"'
    metadata = re.sub(r'^domain = ".*"$', f'domain = "{item["domain"]}"', metadata, flags=re.M)
    assert f'domain = "{item["domain"]}"' in metadata
    if item["slug"] in TEST:
        metadata += f'\nverifiers = "{HERE.name}"'
    return "\n\n".join((header, task, metadata, shared))


def task_dir(item: Spec) -> Path:
    return (TEST_DIR if item["slug"] in TEST else HERE) / item["slug"]


def write(item: Spec) -> None:
    task = task_dir(item)
    (task / "tests").mkdir(parents=True, exist_ok=True)
    (task / "solution").mkdir(parents=True, exist_ok=True)
    copy_shared(task)
    (task / "instruction.md").write_text(item["question"] + "\n")
    (task / "task.toml").write_text(task_toml(item))
    expected: dict[str, str] = {"reference": item["reference"]}
    if item["notes"]:
        expected["notes"] = item["notes"]
    expected.update(expected_api="http", source=SOURCE)
    (task / "tests" / "expected.json").write_text(json.dumps(expected, indent=2) + "\n")
    # The Phoenix example output: the bare reference, shown as an assistant message.
    (task / "tests" / "reference.json").write_text(json.dumps(item["reference"]) + "\n")
    solve = task / "solution" / "solve.py"
    solve.write_text(SOLVE.format(description=item["description"], code=item["code"]))
    solve.chmod(solve.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)


def main() -> None:
    slugs = [item["slug"] for item in SPECS]
    duplicates = {slug for slug in slugs if slugs.count(slug) > 1}
    if duplicates:
        raise SystemExit(f"duplicate slugs: {sorted(duplicates)}")
    for item in SPECS:
        if '"' in item["description"]:
            raise SystemExit(f"{item['slug']}: task.toml descriptions cannot contain double quotes")
        write(item)
    # The code snippets are string literals, so the formatter never saw them.
    subprocess.run(
        ["uv", "run", "ruff", "format", "-q", *(task_dir(item) for item in SPECS)], check=True
    )
    missing = TEST - set(slugs)
    if missing:
        raise SystemExit(f"TEST names unknown slugs: {sorted(missing)}")
    print(f"wrote {len(SPECS) - len(TEST)} tasks under {HERE} and {len(TEST)} under {TEST_DIR}")


if __name__ == "__main__":
    main()
