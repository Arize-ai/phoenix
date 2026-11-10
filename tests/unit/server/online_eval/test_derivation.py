"""Property-based tests for the online-eval derivation recipes.

Hypothesis is not a unit-test dependency, so each property is checked over inputs from
seeded ``random.Random`` generators (deterministic across runs) plus explicit edge-case
examples.
"""

import json
import string
from dataclasses import asdict, replace
from random import Random
from typing import Any, Optional

import pytest

from phoenix.db.types.annotation_configs import AnnotationType, OptimizationDirection
from phoenix.db.types.decision_evaluators import (
    DecisionScoringPolicy,
    PredicateScoring,
    derive_decision_output_configs,
)
from phoenix.db.types.decisions import PredicateQuestion
from phoenix.server.online_eval.derivation import (
    ResolvedProjectEvaluator,
    annotation_identifier,
    config_fingerprint,
    fingerprinted_output_config,
    sample_key,
)

_N_EXAMPLES = 200

_SCALARS: list[Any] = [None, True, False, 0, 1, -17, 3.5, "", "a", "ünïcode ✓"]


def _word(rng: Random) -> str:
    return "".join(rng.choice(string.ascii_lowercase) for _ in range(rng.randint(1, 8)))


def _json_value(rng: Random, depth: int = 0) -> Any:
    if depth >= 2 or rng.random() < 0.5:
        return rng.choice(_SCALARS)
    if rng.random() < 0.5:
        return [_json_value(rng, depth + 1) for _ in range(rng.randint(0, 3))]
    return {_word(rng): _json_value(rng, depth + 1) for _ in range(rng.randint(0, 3))}


def _criteria(rng: Random) -> ResolvedProjectEvaluator:
    version_ref: Any = (
        rng.randint(1, 10_000) if rng.random() < 0.5 else [_word(rng), "2026-07-01T00:00:00+00:00"]
    )
    return ResolvedProjectEvaluator(
        project_evaluator_id=rng.randint(1, 10_000),
        name=_word(rng),
        evaluator_id=rng.randint(1, 10_000),
        version_ref=version_ref,
        output_configs=[_json_value(rng) for _ in range(rng.randint(0, 3))],
        input_mapping={_word(rng): _json_value(rng) for _ in range(rng.randint(0, 3))},
        evaluation_target=rng.choice(["SPAN", "TRACE", "SESSION"]),
        sandbox_config_id=rng.choice([None, rng.randint(1, 10_000)]),
        filter_condition=rng.choice(["", "span_kind == 'LLM'", "status_code == 'ERROR'"]),
        sampling_rate=rng.random(),
    )


_EDGE_CRITERIA = [
    ResolvedProjectEvaluator(
        project_evaluator_id=0,
        name="",
        evaluator_id=0,
        version_ref=0,
        output_configs=[],
        input_mapping={},
        evaluation_target="SPAN",
        sandbox_config_id=None,
        filter_condition="",
        sampling_rate=0.0,
    ),
    ResolvedProjectEvaluator(
        project_evaluator_id=1,
        name="ünïcode ✓",
        evaluator_id=1,
        version_ref=["exact_match", "2026-07-01T00:00:00+00:00"],
        output_configs=[{"nested": {"deep": [1, 2, 3]}}],
        input_mapping={"input": None},
        evaluation_target="SESSION",
        sandbox_config_id=12,
        filter_condition="span_kind == 'LLM'",
        sampling_rate=1.0,
    ),
]

_EDGE_SPAN_IDS = [0, 1, 2, 7, 2**31, 2**63, 10**30]


class TestConfigFingerprint:
    def test_deterministic(self) -> None:
        """Same resolved project_evaluator always yields the same fingerprint, including across
        an independently constructed equal instance."""
        rng = Random(0)
        for resolved in [_criteria(rng) for _ in range(_N_EXAMPLES)] + _EDGE_CRITERIA:
            rebuilt = ResolvedProjectEvaluator(**asdict(resolved))
            assert config_fingerprint(resolved) == config_fingerprint(resolved)
            assert config_fingerprint(resolved) == config_fingerprint(rebuilt)

    def test_format_is_full_sha256_hex(self) -> None:
        rng = Random(1)
        for resolved in [_criteria(rng) for _ in range(_N_EXAMPLES)] + _EDGE_CRITERIA:
            fingerprint = config_fingerprint(resolved)
            assert len(fingerprint) == 64
            assert set(fingerprint) <= set(string.hexdigits.lower())

    def test_key_order_invariance(self) -> None:
        """Dicts that are equal but were built in different key-insertion orders
        fingerprint identically."""
        rng = Random(2)
        for _ in range(_N_EXAMPLES):
            resolved = _criteria(rng)
            mapping = {_word(rng): _json_value(rng) for _ in range(rng.randint(2, 5))}
            forward = replace(resolved, input_mapping=dict(mapping.items()))
            backward = replace(resolved, input_mapping=dict(reversed(mapping.items())))
            assert config_fingerprint(forward) == config_fingerprint(backward)

    def test_whitespace_invariance_through_json_round_trip(self) -> None:
        """Configs arriving via differently formatted JSON text (indentation, spacing)
        fingerprint identically once parsed."""
        rng = Random(3)
        for _ in range(_N_EXAMPLES):
            resolved = _criteria(rng)
            pretty = json.loads(json.dumps(asdict(resolved), indent=4))
            spaced = json.loads(json.dumps(asdict(resolved), separators=(" ,  ", " :   ")))
            assert config_fingerprint(ResolvedProjectEvaluator(**pretty)) == config_fingerprint(
                resolved
            )
            assert config_fingerprint(ResolvedProjectEvaluator(**spaced)) == config_fingerprint(
                resolved
            )

    def test_any_field_change_changes_fingerprint(self) -> None:
        """Every fingerprint input is load-bearing: mutating any single field yields a
        different fingerprint."""
        rng = Random(4)
        for _ in range(_N_EXAMPLES // 10):
            resolved = _criteria(rng)
            mutations = [
                replace(resolved, project_evaluator_id=resolved.project_evaluator_id + 1),
                replace(resolved, name=resolved.name + "x"),
                replace(resolved, evaluator_id=resolved.evaluator_id + 1),
                replace(resolved, version_ref=[resolved.version_ref, "bumped"]),
                replace(resolved, output_configs=[resolved.output_configs, "bumped"]),
                replace(resolved, input_mapping={"bumped": resolved.input_mapping}),
                replace(
                    resolved,
                    evaluation_target=("SPAN" if resolved.evaluation_target != "SPAN" else "TRACE"),
                ),
                replace(resolved, sandbox_config_id=(resolved.sandbox_config_id or 0) + 1),
                replace(resolved, filter_condition=resolved.filter_condition + " "),
                replace(resolved, sampling_rate=resolved.sampling_rate / 2 + 0.25),
            ]
            fingerprints = {config_fingerprint(m) for m in mutations}
            fingerprints.add(config_fingerprint(resolved))
            assert len(fingerprints) == len(mutations) + 1

    def test_golden_vector(self) -> None:
        """Pins the exact canonicalization recipe; producer/consumer fingerprint
        agreement depends on these bytes never changing silently."""
        resolved = ResolvedProjectEvaluator(
            project_evaluator_id=7,
            name="toxicity",
            evaluator_id=42,
            version_ref=1301,
            output_configs=[
                {
                    "name": "toxicity",
                    "values": [
                        {"label": "toxic", "score": 0.0},
                        {"label": "non-toxic", "score": 1.0},
                    ],
                }
            ],
            input_mapping={"input": "metadata.attributes.llm.input_messages"},
            evaluation_target="SPAN",
            sandbox_config_id=None,
            filter_condition="span_kind == 'LLM'",
            sampling_rate=0.25,
        )
        assert (
            config_fingerprint(resolved)
            == "1deed348252eb69b468359d01f0f46e3e43946b573ec067bc499740e415e3b9f"
        )


def _continuous_evaluator(**config: Any) -> ResolvedProjectEvaluator:
    return ResolvedProjectEvaluator(
        project_evaluator_id=5,
        name="fixed-helpfulness",
        evaluator_id=9,
        version_ref=[3, "monty:1"],
        output_configs=[
            {
                "name": "fixed-helpfulness",
                "type": "CONTINUOUS",
                "optimization_direction": "MAXIMIZE",
                "lower_bound": 0.0,
                "upper_bound": 10.0,
                **config,
            }
        ],
        input_mapping={"output": "output.messages"},
        evaluation_target="SPAN",
        sandbox_config_id=3,
        filter_condition="",
        sampling_rate=1.0,
    )


class TestContinuousThresholdLeavesFingerprintAlone:
    """A continuous output's threshold changes no score or label, so it must not
    start a new annotation series (``online:<fingerprint>``)."""

    # The fingerprint of the evaluator above before thresholds existed.
    _GOLDEN = "439c16930850a473119204243417068e389ad8589cca4ec7fbf8d5482b9a50ef"

    def test_unset_threshold_keeps_the_pre_threshold_fingerprint(self) -> None:
        assert config_fingerprint(_continuous_evaluator()) == self._GOLDEN

    @pytest.mark.parametrize("threshold", [7.0, 2.5, None])
    def test_setting_moving_or_clearing_the_threshold_keeps_it(
        self, threshold: Optional[float]
    ) -> None:
        assert config_fingerprint(_continuous_evaluator(threshold=threshold)) == self._GOLDEN

    def test_enum_typed_dumps_are_handled(self) -> None:
        resolved = _continuous_evaluator(threshold=7.0)
        config = dict(resolved.output_configs[0])
        config["type"] = AnnotationType.CONTINUOUS
        config["optimization_direction"] = OptimizationDirection.MAXIMIZE
        assert config_fingerprint(replace(resolved, output_configs=[config])) == self._GOLDEN

    def test_bounds_still_change_it(self) -> None:
        assert config_fingerprint(_continuous_evaluator(upper_bound=5.0)) != self._GOLDEN

    def test_other_kinds_keep_their_threshold_fields(self) -> None:
        # Only continuous thresholds are display-only; a freeform config's
        # leftover thresholds field is hashed as it always was.
        freeform = replace(
            _continuous_evaluator(),
            output_configs=[{"name": "x", "type": "FREEFORM", "thresholds": [0.5]}],
        )
        moved = replace(
            freeform, output_configs=[{"name": "x", "type": "FREEFORM", "thresholds": [0.6]}]
        )
        assert config_fingerprint(freeform) != config_fingerprint(moved)

    def test_decision_fingerprint_is_unchanged(self) -> None:
        # A predicate's threshold rides on its derived output in memory only; it
        # reaches the fingerprint through the scoring policy in version_ref.
        policy = DecisionScoringPolicy(
            questions={
                "addresses_request": PredicateScoring(
                    type="predicate",
                    threshold=0.8,
                    optimization_direction=OptimizationDirection.MAXIMIZE,
                )
            }
        )
        question = PredicateQuestion(
            type="predicate", name="addresses_request", instructions="Does it?"
        )
        dumped = [
            config.model_dump() for config in derive_decision_output_configs([question], policy)
        ]
        assert "threshold" not in dumped[0]
        version_ref = [13, policy.model_dump(mode="json")]
        current = replace(_continuous_evaluator(), version_ref=version_ref, output_configs=dumped)
        with_threshold = [{**dumped[0], "threshold": 0.8}]
        assert config_fingerprint(current) == config_fingerprint(
            replace(current, output_configs=with_threshold)
        )
        moved_policy = DecisionScoringPolicy(
            questions={
                "addresses_request": PredicateScoring(
                    type="predicate",
                    threshold=0.6,
                    optimization_direction=OptimizationDirection.MAXIMIZE,
                )
            }
        )
        # Moving a predicate's threshold rescoring its answers still starts a new series.
        assert config_fingerprint(current) != config_fingerprint(
            replace(current, version_ref=[13, moved_policy.model_dump(mode="json")])
        )

    def test_fingerprinted_output_config_passes_non_dicts_through(self) -> None:
        assert fingerprinted_output_config("bumped") == "bumped"
        assert fingerprinted_output_config({"type": "CONTINUOUS", "threshold": 1}) == {
            "type": "CONTINUOUS"
        }


class TestAnnotationIdentifier:
    def test_prefix_length_and_suffix(self) -> None:
        rng = Random(5)
        for _ in range(_N_EXAMPLES):
            fingerprint = config_fingerprint(_criteria(rng))
            identifier = annotation_identifier(fingerprint)
            assert identifier.startswith("online:")
            assert len(identifier) == len("online:") + 16
            assert identifier == "online:" + fingerprint[:16]

    def test_deterministic(self) -> None:
        rng = Random(6)
        for _ in range(_N_EXAMPLES):
            fingerprint = config_fingerprint(_criteria(rng))
            assert annotation_identifier(fingerprint) == annotation_identifier(fingerprint)


class TestSampleKey:
    def test_range_and_determinism(self) -> None:
        rng = Random(7)
        span_ids = [rng.randint(0, 2**63) for _ in range(_N_EXAMPLES)] + _EDGE_SPAN_IDS
        for span_id in span_ids:
            key = sample_key(span_id)
            assert 0.0 <= key < 1.0
            assert key == sample_key(span_id)

    def test_nested_threshold_subset(self) -> None:
        """For thresholds lo <= hi, the lo-sampled span set is a subset of the
        hi-sampled set — sampling groups nest for free on the shared unsalted key."""
        span_ids = range(1, 1001)
        sampled_20 = {s for s in span_ids if sample_key(s) < 0.2}
        sampled_60 = {s for s in span_ids if sample_key(s) < 0.6}
        assert sampled_20 <= sampled_60
        rng = Random(8)
        for _ in range(_N_EXAMPLES):
            lo, hi = sorted((rng.random(), rng.random()))
            lo_set = {s for s in span_ids if sample_key(s) < lo}
            hi_set = {s for s in span_ids if sample_key(s) < hi}
            assert lo_set <= hi_set

    def test_roughly_uniform(self) -> None:
        """Keys over sequential span ids spread across [0,1) rather than clustering —
        guards against a recipe change that quietly shrinks the effective range."""
        keys = [sample_key(s) for s in range(2000)]
        below_half = sum(1 for k in keys if k < 0.5) / len(keys)
        assert 0.45 < below_half < 0.55
        deciles = {int(k * 10) for k in keys}
        assert deciles == set(range(10))
