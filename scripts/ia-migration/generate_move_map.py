#!/usr/bin/env python3
"""Generate the Phoenix docs IA migration move-map.

Enumerates every .mdx in the sections that change IA (tracing, evaluation,
datasets-and-experiments, prompt-engineering, plus loose platform pages) and
computes its new verb-spine path (instrument / observe / evaluate / improve /
concepts). Files under get-started, settings, integrations, sdk-api-reference,
release-notes, resources, cookbook, use-cases, documentation are NOT moved
(tab-rename only) and are excluded here.

Output: move-map.json  (list of {"old": <repo-rel path, no .mdx>, "new": ...})
        plus a human-readable summary to stdout.

Nothing is moved by this script -- it only computes and validates the map.
"""
import json
import pathlib
import sys
from collections import defaultdict

DOCS_ROOT = pathlib.Path(__file__).resolve().parents[2] / "docs" / "phoenix"
OUT = pathlib.Path(__file__).resolve().parent / "move-map.json"

# Sections whose files are candidates for moving (relative to docs/phoenix).
MOVING_DIRS = ("tracing", "evaluation", "datasets-and-experiments", "prompt-engineering")
# Loose top-level pages that move into Concepts > Platform.
LOOSE = {
    "user-guide": "concepts/platform/user-guide",
    "production-guide": "concepts/platform/production-guide",
    "environments": "concepts/platform/environments",
}

# Exact old->new overrides (landing pages + renames). Keys/values are repo-rel,
# no docs/phoenix/ prefix, no .mdx.
OVERRIDES = {
    # --- Instrument (tracing setup + enrichment) ---
    "tracing/how-to-tracing": "instrument",
    "tracing/how-to-tracing/setup-tracing": "instrument/set-up-tracing",
    "tracing/how-to-tracing/setup-tracing/instrument": "instrument/auto-instrumentation",
    "tracing/how-to-tracing/add-metadata": "instrument/add-metadata",
    "tracing/how-to-tracing/advanced": "instrument/advanced",
    "tracing/how-to-tracing/cost-tracking": "instrument/track-costs",
    "tracing/features-tracing": "instrument/features",
    # --- Observe (view / annotate / import-export traces) ---
    "tracing/llm-traces": "observe/view-and-manage-traces",
    "tracing/how-to-tracing/feedback-and-annotations": "observe/annotations",
    "tracing/how-to-tracing/importing-and-exporting-traces": "observe/import-and-export-traces",
    # --- Evaluate ---
    "evaluation/evals": "evaluate",
    "evaluation/how-to-evals": "evaluate/client-side-evals",
    "evaluation/llm-evals": "evaluate/llm-evals",
    # eval-flavored pages currently mis-filed under tracing>annotations
    "tracing/how-to-tracing/feedback-and-annotations/evaluating-phoenix-traces": "evaluate/evaluating-phoenix-traces",
    "tracing/how-to-tracing/feedback-and-annotations/llm-evaluations": "evaluate/llm-evaluations",
    # --- Guides tab: doc tutorials (landings) ---
    "tracing/tutorial": "guides/tracing",
    "prompt-engineering/tutorial": "guides/prompts",
    # --- Improve (datasets / experiments / prompts) ---
    "datasets-and-experiments/overview-datasets": "improve/datasets/overview",
    "datasets-and-experiments/quickstart-datasets": "improve/datasets/quickstart",
    "datasets-and-experiments/how-to-datasets": "improve/datasets",
    "datasets-and-experiments/how-to-experiments": "improve/experiments",
    "prompt-engineering/overview-prompts": "improve/prompts",
    "prompt-engineering/how-to-prompts": "improve/prompts/how-to",
    # --- Concepts ---
    "evaluation/concepts-evals": "concepts/evaluators",
    "prompt-engineering/concepts-prompts": "concepts/prompts",
    "datasets-and-experiments/concepts-datasets": "concepts/datasets-and-experiments",
}

# Ordered prefix rules (first match wins). Applied only if no exact override.
PREFIX_RULES = [
    ("tracing/how-to-tracing/setup-tracing/", "instrument/"),
    ("tracing/how-to-tracing/add-metadata/", "instrument/"),
    ("tracing/how-to-tracing/advanced/", "instrument/advanced/"),
    ("tracing/how-to-tracing/feedback-and-annotations/", "observe/"),
    ("tracing/how-to-tracing/importing-and-exporting-traces/", "observe/"),
    ("tracing/tutorial/", "guides/tracing/"),
    ("tracing/llm-traces/", "observe/"),
    ("tracing/concepts-tracing/otel-openinference/", "concepts/otel-openinference/"),
    ("tracing/concepts-tracing/", "concepts/tracing/"),
    ("evaluation/concepts-evals/", "concepts/evaluators/"),
    ("evaluation/how-to-evals/", "evaluate/"),
    ("evaluation/pre-built-metrics/", "evaluate/pre-built-metrics/"),
    ("evaluation/server-evals/", "evaluate/server-evals/"),
    ("evaluation/integrations/", "evaluate/integrations/"),
    ("evaluation/llm-evals/", "evaluate/llm-evals/"),
    ("evaluation/tutorials/", "guides/evaluation/"),
    ("evaluation/", "evaluate/"),  # python-quickstart, typescript-quickstart
    ("datasets-and-experiments/how-to-datasets/", "improve/datasets/"),
    ("datasets-and-experiments/how-to-experiments/", "improve/experiments/"),
    ("datasets-and-experiments/tutorial/", "guides/datasets-and-experiments/"),
    ("prompt-engineering/concepts-prompts/", "concepts/prompts/"),
    ("prompt-engineering/overview-prompts/", "improve/prompts/"),
    ("prompt-engineering/how-to-prompts/", "improve/prompts/"),
    ("prompt-engineering/tutorial/", "guides/prompts/"),
]


def compute_new(rel: str) -> str | None:
    """rel is repo-rel path without docs/phoenix/ prefix and without .mdx."""
    if rel in OVERRIDES:
        return OVERRIDES[rel]
    if rel in LOOSE:
        return LOOSE[rel]
    for src, dst in PREFIX_RULES:
        if rel.startswith(src):
            return dst + rel[len(src):]
    return None


def main() -> int:
    moves = []
    unmatched = []
    for p in sorted(DOCS_ROOT.rglob("*.mdx")):
        rel = p.relative_to(DOCS_ROOT).with_suffix("").as_posix()
        top = rel.split("/", 1)[0]
        is_loose = rel in LOOSE
        if top not in MOVING_DIRS and not is_loose:
            continue
        new = compute_new(rel)
        if new is None:
            unmatched.append(rel)
            continue
        if new != rel:
            moves.append({"old": rel, "new": new})

    # Validate: no two olds map to the same new (would clobber on git mv).
    by_new = defaultdict(list)
    for m in moves:
        by_new[m["new"]].append(m["old"])
    collisions = {k: v for k, v in by_new.items() if len(v) > 1}
    # Validate: no new path collides with a file that is NOT being moved.
    moved_olds = {m["old"] for m in moves}
    existing = {
        p.relative_to(DOCS_ROOT).with_suffix("").as_posix()
        for p in DOCS_ROOT.rglob("*.mdx")
    }
    new_set = {m["new"] for m in moves}
    clobber_existing = sorted(n for n in new_set if n in existing and n not in moved_olds)

    OUT.write_text(json.dumps(moves, indent=2) + "\n")

    verbs = defaultdict(int)
    for m in moves:
        verbs[m["new"].split("/", 1)[0]] += 1

    print(f"move-map written: {OUT}")
    print(f"total moves: {len(moves)}")
    print("by destination top-level:")
    for k in sorted(verbs):
        print(f"  {k:12} {verbs[k]}")
    print(f"\nUNMATCHED (in a moving section but no rule -> FIX before running): {len(unmatched)}")
    for u in unmatched:
        print(f"  ! {u}")
    print(f"\nCOLLISIONS (many old -> one new -> FIX): {len(collisions)}")
    for k, v in collisions.items():
        print(f"  ! {k}  <=  {v}")
    print(f"\nNEW PATH CLOBBERS AN UNMOVED FILE -> FIX: {len(clobber_existing)}")
    for c in clobber_existing:
        print(f"  ! {c}")

    return 1 if (unmatched or collisions or clobber_existing) else 0


if __name__ == "__main__":
    sys.exit(main())
