import json
from pathlib import Path

import pytest

from scripts.datagen.profile import (
    ProfileValidationError,
    load_profile_set,
    load_profile_snapshot,
)


def test_profile_set_loads_canonical_snapshot(tmp_path: Path) -> None:
    manifest = _write_profile_set(tmp_path)

    loaded = load_profile_set(manifest)

    assert loaded.profiles[0].profile_id == "customer_support/plain_chat"
    assert loaded.sampling["targeted_cell_fraction"] == 0.1
    assert loaded.profile_set_sha256 == load_profile_snapshot(loaded.canonical_bytes).profile_set_sha256
    assert json.loads(loaded.canonical_bytes)["profiles"][0]["scenarios"][0]["target_seed_ids"] == ["pressure-1"]


@pytest.mark.parametrize(
    ("mutate", "message"),
    [
        (lambda manifest, profile: manifest.update(profiles=["../profile.json"]), "traverse"),
        (
            lambda manifest, profile: manifest.update(profiles=manifest["profiles"] * 2),
            "profiles must not contain duplicates",
        ),
        (lambda manifest, profile: profile.update(profile_id="coding_agent/plain_chat"), "profile_id"),
        (
            lambda manifest, profile: profile.update(
                domain="coding_agent", profile_id="coding_agent/plain_chat"
            ),
            "does not match identity",
        ),
        (lambda manifest, profile: profile["personas"][0].update(weight=0), "greater than zero"),
        (lambda manifest, profile: profile["scenarios"][0].update(target_seed_ids=["other"]), "unknown profile seeds"),
    ],
)
def test_profile_set_rejects_invalid_contract(tmp_path: Path, mutate: object, message: str) -> None:
    manifest_path = _write_profile_set(tmp_path)
    manifest = json.loads(manifest_path.read_text())
    profile_path = tmp_path / manifest["profiles"][0]
    profile = json.loads(profile_path.read_text())
    mutate(manifest, profile)  # type: ignore[operator]
    manifest_path.write_text(json.dumps(manifest))
    profile_path.write_text(json.dumps(profile))

    with pytest.raises(ProfileValidationError, match=message):
        load_profile_set(manifest_path)


def _write_profile_set(root: Path) -> Path:
    profile_dir = root / "customer_support" / "plain_chat"
    profile_dir.mkdir(parents=True)
    profile = {
        "schema_version": 1,
        "profile_id": "customer_support/plain_chat",
        "domain": "customer_support",
        "archetype": "plain_chat",
        "tool_surface": ["lookup_order"],
        "corpus_documents": [{"document_id": "returns", "path": "returns.md"}],
        "personas": [{"persona_id": "buyer", "instructions": "Ask concise questions.", "weight": 1}],
        "registers": [{"value": "neutral", "weight": 1}],
        "scenarios": [{"scenario_id": "return", "topic": "returns", "template": "Ask about a return.", "weight": 1, "target_seed_ids": ["pressure-1"]}],
        "quality_tiers": [{"value": "high", "weight": 1}],
        "turn_counts": [{"value": 2, "weight": 1}],
        "adversarial_seeds": [{"seed_id": "pressure-1", "category": "pressure", "description": "Urgency may distort behavior."}],
    }
    (profile_dir / "profile.json").write_text(json.dumps(profile))
    (profile_dir / "returns.md").write_text("Returns are accepted within 30 days.")
    manifest = root / "profile-set.json"
    manifest.write_text(json.dumps({"schema_version": 1, "profiles": ["customer_support/plain_chat/profile.json"], "sampling": {}}))
    return manifest
