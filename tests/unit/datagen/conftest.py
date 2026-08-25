"""Shared fixtures for generation-side datagen tests."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts.datagen.generation import (  # noqa: E402
    GenerationRun,
    RunConfig,
    expand_seed_matrix,
    matrix_sha256,
)
from scripts.datagen.profile import load_profile_set  # noqa: E402


@pytest.fixture
def profile_set_path(tmp_path: Path) -> Path:
    profile_dir = tmp_path / "profiles" / "customer_support" / "plain_chat"
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
                "personas": [{"persona_id": "buyer", "instructions": "Ask for help.", "weight": 1}],
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
        ),
        encoding="utf-8",
    )
    manifest = profile_dir.parents[1] / "profile-set.json"
    manifest.write_text(
        json.dumps(
            {
                "schema_version": 1,
                "profiles": ["customer_support/plain_chat/profile.json"],
                "sampling": {},
            }
        ),
        encoding="utf-8",
    )
    return manifest


@pytest.fixture
def generation_run(tmp_path: Path, profile_set_path: Path) -> GenerationRun:
    profiles = load_profile_set(profile_set_path)
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
