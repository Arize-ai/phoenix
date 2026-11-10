"""Grade the grounding scores on production traces.

`reward` is 1 when some annotation name covers all 11 bot responses in
`mobile-review-queue`, on the LLM span, another span of the trace, or the trace itself,
with a label or score on each and at most 4 distinct labels. How well the labels match the
planted defects is a diagnostic, because an LLM judge's labels vary between runs.

The other keys are auxiliary and never change the reward.
"""

from __future__ import annotations

import json
from pathlib import Path
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

TRUTH = json.loads((Path(__file__).parent / "grounding_truth.json").read_text())
MAX_LABELS = 4


def main() -> None:
    scores: dict[str, float] = {
        "outcome_all_responses_scored": 0.0,
        "outcome_labels_usable": 0.0,
        "practice_explanations": 0.0,
        "practice_llm_kind_recorded": 0.0,
        "diag_hidden_agreement": 0.0,
        "diag_builtin_used": 0.0,
    }
    spans = project_spans(TRUTH["project"])
    trace_ids = {s["context"]["trace_id"] for s in spans}
    annotations = trace_level_annotations(TRUTH["project"], spans)
    truth = {t: False for t in TRUTH["ungrounded_traces"]} | {
        t: True for t in TRUTH["grounded_traces"]
    }
    candidates: list[tuple[float, str, dict[str, Any]]] = []
    for name in sorted({a.name for a in annotations}):
        chosen = per_trace(annotations, name)
        if set(chosen) != trace_ids:
            continue
        labels = {a.label for a in chosen.values() if a.label is not None}
        ordered = sorted(truth)
        evaluations = [
            Evaluation(name, a.annotator_kind, a.label, a.score, a.explanation, None)
            for a in (chosen[t] for t in ordered)
        ]
        fit = agreement(as_binary(evaluations), [truth[t] for t in ordered])
        candidates.append((fit, name, {"labels": sorted(labels), "chosen": chosen}))
    if candidates:
        fit, name, info = max(candidates)
        chosen = info["chosen"]
        scores["outcome_all_responses_scored"] = 1.0
        scores["outcome_labels_usable"] = float(len(info["labels"]) <= MAX_LABELS)
        explained = sum(bool(a.explanation) for a in chosen.values())
        scores["practice_explanations"] = float(explained / len(chosen) >= 0.9)
        scores["practice_llm_kind_recorded"] = float(
            all(a.annotator_kind.upper() == "LLM" for a in chosen.values())
        )
        scores["diag_hidden_agreement"] = fit
        scores["diag_builtin_used"] = float(bool(builtin_match(name, set(info["labels"]))))
    details = {
        "names": sorted({a.name for a in annotations}),
        "candidates": [(f, n, i["labels"]) for f, n, i in candidates],
    }
    reward = float(
        scores["outcome_all_responses_scored"] == 1.0 and scores["outcome_labels_usable"] == 1.0
    )
    write_reward(reward, details, **scores)


if __name__ == "__main__":
    main()
