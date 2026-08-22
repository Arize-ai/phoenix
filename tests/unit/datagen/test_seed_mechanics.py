import json

import pytest

from scripts.datagen.generation import MatrixCell, ProfileDraw
from scripts.datagen.profile import (
    AdversarialSeed,
    ApplicationProfileV1,
    CorpusDocument,
    CorpusEdit,
    SeedMechanics,
    SeedVariant,
    ToolPatchOperation,
    ToolResultOverlay,
)
from scripts.datagen.seed_mechanics import SeedMechanicsError, materialize_seed_environment


@pytest.mark.parametrize(
    ("intensity", "expected"),
    [(0.0, "29"), (0.199, "29"), (0.2, "21"), (0.499, "21"), (0.5, "14"), (1.0, "14")],
)
def test_materialization_uses_stable_strength_boundaries(intensity: float, expected: str) -> None:
    profile = _profile()
    cell = _cell(
        target_mode="ambient",
        targeted_seed_id=None,
        intensities={"policy-window": intensity, "deadline": intensity},
    )

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
    assert first.documents["returns"] == f"Returns are accepted within {expected} days."
    assert first.route_context is None


def test_targeting_exposes_only_the_selected_route() -> None:
    profile = _profile()
    intensities = {"policy-window": 0.3, "deadline": 0.8}
    ambient = materialize_seed_environment(
        profile,
        _cell(target_mode="ambient", targeted_seed_id=None, intensities=intensities),
        {"returns": "Returns are accepted within 30 days."},
        {"name": "orders"},
    )
    targeted = materialize_seed_environment(
        profile,
        _cell(target_mode="targeted", targeted_seed_id="deadline", intensities=intensities),
        {"returns": "Returns are accepted within 30 days."},
        {"name": "orders"},
    )

    assert ambient.documents == targeted.documents
    assert ambient.tool_result_overlays == targeted.tool_result_overlays
    assert ambient.simulator_traits == targeted.simulator_traits
    assert targeted.route_context == "Ask whether the request can be completed before travel."
    projection = json.dumps(targeted.visible_dict(), sort_keys=True)
    assert "policy-window" not in projection
    assert "deadline" not in projection
    assert "intensit" not in projection


def test_materialization_rejects_conflicting_tool_paths() -> None:
    overlay = ToolResultOverlay(
        "lookup_order",
        {},
        (ToolPatchOperation("replace", "/status", "processing"),),
    )
    variant = SeedVariant("Ask for the latest status.", (), (overlay,), ())
    mechanics = SeedMechanics((variant,), (variant,), (variant,))
    base = _profile()
    profile = ApplicationProfileV1(
        **{
            **base.__dict__,
            "adversarial_seeds": (
                AdversarialSeed("tool-a", "tool_data", "First overlay.", mechanics),
                AdversarialSeed("tool-b", "tool_data", "Second overlay.", mechanics),
            ),
        }
    )
    cell = _cell(
        target_mode="ambient",
        targeted_seed_id=None,
        intensities={"tool-a": 0.1, "tool-b": 0.1},
    )

    with pytest.raises(SeedMechanicsError, match="collide"):
        materialize_seed_environment(
            profile,
            cell,
            {"returns": "Returns are accepted within 30 days."},
            {"name": "orders"},
        )


def test_materialization_requires_the_complete_intensity_map() -> None:
    with pytest.raises(SeedMechanicsError, match="exactly"):
        materialize_seed_environment(
            _profile(),
            _cell(
                target_mode="ambient",
                targeted_seed_id=None,
                intensities={"policy-window": 0.1},
            ),
            {"returns": "Returns are accepted within 30 days."},
            {"name": "orders"},
        )


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


def _cell(
    *,
    target_mode: str,
    targeted_seed_id: str | None,
    intensities: dict[str, float],
) -> MatrixCell:
    return MatrixCell(
        cell_id="self_play-000001-abc",
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
            target_mode=target_mode,  # type: ignore[arg-type]
            targeted_seed_id=targeted_seed_id,
            seed_intensities=intensities,
        ),
        assistant_model="fake-model",
    )
