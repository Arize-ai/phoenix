"""Shared derivation recipes for online-eval coordination. The producer, consumer, and
backstop all compute config fingerprints, annotation identifiers, and sampling keys
through this module — an independent recipe that drifts from these re-materializes the
work backlog (fingerprint mismatch) or breaks annotation idempotency (identifier
mismatch). It also holds the shared work-unit retry budget (``MAX_ATTEMPTS``), which
the producer's reaper/backstop and the consumer's claim predicate must agree on. All
functions are pure; version resolution and any DB access happen in callers.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass
from enum import Enum
from typing import Any

_IDENTIFIER_PREFIX = "online:"
_IDENTIFIER_FINGERPRINT_CHARS = 16

# Retry budget for a work unit before its ERROR state becomes terminal. The producer
# excludes attempt-exhausted rows from reaping and backstop re-materialization using
# this value, and the consumer-side coordinator stops reclaiming ERROR rows at it —
# the two sides drifting apart either resurrects dead work or strands retryable work.
MAX_ATTEMPTS = 3


@dataclass(frozen=True)
class ResolvedCriteria:
    """Fingerprint inputs for one evaluator criteria, resolved by the caller.

    ``version_ref`` must name an immutable version, never a mutable pointer: the
    concrete ``PromptVersion.id`` for LLM evaluators (resolving the tag), the current
    ``CodeEvaluatorVersion.id`` for CODE, and ``(key, synced_at ISO string)`` for
    BUILTIN. Every field must be JSON-serializable — pass the stored column form of
    ``output_configs`` / ``input_mapping``, not model objects.
    """

    criteria_id: int
    name: str
    evaluator_id: int
    version_ref: Any
    output_configs: Any
    input_mapping: Any
    evaluation_target: str
    sandbox_config_id: int | None
    filter_condition: str
    sampling_rate: float


def _canonical_default(obj: Any) -> Any:
    # Evaluator config model_dump() output carries enum members (e.g.
    # OptimizationDirection); coerce to value exactly as the DB engine's JSON
    # serializer does, so the fingerprint sees the stored-column shape.
    if isinstance(obj, Enum):
        return obj.value
    raise TypeError(f"Object of type {type(obj).__name__} is not JSON serializable")


def config_fingerprint(resolved: ResolvedCriteria) -> str:
    """Full 64-char sha256 hex over the canonical JSON form of the resolved criteria.

    Serves as both the work-unit dedup key component and the consumer's staleness
    guard: the consumer re-resolves the same inputs at claim time and refuses to
    execute a unit whose recomputed fingerprint no longer matches the stored one.
    """
    canonical = json.dumps(
        asdict(resolved),
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
        default=_canonical_default,
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def annotation_identifier(fingerprint: str, generation: int | None = None) -> str:
    """Identifier keying the idempotent annotation write for a work unit.

    Span work omits ``generation`` and retains its original identifier. Session work
    includes its generation so each session work address has a distinct identifier.
    """
    identifier = _IDENTIFIER_PREFIX + fingerprint[:_IDENTIFIER_FINGERPRINT_CHARS]
    return identifier if generation is None else f"{identifier}:{generation}"


def sample_key(span_id: int) -> float:
    """Uniform-in-[0,1) sampling key derived from the span id's decimal string.

    A span is sampled for a criteria iff ``sample_key(span_id) < sampling_rate``. The
    key is deliberately unsalted and shared across all criteria so lower-rate samples
    nest inside higher-rate ones (every 20% sample is a subset of every 60% sample).
    """
    digest = hashlib.sha256(str(span_id).encode("ascii")).digest()
    # Top 53 bits only: dividing the full digest by 2**256 can round up to exactly 1.0,
    # violating the half-open interval; 53-bit numerators are exact in a float.
    return (int.from_bytes(digest[:8], "big") >> 11) / (1 << 53)
