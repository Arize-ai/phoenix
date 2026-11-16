"""Migration tests for f125a3233286 (cleanup tasks, project kinds, and lifecycle tombstones)."""

import json
from datetime import datetime, timedelta, timezone
from secrets import token_hex
from typing import Any

import pytest
from alembic.config import Config
from sqlalchemy import Connection, text
from sqlalchemy.ext.asyncio import AsyncEngine

from . import _down, _run_async, _up

_DOWN = "e724eb2ee5cf"
_UP = "f125a3233286"


def _insert(conn: Connection, sql: str, **params: Any) -> int:
    rowid = conn.execute(text(sql + " RETURNING id"), params).scalar_one()
    assert isinstance(rowid, int)
    return rowid


async def test_f125a3233286_backfills_kinds_and_historical_references_and_guards_downgrade(
    _engine: AsyncEngine,
    _alembic_config: Config,
    _schema: str,
) -> None:
    await _up(_engine, _alembic_config, _DOWN, _schema)
    t0 = datetime(2026, 1, 1, 12, 0, 0, tzinfo=timezone.utc)

    def _seed(conn: Connection) -> dict[str, int]:
        default_proj = int(
            conn.execute(text("SELECT id FROM projects WHERE name = 'default'")).scalar_one()
        )
        playground_proj = _insert(
            conn,
            "INSERT INTO projects (name, created_at, updated_at) VALUES ('playground', :t, :t)",
            t=t0,
        )
        standard_proj = _insert(
            conn,
            "INSERT INTO projects (name, created_at, updated_at) VALUES ('prod-app', :t, :t)",
            t=t0,
        )
        exp_proj = _insert(
            conn,
            "INSERT INTO projects (name, created_at, updated_at) VALUES ('Experiment-abc', :t, :t)",
            t=t0,
        )
        ds_eval_proj = _insert(
            conn,
            "INSERT INTO projects (name, created_at, updated_at) VALUES ('ds-eval-proj', :t, :t)",
            t=t0,
        )
        pe_eval_proj = _insert(
            conn,
            "INSERT INTO projects (name, created_at, updated_at) VALUES ('pe-eval-proj', :t, :t)",
            t=t0,
        )
        # Ambiguous project: created AFTER an old experiment whose original project was deleted
        # and recreated under the same user name, with no matching run traces.
        recreated_proj = _insert(
            conn,
            "INSERT INTO projects (name, created_at, updated_at) VALUES ('recreated-name', :t, :t)",
            t=t0 + timedelta(days=5),
        )
        # Shared user project: referenced by an experiment, but ALSO has a project_evaluator
        # attached to it, so it must stay STANDARD rather than becoming an exclusively owned
        # EXPERIMENT project.
        shared_proj = _insert(
            conn,
            "INSERT INTO projects (name, created_at, updated_at) VALUES ('shared-app', :t, :t)",
            t=t0,
        )
        assistant_proj = _insert(
            conn,
            "INSERT INTO projects (name, created_at, updated_at) VALUES ('assistant_agent', :t, :t)",
            t=t0,
        )

        dataset = _insert(
            conn,
            "INSERT INTO datasets (name, metadata) VALUES ('ds', :m)",
            m=json.dumps({}),
        )
        dataset_version = _insert(
            conn,
            "INSERT INTO dataset_versions (dataset_id, metadata) VALUES (:d, :m)",
            d=dataset,
            m=json.dumps({}),
        )
        builtin_eval = _insert(
            conn,
            "INSERT INTO evaluators (name, metadata, kind) VALUES ('builtin-1', :m, 'BUILTIN')",
            m=json.dumps({}),
        )
        conn.execute(
            text(
                "INSERT INTO builtin_evaluators (id, key, input_schema, output_configs) "
                "VALUES (:id, 'hallucination', :s, :o)"
            ),
            {"id": builtin_eval, "s": json.dumps({}), "o": json.dumps([])},
        )
        ds_binding = _insert(
            conn,
            "INSERT INTO dataset_evaluators "
            "(dataset_id, evaluator_id, name, input_mapping, project_id) "
            "VALUES (:d, :e, 'ds-judge', :im, :p)",
            d=dataset,
            e=builtin_eval,
            im=json.dumps({"literal_mapping": {}, "path_mapping": {}}),
            p=ds_eval_proj,
        )
        pe_binding = _insert(
            conn,
            "INSERT INTO project_evaluators "
            "(project_id, evaluator_id, trace_project_id, name, sampling_rate, "
            "evaluation_target, evaluation_delay_seconds) "
            "VALUES (:p, :e, :tp, 'pe-judge', 1.0, 'SPAN', 0)",
            p=shared_proj,
            e=builtin_eval,
            tp=pe_eval_proj,
        )
        exp_owned = _insert(
            conn,
            "INSERT INTO experiments "
            "(dataset_id, dataset_version_id, name, repetitions, metadata, project_name, created_at, updated_at) "
            "VALUES (:d, :dv, 'exp-1', 1, :m, 'Experiment-abc', :t, :t)",
            d=dataset,
            dv=dataset_version,
            m=json.dumps({}),
            t=t0 + timedelta(minutes=1),
        )
        exp_ambiguous = _insert(
            conn,
            "INSERT INTO experiments "
            "(dataset_id, dataset_version_id, name, repetitions, metadata, project_name, created_at, updated_at) "
            "VALUES (:d, :dv, 'exp-old', 1, :m, 'recreated-name', :t, :t)",
            d=dataset,
            dv=dataset_version,
            m=json.dumps({}),
            t=t0,
        )
        exp_shared = _insert(
            conn,
            "INSERT INTO experiments "
            "(dataset_id, dataset_version_id, name, repetitions, metadata, project_name, created_at, updated_at) "
            "VALUES (:d, :dv, 'exp-shared', 1, :m, 'shared-app', :t, :t)",
            d=dataset,
            dv=dataset_version,
            m=json.dumps({}),
            t=t0 + timedelta(minutes=1),
        )
        agent_resolved = _insert(
            conn,
            "INSERT INTO agent_sessions "
            "(project_name, title, model_provider, model_name, is_ephemeral, created_at, updated_at) "
            "VALUES ('assistant_agent', 'chat', 'OPENAI', 'gpt-4o', :ephemeral, :t, :t)",
            ephemeral=False,
            t=t0 + timedelta(minutes=5),
        )
        agent_unresolved = _insert(
            conn,
            "INSERT INTO agent_sessions "
            "(project_name, title, model_provider, model_name, is_ephemeral, created_at, updated_at) "
            "VALUES ('never-created-assistant', 'chat2', 'OPENAI', 'gpt-4o', :ephemeral, :t, :t)",
            ephemeral=False,
            t=t0 + timedelta(minutes=5),
        )
        trace_id = _insert(
            conn,
            "INSERT INTO traces (project_rowid, trace_id, start_time, end_time) "
            "VALUES (:p, :tid, :t, :t)",
            p=standard_proj,
            tid=token_hex(16),
            t=t0,
        )
        # Name-only matches stay STANDARD: only run-linked traces prove an experiment project.
        user_proj = _insert(
            conn,
            "INSERT INTO projects (name, created_at, updated_at) VALUES ('user-app', :t, :t)",
            t=t0,
        )
        mixed_proj = _insert(
            conn,
            "INSERT INTO projects (name, created_at, updated_at) VALUES ('mixed-app', :t, :t)",
            t=t0,
        )
        example = _insert(
            conn,
            "INSERT INTO dataset_examples (dataset_id, created_at) VALUES (:d, :t)",
            d=dataset,
            t=t0,
        )
        for exp_name, proj_name, proj_id, with_run in (
            ("exp-user", "user-app", user_proj, False),
            ("exp-mixed", "mixed-app", mixed_proj, True),
            ("exp-owned-run", "Experiment-abc", exp_proj, True),
        ):
            exp_id = _insert(
                conn,
                "INSERT INTO experiments "
                "(dataset_id, dataset_version_id, name, repetitions, metadata, project_name, "
                "created_at, updated_at) "
                "VALUES (:d, :dv, :n, 1, :m, :pn, :t, :t)",
                d=dataset,
                dv=dataset_version,
                n=exp_name,
                m=json.dumps({}),
                pn=proj_name,
                t=t0 + timedelta(minutes=1),
            )
            if not with_run:
                continue
            run_trace = token_hex(16)
            conn.execute(
                text(
                    "INSERT INTO traces (project_rowid, trace_id, start_time, end_time) "
                    "VALUES (:p, :tid, :t, :t)"
                ),
                {"p": proj_id, "tid": run_trace, "t": t0},
            )
            conn.execute(
                text(
                    "INSERT INTO experiment_runs (experiment_id, dataset_example_id, "
                    "repetition_number, trace_id, output, start_time, end_time) "
                    "VALUES (:e, :x, 1, :tid, :o, :t, :t)"
                ),
                {"e": exp_id, "x": example, "tid": run_trace, "o": json.dumps({}), "t": t0},
            )
        conn.execute(
            text(
                "INSERT INTO traces (project_rowid, trace_id, start_time, end_time) "
                "VALUES (:p, :tid, :t, :t)"
            ),
            {"p": mixed_proj, "tid": token_hex(16), "t": t0},
        )
        conn.commit()
        return {
            "default_proj": default_proj,
            "playground_proj": playground_proj,
            "standard_proj": standard_proj,
            "exp_proj": exp_proj,
            "ds_eval_proj": ds_eval_proj,
            "pe_eval_proj": pe_eval_proj,
            "recreated_proj": recreated_proj,
            "shared_proj": shared_proj,
            "assistant_proj": assistant_proj,
            "ds_binding": ds_binding,
            "pe_binding": pe_binding,
            "exp_owned": exp_owned,
            "exp_ambiguous": exp_ambiguous,
            "exp_shared": exp_shared,
            "agent_resolved": agent_resolved,
            "agent_unresolved": agent_unresolved,
            "trace_id": trace_id,
            "user_proj": user_proj,
            "mixed_proj": mixed_proj,
        }

    ids = await _run_async(_engine, _seed)
    await _up(_engine, _alembic_config, _UP, _schema)

    def _verify_upgrade_and_mark_deleted(conn: Connection) -> int:
        kinds: dict[int, str] = {
            int(row[0]): str(row[1])
            for row in conn.execute(text("SELECT id, kind FROM projects")).all()
        }
        assert kinds[ids["default_proj"]] == "STANDARD"
        assert kinds[ids["playground_proj"]] == "PLAYGROUND"
        assert kinds[ids["standard_proj"]] == "STANDARD"
        assert kinds[ids["exp_proj"]] == "EXPERIMENT"
        assert kinds[ids["ds_eval_proj"]] == "EVALUATOR"
        assert kinds[ids["pe_eval_proj"]] == "EVALUATOR"
        assert kinds[ids["recreated_proj"]] == "STANDARD"
        assert kinds[ids["shared_proj"]] == "STANDARD"
        assert kinds[ids["user_proj"]] == "STANDARD"
        assert kinds[ids["mixed_proj"]] == "STANDARD"

        exp_refs: dict[int, int | None] = {
            int(row[0]): (int(row[1]) if row[1] is not None else None)
            for row in conn.execute(text("SELECT id, project_id FROM experiments")).all()
        }
        assert exp_refs[ids["exp_owned"]] == ids["exp_proj"]
        assert exp_refs[ids["exp_shared"]] == ids["shared_proj"]
        assert exp_refs[ids["exp_ambiguous"]] is None

        agent_refs: dict[int, int | None] = {
            int(row[0]): (int(row[1]) if row[1] is not None else None)
            for row in conn.execute(text("SELECT id, project_id FROM agent_sessions")).all()
        }
        assert agent_refs[ids["agent_resolved"]] == ids["assistant_proj"]
        assert agent_refs[ids["agent_unresolved"]] is None

        # Mark standard_proj deleted and reuse its name 'prod-app' immediately.
        conn.execute(
            text("UPDATE projects SET deleted_at = :t WHERE id = :id"),
            {"t": t0, "id": ids["standard_proj"]},
        )
        new_prod = _insert(
            conn,
            "INSERT INTO projects (name, kind, created_at, updated_at) "
            "VALUES ('prod-app', 'STANDARD', :t, :t)",
            t=t0,
        )
        conn.commit()
        return new_prod

    new_prod_id = await _run_async(_engine, _verify_upgrade_and_mark_deleted)
    assert new_prod_id != ids["standard_proj"]

    # Downgrade refuses while deleted_at IS NOT NULL rows await cleanup.
    with pytest.raises(ValueError, match="Cannot downgrade while projects has deleted rows"):
        await _down(_engine, _alembic_config, _DOWN, _schema)

    def _finish_purge(conn: Connection) -> None:
        conn.execute(text("DELETE FROM projects WHERE id = :id"), {"id": ids["standard_proj"]})
        conn.execute(
            text(
                "INSERT INTO cleanup_tasks (kind, available_at, created_at) "
                "VALUES ('CLEAR_PROJECT_TRACES', :t, :t)"
            ),
            {"t": t0},
        )
        conn.commit()

    await _run_async(_engine, _finish_purge)

    # Downgrade also refuses while any cleanup task is still queued.
    with pytest.raises(ValueError, match="Cannot downgrade while cleanup_tasks has pending rows"):
        await _down(_engine, _alembic_config, _DOWN, _schema)

    def _drain_tasks(conn: Connection) -> None:
        conn.execute(text("DELETE FROM cleanup_tasks"))
        conn.commit()

    await _run_async(_engine, _drain_tasks)
    await _down(_engine, _alembic_config, _DOWN, _schema)
