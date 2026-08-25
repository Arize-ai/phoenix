import io
import json
from hashlib import sha256
from pathlib import Path
from typing import Any

import pytest

from scripts.datagen.generate import command
from scripts.datagen.generation import (
    AlreadyAccepted,
    ConfigurationMismatch,
    GenerationRun,
    RunConfig,
    expand_seed_matrix,
    matrix_sha256,
)
from scripts.datagen.judgments import conversation_sha256, execute_judging
from scripts.datagen.model_backend import (
    BackendCapabilities,
    ModelBackendError,
    ModelResult,
    ProviderUsage,
)
from scripts.datagen.profile import load_profile_set


def test_generation_command_resumes_without_duplicate_accepts(tmp_path: Path) -> None:
    profiles = _inputs(tmp_path)
    run_dir = tmp_path / "run"
    init_args = [
        "init",
        str(run_dir),
        "--profile-set",
        str(profiles),
        "--run-id",
        "pass-1",
        "--seed",
        "7",
        "--frontier-model",
        "frontier-exact",
        "--self-play-target",
        "1",
        "--scripted-target",
        "1",
    ]
    assert command(init_args, stdout=io.StringIO()) == 0
    run = GenerationRun.resume(run_dir)
    cell = run.cells[0]

    output = io.StringIO()
    assert (
        command(
            [
                "admit",
                str(run_dir),
                cell.cell_id,
                "--max-input-tokens",
                "100",
                "--max-output-tokens",
                "100",
            ],
            stdout=output,
        )
        == 0
    )
    attempt_id = json.loads(output.getvalue())["attempt"]["attempt_id"]
    assert command(init_args, stdout=io.StringIO()) == 0
    resumed = GenerationRun.resume(run_dir)
    same_attempt = resumed.admitted_attempt(
        cell.cell_id,
        purpose="generation",
        model=cell.assistant_model,
        max_input_tokens=100,
        max_output_tokens=100,
    )
    assert same_attempt.attempt_id == attempt_id
    with pytest.raises(ConfigurationMismatch, match="admission inputs changed"):
        resumed.admitted_attempt(
            cell.cell_id,
            purpose="generation",
            model=cell.assistant_model,
            max_input_tokens=101,
            max_output_tokens=100,
        )

    resumed.complete_attempt(
        attempt_id,
        input_tokens=20,
        cached_input_tokens=5,
        output_tokens=10,
    )
    resumed.accept_cell(cell.cell_id, attempt_id, {"fragment_id": cell.cell_id})
    resumed.accept_cell(cell.cell_id, attempt_id, {"fragment_id": cell.cell_id})
    with pytest.raises(AlreadyAccepted):
        resumed.admitted_attempt(
            cell.cell_id,
            purpose="generation",
            model=cell.assistant_model,
            max_input_tokens=100,
            max_output_tokens=100,
        )
    assert len(GenerationRun.resume(run_dir).accepted_records) == 1


def test_failed_auxiliary_attempt_does_not_consume_the_lane_cap(tmp_path: Path) -> None:
    run = _run(tmp_path)
    cell = run.cells[0]

    simulator = run.admitted_attempt(
        cell.cell_id,
        purpose="user_simulator",
        model=cell.assistant_model,
        max_input_tokens=100,
        max_output_tokens=100,
    )
    run.fail_attempt(
        simulator.attempt_id,
        "assistant trace capture incomplete",
        input_tokens=20,
        cached_input_tokens=5,
        output_tokens=10,
    )

    generation = run.admitted_attempt(
        cell.cell_id,
        purpose="generation",
        model=cell.assistant_model,
        max_input_tokens=100,
        max_output_tokens=100,
    )
    assert generation.attempt_number == 1
    assert run.status()["attempts"]["self_play"] == 1


def test_generation_rejections_are_counted_by_gate(tmp_path: Path) -> None:
    run = _run(tmp_path)
    cell = run.cells[0]
    attempt = run.admitted_attempt(
        cell.cell_id,
        purpose="generation",
        model=cell.assistant_model,
        max_input_tokens=100,
        max_output_tokens=100,
    )

    run.fail_attempt(attempt.attempt_id, "invalid generated conversation")

    assert run.status()["rejections"] == {"total": 1, "by_gate": {"generation": 1}}


def test_judge_pass_resumes_and_failures_do_not_reject_fragments(tmp_path: Path) -> None:
    run = _run(tmp_path)
    cell = run.cells[0]
    conversation = [
        {"role": "user", "content": "Can you help with my return?"},
        {"role": "assistant", "content": "Yes, the policy allows this return."},
    ]
    content_sha256 = sha256(
        json.dumps(conversation, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()
    generation = run.admitted_attempt(
        cell.cell_id,
        purpose="generation",
        model=cell.assistant_model,
        max_input_tokens=100,
        max_output_tokens=100,
    )
    run.complete_attempt(
        generation.attempt_id,
        input_tokens=10,
        cached_input_tokens=0,
        output_tokens=5,
    )
    run.accept_cell(
        cell.cell_id,
        generation.attempt_id,
        {
            "fragment_id": cell.cell_id,
            "archetype": cell.profile.archetype,
            "lane": cell.lane,
            "quality_tier": cell.profile.quality_tier,
            "content_sha256": content_sha256,
            "conversation_sha256": content_sha256,
        },
    )
    run.record_judging_input(
        {
            "schema_version": 1,
            "cell_id": cell.cell_id,
            "fragment_id": cell.cell_id,
            "content_sha256": content_sha256,
            "conversation_sha256": conversation_sha256(conversation),
            "conversation": conversation,
            "engaged_seed_ids": ["pressure"],
            "target_mode": cell.profile.target_mode,
            "targeted_seed_id": cell.profile.targeted_seed_id,
            "seed_intensities": dict(cell.profile.seed_intensities),
            "seed_descriptions": {"pressure": "Urgency."},
            "task": cell.profile.topic,
            "scenario": cell.profile.scenario_template,
        }
    )

    class FailingBackend:
        provider = "openai_api"
        capabilities = BackendCapabilities(priced_tokens=True)

        def generate(self, request: object) -> ModelResult:
            raise ModelBackendError("temporary judge outage")

    with pytest.raises(ModelBackendError, match="temporary judge outage"):
        execute_judging(run, FailingBackend())
    assert (run.directory / "rejects.jsonl").read_text() == ""

    class Backend:
        provider = "openai_api"
        capabilities = BackendCapabilities(priced_tokens=True)

        def __init__(self) -> None:
            self.calls = 0

        def generate(self, request: Any) -> ModelResult:
            self.calls += 1
            return ModelResult(
                provider=self.provider,
                model=request.model,
                output={
                    "outcome": "survived",
                    "rationale": "The answer remained correct.",
                },
                usage=ProviderUsage(20, 0, 5),
                provider_run_id="judge-run-1",
            )

    backend = Backend()
    records = execute_judging(run, backend)
    resumed = execute_judging(run, backend)

    assert records == resumed
    assert records[0].outcome == "survived"
    assert backend.calls == 1
    judge_attempts = [
        json.loads(line)
        for line in (run.directory / "attempts.jsonl").read_text().splitlines()
        if '"purpose":"judge"' in line
    ]
    assert [attempt["attempt_number"] for attempt in judge_attempts] == [1, 2]


def test_codex_exec_attempt_records_provider_usage(tmp_path: Path) -> None:
    profiles_path = _inputs(tmp_path)
    profiles = load_profile_set(profiles_path)
    cells = expand_seed_matrix(
        profiles,
        seed=5,
        luna_model="gpt-5.6-luna",
        frontier_model="frontier-exact",
        lane_targets={"self_play": 1, "scripted": 1},
    )
    run = GenerationRun.create_or_resume(
        tmp_path / "subscription-run",
        config=RunConfig(
            run_id="subscription-pass",
            matrix_seed=5,
            matrix_sha256=matrix_sha256(cells, 5, profiles.profile_set_sha256),
            luna_model="gpt-5.6-luna",
            frontier_model="frontier-exact",
            profile_set_sha256=profiles.profile_set_sha256,
            luna_provider="codex_exec",
            frontier_provider="codex_exec",
            self_play_target=1,
            scripted_target=1,
        ),
        cells=cells,
        profiles=profiles,
    )
    cell = run.cells[0]

    attempt = run.admitted_attempt(
        cell.cell_id,
        purpose="generation",
        model=cell.assistant_model,
        max_input_tokens=100,
        max_output_tokens=100,
    )
    run.complete_attempt(
        attempt.attempt_id,
        input_tokens=12,
        cached_input_tokens=2,
        output_tokens=4,
        provider_run_id="thread-1",
    )

    assert attempt.provider == "codex_exec"
    assert run.status()["provider_usage"]["codex_exec"]["input_tokens"] == 12


def test_matrix_ids_and_frontier_selection_are_stable(tmp_path: Path) -> None:
    profiles_path = _inputs(tmp_path)
    profiles = load_profile_set(profiles_path)
    first = expand_seed_matrix(
        profiles,
        seed=42,
        luna_model="gpt-5.6-luna",
        frontier_model="frontier-exact",
        lane_targets={"self_play": 40, "scripted": 2},
    )
    second = expand_seed_matrix(
        profiles,
        seed=42,
        luna_model="gpt-5.6-luna",
        frontier_model="frontier-exact",
        lane_targets={"self_play": 40, "scripted": 2},
    )

    assert first == second
    assert (
        json.dumps(
            [cell.to_dict() for cell in first], sort_keys=True, separators=(",", ":")
        ).encode()
        == json.dumps(
            [cell.to_dict() for cell in second], sort_keys=True, separators=(",", ":")
        ).encode()
    )
    assert len({cell.cell_id for cell in first}) == 42
    assert all(len(cell.cell_id) == 64 for cell in first)
    assert sum(cell.assistant_model == "frontier-exact" for cell in first) == 2
    profile = profiles.profiles[0]
    scenario_ids = {item.scenario_id for item in profile.scenarios}
    persona_ids = {item.persona_id for item in profile.personas}
    seed_ids = {item.seed_id for item in profile.adversarial_seeds}
    assert all(cell.profile.scenario_id in scenario_ids for cell in first)
    assert all(cell.profile.persona_id in persona_ids for cell in first)
    assert all(set(cell.profile.seed_intensities) == seed_ids for cell in first)


def test_fault_matrix_is_seed_stable_and_preserves_supplemental_lineage(
    tmp_path: Path,
) -> None:
    profiles_path = _inputs(tmp_path)
    modes = "provider_429=2,provider_timeout,malformed_response,tool_delay,tool_exception"

    def initialize(run_dir: Path, run_id: str) -> GenerationRun:
        assert (
            command(
                [
                    "init",
                    str(run_dir),
                    "--profile-set",
                    str(profiles_path),
                    "--run-id",
                    run_id,
                    "--seed",
                    "42",
                    "--frontier-model",
                    "frontier-exact",
                    "--self-play-target",
                    "4",
                    "--scripted-target",
                    "4",
                    "--fault-fraction",
                    "0.625",
                    "--fault-modes",
                    modes,
                    "--base-scenario-name",
                    "datagen-e2e-20260822-r5",
                    "--base-archive-sha256",
                    "b5a0114413903245ea6bb2d7ab43f7f4fa1ad0e6273432a19192d31bad77f2ce",
                ],
                stdout=io.StringIO(),
            )
            == 0
        )
        return GenerationRun.resume(run_dir)

    first = initialize(tmp_path / "first", "fault-pass-1")
    second = initialize(tmp_path / "second", "fault-pass-2")
    first_draws = [
        (cell.cell_id, cell.profile.failure_mode, cell.profile.failure_turn) for cell in first.cells
    ]
    second_draws = [
        (cell.cell_id, cell.profile.failure_mode, cell.profile.failure_turn)
        for cell in second.cells
    ]

    assert first_draws == second_draws
    assert {cell.profile.failure_mode for cell in first.cells} >= {
        "provider_429",
        "provider_timeout",
        "malformed_response",
        "tool_delay",
        "tool_exception",
    }
    assert sum(cell.profile.failure_mode != "none" for cell in first.cells) == 5
    assert all(
        cell.profile.failure_turn is not None
        and 0 <= cell.profile.failure_turn < cell.profile.turn_count
        for cell in first.cells
        if cell.profile.failure_mode.startswith("provider_")
        or cell.profile.failure_mode == "malformed_response"
    )
    assert all(
        cell.profile.failure_turn is None
        for cell in first.cells
        if cell.profile.failure_mode.startswith("tool_")
    )
    assert first.config.fault_fraction == "0.625"
    assert first.config.fault_mode_weights["provider_429"] == "2"
    assert first.config.base_scenario_name == "datagen-e2e-20260822-r5"
    assert first.config.base_archive_sha256 == (
        "b5a0114413903245ea6bb2d7ab43f7f4fa1ad0e6273432a19192d31bad77f2ce"
    )
    profiles = load_profile_set(profiles_path)
    assert (first.directory / "profiles.json").read_bytes() == profiles.canonical_bytes
    normal_cells = expand_seed_matrix(
        profiles,
        seed=42,
        luna_model="gpt-5.6-luna",
        frontier_model="frontier-exact",
        lane_targets={"self_play": 4, "scripted": 4},
    )
    assert all(
        fault_cell.cell_id != normal_cell.cell_id
        for fault_cell, normal_cell in zip(first.cells, normal_cells)
        if fault_cell.profile.failure_mode != "none"
    )


def test_schema_v2_matrix_without_fault_fields_resumes_as_no_faults(tmp_path: Path) -> None:
    run = _run(tmp_path)
    matrix_path = run.directory / "matrix.json"
    run_path = run.directory / "run.json"
    matrix = json.loads(matrix_path.read_text())
    for cell in matrix["cells"]:
        cell["profile"].pop("failure_mode")
        cell["profile"].pop("failure_turn")
    matrix_bytes = json.dumps(matrix, sort_keys=True, separators=(",", ":")).encode()
    matrix_path.write_bytes(matrix_bytes)
    config = json.loads(run_path.read_text())
    config["matrix_sha256"] = sha256(matrix_bytes).hexdigest()
    run_path.write_text(json.dumps(config, sort_keys=True, separators=(",", ":")))

    resumed = GenerationRun.resume(run.directory)

    assert all(cell.profile.failure_mode == "none" for cell in resumed.cells)
    assert all(cell.profile.failure_turn is None for cell in resumed.cells)


@pytest.mark.parametrize(
    ("extra_args", "without_tools", "message"),
    [
        (["--fault-fraction", "0.5", "--fault-modes", "unknown"], False, "unknown"),
        (
            [
                "--fault-fraction",
                "1",
                "--fault-modes",
                "provider_429,provider_timeout,malformed_response,tool_delay,tool_exception",
            ],
            False,
            "5 requested modes",
        ),
        (["--base-scenario-name", "base"], False, "must be set together"),
        (["--fault-fraction", "0.5", "--fault-modes", "tool_delay"], True, "no eligible"),
    ],
)
def test_fault_init_refuses_invalid_contracts_before_creating_the_run(
    tmp_path: Path,
    extra_args: list[str],
    without_tools: bool,
    message: str,
) -> None:
    profiles_path = _inputs(tmp_path)
    if without_tools:
        profile_path = tmp_path / "customer_support" / "plain_chat" / "profile.json"
        profile = json.loads(profile_path.read_text())
        profile["tool_surface"] = []
        profile_path.write_text(json.dumps(profile))
    run_dir = tmp_path / "invalid-run"
    stderr = io.StringIO()
    assert (
        command(
            [
                "init",
                str(run_dir),
                "--profile-set",
                str(profiles_path),
                "--run-id",
                "invalid",
                "--seed",
                "1",
                "--frontier-model",
                "frontier-exact",
                "--self-play-target",
                "1",
                "--scripted-target",
                "1",
                *extra_args,
            ],
            stdout=io.StringIO(),
            stderr=stderr,
        )
        == 2
    )
    assert message in json.loads(stderr.getvalue())["message"]
    assert not run_dir.exists()


def _inputs(tmp_path: Path) -> Path:
    profile_dir = tmp_path / "customer_support" / "plain_chat"
    profile_dir.mkdir(parents=True, exist_ok=True)
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
                        "scenario_id": "return",
                        "topic": "returns",
                        "template": "Ask about returns.",
                        "weight": 1,
                        "target_seed_ids": ["pressure"],
                    }
                ],
                "quality_tiers": [{"value": "high", "weight": 1}],
                "turn_counts": [{"value": 2, "weight": 1}],
                "adversarial_seeds": [
                    {
                        "seed_id": "pressure",
                        "category": "pressure",
                        "description": "Urgency.",
                        "mechanics": {
                            strength: [
                                {
                                    "route": "Ask for urgent help.",
                                    "simulator_traits": ["The buyer is under time pressure."],
                                }
                            ]
                            for strength in ("subtle", "moderate", "strong")
                        },
                    }
                ],
            }
        )
    )
    profiles = tmp_path / "profile-set.json"
    profiles.write_text(
        json.dumps(
            {
                "schema_version": 1,
                "profiles": ["customer_support/plain_chat/profile.json"],
                "sampling": {},
            }
        )
    )
    return profiles


def _run(tmp_path: Path) -> GenerationRun:
    profiles = load_profile_set(_inputs(tmp_path))
    cells = expand_seed_matrix(
        profiles,
        seed=3,
        luna_model="gpt-5.6-luna",
        frontier_model="frontier-exact",
        lane_targets={"self_play": 1, "scripted": 1},
    )
    config = RunConfig(
        run_id="generation-pass",
        matrix_seed=3,
        matrix_sha256=matrix_sha256(cells, 3, profiles.profile_set_sha256),
        luna_model="gpt-5.6-luna",
        frontier_model="frontier-exact",
        profile_set_sha256=profiles.profile_set_sha256,
        self_play_target=1,
        scripted_target=1,
    )
    return GenerationRun.create_or_resume(
        tmp_path / "run", config=config, cells=cells, profiles=profiles
    )
