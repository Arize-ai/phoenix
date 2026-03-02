"""dataset_example_revision_content_hash_and_external_id

Revision ID: 4f7c9f1e2b3a
Revises: f1a6b2f0c9d5
Create Date: 2026-02-26 00:00:00.000000

"""

import json
import os
import time
import uuid
from hashlib import sha256
from typing import Any, Mapping, Optional, Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "4f7c9f1e2b3a"
down_revision: Union[str, None] = "f1a6b2f0c9d5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _compute_content_hash(
    *,
    input: Mapping[str, Any],
    output: Mapping[str, Any],
    metadata: Optional[Mapping[str, Any]] = None,
) -> str:
    canonical_payload = json.dumps(
        {
            "input": input,
            "output": output,
            "metadata": metadata or {},
        },
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
        allow_nan=False,
    )
    return sha256(canonical_payload.encode("utf-8")).hexdigest()


def _uuid7() -> str:
    timestamp_ms = int(time.time() * 1000)
    rand_a = int.from_bytes(os.urandom(2), "big") & 0x0FFF
    rand_b = int.from_bytes(os.urandom(8), "big") & 0x3FFFFFFFFFFFFFFF
    uuid_int = (timestamp_ms & 0xFFFFFFFFFFFF) << 80
    uuid_int |= 0x7 << 76
    uuid_int |= rand_a << 64
    uuid_int |= 0x2 << 62
    uuid_int |= rand_b
    return str(uuid.UUID(int=uuid_int))


def _parse_json(value: object) -> dict[str, Any]:
    if isinstance(value, str):
        return json.loads(value)  # type: ignore[no-any-return]
    if isinstance(value, dict):
        return value
    return {}


def upgrade() -> None:
    # Step 1: Add columns as nullable (no constraints yet).
    with op.batch_alter_table("dataset_example_revisions") as batch_op:
        batch_op.add_column(sa.Column("content_hash", sa.String(), nullable=True))
    with op.batch_alter_table("dataset_examples") as batch_op:
        batch_op.add_column(sa.Column("external_id", sa.String(), nullable=True))

    # Step 2: Backfill existing rows.
    conn = op.get_bind()

    rows = conn.execute(
        sa.text(
            "SELECT id, input, output, metadata"
            " FROM dataset_example_revisions"
            " WHERE content_hash IS NULL"
        )
    ).fetchall()
    for row in rows:
        content_hash = _compute_content_hash(
            input=_parse_json(row[1]),
            output=_parse_json(row[2]),
            metadata=_parse_json(row[3]),
        )
        conn.execute(
            sa.text("UPDATE dataset_example_revisions SET content_hash = :hash WHERE id = :id"),
            {"hash": content_hash, "id": row[0]},
        )

    example_rows = conn.execute(
        sa.text("SELECT id FROM dataset_examples WHERE external_id IS NULL")
    ).fetchall()
    for row in example_rows:
        conn.execute(
            sa.text("UPDATE dataset_examples SET external_id = :eid WHERE id = :id"),
            {"eid": _uuid7(), "id": row[0]},
        )

    # Step 3: Make columns NOT NULL and add constraints/indexes.
    with op.batch_alter_table("dataset_example_revisions") as batch_op:
        batch_op.alter_column("content_hash", nullable=False)
        batch_op.create_check_constraint(
            "valid_content_hash_length",
            "length(content_hash) = 64",
        )
        batch_op.create_index(
            "ix_dataset_example_revisions_content_hash",
            ["content_hash"],
            unique=False,
        )
    with op.batch_alter_table("dataset_examples") as batch_op:
        batch_op.alter_column("external_id", nullable=False)
        batch_op.create_unique_constraint(
            "uq_dataset_examples_external_id",
            ["external_id"],
        )


def downgrade() -> None:
    with op.batch_alter_table("dataset_examples") as batch_op:
        batch_op.drop_constraint("uq_dataset_examples_external_id", type_="unique")
        batch_op.drop_column("external_id")
    with op.batch_alter_table("dataset_example_revisions") as batch_op:
        batch_op.drop_index("ix_dataset_example_revisions_content_hash")
        batch_op.drop_constraint("valid_content_hash_length", type_="check")
        batch_op.drop_column("content_hash")
