"""Environment-variable configuration for the Phoenix pytest plugin.

The ``PHOENIX_TEST_*`` env grammar is a cross-ecosystem contract shared verbatim with the
TypeScript test runner. Keep names and truthiness semantics in sync with that runner.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Mapping, Optional


class PhoenixTestConfigError(ValueError):
    """Raised when a ``PHOENIX_TEST_*`` env var is malformed."""


_TRUTHY = frozenset({"1", "true", "yes", "on"})
_FALSY = frozenset({"0", "false", "no", "off", ""})


def _env_bool(value: Optional[str], *, default: bool) -> bool:
    if value is None:
        return default
    normalized = value.strip().lower()
    if normalized in _TRUTHY:
        return True
    if normalized in _FALSY:
        return False
    # Unrecognized strings are treated as truthy, matching the TS runner's loose parsing.
    return True


def _parse_min_score(raw: str) -> dict[str, float]:
    """Parse ``name:float[,name:float...]`` into a mapping. Malformed input is a config error."""
    thresholds: dict[str, float] = {}
    for chunk in raw.split(","):
        chunk = chunk.strip()
        if not chunk:
            continue
        if ":" not in chunk:
            raise PhoenixTestConfigError(
                f"PHOENIX_TEST_MIN_SCORE entry {chunk!r} must be of the form name:float"
            )
        name, _, value = chunk.partition(":")
        name = name.strip()
        if not name:
            raise PhoenixTestConfigError(
                f"PHOENIX_TEST_MIN_SCORE entry {chunk!r} has an empty annotation name"
            )
        try:
            thresholds[name] = float(value.strip())
        except ValueError as e:
            raise PhoenixTestConfigError(
                f"PHOENIX_TEST_MIN_SCORE entry {chunk!r} has a non-numeric threshold"
            ) from e
    return thresholds


@dataclass(frozen=True)
class PhoenixTestConfig:
    """Resolved plugin configuration for one pytest session."""

    tracking: bool = True
    dry_run: bool = False
    repetitions: int = 1
    collect_repo_info: bool = True
    fail_on_regression: bool = False
    min_score: Mapping[str, float] = field(default_factory=dict)
    dataset_override: Optional[str] = None

    @property
    def offline(self) -> bool:
        """True when no network calls should be made (tracking off or dry-run on)."""
        return not self.tracking or self.dry_run

    @property
    def gate_configured(self) -> bool:
        """True when an aggregate gate (regression or min-score) is configured."""
        return self.fail_on_regression or bool(self.min_score)

    @classmethod
    def from_env(
        cls,
        env: Optional[Mapping[str, str]] = None,
        *,
        dataset_override: Optional[str] = None,
    ) -> "PhoenixTestConfig":
        env = os.environ if env is None else env

        reps_raw = env.get("PHOENIX_TEST_REPETITIONS")
        if reps_raw is not None and reps_raw.strip():
            try:
                repetitions = int(reps_raw.strip())
            except ValueError as e:
                raise PhoenixTestConfigError(
                    f"PHOENIX_TEST_REPETITIONS must be an integer, got {reps_raw!r}"
                ) from e
            if repetitions < 1:
                raise PhoenixTestConfigError(
                    f"PHOENIX_TEST_REPETITIONS must be >= 1, got {repetitions}"
                )
        else:
            repetitions = 1

        min_score_raw = env.get("PHOENIX_TEST_MIN_SCORE")
        min_score = _parse_min_score(min_score_raw) if min_score_raw else {}

        return cls(
            tracking=_env_bool(env.get("PHOENIX_TEST_TRACKING"), default=True),
            dry_run=_env_bool(env.get("PHOENIX_TEST_DRY_RUN"), default=False),
            repetitions=repetitions,
            collect_repo_info=_env_bool(env.get("PHOENIX_TEST_REPO_INFO"), default=True),
            fail_on_regression=_env_bool(env.get("PHOENIX_TEST_FAIL_ON_REGRESSION"), default=False),
            min_score=min_score,
            dataset_override=dataset_override,
        )
