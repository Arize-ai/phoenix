"""Policy governing SESSION evaluation work: scheduling delays, schedulability, and
the transcript assembly caps.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from typing import TYPE_CHECKING

from sqlalchemy import and_
from sqlalchemy.sql.elements import ColumnElement

from phoenix.config import (
    get_env_online_eval_max_llm_message_bytes,
    get_env_online_eval_max_transcript_bytes,
)

if TYPE_CHECKING:
    from phoenix.db import models

DEFAULT_SESSION_EVALUATION_DELAY_SECONDS = 300
MINIMUM_EVALUATION_DELAY_SECONDS = 10

TRANSCRIPT_POLICY_VERSION = "1"
MAX_SESSION_EVAL_TURNS = 1_000


def session_criteria_is_schedulable(
    criteria: type["models.ProjectEvaluatorCriteria"],
) -> ColumnElement[bool]:
    # Session filters shipped in #14101 (#14041); #14038 owns sampling integration.
    return and_(
        criteria.enabled,
        criteria.evaluation_target == "SESSION",
        criteria.filter_condition == "",
        criteria.sampling_rate == 1.0,
    )


@dataclass(frozen=True)
class SessionTranscriptPolicy:
    """The caps that decide what text a session evaluation actually reads.

    Every field enters the config fingerprint, so results published under one
    annotation identifier are comparable to each other. That only holds while the
    fingerprint and the assembly it describes read the same values, which is why the
    environment is read once, here: a materializer that fingerprinted one cap while an
    executor assembled under another would agree only by accident, and the mismatch
    would surface as expired work rather than as a configuration error.
    """

    max_transcript_bytes: int
    max_llm_message_bytes: int
    max_turns: int = MAX_SESSION_EVAL_TURNS
    version: str = TRANSCRIPT_POLICY_VERSION

    @classmethod
    def from_env(cls) -> SessionTranscriptPolicy:
        return cls(
            max_transcript_bytes=get_env_online_eval_max_transcript_bytes(),
            max_llm_message_bytes=get_env_online_eval_max_llm_message_bytes(),
        )

    @property
    def fingerprint(self) -> str:
        """Identity of the transcript policy in force, for the config fingerprint."""
        payload = {
            "policy_version": self.version,
            "max_transcript_bytes": self.max_transcript_bytes,
            "max_turns": self.max_turns,
            "max_llm_message_bytes": self.max_llm_message_bytes,
        }
        serialized = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
        return hashlib.sha256(serialized.encode("utf-8")).hexdigest()
