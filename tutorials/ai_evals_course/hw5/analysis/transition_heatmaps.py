#!/usr/bin/env python3
"""HW5 Failure Transition Heatmap Generator (Student-facing)

Reads `labeled_traces.json`, tallies transitions (last_success_state →
first_failure_state), and renders a heat-map PNG.

Usage
-----
$ python analysis/transition_heatmaps.py  # from homeworks/hw5/

Outputs
-------
results/failure_transition_heatmap.png
"""

from __future__ import annotations

from pathlib import Path
from typing import Dict, List

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns

import phoenix as px
from phoenix.trace.dsl import SpanQuery

# -----------------------------------------------------------------------------
# Configuration – keep in sync with generation/generate_traces.py
# -----------------------------------------------------------------------------

PIPELINE_STATES: List[str] = [
    "ParseRequest",
    "PlanToolCalls",
    "GenCustomerArgs",
    "GetCustomerProfile",
    "GenRecipeArgs",
    "GetRecipes",
    "GenWebArgs",
    "GetWebInfo",
    "ComposeResponse",
    "DeliverResponse",
]
STATE_INDEX: Dict[str, int] = {s: i for i, s in enumerate(PIPELINE_STATES)}

# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------

ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = ROOT / "results"
OUTPUT_PNG = OUTPUT_DIR / "failure_transition_heatmap.png"


def load_labeled_traces() -> pd.DataFrame:
    query = SpanQuery().where("span_kind == 'AGENT'")
    traces_df = px.Client().query_spans(query, project_name="recipe-agent-hw5")
    return traces_df


def build_transition_matrix(traces: pd.DataFrame) -> np.ndarray:
    n = len(PIPELINE_STATES)
    m = np.zeros((n, n), dtype=int)

    for _, trace in traces.iterrows():
        frm = trace["attributes.last_success_state"]
        to = trace["attributes.first_failure_state"]
        if frm not in STATE_INDEX or to not in STATE_INDEX:
            continue  # skip malformed
        m[STATE_INDEX[frm], STATE_INDEX[to]] += 1
    return m


def plot_heatmap(matrix: np.ndarray):
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    plt.figure(figsize=(10, 8))
    sns.heatmap(
        matrix,
        annot=True,
        fmt="d",
        cmap="Reds",
        xticklabels=PIPELINE_STATES,
        yticklabels=PIPELINE_STATES,
        cbar_kws={"label": "Failure Count"},
        square=True,
    )
    plt.title("Failure Transition Heatmap", fontsize=14)
    plt.xlabel("First Failure State →")
    plt.ylabel("Last Success State ↓")
    plt.xticks(rotation=45, ha="right")
    plt.tight_layout()
    plt.savefig(OUTPUT_PNG, dpi=300)
    plt.close()
    print(f"Saved heatmap to {OUTPUT_PNG.relative_to(ROOT)}")


# -----------------------------------------------------------------------------
# CLI
# -----------------------------------------------------------------------------


def main() -> None:
    traces = load_labeled_traces()
    matrix = build_transition_matrix(traces)

    total = int(matrix.sum())
    print(f"Loaded {len(traces)} traces – total recorded failures: {total}\n")

    plot_heatmap(matrix)

    # Simple textual summary
    if total:
        max_val = matrix.max()
        idx = np.argwhere(matrix == max_val)
        for i, j in idx:
            from_state = PIPELINE_STATES[i]
            to_state = PIPELINE_STATES[j]
            print(f"Most common: {from_state} → {to_state}  ({max_val} failures)")


if __name__ == "__main__":
    main()
