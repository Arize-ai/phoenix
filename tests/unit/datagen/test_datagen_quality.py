import json
import tarfile
from decimal import Decimal
from pathlib import Path
from typing import Any, Mapping

import pytest
from phoenix.datagen.schema import validate_fragment_v2

from scripts.datagen.bank import BankError, package_generation_run, read_v2_bank
from scripts.datagen.generation import (
    GenerationRun,
    ModelPrice,
    PriceCatalog,
    RunConfig,
    expand_seed_matrix,
    matrix_sha256,
)
from scripts.datagen.judgments import conversation_sha256, execute_judging
from scripts.datagen.model_backend import (
    BackendCapabilities,
    ModelResult,
    ProviderUsage,
)
from scripts.datagen.profile import load_profile_set
from scripts.datagen.quality import NORMALIZER_VERSION, QualityGate, select_judge_routes


def test_quality_gate_accepts_cross_archetype_and_packages_raw_requests(
    tmp_path: Path,
) -> None:
    run, prices = _generation_run(tmp_path)
    fixture = Path(__file__).parent / "fixtures" / "fragment_bank" / "traces.jsonl"
    trace_lines = fixture.read_bytes().splitlines(keepends=True)
    staged_traces = (trace_lines[0] + trace_lines[2], trace_lines[1])
    trace_ids = (
        ["01010101010101010101010101010101", "03030303030303030303030303030303"],
        ["02020202020202020202020202020202"],
    )
    messages: list[Mapping[str, Any]] = [
        {"role": "system", "content": "Do not include this prompt."},
        {"role": "user", "content": "Ａccount   help"},
        {
            "role": "assistant",
            "content": [{"type": "text", "text": "Sure"}],
            "tool_schema": {"must_not": "affect content identity"},
        },
    ]
    gate = QualityGate(rejects_path=run.directory / "rejects.jsonl")
    accepted = []
    for index, (cell, archetype) in enumerate(zip(run.cells, ("plain_chat", "rag"))):
        attempt = run.admitted_attempt(
            cell.cell_id,
            purpose="generation",
            model=cell.assistant_model,
            mode="direct",
            max_input_tokens=10,
            max_output_tokens=10,
            prices=prices,
        )
        stage = run.directory / "staging" / cell.cell_id / "attempt-1"
        (stage / "traces.jsonl").write_bytes(staged_traces[index])
        run.complete_attempt(
            attempt.attempt_id,
            prices=prices,
            input_tokens=1,
            cached_input_tokens=0,
            output_tokens=1,
        )
        outcome = gate.evaluate(
            _candidate(cell.cell_id, archetype, cell.lane, trace_ids[index]), messages
        )
        assert outcome.accepted
        assert outcome.fragment is not None
        run.accept_cell(cell.cell_id, attempt.attempt_id, outcome.fragment)
        accepted.append(outcome.fragment)

    assert accepted[0]["content_sha256"] == accepted[1]["content_sha256"]
    _judge(run, prices, accepted, messages)
    archive = tmp_path / "quality-bank.tar.gz"
    package = package_generation_run(
        run.directory,
        archive,
        scenario_name="quality-bank",
        generated_at="2026-08-21T00:00:00Z",
        generation_revision="test-revision",
        instrumenter_package_versions={"fake-instrumenter": "1.0.0"},
    )
    bank = read_v2_bank(archive)

    assert bank.traces_bytes == b"".join(staged_traces)
    summary = package.manifest["quality_gate_summary"]["judged_outcome"]
    assert summary["judged"] == 1
    assert summary["unjudged"] == 1
    assert summary["outcomes"]["survived"] == 1
    assert all("judged_outcome" in fragment.quality_results for fragment in bank.fragments)
    with tarfile.open(archive, "r:gz") as contents:
        assert sorted(member.name for member in contents.getmembers()) == [
            "quality-bank/fragments.jsonl",
            "quality-bank/manifest.json",
            "quality-bank/traces.jsonl",
        ]

    baseline_gate = QualityGate.from_baseline_bank(archive)
    duplicate = baseline_gate.evaluate(
        _candidate("f" * 64, "plain_chat", "self_play", ["f" * 32]), messages
    )
    assert duplicate.reject is not None
    assert duplicate.reject.reason == "exact_duplicate"
    assert duplicate.reject.matched_fragment_id == run.cells[0].cell_id

    published = archive.read_bytes()
    malformed = json.loads(trace_lines[0])
    malformed["unknownRecorderField"] = True
    first_stage = run.directory / "staging" / run.cells[0].cell_id / "attempt-1" / "traces.jsonl"
    first_stage.write_text(json.dumps(malformed) + "\n")
    with pytest.raises(BankError, match="ExportTraceServiceRequest protobuf JSON"):
        package_generation_run(
            run.directory,
            archive,
            scenario_name="quality-bank",
            generated_at="2026-08-21T00:00:00Z",
            generation_revision="test-revision",
            instrumenter_package_versions={"fake-instrumenter": "1.0.0"},
        )
    assert archive.read_bytes() == published


def test_short_fragment_jaccard_threshold_is_inclusive(tmp_path: Path) -> None:
    gate = QualityGate(rejects_path=tmp_path / "rejects.jsonl")
    user = " ".join(f"token{index}" for index in range(32))
    base = gate.evaluate(
        _candidate("a" * 64, "plain_chat", "self_play", ["a" * 32]),
        [
            {"role": "user", "content": user},
            {"role": "assistant", "content": "answer one"},
        ],
    )
    rejected = gate.evaluate(
        _candidate("b" * 64, "plain_chat", "self_play", ["b" * 32]),
        [
            {"role": "user", "content": user},
            {"role": "assistant", "content": "answer two"},
        ],
    )
    accepted = gate.evaluate(
        _candidate("c" * 64, "plain_chat", "self_play", ["c" * 32]),
        [
            {"role": "user", "content": user},
            {"role": "assistant", "content": "different response now"},
        ],
    )

    assert base.accepted
    assert rejected.reject is not None
    assert rejected.reject.reason == "near_duplicate"
    assert rejected.reject.score is not None and rejected.reject.score >= 0.90
    assert rejected.reject.threshold == 0.90
    assert accepted.accepted
    persisted = json.loads((tmp_path / "rejects.jsonl").read_text())
    assert persisted == rejected.reject.to_dict()
    assert persisted["normalizer_version"] == NORMALIZER_VERSION


def test_judge_routes_sample_only_the_non_proximate_remainder() -> None:
    fragments = [
        _candidate(f"fragment-{index}", "plain_chat", "self_play", [f"{index:032x}"])
        for index in range(40)
    ]
    routes = select_judge_routes(
        fragments,
        proximate_fragment_ids={"fragment-0", "fragment-1"},
        seed=11,
    )

    assert routes["fragment-0"] == "trap_proximity"
    assert routes["fragment-1"] == "trap_proximity"
    assert sum(reason == "baseline" for reason in routes.values()) == 2


def test_legacy_bad_tier_remains_readable_in_schema_v2() -> None:
    fragment = _candidate("a" * 64, "plain_chat", "scripted", ["b" * 32])
    fragment.update(
        quality_tier="deliberately_bad",
        content_sha256="c" * 64,
        quality_results={},
    )

    assert validate_fragment_v2(fragment).quality_tier == "deliberately_bad"


def _generation_run(tmp_path: Path) -> tuple[GenerationRun, PriceCatalog]:
    profile_dir = tmp_path / "customer_support" / "plain_chat"
    profile_dir.mkdir(parents=True)
    (profile_dir / "profile.json").write_text(
        json.dumps(
            {
                "schema_version": 1,
                "profile_id": "customer_support/plain_chat",
                "domain": "customer_support",
                "archetype": "plain_chat",
                "tool_surface": ["lookup_order"],
                "corpus_documents": [],
                "personas": [
                    {
                        "persona_id": "buyer",
                        "instructions": "Ask for help.",
                        "weight": 1,
                    }
                ],
                "registers": [{"value": "neutral", "weight": 1}],
                "scenarios": [
                    {
                        "scenario_id": "setup",
                        "topic": "account setup",
                        "template": "Ask for help.",
                        "weight": 1,
                        "target_seed_ids": [],
                    }
                ],
                "quality_tiers": [{"value": "high", "weight": 1}],
                "turn_counts": [{"value": 2, "weight": 1}],
                "adversarial_seeds": [],
            }
        )
    )
    manifest = tmp_path / "profile-set.json"
    manifest.write_text(
        json.dumps(
            {
                "schema_version": 1,
                "profiles": ["customer_support/plain_chat/profile.json"],
                "sampling": {},
            }
        )
    )
    profiles = load_profile_set(manifest)
    cells = expand_seed_matrix(
        profiles,
        seed=7,
        luna_model="fake-model",
        frontier_model="fake-model",
        lane_targets={"self_play": 1, "scripted": 1},
    )
    digest = matrix_sha256(cells, 7, profiles.profile_set_sha256)
    run = GenerationRun.create_or_resume(
        tmp_path / "run",
        config=RunConfig(
            run_id="quality-test",
            matrix_seed=7,
            matrix_sha256=digest,
            luna_model="fake-model",
            frontier_model="fake-model",
            pricing_version="fake-v1",
            pricing_sha256="0" * 64,
            profile_set_sha256=profiles.profile_set_sha256,
            self_play_target=1,
            scripted_target=1,
        ),
        cells=cells,
        profiles=profiles,
    )
    price = ModelPrice(
        input_per_million_usd=Decimal("0.1"),
        cached_input_per_million_usd=Decimal("0.01"),
        output_per_million_usd=Decimal("0.2"),
        batch_multiplier=Decimal("0.5"),
    )
    return run, PriceCatalog("fake-v1", {"fake-model": price}, sha256_digest="0" * 64)


def _candidate(
    fragment_id: str,
    archetype: str,
    lane: str,
    trace_ids: list[str],
) -> dict[str, Any]:
    return {
        "fragment_id": fragment_id,
        "archetype": archetype,
        "domain": "support",
        "topic": "account setup",
        "scenario_template": "support_chat",
        "persona": "helpful specialist",
        "register": "friendly",
        "quality_tier": "standard",
        "failure_mode": "none",
        "length_band": "single_turn",
        "lane": lane,
        "models_used": [{"role": "assistant", "provider": "fake", "model": "fake-model"}],
        "turn_count": 1,
        "trace_ids": trace_ids,
    }


def _judge(
    run: GenerationRun,
    prices: PriceCatalog,
    accepted: list[Mapping[str, Any]],
    messages: list[Mapping[str, Any]],
) -> None:
    visible = [message for message in messages if message.get("role") != "system"]
    visible_sha256 = conversation_sha256(visible)
    for cell, fragment in zip(run.cells, accepted):
        run.record_judging_input(
            {
                "schema_version": 1,
                "cell_id": cell.cell_id,
                "fragment_id": cell.cell_id,
                "content_sha256": fragment["content_sha256"],
                "conversation_sha256": visible_sha256,
                "conversation": visible,
                "engaged_seed_ids": [],
                "target_mode": "ambient",
                "targeted_seed_id": None,
                "seed_intensities": {},
                "seed_descriptions": {},
                "task": cell.profile.topic,
                "scenario": cell.profile.scenario_template,
            }
        )

    class Backend:
        provider = "openai_api"
        capabilities = BackendCapabilities(priced_tokens=True)

        def generate(self, request: Any) -> ModelResult:
            return ModelResult(
                provider=self.provider,
                model=request.model,
                output={
                    "outcome": "survived",
                    "rationale": "The response remained useful.",
                },
                usage=ProviderUsage(10, 0, 4),
            )

    execute_judging(run, Backend(), prices=prices)
