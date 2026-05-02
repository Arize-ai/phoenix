"""Matplotlib helpers for the Stage 2 analysis notebook.

Keeps the notebook itself short. Conventions baked in here:

- One color per router type, stable across plots in the report.
- Percentages on the y-axis where applicable.
- Bar labels enabled by default (small values are otherwise illegible at
  the report's typical aspect ratio).
- Style is self-contained — no global rcParams mutation.
"""

from __future__ import annotations

from collections.abc import Iterable
from typing import Any

import matplotlib.pyplot as plt
import pandas as pd
from matplotlib.ticker import FuncFormatter

# Stable palette. First 10 entries cover the predecessor's router taxonomy;
# we rotate through the rest if newer router types show up (EVAL_HUB,
# EVAL_DETAIL, etc).
_BASE_PALETTE = [
    "#1f77b4",  # blue
    "#ff7f0e",  # orange
    "#2ca02c",  # green
    "#d62728",  # red
    "#9467bd",  # purple
    "#8c564b",  # brown
    "#e377c2",  # pink
    "#7f7f7f",  # gray
    "#bcbd22",  # olive
    "#17becf",  # cyan
    "#aec7e8",  # light blue
    "#ffbb78",  # light orange
]


def palette(names: Iterable[str]) -> dict[str, str]:
    """Map a stable color to each name.

    Sorted by name so the same palette comes back regardless of input
    order — important for keeping the same color on the same router type
    across multiple plots in the report.
    """
    sorted_names = sorted(set(names))
    return {n: _BASE_PALETTE[i % len(_BASE_PALETTE)] for i, n in enumerate(sorted_names)}


def setup(figsize: tuple[float, float] = (8.0, 4.5)) -> tuple[Any, Any]:
    """Create a figure + axes with project defaults applied locally."""
    fig, ax = plt.subplots(figsize=figsize, dpi=110)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.grid(axis="y", alpha=0.25, linestyle="--", linewidth=0.6)
    return fig, ax


def bar_counts(
    series: pd.Series[Any],
    title: str | None = None,
    ylabel: str = "Count",
    color_map: dict[str, str] | None = None,
    rotate_xticks: int = 30,
    annotate: bool = True,
) -> tuple[Any, Any]:
    """Plot a categorical count Series as a bar chart with labels."""
    fig, ax = setup()
    colors = (
        [color_map[k] for k in series.index]
        if color_map is not None
        else _BASE_PALETTE[: len(series)]
    )
    ax.bar(series.index.astype(str), series.values, color=colors)
    if annotate:
        for x, y in zip(range(len(series)), series.values):
            ax.text(x, y, f"{int(y):,}", ha="center", va="bottom", fontsize=8)
    ax.set_ylabel(ylabel)
    if title:
        ax.set_title(title)
    plt.setp(ax.get_xticklabels(), rotation=rotate_xticks, ha="right")
    fig.tight_layout()
    return fig, ax


def stacked_share(
    df: pd.DataFrame,
    title: str | None = None,
    ylabel: str = "Share",
    color_map: dict[str, str] | None = None,
) -> tuple[Any, Any]:
    """Plot a wide DataFrame (rows = x, cols = stacks) as a 100% stacked bar.

    Each row is normalized to 1.0 so the chart shows share within the row.
    """
    fig, ax = setup()
    shares = df.div(df.sum(axis=1), axis=0).fillna(0.0)
    bottom = pd.Series(0.0, index=shares.index)
    for col in shares.columns:
        color = (color_map or {}).get(col)
        ax.bar(
            shares.index.astype(str),
            shares[col].values,
            bottom=bottom.values,
            label=str(col),
            color=color,
        )
        bottom = bottom + shares[col]
    ax.set_ylim(0, 1)
    ax.set_ylabel(ylabel)
    ax.yaxis.set_major_formatter(FuncFormatter(lambda v, _: f"{v:.0%}"))
    if title:
        ax.set_title(title)
    ax.legend(loc="center left", bbox_to_anchor=(1.02, 0.5), frameon=False)
    fig.tight_layout()
    return fig, ax


def hist_with_pct(
    values: pd.Series[Any],
    bins: int | list[float] = 30,
    title: str | None = None,
    xlabel: str = "",
    ylabel: str = "Frequency",
    log_x: bool = False,
) -> tuple[Any, Any]:
    """Histogram with the median annotated."""
    fig, ax = setup()
    ax.hist(values.dropna().values, bins=bins, color=_BASE_PALETTE[0], alpha=0.85)
    median = float(values.dropna().median())
    ax.axvline(median, color="black", linestyle=":", linewidth=1.0)
    ax.text(median, ax.get_ylim()[1] * 0.95, f" median={median:,.1f}", fontsize=8)
    if log_x:
        ax.set_xscale("log")
    ax.set_xlabel(xlabel)
    ax.set_ylabel(ylabel)
    if title:
        ax.set_title(title)
    fig.tight_layout()
    return fig, ax
