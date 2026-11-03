"""Turns agent runs into per-case decisions and per-suite gate results."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional

from evals.skills.runner.cases import Case, RoutingFile, Thresholds


@dataclass
class CaseResult:
    """The runs of one case on one channel."""

    case: Case
    skill: str
    runs: list[dict[str, Any]] = field(default_factory=list)
    runs_per_case: int = 3

    @property
    def valid_runs(self) -> list[dict[str, Any]]:
        return [run for run in self.runs if not run.get("error")]

    @property
    def loads(self) -> int:
        return sum(self.skill in run["loaded"] for run in self.valid_runs)

    @property
    def majority(self) -> int:
        return self.runs_per_case // 2 + 1

    @property
    def decided(self) -> bool:
        """True if more runs can't change the majority; false otherwise."""
        misses = len(self.valid_runs) - self.loads
        return self.loads >= self.majority or misses >= self.majority

    @property
    def loaded(self) -> Optional[bool]:
        """True if the skill loaded in a majority of runs, or None if undecided."""
        if not self.decided:
            return None
        return self.loads >= self.majority

    @property
    def correct(self) -> Optional[bool]:
        if self.loaded is None:
            return None
        return self.loaded == (self.case.expect == "load")

    @property
    def cost_usd(self) -> float:
        return sum(float(run.get("cost_usd") or 0.0) for run in self.runs)

    def other_skills(self) -> list[str]:
        """Returns the other skills loaded in any run, in first-load order."""
        seen: dict[str, None] = {}
        for run in self.valid_runs:
            seen.update(dict.fromkeys(s for s in run["loaded"] if s != self.skill))
        return list(seen)

    def summary(self) -> dict[str, Any]:
        return {
            "query": self.case.query,
            "expect": self.case.expect,
            "kind": self.case.kind,
            "sibling": self.case.sibling,
            "loaded": self.loaded,
            "correct": self.correct,
            "loads": self.loads,
            "valid_runs": len(self.valid_runs),
            "runs": self.runs,
            "other_skills": self.other_skills(),
            "cost_usd": round(self.cost_usd, 6),
        }


@dataclass
class SuiteResult:
    """The results of one routing file on one channel."""

    routing: RoutingFile
    channel: str
    cases: list[CaseResult]

    @property
    def thresholds(self) -> Thresholds:
        return self.routing.thresholds

    def _rate(self, expect: str) -> Optional[float]:
        decided = [c for c in self.cases if c.case.expect == expect and c.loaded is not None]
        if not decided:
            return None
        return sum(bool(c.loaded) for c in decided) / len(decided)

    @property
    def recall(self) -> Optional[float]:
        return self._rate("load")

    @property
    def false_load_rate(self) -> Optional[float]:
        return self._rate("no-load")

    @property
    def undecided(self) -> list[CaseResult]:
        return [c for c in self.cases if c.loaded is None]

    @property
    def passed(self) -> Optional[bool]:
        """True if the suite meets its thresholds, or None if any case is undecided."""
        if self.undecided or self.recall is None or self.false_load_rate is None:
            return None
        return (
            self.recall >= self.thresholds.min_recall
            and self.false_load_rate <= self.thresholds.max_false_load_rate
        )

    @property
    def cost_usd(self) -> float:
        return sum(c.cost_usd for c in self.cases)

    @property
    def run_count(self) -> int:
        return sum(len(c.runs) for c in self.cases)

    def summary(self) -> dict[str, Any]:
        return {
            "skill": self.routing.skill,
            "channel": self.channel,
            "passed": self.passed,
            "recall": self.recall,
            "false_load_rate": self.false_load_rate,
            "min_recall": self.thresholds.min_recall,
            "max_false_load_rate": self.thresholds.max_false_load_rate,
            "undecided": len(self.undecided),
            "runs": self.run_count,
            "cost_usd": round(self.cost_usd, 4),
            "cases": [c.summary() for c in self.cases],
        }
