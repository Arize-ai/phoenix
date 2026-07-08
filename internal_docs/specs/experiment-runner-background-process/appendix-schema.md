# Appendix: Schema Design Decisions

Design rationale for the `experiment_execution_configs` table. For current schema, see `src/phoenix/db/models.py` and `src/phoenix/db/types/experiment_config.py`.

---

## Running State Detection

The `status` column is the canonical lifecycle state:

| `status` | Meaning | How it's set |
|----------|---------|-------------|
| `RUNNING` | Actively being processed | `start_experiment`, resume mutation, orphan recovery |
| `COMPLETED` | All work exhausted | `_set_experiment_stopped` (no error) |
| `STOPPED` | User-initiated stop | Stop mutation |
| `ERROR` | Circuit breaker tripped | `_set_experiment_stopped` (with error) |

The `claimed_at` / `claimed_by` columns track replica ownership (heartbeat liveness):

| `claimed_at` Value | Meaning | Notes |
|--------------------|---------|-------|
| `NULL` | No replica owns it | Available for resume |
| Recent (within heartbeat) | Owned by `claimed_by` | Actively being processed |
| Stale (older than 10 min) | Orphaned | Crashed replica; will be auto-recovered |

---

## Design Decisions

### Why Pydantic Models for JSON Columns?

1. **Type safety** — Models are validated at runtime
2. **Serialization** — Automatic JSON conversion via SQLAlchemy TypeDecorator
3. **Documentation** — Schema is self-documenting in code
4. **Immutability** — `frozen=True` prevents accidental mutation

### Why No Version Field in JSON?

The original design included a `version` field for schema evolution. Omitted because:

1. **Pydantic handles evolution** — Optional fields with defaults enable backward compatibility
2. **Database migrations** — Schema changes can be handled via Alembic if needed
3. **Simplicity** — One less field to maintain

### Why `custom_provider_id` Reference Instead of Credential Snapshot?

Custom provider credentials are stored encrypted in `generative_model_custom_providers`. We store only the ID reference:

- Credentials are never copied to experiment config (security)
- If provider is deleted, experiment fails on resume (acceptable trade-off)
- Credentials are fetched at runtime from the provider table

### Why Separate `task_config` and `evaluator_configs`?

1. **Different lifecycles** — Task config is fixed; evaluators can be added later
2. **Different complexity** — Evaluators have their own provider/model config
3. **Query patterns** — May need to query evaluators independently

---

## Table Relationships

```
experiments
    ├── id (PK)
    ├── dataset_id (FK)
    ├── dataset_version_id (FK)
    └── repetitions

experiment_execution_configs
    └── id (PK, FK → experiments.id)
        ├── task_config (JSONB)
        ├── status (RUNNING/COMPLETED/STOPPED/ERROR)
        ├── claimed_at, claimed_by (ownership)
        ├── cooldown_until (earliest next toggle allowed)
        └── last_error

experiment_runs
    ├── experiment_id (FK → experiments.id)
    ├── dataset_example_id
    ├── repetition_number
    └── output, error, etc.
```

**Key points:**
- `experiment_execution_configs` is 1:1 with `experiments`
- `status` is the canonical lifecycle state, set atomically alongside `claimed_at` changes
- `claimed_at` / `claimed_by` track replica ownership for heartbeat and orphan detection
- `cooldown_until` stores an absolute future timestamp; the next stop/resume is blocked until `cooldown_until <= now`
- Progress is computed from `experiment_runs`, not stored in config
