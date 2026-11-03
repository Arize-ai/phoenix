"""Records routing results to Phoenix: one dataset per skill, one experiment per suite.

The dataset holds the routing file's cases, keyed by a hash of the query, so re-recording
updates it in place. The experiment replays results the runner already has, so recording
calls no model.
"""

from __future__ import annotations

import os
import subprocess
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


def experiment_name(suite: SuiteResult, git: dict[str, str]) -> str:
    return f"{suite.routing.skill} {suite.channel} {git['branch']}@{git['git_sha'][:7]}"


def routed_correctly(output: dict[str, Any]) -> dict[str, Any]:
    correct = output.get("correct")
    if correct is None:
        return {"score": None, "label": "undecided"}
    return {"score": float(correct), "label": "correct" if correct else "wrong"}


def load_rate(output: dict[str, Any]) -> Optional[float]:
    valid = output.get("valid_runs") or 0
    return output["loads"] / valid if valid else None


def record_suite(suite: SuiteResult, metadata: dict[str, Any], client: Optional[Any] = None) -> str:
    """Records one suite as a Phoenix experiment and returns the experiment ID."""
    from phoenix.client import Client
    from phoenix.client.experiments import run_experiment

    client = client or Client()
    summaries = {c.case.query: c.summary() for c in suite.cases}
    examples = [
        {
            "id": c.case.id,
            "input": {"query": c.case.query, "files": c.case.files},
            "output": {"expect": c.case.expect},
            "metadata": {"kind": c.case.kind, "sibling": c.case.sibling, "split": c.case.split},
        }
        for c in suite.cases
    ]
    dataset = client.datasets.create_dataset(
        name=dataset_name(suite.routing.skill),
        examples=examples,
        dataset_description=f"Routing cases from evals/skills/{suite.routing.skill}/routing.yaml",
    )

    def replay(input: dict[str, Any]) -> dict[str, Any]:
        return summaries[input["query"]]

    git = git_info()
    experiment = run_experiment(
        dataset=dataset,
        task=replay,
        evaluators=[routed_correctly, load_rate],
        experiment_name=experiment_name(suite, git),
        experiment_description=(
            f"recall {suite.recall}, false-load rate {suite.false_load_rate}, passed {suite.passed}"
        ),
        experiment_metadata={
            **metadata,
            **git,
            **skill_sha(suite.routing.skill),
            "skill": suite.routing.skill,
            "channel": suite.channel,
            "recall": suite.recall,
            "false_load_rate": suite.false_load_rate,
            "passed": suite.passed,
            "runs": suite.run_count,
            "cost_usd": round(suite.cost_usd, 4),
        },
        print_summary=False,
        client=client,
    )
    return str(experiment["experiment_id"])
