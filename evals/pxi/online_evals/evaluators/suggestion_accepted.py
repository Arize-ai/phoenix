"""Online `suggestion_accepted` evaluator: did the user accept this suggestion?

PXI proposes some changes behind an approval gate: the tool stages an edit,
the UI renders an accept/reject card, and the user's click is recorded in
that TOOL span's ``output.value``. This evaluator turns those recorded
decisions into a deterministic CODE annotation on the TOOL span itself.

It annotates **only manual user decisions**. Automatic accepts (edit
permission set to bypass), still-pending approvals, approvals cancelled by
navigation, errored tools, and malformed output are not evidence of what a
user wanted, so they receive no annotation at all rather than a guessed one.

Targeting the TOOL span rather than the turn root is deliberate: one turn can
contain several suggestions that the user decides differently, and a
turn-level annotation would collapse them into a single label.
"""

from __future__ import annotations

import json
from collections.abc import Mapping, Sequence
from typing import Any

from evals.pxi.online_evals.models import EvaluatorSpec, SpanSelector
from phoenix.client.__generated__ import v1
from phoenix.evals.evaluators import Score

ANNOTATION_NAME = "suggestion_accepted"

APPROVAL_GATED_TOOLS: tuple[str, ...] = (
    "batch_span_annotate",
    "create_annotation_config",
    "edit_code_evaluator_draft",
    "edit_llm_evaluator_draft",
    "edit_prompt_instance",
    "load_dataset",
    "patch_experiment",
    "remove_prompt_instance",
    "save_prompt",
    "update_annotation_config",
    "write_prompt_tools",
)
"""Frontend tools whose pending-action implementation records BOTH outcomes.

This list is a cross-language maintenance contract: when a new approval-gated
tool is added on the frontend, add it here too or its decisions go unmeasured.
The frontend counterparts live in:

- ``app/src/agent/shared/pendingApproval/bindPendingApproval.ts`` (generic
  accept/reject core, used by the annotation-config tools)
- ``app/src/agent/tools/batchSpanAnnotate/pendingBatchSpanAnnotate.ts``
- ``app/src/agent/tools/codeEvaluatorDraft/pendingCodeEvaluatorEdit.ts``
- ``app/src/agent/tools/llmEvaluatorDraft/pendingLlmEvaluatorEdit.ts``
- ``app/src/agent/tools/patchExperiment/pendingPatchExperiment.ts``
- ``app/src/agent/tools/playgroundLoadDataset/pendingLoadDataset.ts``
- ``app/src/agent/tools/playgroundPrompt/pendingPromptEdit.ts``
- ``app/src/agent/tools/playgroundPrompt/pendingPromptInstanceRemoval.ts``
- ``app/src/agent/tools/playgroundPromptTools/pendingPromptToolWrite.ts``
- ``app/src/agent/tools/playgroundSavePrompt/pendingSavePrompt.ts``

Deliberately excluded: read-only, test, and navigation tools have nothing to
approve, and ``submit_code_evaluator_draft`` / ``submit_llm_evaluator_draft``
record only ``awaiting_user`` — their real decision happens in a dialog whose
outcome is not written back to the tool span.
"""

REJECTED_STATUS = "rejected"
USER_APPROVAL_SOURCE = "user"
MAX_OUTPUT_DECODE_LAYERS = 2
"""Real outputs are occasionally double-encoded (a JSON string inside JSON)."""


def _tool_name(span: v1.Span) -> str:
    value: Any = span.get("attributes", {}).get("tool.name")
    return value if isinstance(value, str) and value else span["name"]


def _decoded_output(span: v1.Span) -> Mapping[str, Any] | None:
    """Decode ``output.value`` into a mapping, or ``None`` if it is not one.

    Arrays, scalars, null, empty strings, and malformed JSON are all
    not-applicable rather than errors: the point is to classify recorded
    decisions, and anything that is not a decision object has none to read.
    """
    value: Any = span.get("attributes", {}).get("output.value")
    for _ in range(MAX_OUTPUT_DECODE_LAYERS):
        if isinstance(value, Mapping):
            return value
        if not isinstance(value, str) or not value.strip():
            return None
        try:
            value = json.loads(value)
        except (ValueError, TypeError):
            return None
    return value if isinstance(value, Mapping) else None


def _decision(output: Mapping[str, Any]) -> tuple[str, float] | None:
    """Map a recorded approval outcome to ``(label, score)``, or ``None``.

    Rejection is checked first: a reject callback writes ``status="rejected"``
    and never sets ``acceptedBy``, so a payload carrying both is contradictory
    and the explicit terminal rejection is the safer reading.

    Acceptance keys off ``acceptedBy == "user"`` rather than the status string
    because the accept vocabulary is tool-specific (``accepted``, ``saved``,
    ``loaded``, ``applied``, ``removed``), while ``acceptedBy`` is the one
    field that distinguishes a human click from an automatic bypass.
    """
    if output.get("status") == REJECTED_STATUS:
        return "rejected", 0.0
    if output.get("acceptedBy") == USER_APPROVAL_SOURCE:
        return "accepted", 1.0
    return None


async def evaluate_suggestion_accepted(target: v1.Span, _spans: Sequence[v1.Span]) -> Score | None:
    tool_name = _tool_name(target)
    if tool_name not in APPROVAL_GATED_TOOLS:
        return None
    output = _decoded_output(target)
    if output is None:
        return None
    decision = _decision(output)
    if decision is None:
        return None
    label, score = decision
    return Score(
        name=ANNOTATION_NAME,
        score=score,
        label=label,
        explanation=f"user {label} the {tool_name} suggestion",
        # Only the low-cardinality tool name: never prompt text, tool
        # arguments, raw output, user content, instance ids, or diffs.
        metadata={"tool_name": tool_name},
        kind="code",
    )


SUGGESTION_ACCEPTED = EvaluatorSpec(
    name=ANNOTATION_NAME,
    selector=SpanSelector(names=APPROVAL_GATED_TOOLS, span_kinds=("TOOL",)),
    evaluate=evaluate_suggestion_accepted,
    annotator_kind="CODE",
    sample_rate=1.0,
    identifier="pxi-online-evals:suggestion-accepted:v1",
)
