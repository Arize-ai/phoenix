"""Smoke test the full dataset upsert/update functionality (Python).

Three-step flow via ``client.datasets.create_dataset`` (which sends
``action=update`` under the hood) using the per-example ``id`` field for
stable identity matching:

  1. seed       — 4 examples (a, b, c, d) → new version, 4 examples
  2. idempotence — re-send same payload   → same version_id, no-op
  3. modify     — patch a (A → A'), drop b, move c's split, keep d, add e
                   → new version, 4 examples
                   → because each example carries an `id`, the diff
                     classifies a as a PATCH revision (not delete+create),
                     b as DELETE, e as CREATE, and c as a splits-only
                     change (no new revision row)

Run:
    uv run scripts/testing/dataset_upsert_smoke.py

Set PHOENIX_COLLECTOR_ENDPOINT (e.g. http://localhost:6112) and/or
PHOENIX_API_KEY if your server isn't on the default http://localhost:6006
with no auth.
"""

import time

from phoenix.client import Client


def main() -> None:
    client = Client()
    name = f"upsert-smoke-{int(time.time())}"

    # ── step 1: seed ─────────────────────────────────────────────────────
    seed = [
        {"id": "a", "input": {"v": "A"}, "output": {}, "splits": "s1"},
        {"id": "b", "input": {"v": "B"}, "output": {}, "splits": "s1"},
        {"id": "c", "input": {"v": "C"}, "output": {}, "splits": "s2"},
        {"id": "d", "input": {"v": "D"}, "output": {}, "splits": "s2"},
    ]
    d1 = client.datasets.create_dataset(name=name, examples=seed)
    print(f"step 1 seed         : version={d1.version_id}  n={len(d1)}")
    assert len(d1) == 4

    # ── step 2: idempotence ──────────────────────────────────────────────
    d2 = client.datasets.create_dataset(name=name, examples=seed)
    print(f"step 2 idempotence  : version={d2.version_id}  n={len(d2)}")
    assert d2.version_id == d1.version_id, "expected no new version"
    assert len(d2) == 4

    # ── step 3: modify ───────────────────────────────────────────────────
    # a: A → A'  (PATCH, matched by id="a")
    # b: dropped (DELETE)
    # c: same content, split s2 → s1 (no revision, splits-only change)
    # d: unchanged
    # e: new (CREATE)
    modified = [
        {"id": "a", "input": {"v": "A'"}, "output": {}, "splits": "s1"},
        {"id": "c", "input": {"v": "C"}, "output": {}, "splits": "s1"},
        {"id": "d", "input": {"v": "D"}, "output": {}, "splits": "s2"},
        {"id": "e", "input": {"v": "E"}, "output": {}, "splits": "s1"},
    ]
    d3 = client.datasets.create_dataset(name=name, examples=modified)
    print(f"step 3 modify       : version={d3.version_id}  n={len(d3)}")
    assert d3.version_id != d1.version_id, "expected new version"
    assert len(d3) == 4

    inputs_now = [dict(ex["input"]) for ex in d3]
    assert {"v": "A'"} in inputs_now and {"v": "E"} in inputs_now
    assert {"v": "B"} not in inputs_now

    # verify split-only change on c: it should now be in split s1
    s1_after = client.datasets.get_dataset(dataset=name, splits=["s1"])
    s1_inputs = [dict(ex["input"]) for ex in s1_after]
    assert {"v": "C"} in s1_inputs, (
        f"expected example c (input {{'v':'C'}}) to be in split s1; got {s1_inputs}"
    )

    print(f"OK — full upsert flow verified (dataset {name!r})")


if __name__ == "__main__":
    main()
