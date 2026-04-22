"""
Test for the dataset_upsert migration's content_hash backfill.

Verifies that migration 575aa27302ee:
1. Backfills content_hash for existing dataset_example_revisions rows.
2. Makes the content_hash column NOT NULL after backfill.
3. Creates the content_hash index.
4. Produces hashes that match compute_example_content_hash applied to the
   row's stored (input, output, metadata), including for DELETE revisions
   whose content fields are empty dicts.
"""

import json
from datetime import datetime, timezone
from typing import Any, Literal

import pytest
from alembic.config import Config
from sqlalchemy import Connection, text
from sqlalchemy.ext.asyncio import AsyncEngine

from phoenix.utilities.content_hashing import compute_example_content_hash

from . import _down, _get_table_schema_info, _run_async, _up, _version_num

_PRE_REVISION = "aba52fffe1a1"
_TARGET_REVISION = "575aa27302ee"


async def test_content_hash_backfill_migration(
    _engine: AsyncEngine,
    _alembic_config: Config,
    _db_backend: Literal["sqlite", "postgresql"],
    _schema: str,
) -> None:
    with pytest.raises(BaseException, match="alembic_version"):
        await _version_num(_engine, _schema)

    await _up(_engine, _alembic_config, _PRE_REVISION, _schema)

    seeded = await _seed_revisions(_engine)

    await _verify_pre_migration_schema(_engine, _db_backend, _schema)

    await _up(_engine, _alembic_config, _TARGET_REVISION, _schema)

    await _verify_post_migration_schema(_engine, _db_backend, _schema)
    await _verify_backfill(_engine, seeded)

    await _down(_engine, _alembic_config, _PRE_REVISION, _schema)
    await _verify_downgrade_schema(_engine, _db_backend, _schema)


_REVISIONS: list[dict[str, Any]] = [
    {
        "tag": "create_rich",
        "kind": "CREATE",
        "input": {"question": "what is 2+2?", "ctx": {"lang": "en", "turns": [1, 2]}},
        "output": {"answer": "4", "score": 0.99},
        "metadata": {"source": "unit-test", "tags": ["math", "easy"]},
    },
    {
        "tag": "patch_rich",
        "kind": "PATCH",
        "input": {"question": "what is 2+2?", "ctx": {"lang": "en", "turns": [1, 2, 3]}},
        "output": {"answer": "four", "score": 0.95},
        "metadata": {"source": "unit-test", "tags": ["math"]},
    },
    {
        "tag": "delete_empty",
        "kind": "DELETE",
        "input": {},
        "output": {},
        "metadata": {},
    },
    {
        "tag": "dup_a",
        "kind": "CREATE",
        "input": {"q": "same"},
        "output": {"a": "same"},
        "metadata": {"k": "v"},
    },
    {
        "tag": "dup_b",
        "kind": "CREATE",
        "input": {"q": "same"},
        "output": {"a": "same"},
        "metadata": {"k": "v"},
    },
]


async def _seed_revisions(engine: AsyncEngine) -> dict[str, int]:
    """Insert a dataset, versions, examples, and revisions. Return a map from tag to revision id."""
    now = datetime.now(timezone.utc)

    def _do(conn: Connection) -> dict[str, int]:
        dataset_id = conn.execute(
            text(
                "INSERT INTO datasets (name, description, metadata, created_at, updated_at)"
                " VALUES ('ds_backfill', 'backfill test', '{}', :now, :now) RETURNING id"
            ),
            {"now": now},
        ).scalar()

        # One version per revision so the unique (example_id, version_id) constraint is satisfied.
        version_ids = [
            conn.execute(
                text(
                    "INSERT INTO dataset_versions (dataset_id, description, metadata, created_at)"
                    " VALUES (:dataset_id, :desc, '{}', :now) RETURNING id"
                ),
                {"dataset_id": dataset_id, "desc": f"v{i}", "now": now},
            ).scalar()
            for i in range(len(_REVISIONS))
        ]

        # One example per revision keeps setup straightforward.
        example_ids = [
            conn.execute(
                text(
                    "INSERT INTO dataset_examples (dataset_id, created_at)"
                    " VALUES (:dataset_id, :now) RETURNING id"
                ),
                {"dataset_id": dataset_id, "now": now},
            ).scalar()
            for _ in _REVISIONS
        ]

        tag_to_revision_id: dict[str, int] = {}
        for rev, example_id, version_id in zip(_REVISIONS, example_ids, version_ids):
            revision_id = conn.execute(
                text(
                    "INSERT INTO dataset_example_revisions"
                    " (dataset_example_id, dataset_version_id, input, output, metadata,"
                    "  revision_kind, created_at)"
                    " VALUES (:example_id, :version_id, :input, :output, :metadata,"
                    "  :kind, :now) RETURNING id"
                ),
                {
                    "example_id": example_id,
                    "version_id": version_id,
                    "input": json.dumps(rev["input"]),
                    "output": json.dumps(rev["output"]),
                    "metadata": json.dumps(rev["metadata"]),
                    "kind": rev["kind"],
                    "now": now,
                },
            ).scalar()
            assert revision_id is not None
            tag_to_revision_id[rev["tag"]] = revision_id

        conn.commit()
        return tag_to_revision_id

    return await _run_async(engine, _do)


async def _verify_pre_migration_schema(
    engine: AsyncEngine,
    db_backend: Literal["sqlite", "postgresql"],
    schema: str,
) -> None:
    def _do(conn: Connection) -> None:
        info = _get_table_schema_info(conn, "dataset_example_revisions", db_backend, schema)
        assert info is not None
        assert "content_hash" not in info["column_names"], (
            "content_hash should not exist before migration"
        )

    await _run_async(engine, _do)


async def _verify_post_migration_schema(
    engine: AsyncEngine,
    db_backend: Literal["sqlite", "postgresql"],
    schema: str,
) -> None:
    def _do(conn: Connection) -> None:
        info = _get_table_schema_info(conn, "dataset_example_revisions", db_backend, schema)
        assert info is not None
        assert "content_hash" in info["column_names"]
        assert "content_hash" not in info["nullable_column_names"], (
            "content_hash should be NOT NULL after backfill"
        )
        assert "ix_dataset_example_revisions_content_hash" in info["index_names"]

    await _run_async(engine, _do)


async def _verify_backfill(engine: AsyncEngine, seeded: dict[str, int]) -> None:
    def _do(conn: Connection) -> None:
        for rev in _REVISIONS:
            revision_id = seeded[rev["tag"]]
            content_hash = conn.execute(
                text("SELECT content_hash FROM dataset_example_revisions WHERE id = :id"),
                {"id": revision_id},
            ).scalar()
            assert content_hash is not None, f"{rev['tag']} has NULL content_hash after backfill"
            expected = compute_example_content_hash(
                input=rev["input"], output=rev["output"], metadata=rev["metadata"]
            )
            assert bytes(content_hash) == expected, (
                f"{rev['tag']} hash mismatch: got {bytes(content_hash)!r}, expected {expected!r}"
            )

        # Two revisions with identical content must produce identical hashes.
        dup_a = conn.execute(
            text("SELECT content_hash FROM dataset_example_revisions WHERE id = :id"),
            {"id": seeded["dup_a"]},
        ).scalar()
        dup_b = conn.execute(
            text("SELECT content_hash FROM dataset_example_revisions WHERE id = :id"),
            {"id": seeded["dup_b"]},
        ).scalar()
        assert dup_a is not None and dup_b is not None
        assert bytes(dup_a) == bytes(dup_b), "identical content must hash identically"

    await _run_async(engine, _do)


async def _verify_downgrade_schema(
    engine: AsyncEngine,
    db_backend: Literal["sqlite", "postgresql"],
    schema: str,
) -> None:
    def _do(conn: Connection) -> None:
        info = _get_table_schema_info(conn, "dataset_example_revisions", db_backend, schema)
        assert info is not None
        assert "content_hash" not in info["column_names"], (
            "content_hash should be dropped after downgrade"
        )
        assert "ix_dataset_example_revisions_content_hash" not in info["index_names"]

    await _run_async(engine, _do)
