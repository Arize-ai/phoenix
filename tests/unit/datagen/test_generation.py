import io
import json
from hashlib import sha256
from pathlib import Path
from typing import Any

import pytest

from scripts.datagen.generate import command
from scripts.datagen.generation import AlreadyAccepted, GenerationRun, expand_seed_matrix
from scripts.datagen.judgments import conversation_sha256, execute_judging
from scripts.datagen.model_backend import (
    BackendCapabilities,
    ModelBackendError,
    ModelResult,
    ProviderUsage,
)
from scripts.datagen.profile import load_profile_set


def test_generation_command_resumes_without_duplicate_accepts(
    tmp_path: Path, profile_set_path: Path
) -> None:
    run_dir = tmp_path / "command-run"
    init_args = [
        "init",
        str(run_dir),
        "--profile-set",
        str(profile_set_path),
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
    cell = GenerationRun.resume(run_dir).cells[0]
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
        max_input_tokens=101,
        max_output_tokens=100,
    )
    assert same_attempt.attempt_id == attempt_id
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


def test_judge_pass_resumes_and_failures_do_not_reject_fragments(
    generation_run: GenerationRun,
) -> None:
    run = generation_run
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
                output={"outcome": "survived", "rationale": "The answer remained correct."},
                usage=ProviderUsage(20, 0, 5),
                provider_run_id="judge-run-1",
            )

    backend = Backend()
    records = execute_judging(run, backend)
    resumed = execute_judging(run, backend)

    assert records == resumed
    assert records[0].outcome == "survived"
    assert backend.calls == 1


def test_matrix_ids_and_frontier_selection_are_stable(profile_set_path: Path) -> None:
    profiles = load_profile_set(profile_set_path)
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
    assert len({cell.cell_id for cell in first}) == 42
    assert all(len(cell.cell_id) == 64 for cell in first)
    assert sum(cell.assistant_model == "frontier-exact" for cell in first) == 2


def test_fault_matrix_is_seed_stable_and_preserves_supplemental_lineage(
    tmp_path: Path, profile_set_path: Path
) -> None:
    modes = "provider_429=2,provider_timeout,malformed_response,tool_delay,tool_exception"

    def initialize(run_dir: Path, run_id: str) -> GenerationRun:
        assert (
            command(
                [
                    "init",
                    str(run_dir),
                    "--profile-set",
                    str(profile_set_path),
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
    assert [
        (cell.cell_id, cell.profile.failure_mode, cell.profile.failure_turn) for cell in first.cells
    ] == [
        (cell.cell_id, cell.profile.failure_mode, cell.profile.failure_turn)
        for cell in second.cells
    ]
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
    assert first.config.base_scenario_name == "datagen-e2e-20260822-r5"
    assert first.config.base_archive_sha256 == (
        "b5a0114413903245ea6bb2d7ab43f7f4fa1ad0e6273432a19192d31bad77f2ce"
    )
