"""Shared derivation recipes for online-eval coordination: config fingerprints,
annotation identifiers, and sampling keys. All functions are pure; version resolution and
any DB access happen in callers.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass
from enum import Enum
from typing import Any

from phoenix.db.eval_work import MAX_ATTEMPTS as MAX_ATTEMPTS

_IDENTIFIER_PREFIX = "online:"
_IDENTIFIER_FINGERPRINT_CHARS = 16


@dataclass(frozen=True)
class ResolvedProjectEvaluator:
    """Fingerprint inputs for one project evaluator, resolved by the caller.

    ``version_ref`` must name an immutable version, never a mutable pointer: the
    concrete ``PromptVersion.id`` for LLM evaluators (resolving the tag), the current
    code version plus sandbox-runtime fingerprint for CODE, and the key, sync timestamp,
    and implementation version for BUILTIN. Every field must be JSON-serializable.
    """

    project_evaluator_id: int
    name: str
    evaluator_id: int
    version_ref: Any
    output_configs: Any
    input_mapping: Any
    evaluation_target: str
    sandbox_config_id: int | None
    filter_condition: str
    sampling_rate: float
    session_policy_fingerprint: str | None = None


def _canonical_default(obj: Any) -> Any:
    # Evaluator config model_dump() output carries enum members (e.g.
    # OptimizationDirection); coerce to value exactly as the DB engine's JSON
    # serializer does, so the fingerprint sees the stored-column shape.
    if isinstance(obj, Enum):
        return obj.value
    raise TypeError(f"Object of type {type(obj).__name__} is not JSON serializable")


def config_fingerprint(resolved: ResolvedProjectEvaluator) -> str:
    """Full 64-char sha256 hex over the canonical JSON form of the resolved evaluator.

    The consumer computes it from the configuration it hydrates, so an annotation's
    identifier names the configuration that produced it.
    """
    canonical = json.dumps(
        asdict(resolved),
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
        default=_canonical_default,
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def annotation_identifier(fingerprint: str) -> str:
    """Identifier keying the idempotent annotation write for one configuration."""
    return _IDENTIFIER_PREFIX + fingerprint[:_IDENTIFIER_FINGERPRINT_CHARS]


def sample_key(artifact_identity: int | str) -> float:
    """Uniform-in-[0,1) sampling key derived from a stable artifact identity.

    An artifact is sampled iff ``sample_key(identity) < sampling_rate``. The
    key is deliberately unsalted and shared across all evaluators so lower-rate samples
    nest inside higher-rate ones (every 20% sample is a subset of every 60% sample).
    """
    digest = hashlib.sha256(str(artifact_identity).encode("utf-8")).digest()
    # Top 53 bits only: dividing the full digest by 2**256 can round up to exactly 1.0,
    # violating the half-open interval; 53-bit numerators are exact in a float.
    return (int.from_bytes(digest[:8], "big") >> 11) / (1 << 53)
