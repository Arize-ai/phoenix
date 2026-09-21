"""Fail if the most recent Harbor job errored or scored below a threshold.

`harbor run` exits 0 whenever the job completes, regardless of trial rewards,
so CI needs an explicit gate on the results it writes to disk. With
`--slack-payload`, the script also writes a Slack incoming-webhook payload that
reports the same verdict, so a scheduled run can post its results whether the
gate passes or fails.
"""

import argparse
import json
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional


@dataclass
class Verdict:
    result_path: Optional[Path]
    rewards: dict[str, float] = field(default_factory=dict)
    failures: list[str] = field(default_factory=list)

    @property
    def passed(self) -> bool:
        return not self.failures


def judge(jobs_dir: Path, min_reward: float) -> Verdict:
    results = sorted(jobs_dir.glob("*/result.json"), key=lambda p: p.stat().st_mtime)
    if not results:
        return Verdict(None, failures=[f"no result.json found under {jobs_dir}"])
    result_path = results[-1]
    stats = json.loads(result_path.read_text())["stats"]

    verdict = Verdict(result_path)
    if stats["n_errored_trials"]:
        verdict.failures.append(f"{stats['n_errored_trials']} errored trial(s)")
    verdict.rewards = {
        name: metric["reward"]
        for name, eval_stats in stats["evals"].items()
        for metric in eval_stats.get("metrics") or []
        if metric.get("reward") is not None
    }
    if not verdict.rewards:
        verdict.failures.append("no reward metrics in result.json")
    for name, reward in verdict.rewards.items():
        if reward < min_reward:
            verdict.failures.append(f"{name}: reward {reward} < {min_reward}")
    return verdict


def slack_payload(verdict: Verdict, title: str, run_url: Optional[str]) -> dict[str, object]:
    status = ":white_check_mark: passed" if verdict.passed else ":x: failed"
    lines = [f"*{title}* {status}"]
    lines.extend(f"• `{name}`: reward {reward:.2f}" for name, reward in verdict.rewards.items())
    lines.extend(f"• {failure}" for failure in verdict.failures)
    if run_url:
        lines.append(f"<{run_url}|View run>")
    text = "\n".join(lines)
    return {
        "text": f"{title} {status}",
        "blocks": [{"type": "section", "text": {"type": "mrkdwn", "text": text}}],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--jobs-dir", type=Path, default=Path("jobs"))
    parser.add_argument("--min-reward", type=float, required=True)
    parser.add_argument("--slack-payload", type=Path, help="write a Slack webhook payload here")
    parser.add_argument("--title", default="Harbor job", help="heading for the Slack message")
    parser.add_argument("--run-url", help="link to include in the Slack message")
    args = parser.parse_args()

    verdict = judge(args.jobs_dir, args.min_reward)
    if args.slack_payload:
        args.slack_payload.write_text(json.dumps(slack_payload(verdict, args.title, args.run_url)))

    print(f"{verdict.result_path}: rewards={verdict.rewards}")
    if verdict.failures:
        print("FAIL: " + "; ".join(verdict.failures), file=sys.stderr)
        return 1
    print("OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
