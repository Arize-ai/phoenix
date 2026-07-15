"""Fail if the most recent Harbor job errored or scored below a threshold.

`harbor run` exits 0 whenever the job completes, regardless of trial rewards,
so CI needs an explicit gate on the results it writes to disk.
"""

import argparse
import json
import sys
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--jobs-dir", type=Path, default=Path("jobs"))
    parser.add_argument("--min-reward", type=float, required=True)
    args = parser.parse_args()

    results = sorted(args.jobs_dir.glob("*/result.json"), key=lambda p: p.stat().st_mtime)
    if not results:
        print(f"No result.json found under {args.jobs_dir}", file=sys.stderr)
        return 1
    result_path = results[-1]
    stats = json.loads(result_path.read_text())["stats"]

    failures = []
    if stats["n_errored_trials"]:
        failures.append(f"{stats['n_errored_trials']} errored trial(s)")
    rewards = {
        name: metric["reward"]
        for name, eval_stats in stats["evals"].items()
        for metric in eval_stats.get("metrics") or []
        if metric.get("reward") is not None
    }
    if not rewards:
        failures.append("no reward metrics in result.json")
    for name, reward in rewards.items():
        if reward < args.min_reward:
            failures.append(f"{name}: reward {reward} < {args.min_reward}")

    print(f"{result_path}: rewards={rewards}")
    if failures:
        print("FAIL: " + "; ".join(failures), file=sys.stderr)
        return 1
    print("OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
