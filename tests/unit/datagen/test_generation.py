import io
import json
from pathlib import Path
from typing import Any

import pytest

from scripts.datagen.generate import command
from scripts.datagen.generation import (
    AlreadyAccepted,
    ConfigurationMismatch,
    GenerationError,
    GenerationRun,
    PriceCatalog,
    RunConfig,
    expand_seed_matrix,
    matrix_sha256,
)
from scripts.datagen.openai_batch import (
    BATCH_COMPLETION_WINDOW,
    BatchRequest,
    OpenAIBatchAdapter,
    custom_id,
    usage_from_body,
)


def test_generation_command_resumes_without_duplicate_accepts(tmp_path: Path) -> None:
    factors, pricing = _inputs(tmp_path)
    run_dir = tmp_path / "run"
    init_args = [
        "init",
        str(run_dir),
        "--matrix-factors",
        str(factors),
        "--run-id",
        "pass-1",
        "--seed",
        "7",
        "--frontier-model",
        "frontier-exact",
        "--pricing",
        str(pricing),
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
                "--mode",
                "direct",
                "--max-input-tokens",
                "100",
                "--max-output-tokens",
                "100",
                "--pricing",
                str(pricing),
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
        mode="direct",
        max_input_tokens=100,
        max_output_tokens=100,
        prices=PriceCatalog.load(pricing),
    )
    assert same_attempt.attempt_id == attempt_id
    with pytest.raises(ConfigurationMismatch, match="admission inputs changed"):
        resumed.admitted_attempt(
            cell.cell_id,
            purpose="generation",
            model=cell.assistant_model,
            mode="direct",
            max_input_tokens=101,
            max_output_tokens=100,
            prices=PriceCatalog.load(pricing),
        )

    resumed.complete_attempt(
        attempt_id,
        prices=PriceCatalog.load(pricing),
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
            mode="direct",
            max_input_tokens=100,
            max_output_tokens=100,
            prices=PriceCatalog.load(pricing),
        )
    assert len(GenerationRun.resume(run_dir).accepted_records) == 1


def test_generation_command_reports_exact_budget_denial(tmp_path: Path) -> None:
    factors, pricing = _inputs(tmp_path)
    run_dir = tmp_path / "run"
    assert (
        command(
            [
                "init",
                str(run_dir),
                "--matrix-factors",
                str(factors),
                "--run-id",
                "small-budget",
                "--seed",
                "1",
                "--frontier-model",
                "frontier-exact",
                "--pricing",
                str(pricing),
                "--budget-usd",
                "0.001",
                "--self-play-target",
                "1",
                "--scripted-target",
                "1",
            ],
            stdout=io.StringIO(),
        )
        == 0
    )
    cell = GenerationRun.resume(run_dir).cells[1]
    error = io.StringIO()
    assert (
        command(
            [
                "admit",
                str(run_dir),
                cell.cell_id,
                "--mode",
                "batch",
                "--max-input-tokens",
                "2000",
                "--max-output-tokens",
                "2000",
                "--pricing",
                str(pricing),
            ],
            stdout=io.StringIO(),
            stderr=error,
        )
        == 2
    )
    failure = json.loads(error.getvalue())
    assert failure["error"] == "BudgetExceeded"
    status = GenerationRun.resume(run_dir).status()
    assert status["costs"]["spent_usd"] == "0E-9"
    assert status["costs"]["reserved_usd"] == "0E-9"
    assert status["exhausted"][-1]["kind"] == "budget"
    assert status["exhausted"][-1]["requested_usd"] == "0.001400000"


def test_reconciliation_blocks_run_when_usage_exceeds_admitted_envelope(tmp_path: Path) -> None:
    _, pricing = _inputs(tmp_path)
    run = _run(tmp_path, pricing)
    first, second = run.cells
    prices = PriceCatalog.load(pricing)
    attempt = run.admitted_attempt(
        first.cell_id,
        purpose="generation",
        model=first.assistant_model,
        mode="direct",
        max_input_tokens=100,
        max_output_tokens=100,
        prices=prices,
    )

    with pytest.raises(GenerationError, match="exceeds admitted token envelope"):
        run.complete_attempt(
            attempt.attempt_id,
            prices=prices,
            input_tokens=101,
            cached_input_tokens=0,
            output_tokens=100,
        )

    status = run.status()
    assert status["costs"]["available_usd"] == "0"
    assert status["exhausted"][-1]["kind"] == "cost_invariant"
    with pytest.raises(GenerationError, match="blocked by cost invariant violation"):
        run.admitted_attempt(
            second.cell_id,
            purpose="generation",
            model=second.assistant_model,
            mode="batch",
            max_input_tokens=100,
            max_output_tokens=100,
            prices=prices,
        )


def test_failed_auxiliary_attempt_counts_cost_without_consuming_lane_cap(tmp_path: Path) -> None:
    _, pricing = _inputs(tmp_path)
    run = _run(tmp_path, pricing)
    cell = run.cells[0]
    prices = PriceCatalog.load(pricing)

    simulator = run.admitted_attempt(
        cell.cell_id,
        purpose="user_simulator",
        model=cell.assistant_model,
        mode="direct",
        max_input_tokens=100,
        max_output_tokens=100,
        prices=prices,
    )
    run.fail_attempt(
        simulator.attempt_id,
        "assistant trace capture incomplete",
        prices=prices,
        input_tokens=20,
        cached_input_tokens=5,
        output_tokens=10,
    )

    generation = run.admitted_attempt(
        cell.cell_id,
        purpose="generation",
        model=cell.assistant_model,
        mode="direct",
        max_input_tokens=100,
        max_output_tokens=100,
        prices=prices,
    )
    assert generation.attempt_number == 1
    assert run.status()["attempts"]["self_play"] == 1
    assert run.cost_summary().spent_usd > 0


def test_matrix_ids_and_frontier_selection_are_stable() -> None:
    kwargs = {
        "seed": 42,
        "luna_model": "gpt-5.6-luna",
        "frontier_model": "frontier-exact",
        "lane_targets": {"self_play": 40, "scripted": 2},
    }
    first = expand_seed_matrix({"domain": ["retail", "travel"], "tone": ["formal"]}, **kwargs)
    second = expand_seed_matrix({"tone": ["formal"], "domain": ["retail", "travel"]}, **kwargs)

    assert first == second
    assert len({cell.cell_id for cell in first}) == 42
    assert all(len(cell.cell_id) == 64 for cell in first)
    assert sum(cell.assistant_model == "frontier-exact" for cell in first) == 2


def test_bundled_pricing_preserves_models_and_requires_frontier_price(tmp_path: Path) -> None:
    factors = tmp_path / "factors.json"
    factors.write_text(json.dumps({"domain": ["retail"]}))
    common = [
        "--matrix-factors",
        str(factors),
        "--seed",
        "1",
        "--self-play-target",
        "1",
        "--scripted-target",
        "1",
    ]
    assert (
        command(
            [
                "init",
                str(tmp_path / "luna-run"),
                "--run-id",
                "luna-run",
                "--frontier-model",
                "gpt-5.6-luna",
                *common,
            ],
            stdout=io.StringIO(),
        )
        == 0
    )
    error = io.StringIO()
    assert (
        command(
            [
                "init",
                str(tmp_path / "unknown-run"),
                "--run-id",
                "unknown-run",
                "--frontier-model",
                "frontier-without-price",
                *common,
            ],
            stdout=io.StringIO(),
            stderr=error,
        )
        == 2
    )
    assert "model substitution is disabled" in json.loads(error.getvalue())["message"]


def test_batch_adapter_persists_ids_and_correlates_fake_results(tmp_path: Path) -> None:
    run = _run(tmp_path)
    cell = run.cells[-1]
    identifier = custom_id(run.config.run_id, cell.cell_id, "script")
    client = _FakeClient(identifier)
    adapter = OpenAIBatchAdapter(client, run)
    assert run.batch_cells_to_submit([cell.cell_id], purpose="script") == (cell.cell_id,)

    job = adapter.submit(
        [
            BatchRequest(
                custom_id=identifier,
                endpoint="/v1/responses",
                body={"model": "gpt-5.6-luna", "input": "hello"},
            )
        ]
    )
    assert job["batch_id"] == "batch-1"
    assert client.create_batch_args == {
        "input_file_id": "file-input",
        "endpoint": "/v1/responses",
        "completion_window": BATCH_COMPLETION_WINDOW,
    }
    assert run.batch_cells_to_submit([cell.cell_id], purpose="script") == ()
    refreshed = adapter.refresh("batch-1")
    assert refreshed["status"] == "completed"
    assert run.batch_cells_to_submit([cell.cell_id], purpose="script") == (cell.cell_id,)
    result = adapter.results("batch-1")[0]
    assert result.custom_id == identifier
    assert result.succeeded
    assert usage_from_body(result.body or {}) == (12, 2, 5)
    assert run.latest_jobs["batch-1"]["output_file_id"] == "file-output"
    assert run.batch_cells_to_submit([cell.cell_id], purpose="script") == ()
    assert '"event":"result"' in (run.directory / "jobs.jsonl").read_text()


def _inputs(tmp_path: Path) -> tuple[Path, Path]:
    factors = tmp_path / "factors.json"
    factors.write_text(json.dumps({"domain": ["retail"], "archetype": ["plain_chat"]}))
    pricing = tmp_path / "pricing.json"
    pricing.write_text(
        json.dumps(
            {
                "schema_version": 1,
                "version": "test",
                "models": {
                    model: {
                        "input_per_million_usd": "0.20",
                        "cached_input_per_million_usd": "0.02",
                        "output_per_million_usd": "1.20",
                        "batch_multiplier": "0.50",
                    }
                    for model in ("gpt-5.6-luna", "frontier-exact")
                },
            }
        )
    )
    return factors, pricing


def _run(tmp_path: Path, pricing_path: Path | None = None) -> GenerationRun:
    if pricing_path is None:
        _, pricing_path = _inputs(tmp_path)
    prices = PriceCatalog.load(pricing_path)
    cells = expand_seed_matrix(
        {"domain": ["retail"]},
        seed=3,
        luna_model="gpt-5.6-luna",
        frontier_model="frontier-exact",
        lane_targets={"self_play": 1, "scripted": 1},
    )
    config = RunConfig(
        run_id="batch-pass",
        matrix_seed=3,
        matrix_sha256=matrix_sha256(cells, 3),
        luna_model="gpt-5.6-luna",
        frontier_model="frontier-exact",
        pricing_version="test",
        pricing_sha256=prices.sha256,
        self_play_target=1,
        scripted_target=1,
    )
    return GenerationRun.create_or_resume(tmp_path / "run", config=config, cells=cells)


class _FakeFiles:
    def __init__(self, custom_identifier: str) -> None:
        self.custom_identifier = custom_identifier
        self.uploaded = b""

    def create(self, *, file: Any, purpose: str) -> dict[str, str]:
        assert purpose == "batch"
        self.uploaded = file.read()
        return {"id": "file-input"}

    def content(self, file_id: str) -> bytes:
        assert file_id == "file-output"
        return (
            json.dumps(
                {
                    "custom_id": self.custom_identifier,
                    "response": {
                        "status_code": 200,
                        "request_id": "request-1",
                        "body": {
                            "usage": {
                                "input_tokens": 12,
                                "output_tokens": 5,
                                "input_tokens_details": {"cached_tokens": 2},
                            }
                        },
                    },
                    "error": None,
                }
            )
            + "\n"
        ).encode()


class _FakeBatches:
    def __init__(self) -> None:
        self.create_args: dict[str, str] = {}

    def create(self, **kwargs: str) -> dict[str, Any]:
        self.create_args = kwargs
        return {"id": "batch-1", "status": "validating", **kwargs}

    def retrieve(self, batch_id: str) -> dict[str, Any]:
        assert batch_id == "batch-1"
        return {
            "id": batch_id,
            "status": "completed",
            "output_file_id": "file-output",
            "request_counts": {"total": 1, "completed": 1, "failed": 0},
            "completed_at": 1,
        }


class _FakeClient:
    def __init__(self, custom_identifier: str) -> None:
        self.files = _FakeFiles(custom_identifier)
        self.batches = _FakeBatches()

    @property
    def create_batch_args(self) -> dict[str, str]:
        return self.batches.create_args
