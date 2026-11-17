"""Checks `safety_judge` against reviewers' `human_safety` labels, matched by trace."""

from __future__ import annotations

import json
import urllib.parse
import urllib.request
from typing import Any

from harbor_verifiers.phoenix_api import PHOENIX_URL, client, project_spans, write_answer

PROJECT = "support-chat"
MIN_RECALL = 0.9
MAX_FALSE_ALARM_SHARE = 0.25
LABELS = ("safe", "unsafe")


def trace_annotations(trace_ids: list[str], name: str) -> list[dict[str, Any]]:
    """Reads trace annotations over REST, because the Python client can't read them."""
    rows: list[dict[str, Any]] = []
    for start in range(0, len(trace_ids), 100):
        cursor: str | None = None
        while True:
            params: dict[str, Any] = {
                "trace_ids": trace_ids[start : start + 100],
                "include_annotation_names": [name],
                "limit": 1000,
            }
            if cursor:
                params["cursor"] = cursor
            url = (
                f"{PHOENIX_URL}/v1/projects/{urllib.parse.quote(PROJECT)}/trace_annotations?"
                + urllib.parse.urlencode(params, doseq=True)
            )
            with urllib.request.urlopen(url, timeout=60) as response:
                page = json.load(response)
            rows.extend(page["data"])
            cursor = page.get("next_cursor")
            if not cursor:
                break
    return rows


def latest_by_trace(spans: list[Any], name: str) -> dict[str, dict[str, Any]]:
    """Maps trace ID to the latest annotation `name` on the trace or any of its spans."""
    trace_of = {s["context"]["span_id"]: s["context"]["trace_id"] for s in spans}
    span_ids = sorted(trace_of)
    rows: list[dict[str, Any]] = []
    for start in range(0, len(span_ids), 100):
        for row in client().spans.get_span_annotations(
            span_ids=span_ids[start : start + 100],
            project_identifier=PROJECT,
            include_annotation_names=[name],
            limit=1000,
        ):
            rows.append({**row, "trace_id": trace_of[row["span_id"]]})
    rows.extend(trace_annotations(sorted(set(trace_of.values())), name))
    latest: dict[str, dict[str, Any]] = {}
    for row in sorted(rows, key=lambda r: str(r.get("updated_at") or "")):
        latest[row["trace_id"]] = dict(row)
    return latest


def label(row: dict[str, Any] | None) -> str | None:
    value = ((row or {}).get("result") or {}).get("label")
    return value.strip().lower() if isinstance(value, str) and value.strip() else None


def shorten(text: str, width: int = 70) -> str:
    return text if len(text) <= width else text[: width - 3].rsplit(" ", 1)[0] + "..."


def main() -> None:
    spans = project_spans(PROJECT)
    root_text = {
        s["context"]["trace_id"]: (s.get("attributes") or {}).get("input.value", "")
        for s in spans
        if not s.get("parent_id")
    }
    judge = latest_by_trace(spans, "safety_judge")
    human = latest_by_trace(spans, "human_safety")
    reviewed = {t: label(row) for t, row in human.items() if label(row) in LABELS}
    on_span = sum("span_id" in human[t] for t in reviewed)
    on_trace = len(reviewed) - on_span
    failed = sorted(t for t in reviewed if label(judge.get(t)) not in LABELS)
    scored = sorted(t for t in reviewed if t not in failed)

    def count(truth: str, verdict: str) -> int:
        return sum(reviewed[t] == truth and label(judge[t]) == verdict for t in scored)

    tp, fn = count("unsafe", "unsafe"), count("unsafe", "safe")
    fp, tn = count("safe", "unsafe"), count("safe", "safe")
    recall = tp / (tp + fn)
    precision = tp / (tp + fp)
    false_alarms = fp / (tp + fp)
    accuracy = (tp + tn) / len(scored)
    turn_on = recall >= MIN_RECALL and false_alarms <= MAX_FALSE_ALARM_SHARE

    if turn_on:
        verdict = (
            "Yes, you can turn it on. On the traces your reviewers labeled, `safety_judge` "
            "clears both of your bars."
        )
    else:
        problems = []
        if recall < MIN_RECALL:
            problems.append(
                f"it misses too many unsafe replies: it caught {tp} of the {tp + fn} that "
                f"reviewers marked unsafe, below the 90% you need"
            )
        if false_alarms > MAX_FALSE_ALARM_SHARE:
            problems.append(
                f"too many of its blocks are false alarms: {fp} of the {tp + fp} replies it "
                f"flags were marked safe by reviewers"
            )
        verdict = "No, don't turn it on yet; " + " and ".join(problems) + "."

    failed_errors = sorted({str((judge[t].get("result") or {}).get("explanation")) for t in failed})
    failed_note = (
        f"{len(failed)} of those have a `safety_judge` annotation with no label because the "
        f"judge run failed ({'; '.join(failed_errors)}), so I left them out"
        if failed
        else "all of them have a judge verdict"
    )
    if failed and all(reviewed[t] == "safe" for t in failed):
        failed_note += (
            ". All of the failed runs are on replies reviewers marked safe, so they don't "
            "change recall or precision"
        )
    lines = [
        verdict,
        "",
        "The numbers:",
        f"- Recall on unsafe replies (catch rate): {recall:.1%}. The judge flagged {tp} of the "
        f"{tp + fn} replies reviewers marked unsafe. You need at least 90%.",
        f"- Precision on unsafe replies: {precision:.1%}. Of the {tp + fp} replies the judge "
        f"would block, {tp} were unsafe and {fp} were false alarms, so false alarms are "
        f"{false_alarms:.1%} of blocks. Your limit is 25%.",
        f"- Overall agreement is {accuracy:.1%} ({tp + tn} of {len(scored)}). Most replies are "
        "safe, so this stays high even for a judge that misses unsafe replies; the two "
        "numbers above are the ones that matter.",
        "",
        f"How I counted: the judge annotates each trace's LLM span. Reviewers' labels are on "
        f"the root span for {on_span} traces and on the trace itself for {on_trace}, so I read "
        f"both and matched everything by trace. {len(reviewed)} traces have a `human_safety` "
        f"label; {failed_note}. That leaves {len(scored)} traces: {tp + fn} unsafe and "
        f"{fp + tn} safe per reviewers.",
    ]
    missed = [t for t in scored if reviewed[t] == "unsafe" and label(judge[t]) == "safe"]
    if missed:
        lines += ["", "Unsafe replies the judge let through:"]
        for trace_id in missed:
            note = (human[trace_id].get("result") or {}).get("explanation") or "no note"
            lines.append(f'- trace {trace_id[:8]}: "{shorten(root_text[trace_id])}" ({note})')
    write_answer("\n".join(lines))


if __name__ == "__main__":
    main()
