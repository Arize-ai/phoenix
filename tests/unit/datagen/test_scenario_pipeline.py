import io
import json
import tarfile
from hashlib import sha256
from pathlib import Path
from typing import Any

from phoenix.datagen import load_scenario
from scripts.datagen.generation import GenerationRun
from scripts.datagen.judgments import JudgingInputV1, route_judging_inputs
from scripts.datagen.quality import QualityGate
from scripts.datagen.scenario import command as scenario_command


def test_scripts_produced_archive_loads_through_shipped_loader(
    tmp_path: Path, generation_run: GenerationRun
) -> None:
    run = generation_run
    cell = run.cells[0]
    traces = (
        (Path(__file__).parent / "fixtures" / "fragment_bank" / "traces.jsonl")
        .read_bytes()
        .splitlines(keepends=True)[0]
    )
    attempt = run.admitted_attempt(
        cell.cell_id,
        purpose="generation",
        model=cell.assistant_model,
        max_input_tokens=10,
        max_output_tokens=10,
    )
    stage = run.directory / "staging" / cell.cell_id / "attempt-1"
    (stage / "traces.jsonl").write_bytes(traces)
    run.complete_attempt(
        attempt.attempt_id,
        input_tokens=1,
        cached_input_tokens=0,
        output_tokens=1,
    )
    outcome = QualityGate().evaluate(
        _candidate(
            cell.cell_id,
            ["01010101010101010101010101010101"],
        ),
        [
            {"role": "user", "content": "Can you help with my account?"},
            {"role": "assistant", "content": "Yes, I can help with that."},
        ],
    )
    assert outcome.fragment is not None
    run.accept_cell(cell.cell_id, attempt.attempt_id, outcome.fragment)
    run.record_judgment(
        {
            "cell_id": cell.cell_id,
            "fragment_id": cell.cell_id,
            "failure_mode": "none",
            "route_reason": "not_selected",
            "attempt_id": None,
            "outcome": None,
            "rationale": None,
        }
    )
    archive = tmp_path / "scenario.tar.gz"
    assert (
        scenario_command(
            [
                "package",
                str(run.directory),
                "--archive",
                str(archive),
                "--scenario-name",
                "scenario-pipeline",
                "--generated-at",
                "2026-08-25T00:00:00Z",
                "--generation-revision",
                "test-revision",
                "--instrumenter-package",
                "fake-instrumenter=1.0.0",
            ],
            stdout=io.StringIO(),
        )
        == 0
    )

    extracted = tmp_path / "extracted"
    with tarfile.open(archive, "r:gz") as contents:
        for member in contents.getmembers():
            if not member.isfile():
                continue
            target = extracted / member.name
            target.parent.mkdir(parents=True, exist_ok=True)
            source = contents.extractfile(member)
            assert source is not None
            target.write_bytes(source.read())
    scenario = load_scenario(extracted / "scenario-pipeline")

    assert scenario.schema_version == 2
    assert len(scenario.fragments) == 1
    assert len(scenario.requests) == 1


def test_judging_inputs_route_at_the_wrapper_altitude() -> None:
    fragments = [
        _judged_fragment(
            f"fragment-{index}",
            quality_tier="high" if index % 2 else "standard",
            failure_mode="tool_exception" if index == 2 else "none",
        )
        for index in range(40)
    ]
    inputs = [
        _judging_input(
            fragment["fragment_id"],
            target_mode="targeted" if index == 0 else "ambient",
            targeted_seed_id="seed-a" if index == 0 else None,
            engaged_seed_ids=("seed-a",) if index == 1 else (),
            failure_mode=fragment["failure_mode"],
        )
        for index, fragment in enumerate(fragments)
    ]

    first = route_judging_inputs(inputs, fragments, seed=19)
    second = route_judging_inputs(inputs, fragments, seed=19)

    assert [route.route_reason for route in first] == [route.route_reason for route in second]
    reasons = {route.input.fragment_id: route.route_reason for route in first}
    assert reasons["fragment-0"] == "trap_proximity"
    assert reasons["fragment-1"] == "trap_proximity"
    assert reasons["fragment-2"] == "fault"
    assert sum(reason == "baseline" for reason in reasons.values()) == 2


def _candidate(fragment_id: str, trace_ids: list[str]) -> dict[str, Any]:
    return {
        "fragment_id": fragment_id,
        "archetype": "plain_chat",
        "domain": "support",
        "topic": "account setup",
        "scenario_template": "support_chat",
        "persona": "helpful specialist",
        "register": "friendly",
        "quality_tier": "standard",
        "failure_mode": "none",
        "length_band": "single_turn",
        "lane": "self_play",
        "models_used": [{"role": "assistant", "provider": "fake", "model": "fake-model"}],
        "turn_count": 1,
        "trace_ids": trace_ids,
    }


def _judging_input(
    fragment_id: str,
    *,
    target_mode: str,
    targeted_seed_id: str | None,
    engaged_seed_ids: tuple[str, ...],
    failure_mode: str,
) -> JudgingInputV1:
    conversation = (
        {"role": "user", "content": f"Question for {fragment_id}"},
        {"role": "assistant", "content": "A bounded answer."},
    )
    digest = sha256(
        json.dumps(conversation, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()
    return JudgingInputV1(
        cell_id=fragment_id,
        fragment_id=fragment_id,
        content_sha256=digest,
        conversation_sha256=digest,
        conversation=conversation,
        engaged_seed_ids=engaged_seed_ids,
        target_mode=target_mode,  # type: ignore[arg-type]
        targeted_seed_id=targeted_seed_id,
        seed_intensities={"seed-a": 0.2},
        seed_descriptions={"seed-a": "A test condition."},
        task="Help the user.",
        scenario="A support conversation.",
        failure_mode=failure_mode,
    )


def _judged_fragment(fragment_id: str, *, quality_tier: str, failure_mode: str) -> dict[str, Any]:
    return {
        "fragment_id": fragment_id,
        "archetype": "plain_chat",
        "lane": "self_play",
        "quality_tier": quality_tier,
        "failure_mode": failure_mode,
    }
