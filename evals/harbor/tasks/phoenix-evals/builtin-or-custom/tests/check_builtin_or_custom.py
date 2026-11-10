"""Grade the two per-response dimensions on production traces.

`reward` is 1 when two different annotation names each cover all 11 bot responses in
`mobile-review-queue`, and one of them matches the dollar-amount truth on every trace, in
either polarity. The truth is computable: the response states a dollar amount and the trace
has no tool span that returned it. Whether the frustration dimension used the built-in
evaluator is a diagnostic.

The other keys are auxiliary and never change the reward.
"""

from __future__ import annotations

import re
from typing import Any

from harbor_verifiers.evals_state import (
    Evaluation,
    agreement,
    as_binary,
    builtin_match,
    per_trace,
    trace_level_annotations,
)
from harbor_verifiers.phoenix_api import project_spans
from harbor_verifiers.verify import write_reward

PROJECT = "mobile-review-queue"
_DOLLARS = re.compile(r"\$\s?\d[\d,]*(\.\d+)?")


def unsupported_amount(trace_spans: list[dict[str, Any]]) -> bool:
    llm = [s for s in trace_spans if str(s.get("span_kind", "")).upper() == "LLM"]
    tools = [s for s in trace_spans if str(s.get("span_kind", "")).upper() == "TOOL"]
    tool_text = " ".join(str((s.get("attributes") or {}).get("output.value", "")) for s in tools)
    for span in llm:
        output = str((span.get("attributes") or {}).get("output.value", ""))
        if any(m.group(0) not in tool_text for m in _DOLLARS.finditer(output)):
            return True
    return False


def main() -> None:
    scores: dict[str, float] = {
        "outcome_two_dimensions": 0.0,
        "outcome_amount_check_correct": 0.0,
        "practice_amount_check_is_code": 0.0,
        "diag_builtin_used": 0.0,
    }
    spans = [dict(s) for s in project_spans(PROJECT)]
    by_trace: dict[str, list[dict[str, Any]]] = {}
    for span in spans:
        by_trace.setdefault(span["context"]["trace_id"], []).append(span)
    truth = {t: unsupported_amount(members) for t, members in by_trace.items()}
    annotations = trace_level_annotations(PROJECT, spans)
    complete = {}
    for name in sorted({a.name for a in annotations}):
        chosen = per_trace(annotations, name)
        if set(chosen) == set(by_trace):
            complete[name] = chosen
    scores["outcome_two_dimensions"] = float(len(complete) >= 2)
    ordered = sorted(truth)
    fits = {}
    for name, chosen in complete.items():
        evaluations = [
            Evaluation(name, chosen[t].annotator_kind, chosen[t].label, chosen[t].score, None, None)
            for t in ordered
        ]
        fits[name] = agreement(as_binary(evaluations), [truth[t] for t in ordered])
    amount = [name for name, fit in fits.items() if fit == 1.0]
    scores["outcome_amount_check_correct"] = float(bool(amount))
    scores["practice_amount_check_is_code"] = float(
        any(all(a.annotator_kind.upper() == "CODE" for a in complete[n].values()) for n in amount)
    )
    others = [n for n in complete if n not in amount]
    scores["diag_builtin_used"] = float(
        any(
            builtin_match(n, {a.label for a in complete[n].values() if a.label}) == "user_friction"
            for n in others
        )
    )
    details = {"complete_names": sorted(complete), "fits": fits, "truth": truth}
    reward = float(
        scores["outcome_two_dimensions"] == 1.0
        and scores["outcome_amount_check_correct"] == 1.0
        and bool(others)
    )
    write_reward(reward, details, **scores)


if __name__ == "__main__":
    main()
