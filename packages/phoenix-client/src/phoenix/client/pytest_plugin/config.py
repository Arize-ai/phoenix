from __future__ import annotations

import os
from dataclasses import dataclass
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
    return True


@dataclass(frozen=True)
class PhoenixTestConfig:
    """Resolved plugin configuration for one pytest session."""

    tracking: bool = True
    dry_run: bool = False
    repetitions: int = 1
    dataset_override: Optional[str] = None

    @property
    def offline(self) -> bool:
        """True when no network calls should be made (tracking off or dry-run on)."""
        return not self.tracking or self.dry_run

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

        return cls(
            tracking=_env_bool(env.get("PHOENIX_TEST_TRACKING"), default=True),
            dry_run=_env_bool(env.get("PHOENIX_TEST_DRY_RUN"), default=False),
            repetitions=repetitions,
            dataset_override=dataset_override,
        )
