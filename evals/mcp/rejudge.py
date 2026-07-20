"""Re-grade a saved session's answers against freshly computed ground truth.

When a reference turns out to be wrong, the agents' answers are still valid
evidence — only the grading was broken. Re-running the whole grid to fix a
grader bug would burn the budget and, worse, would swap in a different sample of
stochastic agent behaviour, making the numbers incomparable to the run being
corrected. This re-judges the stored answers in place instead.

    uv run python -m evals.mcp.rejudge evals/mcp/results/session-<arm>-<stamp>.json

Also reads legacy pre-pytest ``runs-*.jsonl`` files, writing the same format
back out.
"""

# ruff: noqa: I001 -- repository import formatter and lint resolver disagree on local `evals`.

from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path
from typing import Optional, Sequence

from evals.mcp.harness.environment import (
    DEFAULT_BASE_URL,
    DEFAULT_MODEL,
    load_dotenv,
    resolve_api_key,
)
from evals.mcp.harness.ground_truth import compute_ground_truth
from evals.mcp.harness.judge import judge_answer
from evals.mcp.harness.sessions import load_session, write_session
from evals.mcp.questions import QUESTIONS_BY_ID


async def _rejudge(path: Path, base_url: str, model: str) -> Path:
    session = load_session(path)
    api_key = resolve_api_key()

    print("Recomputing ground truth...", flush=True)
    ground_truth = await compute_ground_truth(base_url, api_key)

    for run in session.runs:
        question = QUESTIONS_BY_ID.get(run["question_id"])
        if question is None:
            print(f"  skipping unknown question {run['question_id']}", flush=True)
            continue
        reference = ground_truth.get(question.reference) if question.reference else None

        judgement = await judge_answer(
            model=model,
            arm=run["arm"],
            question_id=run["question_id"],
            repeat=run.get("repeat", 0),
            prompt=question.prompt,
            rubric=question.rubric,
            answer=run.get("answer", ""),
            reference=reference,
        )
        was, now = run.get("correct"), judgement.correct
        run["correct"] = judgement.correct
        run["score"] = judgement.score
        run["judge_explanation"] = judgement.explanation
        flag = "  <-- CHANGED" if was != now else ""
        print(f"  {run['arm']:<12} {run['question_id']:<28} {was} -> {now}{flag}", flush=True)

    out = path.with_name(f"{path.stem}-rejudged{path.suffix}")
    if session.meta is None:
        # Legacy row dump: preserve the format so the legacy loaders still apply.
        with out.open("w") as handle:
            for run in session.runs:
                handle.write(json.dumps(run) + "\n")
    else:
        meta = {**session.meta, "ground_truth": ground_truth, "rejudged_with": model}
        write_session(out, meta=meta, runs=session.runs)
    return out


def main(argv: Optional[Sequence[str]] = None) -> int:
    load_dotenv()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("session", type=Path, help="A session-*.json (or legacy runs-*.jsonl).")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL)
    parser.add_argument("--model", default=DEFAULT_MODEL)
    args = parser.parse_args(argv)

    out = asyncio.run(_rejudge(args.session, args.base_url, args.model))
    print(f"\nRe-judged session: {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
