"""Runs the loading evals in the routing files and gates on recall and false loads.

Exit codes:

- 0: every suite passed.
- 1: a suite missed a threshold.
- 2: the run is incomplete: the cost cap stopped it, runs failed, or recording failed.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import threading
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict
from pathlib import Path
from typing import Any, Optional

from evals.skills.runner.cases import RoutingFile, routing_files
from evals.skills.runner.claude_code import ClaudeCodeAdapter
from evals.skills.runner.scoring import CaseResult, SuiteResult

ADAPTERS = {"claude-code"}
DEFAULT_MODEL = "claude-sonnet-5-5"


class Budget:
    """A cost cap shared by every worker thread."""

    def __init__(self, cap_usd: float) -> None:
        self.cap_usd = cap_usd
        self.spent_usd = 0.0
        self.exhausted = False
        self._lock = threading.Lock()

    def reserve(self) -> bool:
        """Checks whether money is left for another run."""
        with self._lock:
            if self.spent_usd >= self.cap_usd:
                self.exhausted = True
            return not self.exhausted

    def spend(self, amount_usd: float) -> None:
        with self._lock:
            self.spent_usd += amount_usd


def _run_case(
    adapter: ClaudeCodeAdapter, routing: RoutingFile, result: CaseResult, budget: Budget
) -> None:
    # Runs stop once the majority is decided, so a case costs 2 runs when they agree.
    attempts = 0
    while not result.decided and attempts < result.runs_per_case + 1:
        if not budget.reserve():
            return
        attempts += 1
        run = adapter.run(result.case.query, routing.case_files(result.case))
        budget.spend(run.cost_usd)
        result.runs.append(asdict(run))


def _parse_args(argv: Optional[list[str]]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(prog="python -m evals.skills.runner", description=__doc__)
    parser.add_argument("--skill", action="append", help="A skill to run. Default: all.")
    parser.add_argument(
        "--channel", action="append", help="A channel to run. Default: each file's channels."
    )
    parser.add_argument("--model", default=os.environ.get("SKILL_EVAL_MODEL", DEFAULT_MODEL))
    parser.add_argument(
        "--auth",
        choices=["subscription", "api-key"],
        default="api-key" if os.environ.get("CI") else "subscription",
        help="How Claude Code authenticates. Default: api-key in CI, else subscription.",
    )
    parser.add_argument("--runs", type=int, default=3, help="Runs per case. Default: 3.")
    parser.add_argument("--jobs", type=int, default=4, help="Cases run at once. Default: 4.")
    parser.add_argument(
        "--max-cost-usd", type=float, default=10.0, help="The cost cap. Default: 10."
    )
    parser.add_argument("--limit", type=int, help="Run only the first N cases of each file.")
    parser.add_argument("--json", type=Path, help="Write full results to this file.")
    parser.add_argument(
        "--no-record", action="store_true", help="Don't record the results to Phoenix."
    )
    return parser.parse_args(argv)


def _format_rate(value: Optional[float]) -> str:
    return "n/a" if value is None else f"{value:.2f}"


def _print_suite(suite: SuiteResult) -> None:
    verdict = {True: "PASS", False: "FAIL", None: "INCOMPLETE"}[suite.passed]
    print(
        f"{verdict}  {suite.routing.skill} on {suite.channel}: "
        f"recall {_format_rate(suite.recall)} (min {suite.thresholds.min_recall}), "
        f"false loads {_format_rate(suite.false_load_rate)} "
        f"(max {suite.thresholds.max_false_load_rate}), "
        f"{suite.run_count} runs, ${suite.cost_usd:.2f}"
    )
    for case in suite.cases:
        if case.correct is False or case.loaded is None:
            mark = "undecided" if case.loaded is None else "wrong"
            others = f" (loaded {', '.join(case.other_skills())})" if case.other_skills() else ""
            errors = [run["error"] for run in case.runs if run.get("error")]
            detail = f" errors: {errors[-1]}" if errors else ""
            print(
                f"    {mark}: expect {case.case.expect}, {case.loads}/{len(case.valid_runs)} "
                f"loads{others}: {case.case.query[:90]}{detail}"
            )


def main(argv: Optional[list[str]] = None) -> int:
    args = _parse_args(argv)
    files = routing_files(args.skill)
    budget = Budget(args.max_cost_usd)
    adapter = ClaudeCodeAdapter(model=args.model, auth=args.auth)
    agent_version = adapter.version()
    suites: list[SuiteResult] = []
    try:
        with ThreadPoolExecutor(max_workers=args.jobs) as pool:
            for routing in files:
                for channel in routing.resolved_channels():
                    if args.channel and channel not in args.channel:
                        continue
                    if channel not in ADAPTERS:
                        print(f"skip   {routing.skill} on {channel}: no adapter for {channel}")
                        continue
                    cases = routing.cases[: args.limit] if args.limit else routing.cases
                    results = [
                        CaseResult(case=c, skill=routing.skill, runs_per_case=args.runs)
                        for c in cases
                    ]
                    futures = [pool.submit(_run_case, adapter, routing, r, budget) for r in results]
                    for future in futures:
                        future.result()
                    suite = SuiteResult(routing=routing, channel=channel, cases=results)
                    suites.append(suite)
                    _print_suite(suite)
    finally:
        adapter.close()

    total = sum(s.cost_usd for s in suites)
    runs = sum(s.run_count for s in suites)
    print(f"total: {runs} runs, ${total:.2f} (cap ${args.max_cost_usd:.2f})")
    if budget.exhausted:
        print("the cost cap stopped the run before every case finished")

    metadata: dict[str, Any] = {
        "agent": "claude-code",
        "agent_version": agent_version,
        "model": args.model,
        "auth": args.auth,
        "runs_per_case": args.runs,
    }
    from evals.skills.runner.record import record_suite, suite_metadata

    summaries = [s.summary(suite_metadata(s, metadata)) for s in suites]
    if args.json:
        args.json.parent.mkdir(parents=True, exist_ok=True)
        args.json.write_text(
            json.dumps(
                {
                    **metadata,
                    "cost_usd": round(total, 4),
                    "runs": runs,
                    "cost_cap_hit": budget.exhausted,
                    "suites": summaries,
                },
                indent=2,
            )
        )

    recorded = True
    if not args.no_record:
        for summary in summaries:
            try:
                experiment_id = record_suite(summary)
                print(f"recorded {summary['skill']} on {summary['channel']}: {experiment_id}")
            except Exception as error:  # noqa: BLE001
                recorded = False
                print(f"couldn't record {summary['skill']} on {summary['channel']}: {error}")

    if any(s.passed is False for s in suites):
        return 1
    if budget.exhausted or not recorded or any(s.passed is None for s in suites):
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
