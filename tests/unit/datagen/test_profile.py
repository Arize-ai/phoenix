import json
from pathlib import Path

from scripts.datagen.profile import load_profile_set, load_profile_snapshot


def test_profile_set_loads_snapshot(profile_set_path: Path) -> None:
    loaded = load_profile_set(profile_set_path)
    reformatted = json.dumps(json.loads(loaded.canonical_bytes), indent=2).encode()
    snapshot = load_profile_snapshot(reformatted)

    assert loaded.profiles[0].profile_id == "customer_support/plain_chat"
    assert snapshot.profiles == loaded.profiles
    assert json.loads(snapshot.canonical_bytes) == json.loads(reformatted)
