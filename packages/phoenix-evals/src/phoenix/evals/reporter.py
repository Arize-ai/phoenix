"""Reporter utilities for AsyncExecutor.

Separated from executors.py to keep core execution logic free of
presentation/printing concerns.  StdoutReporter reproduces the original
ASCII timeline + tick-bar behaviour; other reporters (JSON, Rich, Null)
can subclass BaseReporter.
"""
from __future__ import annotations

import time
from typing import TYPE_CHECKING, List, Tuple

from tqdm.auto import tqdm

if TYPE_CHECKING:
    from .executors import ExecutionDetails

# ---------------------------------------------------------------------------
# ASCII helpers (moved verbatim from executors.py, minus comments)
# ---------------------------------------------------------------------------

def _ascii_timeline(details_list: List["ExecutionDetails"], *, width: int = 80, max_tasks: int | None = None) -> str:
    if max_tasks is None:
        max_tasks = len(details_list)

    all_timestamps = [ts for d in details_list for _, ts in d.events]
    if not all_timestamps:
        return ""

    t0, t1 = min(all_timestamps), max(all_timestamps)
    span = max(t1 - t0, 1e-6)
    scale = (width - 1) / span

    _priority = {
        "P": 1, "Q": 2, "S": 3, "*": 0, "W": 1, "T": 4, "B": 4,
        "R": 3, "E": 4, "F": 5, "C": 5, "X": 6,
    }

    lines: List[str] = []
    for task_id, details in enumerate(details_list[:max_tasks]):
        events = sorted(details.events, key=lambda e: e[1])
        if not events:
            continue
        canvas = [" "] * width
        for idx, (tag, ts) in enumerate(events):
            col = int((ts - t0) * scale)
            col = max(0, min(width - 1, col))
            if tag == "C" and canvas[col] == "S":
                canvas[col] = "F"
            elif _priority.get(tag, 0) >= _priority.get(canvas[col], 0):
                canvas[col] = tag
            if tag == "S" and idx + 1 < len(events):
                next_ts = events[idx + 1][1]
                end_col = int((next_ts - t0) * scale)
                for c in range(col + 1, min(end_col, width - 1)):
                    if canvas[c] == " ":
                        canvas[c] = "*"
            if tag == "W" and idx + 1 < len(events):
                next_ts = events[idx + 1][1]
                end_col = int((next_ts - t0) * scale)
                for c in range(col + 1, min(end_col, width - 1)):
                    if canvas[c] == " ":
                        canvas[c] = "W"
        lines.append(f"T-{task_id:<3} │ {''.join(canvas)}")
    return "\n".join(lines)


def _ascii_tickbar(details_list: List["ExecutionDetails"], *, width: int = 80, focus_tags: Tuple[str, ...] = ("S",)) -> str:
    timestamps = [ts for d in details_list for tag, ts in d.events if tag in focus_tags]
    if not timestamps:
        return ""
    all_timestamps = [ts for d in details_list for _, ts in d.events]
    t0, t1 = min(all_timestamps), max(all_timestamps)
    span = max(t1 - t0, 1e-6)
    n_bins = width - 1
    counts = [0] * n_bins
    for ts in timestamps:
        idx = int((ts - t0) * n_bins / span)
        idx = min(n_bins - 1, max(0, idx))
        counts[idx] += 1

    def glyph(c: int) -> str:
        if c == 0:
            return " "
        thresholds = (1, 2, 5, 10, 20, 50, 100)
        glyphs = ".::::|*#@"
        for i, threshold in enumerate(thresholds):
            if c < threshold:
                return glyphs[i]
        return glyphs[-1]  # Return the highest glyph for counts >= 100

    bar = "".join(glyph(c) for c in counts)
    return f"Ticks │ {bar}"

# ---------------------------------------------------------------------------
# Reporter interface
# ---------------------------------------------------------------------------

class BaseReporter:  # pylint: disable=too-few-public-methods
    """Abstract reporter – override methods to emit desired output."""

    def periodic(self, details: List["ExecutionDetails"]) -> None:  # noqa: D401 – simple verb
        pass

    def final(self, details: List["ExecutionDetails"]) -> None:
        pass
    
    def task_completed(self, task_index: int, attempt_no: int, runtime: float) -> None:
        """Called when an individual task completes successfully."""
        pass


class NullReporter(BaseReporter):
    """A reporter that suppresses all ASCII timeline visualization."""
    
    def periodic(self, details: List["ExecutionDetails"]) -> None:
        pass  # No output
    
    def final(self, details: List["ExecutionDetails"]) -> None:
        pass  # No output
    
    def task_completed(self, task_index: int, attempt_no: int, runtime: float) -> None:
        pass  # No output


class StdoutReporter(BaseReporter):
    def __init__(self, width: int = 80, max_tasks_snapshot: int = 60) -> None:
        self._width = width
        self._snapshot_cap = max_tasks_snapshot

    # periodic snapshot every few seconds
    def periodic(self, details: List["ExecutionDetails"]) -> None:
        timeline = _ascii_timeline(details, width=self._width, max_tasks=self._snapshot_cap)
        if timeline:
            tqdm.write("\n" + timeline + "\n")
            bar = _ascii_tickbar(details, width=self._width, focus_tags=("S",))
            if bar:
                tqdm.write(bar + "\n")

    # final summary at the very end (no attempt history)
    def final(self, details: List["ExecutionDetails"]) -> None:
        timeline = _ascii_timeline(details, width=self._width, max_tasks=len(details))
        if timeline:
            tqdm.write("\n📊 Timeline Legend: P=Queued, Q=Dequeued, S=Started, *=Executing, T=Timeout, B=Backoff-timeout, W=Waiting, R=Re-queued, E=Error, F=Fast, C=Completed, X=Failed")
            tqdm.write("\n" + timeline + "\n")
            bar = _ascii_tickbar(details, width=self._width, focus_tags=("S",))
            if bar:
                tqdm.write(bar + "\n")
    
    def task_completed(self, task_index: int, attempt_no: int, runtime: float) -> None:
        """Print individual task completion message."""
        tqdm.write(f"✅ Task {task_index}-a{attempt_no}: Completed in {runtime:.2f}s")