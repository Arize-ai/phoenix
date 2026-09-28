"""Repeated-run gates for skill evals; never infer success from missing results."""

from __future__ import annotations

import argparse
import json
import math
import tomllib
from collections import defaultdict
from pathlib import Path
from typing import Any

import yaml

ROOT = Path(__file__).resolve().parents[1]
PLUGIN_CASES = ROOT / "plugins/claude/arize-phoenix/evals"


def coverage() -> dict[str, Any]:
    data: dict[str, Any] = yaml.safe_load(
        (ROOT / "evals/skill_coverage.yaml").read_text(encoding="utf-8")
    )
    return data


def plugin_cases(suite: str) -> list[str]:
    pattern = coverage()["plugin_suites"][suite]["cases"]
    return sorted(
        path.name
        for path in PLUGIN_CASES.glob(pattern)
        if (path / "prompt.md").is_file() or (path / "case.yaml").is_file()
    )


def plugin_contract(name: str) -> tuple[str, list[dict[str, Any]]]:
    """Read the committed case, normalizing Claude's YAML and Markdown formats."""
    path = PLUGIN_CASES / name
    if (path / "case.yaml").is_file():
        case = yaml.safe_load((path / "case.yaml").read_text(encoding="utf-8"))
        prompt = case["execution"]["prompt"]
        graders = case["graders"]
    else:
        prompt = (path / "prompt.md").read_text(encoding="utf-8").split("---", 2)[2].strip()
        graders = []
        for file in sorted((path / "graders").glob("*.md")):
            _, header, body = file.read_text(encoding="utf-8").split("---", 2)
            grader = yaml.safe_load(header)
            grader["name"] = file.stem
            if grader["type"] in {"regex", "llm"}:
                grader["pattern" if grader["type"] == "regex" else "criteria"] = body.strip()
            graders.append(grader)
    definitions = []
    for grader in graders:
        config = {k: v for k, v in grader.items() if k not in {"name", "type", "weight"}}
        if grader["type"] == "regex":
            config.setdefault("flags", "")
        if grader["type"] == "tool_order":
            for key in ("before", "after"):
                if isinstance(config[key], str):
                    config[key] = {"tool": config[key]}
        definitions.append(
            {
                "name": grader["name"],
                "type": grader["type"],
                "weight": grader.get("weight", 1),
                "config": config,
            }
        )
    return prompt, definitions


def plugin_contract_errors(result: dict[str, Any], suite: str) -> list[str]:
    """A stale or truncated report must not redefine what counts as coverage."""
    cases = result.get("cases", [])
    names = [case["name"] for case in cases]
    if sorted(names) != plugin_cases(suite):
        return ["missing, duplicate, or unexpected cases"]
    failures = []
    for case in cases:
        prompt, definitions = plugin_contract(case["name"])
        # Claude preserves some YAML source line wraps that PyYAML folds.
        if case.get("promptMarkdown", "").split() != prompt.split():
            failures.append(
                f"case={case['name']} grader=case_contract: prompt differs from checkout"
            )
        observed = [
            {key: grader.get(key) for key in ("name", "type", "weight", "config")}
            for grader in case.get("graders", [])
        ]
        # Markdown reports retain CRLF on Windows; normalize line endings only.
        serialized = json.dumps(observed, sort_keys=True).replace(r"\r\n", r"\n")
        # Order is not part of the contract; grader names are unique.
        normalized = json.loads(serialized)
        for graders in (normalized, definitions):
            for grader in graders:
                config = grader.get("config") or {}
                if "criteria" in config:
                    config["criteria"] = " ".join(config["criteria"].split())
        if sorted(normalized, key=lambda g: g["name"]) != sorted(
            definitions, key=lambda g: g["name"]
        ):
            failures.append(
                f"case={case['name']} grader=case_contract: grader definitions differ from checkout"
            )
    return failures


def check_plugin(result: dict[str, Any], suite: str, model: str) -> list[str]:
    inventory = coverage()
    policy = inventory["policy"]
    spec = inventory["plugin_suites"][suite]
    prefix = f"harness=claude-plugin skill={spec['skill']} model={model}"
    failures: list[str] = []
    if result.get("schemaVersion") != 1:
        return [f"{prefix}: unsupported result schema"]
    if result.get("partial") or result.get("suite", {}).get("ablation") != "with-without":
        failures.append(f"{prefix}: a complete with/without run is required")
    cases = result.get("cases", [])
    failures.extend(f"{prefix} {error}" for error in plugin_contract_errors(result, suite))
    deltas: list[float] = []
    for case in cases:
        location = f"{prefix} case={case['name']}"
        definitions = {grader["name"] for grader in case.get("graders", [])}
        if not definitions:
            failures.append(f"{location}: missing grader definitions")
        arms = case.get("arms", {})
        for arm in ("with", "without"):
            required = definitions
            if arm == "without":
                # Indicators may be omitted from the baseline arm. Its outcome
                # graders and explicitly arm:both boundary checks must remain.
                required = {
                    g["name"]
                    for g in case.get("graders", [])
                    if g.get("config", {}).get("arm") == "both"
                    or (
                        g.get("config", {}).get("arm") != "with-only"
                        and not (
                            g.get("type") == "tool_used"
                            and g.get("config", {}).get("tool") == "Skill"
                        )
                    )
                }
            runs = arms.get(arm, [])
            if len(runs) < policy["minimum_runs"]:
                failures.append(f"{location} arm={arm}: too few runs ({len(runs)})")
            for index, run in enumerate(runs, 1):
                if run.get("error") or run.get("aborted") or run.get("skippedPaidGraders"):
                    failures.append(
                        f"{location} arm={arm} run={index}: incomplete run {run.get('error') or run.get('aborted') or 'skipped graders'}"
                    )
                graders = run.get("graders", [])
                observed = {g["name"] for g in graders}
                if not required <= observed <= definitions or len(graders) != len(observed):
                    failures.append(
                        f"{location} arm={arm} run={index}: missing or duplicate grader results"
                    )
            if arm == "with" and runs:
                # Includes activation indicators that ablation excludes from its score.
                for name in sorted(definitions):
                    passed = sum(
                        any(
                            g["name"] == name and g.get("passed") is True
                            for g in r.get("graders", [])
                        )
                        and not (r.get("error") or r.get("aborted") or r.get("skippedPaidGraders"))
                        for r in runs
                    )
                    rate = passed / len(runs)
                    if rate < policy["minimum_grader_pass_rate"]:
                        failures.append(f"{location} grader={name}: {passed}/{len(runs)} passed")
        score = case.get("aggregates", {}).get("score")
        if (
            not isinstance(score, (int, float))
            or not math.isfinite(score)
            or score < policy["minimum_plugin_score"]
        ):
            failures.append(f"{location} grader=weighted_score: {score}")
        if "-neg-" not in case["name"]:
            delta = case.get("aggregates", {}).get("delta")
            if isinstance(delta, (int, float)) and math.isfinite(delta):
                deltas.append(delta)
            else:
                failures.append(f"{location}: missing ablation delta")
    minimum_delta = spec["minimum_delta"]
    if minimum_delta is not None and (not deltas or sum(deltas) / len(deltas) < minimum_delta):
        failures.append(f"{prefix} grader=uplift: mean delta below {minimum_delta}")
    return failures


def check_harbor(job_dir: Path, tasks_dir: Path) -> list[str]:
    """Gate each declared dimension per task/model, using Harbor 0.21 trial results."""
    policy = coverage()["policy"]
    expected: dict[str, tuple[str, set[str]]] = {}
    for task_path in tasks_dir.glob("*/task.toml"):
        config = tomllib.loads(task_path.read_text(encoding="utf-8"))
        metadata = config.get("metadata", {})
        if "skill" not in metadata:
            continue
        dataset = yaml.safe_load(
            (ROOT / "evals/harbor/pxi/datasets" / f"{metadata['pxi_dataset']}.yaml").read_text(
                encoding="utf-8"
            )
        )
        # Harbor's task_name is the task directory name, not task.toml's package name.
        expected[task_path.parent.name] = (
            metadata["skill"],
            set(dataset["evaluators"]) | {"reward"},
        )
    if not expected:
        return ["harness=harbor: no compiled skill tasks found"]
    if not (job_dir / "config.json").is_file():
        return ["harness=harbor grader=job_contract: missing job config.json"]
    job = json.loads((job_dir / "config.json").read_text(encoding="utf-8"))
    models = [agent.get("model_name") for agent in job.get("agents", [])]
    if not models or not all(models) or len(models) != len(set(models)):
        return [
            "harness=harbor grader=job_contract: require one agent configuration per named model"
        ]
    planned_runs = job.get("n_attempts", 1)
    failures: list[str] = []
    if planned_runs < policy["minimum_runs"]:
        failures.append("harness=harbor grader=job_contract: too few planned attempts")
    groups: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    trial_names: set[str] = set()
    for path in job_dir.glob("*/result.json"):
        result = json.loads(path.read_text(encoding="utf-8"))
        task = result["task_name"]
        if task not in expected:
            continue
        model = result.get("config", {}).get("agent", {}).get("model_name")
        if not model:
            failures.append(f"harness=harbor case={task}: missing model")
            continue
        if model not in models:
            failures.append(
                f"harness=harbor case={task} model={model} grader=job_contract: unexpected model"
            )
        if result["trial_name"] in trial_names:
            failures.append(
                f"harness=harbor case={task} model={model} grader=job_contract: duplicate trial"
            )
            continue
        trial_names.add(result["trial_name"])
        groups[task, model].append(result)
    for task in sorted(expected):
        for model in models:
            if (task, model) not in groups:
                failures.append(
                    f"harness=harbor skill={expected[task][0]} case={task} model={model} grader=job_contract: missing trials"
                )
    for (task, model), trials in sorted(groups.items()):
        skill, graders = expected[task]
        prefix = f"harness=harbor skill={skill} case={task} model={model}"
        if len(trials) < policy["minimum_runs"]:
            failures.append(f"{prefix}: too few trials ({len(trials)})")
        if len(trials) != planned_runs:
            failures.append(
                f"{prefix} grader=job_contract: expected {planned_runs} trials, got {len(trials)}"
            )
        for trial in trials:
            rewards = (trial.get("verifier_result") or {}).get("rewards") or {}
            if (
                trial.get("exception_info")
                or not trial.get("finished_at")
                or set(rewards) != graders
            ):
                failures.append(
                    f"{prefix} trial={trial['trial_name']}: incomplete trial or missing graders"
                )
        for grader in sorted(graders):
            passed = sum(
                not trial.get("exception_info")
                and ((trial.get("verifier_result") or {}).get("rewards") or {}).get(grader) == 1
                for trial in trials
            )
            if passed / len(trials) < policy["minimum_grader_pass_rate"]:
                failures.append(f"{prefix} grader={grader}: {passed}/{len(trials)} passed")
    return failures


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="harness", required=True)
    plugin = subparsers.add_parser("plugin")
    plugin.add_argument("result", type=Path)
    plugin.add_argument("--suite", choices=list(coverage()["plugin_suites"]), required=True)
    plugin.add_argument("--model", required=True)
    harbor = subparsers.add_parser("harbor")
    harbor.add_argument("--jobs-dir", type=Path, default=Path("jobs"))
    harbor.add_argument("--tasks-dir", type=Path, default=Path("evals/harbor/tasks/pxi"))
    args = parser.parse_args()
    if args.harness == "plugin":
        failures = check_plugin(
            json.loads(args.result.read_text(encoding="utf-8")), args.suite, args.model
        )
    else:
        results = sorted(args.jobs_dir.glob("*/result.json"), key=lambda p: p.stat().st_mtime)
        failures = (
            check_harbor(results[-1].parent, args.tasks_dir)
            if results
            else ["No Harbor job results"]
        )
    for failure in failures:
        print(f"FAIL {failure}")
    if not failures:
        print("Repeated skill evaluation checks passed")
    return int(bool(failures))


if __name__ == "__main__":
    raise SystemExit(main())
