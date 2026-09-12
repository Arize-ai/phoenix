from datetime import datetime, timezone
from typing import Literal

import pytest
import sqlalchemy as sa
from alembic.config import Config
from sqlalchemy import Connection, text
from sqlalchemy.ext.asyncio import AsyncEngine

from . import _down, _run_async, _up, _version_num

_PREVIOUS_REVISION = "4aad9107d196"
_THIS_REVISION = "08a89b1ca1f6"


async def test_span_costs_unique_constraint_migration(
    _engine: AsyncEngine,
    _alembic_config: Config,
    _db_backend: Literal["sqlite", "postgresql"],
    _schema: str,
) -> None:
    # no migrations applied yet
    with pytest.raises(BaseException, match="alembic_version"):
        await _version_num(_engine, _schema)

    # apply migrations up to right before this one
    await _up(_engine, _alembic_config, _PREVIOUS_REVISION, _schema)

    now = datetime.now(timezone.utc)

    def _seed(conn: Connection) -> tuple[int, int, list[int]]:
        """One span with three pre-existing span_costs rows (a state the
        model layer could never itself produce, but the migration must be
        able to clean up regardless), each with its own detail row.
        Returns (span_rowid, trace_rowid, [span_cost_id, ...] oldest to newest)."""
        project_id = conn.execute(
            text(
                "INSERT INTO projects (name, description) VALUES (:name, :description) RETURNING id"
            ),
            {"name": "project-name", "description": None},
        ).scalar()

        trace_rowid = conn.execute(
            text(
                "INSERT INTO traces (project_rowid, trace_id, start_time, end_time) "
                "VALUES (:project_id, :trace_id, :now, :now) RETURNING id"
            ),
            {"project_id": project_id, "trace_id": "trace1", "now": now},
        ).scalar()
        assert isinstance(trace_rowid, int)

        span_rowid = conn.execute(
            text(
                """
                INSERT INTO spans (
                    trace_rowid, span_id, parent_id, name, span_kind, start_time, end_time,
                    attributes, events, status_code, status_message,
                    cumulative_error_count, cumulative_llm_token_count_prompt,
                    cumulative_llm_token_count_completion, llm_token_count_prompt,
                    llm_token_count_completion
                )
                VALUES (
                    :trace_rowid, :span_id, :parent_id, :name, :span_kind, :start_time, :end_time,
                    :attributes, :events, :status_code, :status_message,
                    :cumulative_error_count, :cumulative_llm_token_count_prompt,
                    :cumulative_llm_token_count_completion, :llm_token_count_prompt,
                    :llm_token_count_completion
                )
                RETURNING id
                """
            ),
            {
                "trace_rowid": trace_rowid,
                "span_id": "span1",
                "parent_id": None,
                "name": "span-name",
                "span_kind": "LLM",
                "start_time": now,
                "end_time": now,
                "attributes": "{}",
                "events": "[]",
                "status_code": "OK",
                "status_message": "",
                "cumulative_error_count": 0,
                "cumulative_llm_token_count_prompt": 0,
                "cumulative_llm_token_count_completion": 0,
                "llm_token_count_prompt": None,
                "llm_token_count_completion": None,
            },
        ).scalar()
        assert isinstance(span_rowid, int)

        span_cost_ids: list[int] = []
        for _ in range(3):
            span_cost_id = conn.execute(
                text(
                    "INSERT INTO span_costs (span_rowid, trace_rowid, span_start_time) "
                    "VALUES (:span_rowid, :trace_rowid, :now) RETURNING id"
                ),
                {"span_rowid": span_rowid, "trace_rowid": trace_rowid, "now": now},
            ).scalar()
            assert isinstance(span_cost_id, int)
            span_cost_ids.append(span_cost_id)
            conn.execute(
                text(
                    "INSERT INTO span_cost_details (span_cost_id, token_type, is_prompt) "
                    "VALUES (:span_cost_id, 'input', true)"
                ),
                {"span_cost_id": span_cost_id},
            )
        conn.commit()
        return span_rowid, trace_rowid, span_cost_ids

    span_rowid, trace_rowid, span_cost_ids = await _run_async(_engine, _seed)
    kept_id = max(span_cost_ids)
    deleted_ids = [i for i in span_cost_ids if i != kept_id]

    # apply this migration
    await _up(_engine, _alembic_config, _THIS_REVISION, _schema)

    def _assert_deduped(conn: Connection) -> None:
        remaining = (
            conn.execute(
                text("SELECT id FROM span_costs WHERE span_rowid = :span_rowid"),
                {"span_rowid": span_rowid},
            )
            .scalars()
            .all()
        )
        assert list(remaining) == [kept_id], "exactly the highest-id row must survive dedup"
        orphaned_details = conn.execute(
            text(
                "SELECT COUNT(*) FROM span_cost_details WHERE span_cost_id IN "
                + "("
                + ", ".join(str(i) for i in deleted_ids)
                + ")"
            )
        ).scalar()
        assert orphaned_details == 0, "no span_cost_details may survive their deleted parent"
        remaining_details = conn.execute(
            text("SELECT COUNT(*) FROM span_cost_details WHERE span_cost_id = :id"),
            {"id": kept_id},
        ).scalar()
        assert remaining_details == 1, "the kept row's own detail must be untouched"

    await _run_async(_engine, _assert_deduped)

    def _assert_constraint_present(conn: Connection) -> None:
        inspector = sa.inspect(conn)
        unique_columns = {
            tuple(uq["column_names"])
            for uq in inspector.get_unique_constraints("span_costs", schema=_schema or None)
        }
        assert ("span_rowid",) in unique_columns, (
            f"expected a unique constraint on span_rowid, found {unique_columns}"
        )
        index_names = {
            ix["name"] for ix in inspector.get_indexes("span_costs", schema=_schema or None)
        }
        assert "ix_span_costs_span_rowid" not in index_names, (
            "the old non-unique index should have been replaced by the constraint"
        )

    await _run_async(_engine, _assert_constraint_present)

    # downgrade drops the constraint again (the dedup itself is not reversed)
    await _down(_engine, _alembic_config, _PREVIOUS_REVISION, _schema)

    def _assert_constraint_removed(conn: Connection) -> None:
        inspector = sa.inspect(conn)
        unique_columns = {
            tuple(uq["column_names"])
            for uq in inspector.get_unique_constraints("span_costs", schema=_schema or None)
        }
        assert ("span_rowid",) not in unique_columns
        index_names = {
            ix["name"] for ix in inspector.get_indexes("span_costs", schema=_schema or None)
        }
        assert "ix_span_costs_span_rowid" in index_names, "the original index must be restored"

    await _run_async(_engine, _assert_constraint_removed)
