"""Score whether a PXI turn that changes an evaluator followed the plan-first workflow.

PXI keeps an evaluator plan at ``/home/user/workspace/evaluator-plans/<name>.md`` and works
through ``bash`` to write it, so the plan shows up in traces as bash TOOL spans. A turn that
edits, previews, or saves an evaluator (through the browser operations or ``phoenix-gql``)
should touch the plan first, and a turn that saves should rewrite the plan after its last
preview, recording observed results, before the save.

Browser operations count only when they ran: the tool's output lists each executed call with
``ok`` or ``FAILED``, and a script that returned early (a failed read, say) changed nothing even
though its source names an edit.
"""

from __future__ import annotations

import json
import re
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any, Literal, Optional

from phoenix.client.__generated__ import v1
from phoenix.evals.evaluators import Score

from evals.pxi.online_evals.models import EvaluatorSpec
from evals.pxi.online_evals.topology import PXI_TURN_ROOT_SELECTOR, top_level_tool_spans

ANNOTATION_NAME = "evaluator_authoring_process"

PLAN_PATH = "/home/user/workspace/evaluator-plans/"

_UI_OPERATION_CALL_RE = re.compile(r"\bui\.((?:[A-Za-z_$][\w$]*\.)*[A-Za-z_$][\w$]*)\s*\(")
# The browser tool's output lists the operations the script actually ran, one per line:
# ``1. evaluators.code.edit ok 2ms 145ch`` or ``2. evaluators.code.test FAILED 70ms 206ch``.
_EXECUTED_CALL_RE = re.compile(r"^\s*\d+\.\s+(\S+)\s+(ok|FAILED)\b", re.MULTILINE)
# A plan access writes when the command redirects into, copies onto, or edits a file in place.
_PLAN_WRITE_RE = re.compile(r">|\btee\b|\bsed\s+-i\b|\bcp\b|\bmv\b")

_EDIT_OPERATIONS = frozenset(
    {"evaluators.code.edit", "evaluators.llm.edit", "playground.evaluator.edit"}
)
_PREVIEW_OPERATIONS = frozenset({"evaluators.code.test", "evaluators.llm.test", "playground.run"})
_SAVE_OPERATIONS = frozenset(
    {"evaluators.code.submit", "evaluators.llm.submit", "playground.evaluator.save"}
)
_PREVIEW_MUTATIONS = ("evaluatorPreviews",)
_SAVE_MUTATIONS = (
    "createCodeEvaluator",
    "patchCodeEvaluator",
    "createCodeEvaluatorVersion",
    "createDatasetCodeEvaluator",
    "updateDatasetCodeEvaluator",
    "createDatasetLlmEvaluator",
    "updateDatasetLlmEvaluator",
    "createProjectCodeEvaluator",
    "addProjectCodeEvaluator",
    "updateProjectCodeEvaluator",
    "createProjectLlmEvaluator",
    "updateProjectLlmEvaluator",
)

Step = Literal["plan_read", "plan_write", "edit", "preview", "save"]

SCORES: dict[str, float] = {
    "planned_and_validated": 1.0,
    "planned": 1.0,
    "planned_not_validated": 0.5,
    "unplanned": 0.0,
}


@dataclass(frozen=True)
class _Step:
    kind: Step
    tool_name: str


def _tool_name(span: v1.Span) -> str:
    value: Any = span.get("attributes", {}).get("tool.name")
    return value if isinstance(value, str) and value else span["name"]


def _tool_input(span: v1.Span) -> dict[str, Any]:
    raw: Any = span.get("attributes", {}).get("input.value")
    if isinstance(raw, dict):
        return raw
    if not isinstance(raw, str):
        return {}
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _tool_output_text(span: v1.Span) -> Optional[str]:
    """The tool's output as text; a JSON-encoded string is decoded, anything else is left alone."""
    raw: Any = span.get("attributes", {}).get("output.value")
    if not isinstance(raw, str):
        return None
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return raw
    return parsed if isinstance(parsed, str) else raw


def _bash_steps(command: str, *, succeeded: bool) -> list[Step]:
    steps: list[Step] = []
    if PLAN_PATH in command and succeeded:
        steps.append("plan_write" if _PLAN_WRITE_RE.search(command) else "plan_read")
    if any(name in command for name in _PREVIEW_MUTATIONS):
        steps.append("preview")
    if any(re.search(rf"\b{name}\b", command) for name in _SAVE_MUTATIONS):
        steps.append("save")
    return steps


def _executed_operations(output: Optional[str]) -> Optional[list[str]]:
    """The operations a browser script actually ran, from the tool's call log.

    ``None`` when the output carries no call log (an older trace, or a script that failed
    before any call); the caller then falls back to the operations named in the script.
    """
    if output is None or "Calls:" not in output:
        return None
    return [
        match.group(1) for match in _EXECUTED_CALL_RE.finditer(output) if match.group(2) == "ok"
    ]


def _browser_steps(script: str, output: Optional[str]) -> list[Step]:
    operations = _executed_operations(output)
    if operations is None:
        # A script names operations it may never reach (an early ``return`` after a failed
        # read, for instance), so this is only a fallback for traces without a call log.
        operations = [match.group(1) for match in _UI_OPERATION_CALL_RE.finditer(script)]
    steps: list[Step] = []
    for operation in operations:
        if operation in _EDIT_OPERATIONS:
            steps.append("edit")
        elif operation in _PREVIEW_OPERATIONS:
            steps.append("preview")
        elif operation in _SAVE_OPERATIONS:
            steps.append("save")
    return steps


def authoring_steps(root: v1.Span, spans: Sequence[v1.Span]) -> list[_Step]:
    """The turn's plan accesses and evaluator changes, in the order they started."""
    steps: list[_Step] = []
    for span in top_level_tool_spans(root, spans):
        tool_name = _tool_name(span)
        tool_input = _tool_input(span)
        if tool_name == "bash":
            command = tool_input.get("command")
            if isinstance(command, str):
                succeeded = span.get("status_code") != "ERROR"
                kinds = _bash_steps(command, succeeded=succeeded)
                steps.extend(_Step(kind, tool_name) for kind in kinds)
        elif tool_name == "execute_browser_action":
            script = tool_input.get("script")
            if isinstance(script, str):
                kinds = _browser_steps(script, _tool_output_text(span))
                steps.extend(_Step(kind, tool_name) for kind in kinds)
    return steps


def _classify(steps: Sequence[_Step]) -> Optional[tuple[str, str]]:
    kinds = [step.kind for step in steps]
    changes = [index for index, kind in enumerate(kinds) if kind in ("edit", "preview", "save")]
    if not changes:
        return None
    first_change = changes[0]
    if not any(kind in ("plan_read", "plan_write") for kind in kinds[:first_change]):
        return "unplanned", "changed an evaluator before writing or reading its plan"
    saves = [index for index, kind in enumerate(kinds) if kind == "save"]
    if not saves:
        return "planned", "consulted the plan before changing the evaluator; nothing saved"
    last_save = saves[-1]
    previews = [index for index, kind in enumerate(kinds[:last_save]) if kind == "preview"]
    if not previews:
        return "planned_not_validated", "saved without a preview in this turn"
    if "plan_write" not in kinds[previews[-1] : last_save]:
        return (
            "planned_not_validated",
            "saved without recording the last preview's results in the plan",
        )
    return (
        "planned_and_validated",
        "planned first, previewed, and recorded results in the plan before saving",
    )


async def evaluate_evaluator_authoring_process(
    root: v1.Span, spans: Sequence[v1.Span]
) -> Optional[Score]:
    steps = authoring_steps(root, spans)
    classified = _classify(steps)
    if classified is None:
        return None
    label, explanation = classified
    return Score(
        name=ANNOTATION_NAME,
        score=SCORES[label],
        label=label,
        explanation=explanation,
        metadata={"steps": [f"{step.kind}:{step.tool_name}" for step in steps]},
        kind="code",
    )


EVALUATOR_AUTHORING_PROCESS = EvaluatorSpec(
    name=ANNOTATION_NAME,
    selector=PXI_TURN_ROOT_SELECTOR,
    evaluate=evaluate_evaluator_authoring_process,
    annotator_kind="CODE",
    sample_rate=1.0,
    identifier="pxi-online-evals:evaluator-authoring-process:v1",
)
