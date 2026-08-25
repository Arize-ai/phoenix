import base64
import io
import json
import tarfile
from hashlib import sha256
from pathlib import Path
from typing import Any, Mapping

import pytest

from phoenix.datagen import load_scenario
from phoenix.datagen.schema import validate_fragment_v2
from scripts.datagen.bank import (
    BankError,
    merge_v2_banks,
    package_generation_run,
    read_v2_bank,
)
from scripts.datagen.bank import (
    command as bank_command,
)
from scripts.datagen.generation import (
    GenerationRun,
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
from scripts.datagen.publish import validate_archive
from scripts.datagen.quality import (
    NORMALIZER_VERSION,
    VALIDITY_VERSION,
    QualityGate,
    select_judge_routes,
)


def test_quality_gate_accepts_cross_archetype_and_packages_raw_requests(
    tmp_path: Path,
) -> None:
    run = _generation_run(
        tmp_path,
        base_scenario_name="datagen-e2e-20260822-r5",
        base_archive_sha256=("b5a0114413903245ea6bb2d7ab43f7f4fa1ad0e6273432a19192d31bad77f2ce"),
    )
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
            max_input_tokens=10,
            max_output_tokens=10,
        )
        stage = run.directory / "staging" / cell.cell_id / "attempt-1"
        (stage / "traces.jsonl").write_bytes(staged_traces[index])
        run.complete_attempt(
            attempt.attempt_id,
            input_tokens=1,
            cached_input_tokens=0,
            output_tokens=1,
        )
        candidate = _candidate(cell.cell_id, archetype, cell.lane, trace_ids[index])
        if index == 1:
            candidate["failure_mode"] = "provider_timeout"
        outcome = gate.evaluate(candidate, messages)
        assert outcome.accepted
        assert outcome.fragment is not None
        assert outcome.fragment["quality_results"]["validity"] == {
            "accepted": True,
            "version": VALIDITY_VERSION,
        }
        run.accept_cell(cell.cell_id, attempt.attempt_id, outcome.fragment)
        accepted.append(outcome.fragment)

    assert accepted[0]["content_sha256"] == accepted[1]["content_sha256"]
    _judge(run, accepted, messages)
    archive = tmp_path / "quality-bank.tar.gz"
    output = io.StringIO()
    assert (
        bank_command(
            [
                "package",
                str(run.directory),
                "--archive",
                str(archive),
                "--scenario-name",
                "quality-bank",
                "--generated-at",
                "2026-08-21T00:00:00Z",
                "--generation-revision",
                "test-revision",
                "--instrumenter-package",
                "fake-instrumenter=1.0.0",
            ],
            stdout=output,
        )
        == 0
    )
    assert json.loads(output.getvalue())["fragment_count"] == 2
    bank = read_v2_bank(archive)

    assert bank.traces_bytes == b"".join(staged_traces)
    quality_summary = bank.manifest["quality_gate_summary"]
    assert quality_summary["supplemental_lineage"] == {
        "base_scenario_name": "datagen-e2e-20260822-r5",
        "base_archive_sha256": ("b5a0114413903245ea6bb2d7ab43f7f4fa1ad0e6273432a19192d31bad77f2ce"),
    }
    summary = quality_summary["judged_outcome"]
    assert summary["routes"]["fault"] == 1
    assert summary["judged"] == 2
    assert summary["unjudged"] == 0
    assert summary["outcomes"]["survived"] == 2
    assert all("judged_outcome" in fragment.quality_results for fragment in bank.fragments)
    fault_fragment = next(
        fragment for fragment in bank.fragments if fragment.failure_mode != "none"
    )
    assert fault_fragment.quality_results["judged_outcome"]["failure_mode"] == "provider_timeout"
    assert fault_fragment.quality_results["judged_outcome"]["route_reason"] == "fault"
    assert fault_fragment.quality_results["judged_outcome"]["outcome"] == "survived"
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


def test_merge_v2_banks_rebuilds_and_loads_the_combined_archive(tmp_path: Path) -> None:
    base = _fixture_bank_archive(tmp_path, "base-source", scenario_name="base-bank")
    base_digest = sha256(base.read_bytes()).hexdigest()
    supplement = _fixture_bank_archive(
        tmp_path,
        "supplement-source",
        scenario_name="supplement-bank",
        trace_byte_offset=0x10,
        fragment_ids=("d" * 64, "f" * 64),
        matrix_sha256_value="f" * 64,
        rejected_by_gate={"generation": 2, "validity": 1},
        fault_count=1,
        instrumenter_version="2.0.0",
        additional_instrumenter_versions={"supplement-recorder": "2.0.0"},
        supplemental_lineage={
            "base_scenario_name": "base-bank",
            "base_archive_sha256": base_digest,
        },
    )
    merged = tmp_path / "base-bank.tar.gz"
    output = io.StringIO()

    assert (
        bank_command(
            [
                "merge",
                "--base",
                str(base),
                "--supplement",
                str(supplement),
                "--archive",
                str(merged),
            ],
            stdout=output,
        )
        == 0
    )

    package_document = json.loads(output.getvalue())
    assert package_document["fragment_count"] == 4
    assert package_document["trace_count"] == 6
    bank = read_v2_bank(merged)
    summary = bank.manifest["quality_gate_summary"]
    assert bank.manifest["scenario_name"] == "base-bank"
    assert bank.manifest["matrix_seed"] == 7
    assert bank.manifest["matrix_sha256"] != "e" * 64
    assert bank.manifest["fragment_count"] == 4
    assert bank.manifest["trace_count"] == 6
    assert bank.manifest["span_count"] == 8
    assert bank.manifest["instrumenter_package_versions"] == {"synthetic": "1.0.0"}
    assert summary["accepted"] == 4
    assert summary["rejected"] == 4
    assert summary["rejected_by_gate"] == {"generation": 3, "validity": 1}
    assert summary["judged_outcome"]["routes"]["fault"] == 1
    assert summary["judged_outcome"]["outcomes"]["survived"] == 2
    assert summary["merge_lineage"]["base"]["archive_sha256"] == base_digest
    assert summary["merge_lineage"]["base"]["instrumenter_package_versions"] == {
        "synthetic": "1.0.0"
    }
    assert summary["merge_lineage"]["supplement"]["instrumenter_package_versions"] == {
        "supplement-recorder": "2.0.0",
        "synthetic": "2.0.0",
    }
    assert (
        summary["merge_lineage"]["supplement"]["archive_sha256"]
        == sha256(supplement.read_bytes()).hexdigest()
    )
    assert sum(fragment.failure_mode != "none" for fragment in bank.fragments) == 1
    assert validate_archive(merged, asset_schema_version=2).fragment_count == 4

    extracted = tmp_path / "loaded" / "base-bank"
    extracted.mkdir(parents=True)
    with tarfile.open(merged, "r:gz") as contents:
        for filename in ("manifest.json", "fragments.jsonl", "traces.jsonl"):
            member = contents.extractfile(f"base-bank/{filename}")
            assert member is not None
            (extracted / filename).write_bytes(member.read())
    scenario = load_scenario(extracted)
    assert len(scenario.fragments) == 4
    assert len(scenario.requests_by_trace_id) == 6
    with tarfile.open(merged, "r:gz") as contents:
        assert sorted(member.name for member in contents.getmembers()) == [
            "base-bank/fragments.jsonl",
            "base-bank/manifest.json",
            "base-bank/traces.jsonl",
        ]


@pytest.mark.parametrize(
    ("trace_byte_offset", "fragment_ids", "instrumenter_version", "sample_fraction", "match"),
    [
        (0x10, ("a" * 64, "b" * 64), "1.0.0", 0.05, "duplicate fragment IDs"),
        (0, ("d" * 64, "f" * 64), "1.0.0", 0.05, "duplicate trace IDs"),
        (0x10, ("d" * 64, "f" * 64), "1.0.0", 0.10, "judge_sample_fraction"),
    ],
    ids=("fragment-id", "trace-id", "quality-settings"),
)
def test_merge_v2_banks_rejects_cross_bank_identity_or_configuration(
    tmp_path: Path,
    trace_byte_offset: int,
    fragment_ids: tuple[str, str],
    instrumenter_version: str,
    sample_fraction: float,
    match: str,
) -> None:
    base = _fixture_bank_archive(tmp_path, "base-source", scenario_name="base-bank")
    base_digest = sha256(base.read_bytes()).hexdigest()
    supplement = _fixture_bank_archive(
        tmp_path,
        "supplement-source",
        scenario_name="supplement-bank",
        trace_byte_offset=trace_byte_offset,
        fragment_ids=fragment_ids,
        matrix_sha256_value="f" * 64,
        instrumenter_version=instrumenter_version,
        judge_sample_fraction=sample_fraction,
        supplemental_lineage={
            "base_scenario_name": "base-bank",
            "base_archive_sha256": base_digest,
        },
    )

    with pytest.raises(BankError, match=match):
        merge_v2_banks(base, supplement, tmp_path / "base-bank.tar.gz")


def test_merge_v2_banks_requires_the_exact_declared_base(tmp_path: Path) -> None:
    base = _fixture_bank_archive(tmp_path, "base-source", scenario_name="base-bank")
    supplement = _fixture_bank_archive(
        tmp_path,
        "supplement-source",
        scenario_name="supplement-bank",
        trace_byte_offset=0x10,
        fragment_ids=("d" * 64, "f" * 64),
        matrix_sha256_value="f" * 64,
        supplemental_lineage={
            "base_scenario_name": "base-bank",
            "base_archive_sha256": "0" * 64,
        },
    )

    with pytest.raises(BankError, match="base archive SHA-256"):
        merge_v2_banks(base, supplement, tmp_path / "base-bank.tar.gz")


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


@pytest.mark.parametrize(
    ("messages", "reason"),
    [
        (
            [
                {"role": "user", "content": "Can you help with this order?"},
                {"role": "assistant", "content": "assistant"},
            ],
            "bare role name",
        ),
        (
            [
                {"role": "user", "content": "Can you help with this order?"},
                {"role": "assistant", "content": " \n\t"},
            ],
            "whitespace-only",
        ),
        (
            [
                {"role": "user", "content": "First request."},
                {"role": "user", "content": "Second request."},
                {"role": "assistant", "content": "One response."},
            ],
            "cannot follow",
        ),
        (
            [
                {
                    "role": "user",
                    "content": "I'll reconcile the requested totals and return a clean bridge.",
                },
                {
                    "role": "assistant",
                    "content": "Please reconcile Q2 revenue and explain the differences.",
                },
            ],
            "assistant voice",
        ),
    ],
    ids=("bare-role-name", "whitespace-only", "broken-alternation", "role-inversion"),
)
def test_validity_gate_rejects_structural_corruption(
    tmp_path: Path, messages: list[Mapping[str, Any]], reason: str
) -> None:
    run = _generation_run(tmp_path)
    gate = QualityGate(rejects_path=run.directory / "rejects.jsonl")

    outcome = gate.evaluate(_candidate("a" * 64, "plain_chat", "self_play", ["a" * 32]), messages)

    assert not outcome.accepted
    assert outcome.reject is not None
    assert outcome.reject.gate == "validity"
    assert reason in outcome.reject.reason
    assert run.status()["rejections"] == {"total": 1, "by_gate": {"validity": 1}}


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

    fragments[2]["failure_mode"] = "tool_exception"
    fault_routes = select_judge_routes(
        fragments,
        proximate_fragment_ids={"fragment-0", "fragment-1", "fragment-2"},
        seed=11,
    )
    assert fault_routes["fragment-2"] == "fault"


def test_legacy_bad_tier_remains_readable_in_schema_v2() -> None:
    fragment = _candidate("a" * 64, "plain_chat", "scripted", ["b" * 32])
    fragment.update(
        quality_tier="deliberately_bad",
        content_sha256="c" * 64,
        quality_results={},
    )

    assert validate_fragment_v2(fragment).quality_tier == "deliberately_bad"


def _fixture_bank_archive(
    tmp_path: Path,
    archive_id: str,
    *,
    scenario_name: str,
    trace_byte_offset: int = 0,
    fragment_ids: tuple[str, str] = ("a" * 64, "b" * 64),
    matrix_sha256_value: str = "e" * 64,
    instrumenter_version: str = "1.0.0",
    additional_instrumenter_versions: Mapping[str, str] | None = None,
    judge_sample_fraction: float = 0.05,
    rejected_by_gate: Mapping[str, int] | None = None,
    fault_count: int = 0,
    supplemental_lineage: Mapping[str, str] | None = None,
) -> Path:
    rejected_by_gate = rejected_by_gate or {"generation": 1}
    fixture = Path(__file__).parent / "fixtures" / "fragment_bank"
    fragments = [
        json.loads(line) for line in (fixture / "fragments.jsonl").read_text().splitlines()
    ]
    traces = (fixture / "traces.jsonl").read_bytes()
    for index, fragment in enumerate(fragments, start=1):
        fragment["fragment_id"] = fragment_ids[index - 1]
        remapped_trace_ids = []
        for trace_id in fragment["trace_ids"]:
            old_bytes = bytes.fromhex(trace_id)
            new_bytes = bytes([old_bytes[0] + trace_byte_offset]) * len(old_bytes)
            traces = traces.replace(base64.b64encode(old_bytes), base64.b64encode(new_bytes))
            remapped_trace_ids.append(new_bytes.hex())
        fragment["trace_ids"] = remapped_trace_ids
    if fault_count:
        fragments[0]["failure_mode"] = "provider_timeout"
        fragments[0]["quality_results"]["judged_outcome"] = {
            "failure_mode": "provider_timeout",
            "route_reason": "fault",
            "outcome": "survived",
        }
    fragments_bytes = b"".join(
        json.dumps(fragment, sort_keys=True, separators=(",", ":")).encode() + b"\n"
        for fragment in fragments
    )
    quality_summary: dict[str, Any] = {
        "accepted": len(fragments),
        "rejected": sum(rejected_by_gate.values()),
        "rejected_by_gate": dict(rejected_by_gate),
        "normalizer_version": NORMALIZER_VERSION,
        "dedup_thresholds": {"short": 0.9, "long": 0.82},
        "judge_sample_fraction": judge_sample_fraction,
        "judged_outcome": {
            "routes": {
                "fault": fault_count,
                "trap_proximity": 0,
                "baseline": 1 - fault_count,
                "not_selected": 1,
            },
            "judged": 1,
            "unjudged": 1,
            "outcomes": {"survived": 1, "degraded": 0, "failed": 0},
            "judge_failures": 0,
        },
    }
    if supplemental_lineage is not None:
        quality_summary["supplemental_lineage"] = dict(supplemental_lineage)
    manifest = json.loads((fixture / "manifest.json").read_text())
    manifest.update(
        scenario_name=scenario_name,
        matrix_sha256=matrix_sha256_value,
        instrumenter_package_versions={
            "synthetic": instrumenter_version,
            **(additional_instrumenter_versions or {}),
        },
        quality_gate_summary=quality_summary,
        files={
            "fragments.jsonl": {
                "sha256": sha256(fragments_bytes).hexdigest(),
                "size_bytes": len(fragments_bytes),
            },
            "traces.jsonl": {
                "sha256": sha256(traces).hexdigest(),
                "size_bytes": len(traces),
            },
        },
    )
    files = {
        "manifest.json": json.dumps(manifest, sort_keys=True, separators=(",", ":")).encode()
        + b"\n",
        "fragments.jsonl": fragments_bytes,
        "traces.jsonl": traces,
    }
    archive = tmp_path / f"{archive_id}.tar.gz"
    with tarfile.open(archive, "w:gz") as contents:
        for filename, content in files.items():
            member = tarfile.TarInfo(f"{scenario_name}/{filename}")
            member.size = len(content)
            contents.addfile(member, io.BytesIO(content))
    return archive


def _generation_run(
    tmp_path: Path,
    *,
    base_scenario_name: str | None = None,
    base_archive_sha256: str | None = None,
) -> GenerationRun:
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
            profile_set_sha256=profiles.profile_set_sha256,
            self_play_target=1,
            scripted_target=1,
            base_scenario_name=base_scenario_name,
            base_archive_sha256=base_archive_sha256,
        ),
        cells=cells,
        profiles=profiles,
    )
    return run


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
                "failure_mode": fragment["failure_mode"],
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

    execute_judging(run, Backend())
