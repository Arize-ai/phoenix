"""Reference solution: write the reply, with the rate its own `grounded` annotations give."""

from __future__ import annotations

from typing import Any

from harbor_verifiers.phoenix_api import client, project_spans, write_answer

PROJECT = "support-bot"
ANNOTATION = "grounded"


def latest_labels(span_ids: list[str]) -> dict[str, str]:
    latest: dict[str, dict[str, Any]] = {}
    for start in range(0, len(span_ids), 100):
        rows = client().spans.get_span_annotations(
            span_ids=span_ids[start : start + 100],
            project_identifier=PROJECT,
            include_annotation_names=[ANNOTATION],
            limit=1000,
        )
        for row in rows:
            span_id, updated = row["span_id"], str(row.get("updated_at") or "")
            if span_id not in latest or updated >= str(latest[span_id].get("updated_at") or ""):
                latest[span_id] = dict(row)
    return {
        span_id: str((row.get("result") or {}).get("label") or "")
        for span_id, row in latest.items()
    }


def rate(labels: list[str]) -> tuple[int, int, float]:
    grounded = sum(label == "pass" for label in labels)
    return grounded, len(labels), grounded / len(labels) if labels else 0.0


def main() -> None:
    roots = [span for span in project_spans(PROJECT) if not span.get("parent_id")]
    labels = latest_labels([span["context"]["span_id"] for span in roots])
    timeouts = {span["context"]["span_id"] for span in roots if span["status_code"] == "ERROR"}
    grounded, scored, share = rate(list(labels.values()))
    calm, calm_scored, calm_share = rate([v for k, v in labels.items() if k not in timeouts])
    unscored = len(roots) - scored
    lines = [
        f"The real grounded rate is {share:.0%}: {grounded} of the {scored} replies in "
        f"`support-bot` are grounded, and {scored - grounded} make at least one claim that "
        "nothing the bot looked up supports. Leaving out the "
        f"{len(timeouts)} replies sent after a tracking timeout, it's {calm_share:.0%} "
        f"({calm} of {calm_scored}).",
        "",
        "Why the eval said 95%:",
        "",
        "1. `get_spans` had no `limit`, so it returned the client's default of 100 spans, "
        "newest first. That covers only the newest third of the traces, so most replies "
        "were never scored.",
        "2. The prompt asks for `PASS` or `FAIL`, but the code compared the verdict with "
        'lowercase `"fail"`. The comparison never matched, so every judged reply was '
        "recorded as pass.",
        "3. Any exception was recorded as pass. Email messages have `subject` and `body` "
        "instead of `message`, so every email raised a `KeyError` before the judge ran and "
        "counted as grounded.",
        "4. The judge saw only the customer's message and the reply, never the order record, "
        "tracking data, or help articles from the trace's tool and retriever spans, and it "
        'asked whether the reply "sounds reasonable and helpful". It had no way to catch a '
        "wrong date or an invented policy.",
        "5. Verdicts were computed oldest first but zipped with the root spans newest first, "
        "so each annotation landed on a different trace.",
        "",
        "The script also had a separate rule that marked every trace with an `ERROR` status "
        "`fail` without judging it. When `track_shipment` times out, the bot still answers "
        "from the order record: some of those replies say tracking couldn't load, and some "
        "state an estimate or scan the bot never got. The fixed script judges them like any "
        "other reply.",
        "",
        "The fixed script reads every span, gives the judge the tool results and articles, "
        "reads the verdict in any casing, and annotates the root span of the trace it judged. "
        "The script path, the `grounded` annotation name, and the `gpt-5-nano` judge are "
        "unchanged.",
    ]
    if unscored:
        lines.append(
            f"{unscored} replies couldn't be scored, so they have no annotation and the script "
            "exits with status 1; rerunning it scores them."
        )
    write_answer("\n".join(lines))


if __name__ == "__main__":
    main()
