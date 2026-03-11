# Database Patterns

Patterns for database models, Alembic migrations, and async session management.

## Adding a Migration

Always scaffold migrations with Alembic — never write migration files from scratch:

```bash
uv run alembic revision -m "add things table"
```

This creates a new file in `src/phoenix/db/migrations/versions/` with the revision chain
already wired up. Then fill in `upgrade()` and `downgrade()`.

The alembic config is in `pyproject.toml` under `[tool.alembic]` with
`script_location = "src/phoenix/db/migrations"`.

### batch_alter_table (Required for SQLite Compatibility)

SQLite has limited ALTER TABLE support. All column additions, drops, and constraint changes
must use `batch_alter_table`:

```python
def upgrade() -> None:
    with op.batch_alter_table("things") as batch_op:
        batch_op.add_column(sa.Column("status", sa.String, nullable=True))

def downgrade() -> None:
    with op.batch_alter_table("things") as batch_op:
        batch_op.drop_column("status")
```

For multi-step operations (add column, backfill, add constraint):

```python
def upgrade() -> None:
    # Step 1: Add column as nullable
    with op.batch_alter_table("things") as batch_op:
        batch_op.add_column(sa.Column("status", sa.String, nullable=True))

    # Step 2: Backfill
    op.execute("UPDATE things SET status = 'active' WHERE status IS NULL")

    # Step 3: Add constraints
    with op.batch_alter_table("things") as batch_op:
        batch_op.alter_column("status", nullable=False, existing_nullable=True)
        batch_op.create_check_constraint(
            "valid_status",
            "status IN ('active', 'inactive')",
        )
```

### JSONB Shim (Must Be Redefined Per Migration)

Never import JSON types from `models.py` in migrations. Redefine the JSONB shim locally
in each migration file:

```python
from sqlalchemy import JSON
from sqlalchemy.dialects import postgresql

# For SQLite compatibility — define this at the top of every migration that uses JSON
class JSONB(JSON):
    """JSONB shim for SQLite (which only supports plain JSON)."""

JSON_ = (
    JSON()
    .with_variant(postgresql.JSONB(), "postgresql")
    .with_variant(JSONB(), "sqlite")
)
```

This is necessary because migrations must be self-contained — they can't depend on the
current state of `models.py`, which changes over time.

### Create Table Example

```python
def upgrade() -> None:
    op.create_table(
        "things",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String, nullable=False, unique=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("metadata_", JSON_, nullable=False, server_default="{}"),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
    )
```

## Model Patterns

Models live in `src/phoenix/db/models.py` (single file).

### Basic Model

```python
class Thing(Base):
    __tablename__ = "things"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        UtcTimeStamp, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        UtcTimeStamp, server_default=func.now(), onupdate=func.now()
    )
```

### Polymorphic Inheritance (Single Table)

Phoenix uses single-table inheritance with a `kind` discriminator for evaluators:

```python
class Evaluator(Base):
    __tablename__ = "evaluators"

    kind: Mapped[str] = mapped_column(String, nullable=False)
    id: Mapped[int] = mapped_column(primary_key=True)

    __mapper_args__ = {
        "polymorphic_on": "kind",
    }

class LLMEvaluator(Evaluator):
    __tablename__ = "llm_evaluators"

    kind: Mapped[str] = mapped_column(String, insert_default="LLM")
    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    # Composite FK back to parent
    __table_args__ = (
        ForeignKeyConstraint(
            ["kind", "id"],
            ["evaluators.kind", "evaluators.id"],
        ),
    )
    __mapper_args__ = {"polymorphic_identity": "LLM"}
```

### Column Aliasing

When you need to rename a Python attribute without a DB migration:

```python
# DB column is "output_config", Python attribute is "output_configs"
output_configs: Mapped[...] = mapped_column("output_config", JSON_, nullable=True)
```

## Session Management

### In Mutations/Resolvers

```python
async with info.context.db() as session:
    thing = models.Thing(name="foo")
    session.add(thing)
    # Auto-commits on clean exit of the async with block
```

### In Tests

```python
async with db() as session:
    thing = await session.get(models.Thing, thing_id)
    assert thing is not None
```

### Key Rules

- **One session per `async with` block** — don't nest or share sessions across blocks.
- **`await session.flush()`** when you need auto-generated IDs before the block exits.
- **The session expires after the block** — don't access ORM attributes on objects after
  the `async with` exits unless they were eagerly loaded or detached.

## Gotchas

**`batch_alter_table` is not optional** — Plain `op.add_column()` works on PostgreSQL but
silently fails or errors on SQLite. Always use the batch form.

**JSONB shim must be local to each migration** — Importing from `models.py` creates a
dependency on the current model state, which breaks when models change after the migration
was written.

**Composite FK pattern** — Polymorphic subtypes use
`ForeignKeyConstraint(['kind', 'id'], ['parent.kind', 'parent.id'])`. Getting the column
order wrong causes silent join failures.
