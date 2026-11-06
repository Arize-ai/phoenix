# Database Patterns

Patterns for database models, Alembic migrations, and async session management.

## Adding a Migration

Always scaffold migrations with Alembic — never write migration files from scratch:

```bash
uv run alembic revision -m "add things table"
```

This creates a new file in `src/phoenix/db/migrations/versions/` with the revision chain
already wired up. Then fill in `upgrade()` and `downgrade()`.

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

Migrations must be self-contained — they can't depend on the current state of `models.py` or any other source file which changes over time. When custom ORM types are needed inside a migration (e.g., for JSONB types), do not import those types from other modules in the codebase, but instead copy and re-implement inside the migration file itself to ensure it is self-contained.

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

## Session Management

### In Mutations/Resolvers

```python
async with info.context.db() as session:
    thing = models.Thing(name="foo")
    session.add(thing)
    # Auto-commits on clean exit of the async with block
```

### In Tests

The `db` fixture (type `DbSessionFactory`) is provided by `conftest.py` and gives each test
an isolated transaction:

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

