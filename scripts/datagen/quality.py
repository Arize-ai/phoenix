"""Deterministic schema, duplicate, and judge-sampling gates for datagen fragments."""

from __future__ import annotations

import json
import os
import re
import unicodedata
from dataclasses import dataclass
from hashlib import sha256
from pathlib import Path
from typing import Any, Iterable, Literal, Mapping, Sequence

from phoenix.datagen.schema import (
    ARCHETYPES,
    Fragment,
    SchemaValidationError,
    validate_fragment_v2,
)

NORMALIZER_VERSION = "visible-messages-nfkc-lower-ws-v1"
VALIDITY_VERSION = "conversation-structure-v1"
MINHASH_VALUES = 128
MINHASH_BANDS = 32
MINHASH_ROWS_PER_BAND = 4
LONG_FRAGMENT_MIN_TOKENS = 40
JUDGE_SAMPLE_FRACTION = 0.05

_WHITESPACE = re.compile(r"\s+")
_ASSISTANT_VOICE_FIRST_TURN = re.compile(
    r"^(?:certainly\b|sure[,.!]|i(?:'d be happy to| can help)\b|"
    r"i(?:'ll| will)\s+(?:analyze|assemble|calculate|check|compare|draft|explain|help|"
    r"investigate|keep|look|outline|prepare|provide|reconcile|review|start|summarize|"
    r"use|verify|walk)\b|here(?:'s| is| are)\b)",
    re.IGNORECASE,
)
_BARE_ROLE_NAMES = frozenset({"assistant", "system", "tool", "user"})
_MINHASH_PRIME = (1 << 61) - 1


@dataclass(frozen=True)
class DedupRule:
    shingle_size: int
    threshold: float


SHORT_FRAGMENT_RULE = DedupRule(shingle_size=3, threshold=0.90)
LONG_FRAGMENT_RULE = DedupRule(shingle_size=5, threshold=0.82)


class QualityError(ValueError):
    """Raised when quality-gate inputs cannot be evaluated."""


@dataclass(frozen=True)
class QualityReject:
    fragment_id: str
    archetype: str
    reason: str
    matched_fragment_id: str | None
    score: float | None
    threshold: float | None
    gate: Literal["validity", "schema", "dedup"]
    normalizer_version: str = NORMALIZER_VERSION

    def to_dict(self) -> dict[str, Any]:
        return {
            "fragment_id": self.fragment_id,
            "archetype": self.archetype,
            "reason": self.reason,
            "matched_fragment_id": self.matched_fragment_id,
            "score": self.score,
            "threshold": self.threshold,
            "gate": self.gate,
            "normalizer_version": self.normalizer_version,
        }


@dataclass(frozen=True)
class QualityOutcome:
    accepted: bool
    fragment: Mapping[str, Any] | None
    reject: QualityReject | None


@dataclass(frozen=True)
class _Fingerprint:
    fragment_id: str
    archetype: str
    content_sha256: str
    token_count: int
    shingle_size: int
    shingle_hashes: frozenset[str]
    minhash: tuple[int, ...]


class QualityGate:
    """Evaluate candidates against accepted and optional baseline fragments."""

    def __init__(
        self,
        baseline_fragments: Iterable[Fragment | Mapping[str, Any]] = (),
        *,
        rejects_path: Path | None = None,
    ) -> None:
        self._rejects_path = rejects_path
        self._fingerprints: dict[tuple[str, str], _Fingerprint] = {}
        self._exact: dict[tuple[str, str], str] = {}
        self._bands: dict[tuple[str, int, int, tuple[int, ...]], set[str]] = {}
        for fragment in baseline_fragments:
            self._add_baseline(fragment)

    @classmethod
    def from_baseline_bank(cls, source: Path, *, rejects_path: Path | None = None) -> QualityGate:
        from scripts.datagen.bank import read_v2_bank

        return cls(read_v2_bank(source).fragments, rejects_path=rejects_path)

    def evaluate(
        self, candidate: Mapping[str, Any], messages: Sequence[Mapping[str, Any]]
    ) -> QualityOutcome:
        fragment_id = candidate.get("fragment_id")
        archetype = candidate.get("archetype")
        identity = fragment_id if isinstance(fragment_id, str) else ""
        family = archetype if isinstance(archetype, str) else ""
        try:
            normalized, turn_count = normalize_visible_messages(messages)
        except QualityError as error:
            reject = QualityReject(
                fragment_id=identity,
                archetype=family,
                reason=f"validity: {error}",
                matched_fragment_id=None,
                score=None,
                threshold=None,
                gate="validity",
            )
            self._persist_reject(reject)
            return QualityOutcome(accepted=False, fragment=None, reject=reject)
        try:
            if candidate.get("turn_count") != turn_count:
                raise QualityError(
                    f"turn_count must equal the {turn_count} visible user message(s)"
                )
            fingerprint = _fingerprint(identity, family, normalized)
            quality_results = candidate.get("quality_results")
            merged_results = dict(quality_results) if isinstance(quality_results, Mapping) else {}
            merged_results.update(
                {
                    "validity": {"accepted": True, "version": VALIDITY_VERSION},
                    "schema": {"accepted": True},
                    "dedup": _accepted_dedup_result(fingerprint),
                }
            )
            enriched = {
                **candidate,
                "content_sha256": fingerprint.content_sha256,
                "quality_results": merged_results,
            }
            validate_fragment_v2(enriched)
        except (QualityError, SchemaValidationError) as error:
            reject = QualityReject(
                fragment_id=identity,
                archetype=family,
                reason=f"schema: {error}",
                matched_fragment_id=None,
                score=None,
                threshold=None,
                gate="schema",
            )
            self._persist_reject(reject)
            return QualityOutcome(accepted=False, fragment=None, reject=reject)

        duplicate = self._find_duplicate(fingerprint)
        if duplicate is not None:
            matched_fragment_id, score, threshold, reason = duplicate
            reject = QualityReject(
                fragment_id=identity,
                archetype=family,
                reason=reason,
                matched_fragment_id=matched_fragment_id,
                score=score,
                threshold=threshold,
                gate="dedup",
            )
            self._persist_reject(reject)
            return QualityOutcome(accepted=False, fragment=enriched, reject=reject)

        self._index(fingerprint)
        return QualityOutcome(accepted=True, fragment=enriched, reject=None)

    def _find_duplicate(self, fingerprint: _Fingerprint) -> tuple[str, float, float, str] | None:
        rule = _rule(fingerprint.token_count)
        exact_match = self._exact.get((fingerprint.archetype, fingerprint.content_sha256))
        if exact_match is not None:
            return exact_match, 1.0, rule.threshold, "exact_duplicate"

        candidate_ids: set[str] = set()
        for band, values in _signature_bands(fingerprint.minhash):
            candidate_ids.update(
                self._bands.get((fingerprint.archetype, fingerprint.shingle_size, band, values), ())
            )
        matches = []
        for candidate_id in candidate_ids:
            existing = self._fingerprints[(fingerprint.archetype, candidate_id)]
            score = _jaccard(fingerprint.shingle_hashes, existing.shingle_hashes)
            if score >= rule.threshold:
                matches.append((score, candidate_id))
        if not matches:
            return None
        score, candidate_id = min(matches, key=lambda item: (-item[0], item[1]))
        return candidate_id, score, rule.threshold, "near_duplicate"

    def _add_baseline(self, fragment: Fragment | Mapping[str, Any]) -> None:
        fragment_id = _value(fragment, "fragment_id")
        archetype = _value(fragment, "archetype")
        content_digest = _value(fragment, "content_sha256")
        if not all(isinstance(value, str) for value in (fragment_id, archetype, content_digest)):
            raise QualityError("baseline fragment identity fields must be strings")
        if archetype not in ARCHETYPES:
            raise QualityError(f"unsupported baseline archetype {archetype!r}")
        self._exact[(archetype, content_digest)] = fragment_id

        quality_results = _value(fragment, "quality_results")
        dedup = quality_results.get("dedup") if isinstance(quality_results, Mapping) else None
        fingerprint = _fingerprint_from_result(fragment_id, archetype, content_digest, dedup)
        if fingerprint is not None:
            self._index(fingerprint)

    def _index(self, fingerprint: _Fingerprint) -> None:
        key = (fingerprint.archetype, fingerprint.fragment_id)
        if key in self._fingerprints:
            raise QualityError(f"fragment {fingerprint.fragment_id} is already indexed")
        self._fingerprints[key] = fingerprint
        self._exact[(fingerprint.archetype, fingerprint.content_sha256)] = fingerprint.fragment_id
        for band, values in _signature_bands(fingerprint.minhash):
            band_key = (fingerprint.archetype, fingerprint.shingle_size, band, values)
            self._bands.setdefault(band_key, set()).add(fingerprint.fragment_id)

    def _persist_reject(self, reject: QualityReject) -> None:
        if self._rejects_path is None:
            return
        self._rejects_path.parent.mkdir(parents=True, exist_ok=True)
        content = (
            json.dumps(reject.to_dict(), sort_keys=True, separators=(",", ":")) + "\n"
        ).encode()
        descriptor = os.open(self._rejects_path, os.O_APPEND | os.O_CREAT | os.O_WRONLY, 0o644)
        try:
            os.write(descriptor, content)
            os.fsync(descriptor)
        finally:
            os.close(descriptor)


def normalize_visible_messages(
    messages: Sequence[Mapping[str, Any]],
) -> tuple[str, int]:
    """Normalize visible conversation messages and return text plus user-turn count."""
    visible: list[str] = []
    roles: list[str] = []
    user_turns = 0
    for index, message in enumerate(messages):
        role = message.get("role")
        if role == "system":
            continue
        if role not in {"user", "assistant", "tool"}:
            raise QualityError(f"messages[{index}].role is not visible or supported")
        content = _visible_content(message.get("content"))
        if _is_whitespace_only(message.get("content")):
            raise QualityError(f"messages[{index}].content is whitespace-only; regenerate it")
        if content.strip().casefold() in _BARE_ROLE_NAMES:
            raise QualityError(
                f"messages[{index}].content is the bare role name {content.strip()!r}; "
                "regenerate it"
            )
        if not content and role != "assistant":
            raise QualityError(f"messages[{index}].content must contain visible text")
        _validate_role_transition(roles[-1] if roles else None, role, index)
        marker = f"[tool:{message.get('name', 'tool')}]" if role == "tool" else f"[{role}]"
        visible.append(f"{marker} {content}")
        roles.append(role)
        if role == "user":
            user_turns += 1
    if not roles or roles[0] != "user":
        raise QualityError("conversation must begin with a visible user message")
    if roles[-1] not in {"assistant", "tool"}:
        raise QualityError("conversation must end with an assistant or tool message")
    first_content = _visible_content(
        next(message.get("content") for message in messages if message.get("role") != "system")
    ).strip()
    if _ASSISTANT_VOICE_FIRST_TURN.match(first_content):
        raise QualityError(
            "messages[0].content begins in assistant voice; likely role inversion, regenerate "
            "with the user's request first"
        )
    normalized = _WHITESPACE.sub(
        " ", unicodedata.normalize("NFKC", " ".join(visible)).lower()
    ).strip()
    if not normalized:
        raise QualityError("conversation has no visible normalized text")
    return normalized, user_turns


def select_judge_sample(
    fragments: Sequence[Fragment | Mapping[str, Any]],
    *,
    seed: int,
    fraction: float = JUDGE_SAMPLE_FRACTION,
) -> tuple[str, ...]:
    """Select a deterministic proportional sample across archetype, lane, and quality tier."""
    if not 0 < fraction <= 1:
        raise QualityError("judge sample fraction must be in (0, 1]")
    if not fragments:
        return ()
    target = max(1, round(len(fragments) * fraction))
    strata: dict[tuple[str, str, str], list[str]] = {}
    for fragment in fragments:
        fragment_id = _value(fragment, "fragment_id")
        key = (
            _value(fragment, "archetype"),
            _value(fragment, "lane"),
            _value(fragment, "quality_tier"),
        )
        if not isinstance(fragment_id, str) or not all(isinstance(item, str) for item in key):
            raise QualityError("judge sampling requires string identity and stratum fields")
        strata.setdefault(key, []).append(fragment_id)

    quotas = {key: len(values) * target // len(fragments) for key, values in strata.items()}
    remaining = target - sum(quotas.values())
    remainders = sorted(
        strata,
        key=lambda key: (
            -(len(strata[key]) * target % len(fragments)),
            sha256(f"{seed}:{key!r}".encode()).hexdigest(),
        ),
    )
    for key in remainders[:remaining]:
        quotas[key] += 1

    selected = []
    for key, fragment_ids in strata.items():
        ranked = sorted(
            fragment_ids,
            key=lambda fragment_id: sha256(f"{seed}:{fragment_id}".encode()).hexdigest(),
        )
        selected.extend(ranked[: quotas[key]])
    return tuple(sorted(selected))


def select_judge_routes(
    fragments: Sequence[Fragment | Mapping[str, Any]],
    *,
    proximate_fragment_ids: Iterable[str],
    seed: int,
    fraction: float = JUDGE_SAMPLE_FRACTION,
) -> Mapping[str, Literal["trap_proximity", "baseline", "not_selected"]]:
    """Route all proximate fragments and sample only from the remainder."""
    fragment_ids = {_value(fragment, "fragment_id") for fragment in fragments}
    if any(not isinstance(fragment_id, str) for fragment_id in fragment_ids):
        raise QualityError("judge routing requires string fragment IDs")
    proximate = set(proximate_fragment_ids)
    unknown = proximate - fragment_ids
    if unknown:
        raise QualityError(f"proximate fragment IDs are not accepted: {sorted(unknown)!r}")
    remainder = [
        fragment for fragment in fragments if _value(fragment, "fragment_id") not in proximate
    ]
    baseline = set(select_judge_sample(remainder, seed=seed, fraction=fraction))
    return {
        cast_id: (
            "trap_proximity"
            if cast_id in proximate
            else "baseline"
            if cast_id in baseline
            else "not_selected"
        )
        for cast_id in sorted(fragment_ids)
    }


def _visible_content(value: Any) -> str:
    if isinstance(value, str):
        return value
    if not isinstance(value, list):
        return ""
    parts = []
    for part in value:
        if isinstance(part, str):
            parts.append(part)
        elif isinstance(part, Mapping) and isinstance(part.get("text"), str):
            parts.append(part["text"])
    return " ".join(parts)


def _is_whitespace_only(value: Any) -> bool:
    if isinstance(value, str):
        return bool(value) and not value.strip()
    if not isinstance(value, list):
        return False
    text_parts = [
        part if isinstance(part, str) else part.get("text")
        for part in value
        if isinstance(part, str) or isinstance(part, Mapping)
    ]
    strings = [part for part in text_parts if isinstance(part, str)]
    return bool(strings) and not "".join(strings).strip()


def _validate_role_transition(previous: str | None, role: str, index: int) -> None:
    allowed = {
        None: {"user"},
        "user": {"assistant"},
        "assistant": {"user", "tool"},
        "tool": {"assistant", "tool"},
    }
    if role not in allowed[previous]:
        raise QualityError(f"messages[{index}].role {role!r} cannot follow {previous!r}")


def _fingerprint(fragment_id: str, archetype: str, normalized: str) -> _Fingerprint:
    tokens = tuple(normalized.split())
    rule = _rule(len(tokens))
    shingles = _shingles(tokens, rule.shingle_size)
    shingle_hashes = frozenset(sha256("\x1f".join(item).encode()).hexdigest() for item in shingles)
    return _Fingerprint(
        fragment_id=fragment_id,
        archetype=archetype,
        content_sha256=sha256(normalized.encode()).hexdigest(),
        token_count=len(tokens),
        shingle_size=rule.shingle_size,
        shingle_hashes=shingle_hashes,
        minhash=_minhash(shingle_hashes),
    )


def _fingerprint_from_result(
    fragment_id: str,
    archetype: str,
    content_digest: str,
    value: Any,
) -> _Fingerprint | None:
    if not isinstance(value, Mapping) or value.get("normalizer_version") != NORMALIZER_VERSION:
        return None
    token_count = value.get("token_count")
    shingle_size = value.get("shingle_size")
    raw_hashes = value.get("shingle_hashes")
    if (
        type(token_count) is not int
        or shingle_size not in {3, 5}
        or not isinstance(raw_hashes, list)
    ):
        return None
    if any(not isinstance(item, str) or len(item) != 64 for item in raw_hashes):
        return None
    shingle_hashes = frozenset(raw_hashes)
    return _Fingerprint(
        fragment_id=fragment_id,
        archetype=archetype,
        content_sha256=content_digest,
        token_count=token_count,
        shingle_size=shingle_size,
        shingle_hashes=shingle_hashes,
        minhash=_minhash(shingle_hashes),
    )


def _accepted_dedup_result(fingerprint: _Fingerprint) -> Mapping[str, Any]:
    rule = _rule(fingerprint.token_count)
    return {
        "accepted": True,
        "normalizer_version": NORMALIZER_VERSION,
        "token_count": fingerprint.token_count,
        "shingle_size": fingerprint.shingle_size,
        "threshold": rule.threshold,
        "shingle_hashes": sorted(fingerprint.shingle_hashes),
        "minhash_values": MINHASH_VALUES,
        "minhash_bands": MINHASH_BANDS,
        "minhash_rows_per_band": MINHASH_ROWS_PER_BAND,
    }


def _rule(token_count: int) -> DedupRule:
    return LONG_FRAGMENT_RULE if token_count >= LONG_FRAGMENT_MIN_TOKENS else SHORT_FRAGMENT_RULE


def _shingles(tokens: tuple[str, ...], size: int) -> frozenset[tuple[str, ...]]:
    if len(tokens) < size:
        return frozenset({tokens})
    return frozenset(tuple(tokens[index : index + size]) for index in range(len(tokens) - size + 1))


def _minhash(shingle_hashes: frozenset[str]) -> tuple[int, ...]:
    values = tuple(int(digest[:16], 16) % _MINHASH_PRIME for digest in shingle_hashes)
    signature = []
    for index in range(MINHASH_VALUES):
        seed = sha256(f"{NORMALIZER_VERSION}:minhash:{index}".encode()).digest()
        coefficient = int.from_bytes(seed[:8], "big") % (_MINHASH_PRIME - 1) + 1
        offset = int.from_bytes(seed[8:16], "big") % _MINHASH_PRIME
        signature.append(min((coefficient * value + offset) % _MINHASH_PRIME for value in values))
    return tuple(signature)


def _signature_bands(signature: tuple[int, ...]) -> Iterable[tuple[int, tuple[int, ...]]]:
    for band in range(MINHASH_BANDS):
        start = band * MINHASH_ROWS_PER_BAND
        yield band, signature[start : start + MINHASH_ROWS_PER_BAND]


def _jaccard(left: frozenset[str], right: frozenset[str]) -> float:
    union = left | right
    return len(left & right) / len(union) if union else 1.0


def _value(fragment: Fragment | Mapping[str, Any], field: str) -> Any:
    return fragment.get(field) if isinstance(fragment, Mapping) else getattr(fragment, field)
