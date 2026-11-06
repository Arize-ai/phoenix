from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Mapping, Optional


class PhoenixTestConfigError(ValueError):
    """Raised when a ``PHOENIX_TEST_*`` env var is malformed."""


_TRUTHY = frozenset({"1", "true", "yes", "on"})
_FALSY = frozenset({"0", "false", "no", "off"})


def _env_bool(value: Optional[str], *, default: bool, name: str = "value") -> bool:
    """Parse a boolean env var symmetrically.

    Unset or empty -> ``default``; ``1/true/yes/on`` -> True; ``0/false/no/off`` -> False.
    Anything else is an error: a typo like ``PHOENIX_TEST_TRACKING=flase`` fails loudly rather
    than silently resolving to True.
    """
    if value is None:
        return default
    normalized = value.strip().lower()
    if not normalized:
        return default
    if normalized in _TRUTHY:
        return True
    if normalized in _FALSY:
        return False
    raise PhoenixTestConfigError(
        f"{name} must be a boolean ({sorted(_TRUTHY | _FALSY)}) or empty, got {value!r}"
    )


@dataclass(frozen=True)
class PhoenixTestConfig:
    """Resolved plugin configuration for one pytest session."""

    tracking: bool = True
    repetitions: int = 1
    dataset_override: Optional[str] = None

    @property
    def offline(self) -> bool:
        """True when no network calls should be made (tracking off)."""
        return not self.tracking

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

        # PHOENIX_TEST_DATASET wins over the phoenix_dataset ini option so CI can name the
        # dataset per invocation (e.g. PHOENIX_TEST_DATASET=smoke pytest -m smoke) without
        # editing committed config.
        env_dataset = env.get("PHOENIX_TEST_DATASET")
        if env_dataset is not None and env_dataset.strip():
            dataset_override = env_dataset.strip()

        return cls(
            tracking=_env_bool(
                env.get("PHOENIX_TEST_TRACKING"), default=True, name="PHOENIX_TEST_TRACKING"
            ),
            repetitions=repetitions,
            dataset_override=dataset_override,
        )
