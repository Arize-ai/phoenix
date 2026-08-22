import json
from hashlib import sha256
from typing import Any

import pytest

from scripts.datagen.judgments import (
    JudgingInputV1,
    JudgmentContractV1,
    JudgmentError,
    route_judging_inputs,
)


def test_contract_routes_proximity_and_remainder_deterministically() -> None:
    fragments = [_fragment(f"fragment-{index}", quality_tier="high" if index % 2 else "standard") for index in range(40)]
    inputs = [
        _input(
            fragment["fragment_id"],
            target_mode="targeted" if index == 0 else "ambient",
            targeted_seed_id="seed-a" if index == 0 else None,
            engaged_seed_ids=("seed-a",) if index == 1 else (),
        )
        for index, fragment in enumerate(fragments)
    ]

    first = route_judging_inputs(inputs, fragments, seed=19)
    second = route_judging_inputs(inputs, fragments, seed=19)

    assert [route.route_reason for route in first] == [route.route_reason for route in second]
    reasons = {route.input.fragment_id: route.route_reason for route in first}
    assert reasons["fragment-0"] == "trap_proximity"
    assert reasons["fragment-1"] == "trap_proximity"
    assert sum(reason == "baseline" for reason in reasons.values()) == 2

    request = JudgmentContractV1.build_request(first[0], model="frontier-exact")
    assert request.purpose == "judge"
    assert "<judging_input>" in request.prompt
    assert all(label in request.prompt for label in ("survived", "degraded", "failed"))
    assert request.output_schema["additionalProperties"] is False
    assert JudgmentContractV1.parse(
        {"outcome": "degraded", "rationale": "The answer needed a bounded correction."}
    ).outcome == "degraded"
    with pytest.raises(JudgmentError, match="exactly"):
        JudgmentContractV1.parse(
            {"outcome": "survived", "rationale": "Usable.", "confidence": 0.9}
        )


def test_ambient_proximity_requires_a_complete_resolvable_signal() -> None:
    complete_empty = _input("fragment-empty", engaged_seed_ids=())
    missing = _input("fragment-missing", engaged_seed_ids=None)

    assert complete_empty.seed_proximity is False
    assert complete_empty.proximity_source == "complete_empty"
    with pytest.raises(JudgmentError, match="missing engagement signal"):
        _ = missing.seed_proximity
    with pytest.raises(JudgmentError, match="unknown seed IDs"):
        _input("fragment-unknown", engaged_seed_ids=("unknown",))
    with pytest.raises(JudgmentError, match="digest"):
        JudgingInputV1(
            cell_id="fragment-digest",
            fragment_id="fragment-digest",
            content_sha256="0" * 64,
            conversation_sha256="0" * 64,
            conversation=({"role": "user", "content": "hello"},),
            engaged_seed_ids=(),
            target_mode="ambient",
            targeted_seed_id=None,
            seed_intensities={"seed-a": 0.2},
            seed_descriptions={"seed-a": "A test condition."},
            task="Help the user.",
            scenario="A support conversation.",
        )


def _input(
    fragment_id: str,
    *,
    target_mode: str = "ambient",
    targeted_seed_id: str | None = None,
    engaged_seed_ids: tuple[str, ...] | None = (),
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
    )


def _fragment(fragment_id: str, *, quality_tier: str) -> dict[str, Any]:
    return {
        "fragment_id": fragment_id,
        "archetype": "plain_chat",
        "lane": "self_play",
        "quality_tier": quality_tier,
    }
