"""Records routing results to Phoenix: one dataset per skill, one experiment per suite.

The dataset holds the routing file's cases, keyed by a hash of the query, so re-recording
updates it in place. The experiment replays results the runner already has, so recording
calls no model.

To record a results file from a run made with ``--no-record``, run
``python -m evals.skills.runner.record RESULTS_JSON``.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any, Optional

from evals.skills.runner.cases import REPO_ROOT
from evals.skills.runner.scoring import SuiteResult


def _git(*args: str) -> str:
    try:
        return subprocess.check_output(
            ["git", *args], cwd=REPO_ROOT, text=True, stderr=subprocess.DEVNULL
        ).strip()
    except (OSError, subprocess.CalledProcessError):
        return ""


def git_info() -> dict[str, str]:
    """Returns the branch and commit to name experiments by.

    In CI, ``GITHUB_HEAD_REF`` and ``SKILL_EVAL_GIT_SHA`` name the pull request's branch and
    head commit, because a pull request checkout is a merge commit.
    """
    branch = (
        os.environ.get("GITHUB_HEAD_REF")
        or os.environ.get("GITHUB_REF_NAME")
        or _git("rev-parse", "--abbrev-ref", "HEAD")
        or "unknown"
    )
    sha = os.environ.get("SKILL_EVAL_GIT_SHA") or _git("rev-parse", "HEAD") or "unknown"
    return {"branch": branch, "git_sha": sha}


def skill_sha(skill: str) -> dict[str, Any]:
    """Returns the git tree hash of ``skills/SKILL_NAME`` and whether it has local edits."""
    path = f"skills/{skill}"
    return {
        "skill_sha": _git("rev-parse", f"HEAD:{path}"),
        "skill_dirty": bool(_git("status", "--porcelain", "--", path)),
    }


def dataset_name(skill: str) -> str:
    return f"skill-routing-{skill}"


def routed_correctly(output: dict[str, Any]) -> dict[str, Any]:
    correct = output.get("correct")
    if correct is None:
        return {"score": None, "label": "undecided"}
    return {"score": float(correct), "label": "correct" if correct else "wrong"}


def load_rate(output: dict[str, Any]) -> dict[str, Any]:
    valid = output.get("valid_runs") or 0
    return {"score": output["loads"] / valid if valid else None}


def suite_metadata(suite: SuiteResult, run_metadata: dict[str, Any]) -> dict[str, Any]:
    """Returns the experiment metadata for a suite, captured when the suite ran."""
    return {
        **run_metadata,
        **git_info(),
        **skill_sha(suite.routing.skill),
        "skill": suite.routing.skill,
        "channel": suite.channel,
        "recall": suite.recall,
        "false_load_rate": suite.false_load_rate,
        "passed": suite.passed,
        "runs": suite.run_count,
        "cost_usd": round(suite.cost_usd, 4),
    }


def record_suite(summary: dict[str, Any], client: Optional[Any] = None) -> str:
    """Records one suite summary as a Phoenix experiment and returns the experiment ID.

    Args:
        summary: A suite from the runner's ``--json`` output.
        client: The Phoenix client. Default: a client configured from the environment.
    """
    from phoenix.client import Client
    from phoenix.client.experiments import run_experiment

    client = client or Client()
    skill = summary["skill"]
    metadata = summary["metadata"]
    cases: dict[str, dict[str, Any]] = {case["query"]: case for case in summary["cases"]}
    examples = [
        {
            "id": case["id"],
            "input": {"query": case["query"], "files": case["files"]},
            "output": {"expect": case["expect"]},
            "metadata": {"kind": case["kind"], "sibling": case["sibling"], "split": case["split"]},
        }
        for case in cases.values()
    ]
    dataset = client.datasets.create_dataset(
        name=dataset_name(skill),
        examples=examples,
        dataset_description=f"Routing cases from evals/skills/{skill}/routing.yaml",
    )

    def replay(input: dict[str, Any]) -> dict[str, Any]:
        return cases[input["query"]]

    experiment = run_experiment(
        dataset=dataset,
        task=replay,
        evaluators=[routed_correctly, load_rate],
        experiment_name=(
            f"{skill} {summary['channel']} {metadata['branch']}@{metadata['git_sha'][:7]}"
        ),
        experiment_description=(
            f"recall {summary['recall']}, false-load rate {summary['false_load_rate']}, "
            f"passed {summary['passed']}"
        ),
        experiment_metadata=metadata,
        print_summary=False,
        client=client,
    )
    return str(experiment["experiment_id"])


def main() -> None:
    """Records every suite in a ``--json`` results file, for runs made with ``--no-record``."""
    results = json.loads(Path(sys.argv[1]).read_text())
    for summary in results["suites"]:
        experiment_id = record_suite(summary)
        print(f"recorded {summary['skill']} on {summary['channel']}: {experiment_id}")


if __name__ == "__main__":
    main()
