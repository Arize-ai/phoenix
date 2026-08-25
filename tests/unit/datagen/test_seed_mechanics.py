import json

from scripts.datagen.generation import MatrixCell, ProfileDraw
from scripts.datagen.profile import (
    AdversarialSeed,
    ApplicationProfileV1,
    CorpusDocument,
    CorpusEdit,
    SeedMechanics,
    SeedVariant,
)
from scripts.datagen.seed_mechanics import materialize_seed_environment


def test_materialization_is_deterministic_and_hides_seed_metadata() -> None:
    profile = _profile()
    cell = _cell()

    first = materialize_seed_environment(
        profile,
        cell,
        {"returns": "Returns are accepted within 30 days."},
        {"name": "orders"},
    )
    second = materialize_seed_environment(
        profile,
        cell,
        {"returns": "Returns are accepted within 30 days."},
        {"name": "orders"},
    )

    assert first == second
    assert first.documents["returns"] == "Returns are accepted within 21 days."
    assert first.route_context == "Ask whether the request can be completed before travel."
    visible = json.dumps(first.visible_dict(), sort_keys=True)
    assert "source_seed_id" not in visible
    assert "policy-window" not in visible
    assert "deadline" not in visible


def _profile() -> ApplicationProfileV1:
    corpus_levels = tuple(
        (
            SeedVariant(
                "Ask what policy applies to the purchase date.",
                (CorpusEdit("returns", "replace_once", source="30", replacement=days),),
                (),
                (),
            ),
        )
        for days in ("29", "21", "14")
    )
    pressure_variant = SeedVariant(
        "Ask whether the request can be completed before travel.",
        (),
        (),
        ("The buyer has upcoming travel and is attentive to timing.",),
    )
    return ApplicationProfileV1(
        profile_id="customer_support/plain_chat",
        domain="customer_support",
        archetype="plain_chat",
        tool_surface=("lookup_order",),
        corpus_documents=(CorpusDocument("returns", "returns.md"),),
        personas=(),
        registers=(),
        scenarios=(),
        quality_tiers=(),
        turn_counts=(),
        adversarial_seeds=(
            AdversarialSeed(
                "policy-window",
                "corpus",
                "The policy window varies.",
                SeedMechanics(*corpus_levels),
            ),
            AdversarialSeed(
                "deadline",
                "pressure",
                "The buyer has a deadline.",
                SeedMechanics(
                    (pressure_variant,),
                    (pressure_variant,),
                    (pressure_variant,),
                ),
            ),
        ),
        source_path="customer_support/plain_chat/profile.json",
    )


def _cell() -> MatrixCell:
    return MatrixCell(
        cell_id="self-play-000001-abc",
        lane="self_play",
        ordinal=1,
        profile=ProfileDraw(
            profile_id="customer_support/plain_chat",
            domain="customer_support",
            archetype="plain_chat",
            scenario_id="return",
            topic="returns",
            scenario_template="Ask about a return.",
            persona_id="buyer",
            persona_instructions="Ask concise questions.",
            register="neutral",
            quality_tier="high",
            turn_count=2,
            target_mode="targeted",
            targeted_seed_id="deadline",
            seed_intensities={"policy-window": 0.3, "deadline": 0.8},
        ),
        assistant_model="fake-model",
    )
