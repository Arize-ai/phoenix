"""add per-resource access control

Revision ID: f7a3c1e9d2b4
Revises: d4e5f6a7b8c9
Create Date: 2026-06-14 00:00:00.000000

The schema for per-resource access control, in one migration:

- scope session uniqueness to (project_id, session_id) instead of session_id
  alone, so two projects can each have a session with the same id.
- roles as data: role_permissions + user_roles.is_built_in.
- subjects: user_groups + user_group_memberships (IdP/LDAP groups).
- permission sets: permission_sets + permission_set_items.
- grants: the acls table + a durable scope column on api_keys.
- a server-set ``kind`` discriminator on projects (TELEMETRY / PLAYGROUND /
  EXPERIMENT / EVALUATOR), backfilled for existing rows, dispatching per-kind
  access policy and replacing the name-pattern + exclude_* heuristics.
- a ``project_id`` FK on experiments, the durable link for access-by-parent,
  backfilled from the existing ``project_name``.

Schema only — built-in role bundles and the built-in permission sets are seeded
idempotently at startup by the Facilitator. The model is fail-closed and
monotonic (admin-only by default; grants only add), so there is no everyone-allow
default to seed. Enforcement is driven by a DB-latched ``access_control.enabled``
system setting (the sole source of truth, off by default), which
PHOENIX_ACCESS_CONTROL_ENABLED can only ever *bootstrap on* (a one-way switch);
so this migration changes no behavior.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f7a3c1e9d2b4"
down_revision: Union[str, None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_UQ_COMPOSITE = "uq_project_sessions_project_id_session_id"
_UQ_SINGLE = "uq_project_sessions_session_id"

# Lets batch_alter_table render a deterministic name for the reflected,
# originally-unnamed unique constraint so it can be dropped on SQLite.
_NAMING = {"uq": "uq_%(table_name)s_%(column_0_N_name)s"}


def upgrade() -> None:
    _scope_sessions_to_project()

    # roles as data
    op.create_table(
        "role_permissions",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "user_role_id",
            sa.Integer,
            sa.ForeignKey("user_roles.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("permission", sa.String, nullable=False),
        sa.UniqueConstraint(
            "user_role_id",
            "permission",
            name="uq_role_permissions_user_role_id_permission",
        ),
    )
    with op.batch_alter_table("user_roles") as batch_op:
        batch_op.add_column(
            sa.Column(
                "is_built_in",
                sa.Boolean(),
                nullable=False,
                server_default=sa.true(),
            ),
        )

    # subjects: groups
    op.create_table(
        "user_groups",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("provider", sa.String, nullable=False),
        sa.Column("group_key", sa.String, nullable=False),
        sa.Column("display_name", sa.String, nullable=True),
        sa.UniqueConstraint("provider", "group_key", name="uq_user_groups_provider_group_key"),
    )
    op.create_table(
        "user_group_memberships",
        # The natural key (user_group_id, user_id) is the primary key — a membership is just
        # the pair, so a surrogate id would only add a second index. user_group_id needs no
        # separate index (it is the PK's leftmost column); user_id does (it is not a PK prefix).
        sa.Column(
            "user_group_id",
            sa.Integer,
            sa.ForeignKey("user_groups.id", ondelete="CASCADE"),
            nullable=False,
            primary_key=True,
        ),
        sa.Column(
            "user_id",
            sa.Integer,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            primary_key=True,
            index=True,
        ),
    )

    # permission sets (what a grant confers on its object)
    op.create_table(
        "permission_sets",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String, nullable=False, unique=True, index=True),
        sa.Column("is_built_in", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.create_table(
        "permission_set_items",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "permission_set_id",
            sa.Integer,
            sa.ForeignKey("permission_sets.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("permission", sa.String, nullable=False),
        sa.UniqueConstraint(
            "permission_set_id",
            "permission",
            name="uq_permission_set_items_permission_set_id_permission",
        ),
    )
    op.create_index(
        "ix_permission_set_items_permission_permission_set_id",
        "permission_set_items",
        ["permission", "permission_set_id"],
    )

    # grants
    op.create_table(
        "acls",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("subject_kind", sa.String, nullable=False),
        sa.Column("subject_id", sa.Integer, nullable=True),
        sa.Column(
            "role_id",
            sa.Integer,
            sa.ForeignKey("permission_sets.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("object_type", sa.String, nullable=False),
        sa.Column("object_id", sa.Integer, nullable=True),
        sa.Column("selector_kind", sa.String, nullable=False, server_default="ids"),
        # Attribute (tag) selector: set only when selector_kind='tag'. A tag grant
        # reaches every object of its type carrying this exact key=value (see
        # resource_tags); NULL for id/all grants.
        sa.Column("tag_key", sa.String, nullable=True),
        sa.Column("tag_value", sa.String, nullable=True),
        sa.Column("effect", sa.String, nullable=False, server_default="allow"),
        # A wildcard object_type ('*' = all types) is only coherent with the type-wide
        # 'all' selector; an id-scoped '*' grant would alias every row sharing that id
        # across tables, since object identity is the (type, id) pair, not the id alone.
        sa.CheckConstraint(
            "object_type != '*' OR selector_kind = 'all'",
            # Short name; the shared naming convention renders it to ck_<table>_`<name>`,
            # so the migrated schema and the metadata-built one agree.
            name="wildcard_type_requires_all_selector",
        ),
    )
    op.create_index("ix_acls_object_type_object_id", "acls", ["object_type", "object_id"])
    op.create_index("ix_acls_subject_kind_subject_id", "acls", ["subject_kind", "subject_id"])
    op.create_index(
        "ix_acls_subject_access_lookup",
        "acls",
        ["effect", "subject_kind", "subject_id", "object_type", "selector_kind", "object_id"],
    )
    op.create_index(
        "ix_acls_object_access_lookup",
        "acls",
        ["effect", "object_type", "object_id", "selector_kind"],
    )

    # curated object attributes — the source of truth a tag grant expands against.
    # Polymorphic (object_type, object_id) like acls: one table for every resource
    # type, at the cost of no FK to the target (swept on the delete path instead).
    op.create_table(
        "resource_tags",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("object_type", sa.String, nullable=False),
        sa.Column("object_id", sa.Integer, nullable=False),
        sa.Column("key", sa.String, nullable=False),
        sa.Column("value", sa.String, nullable=False),
        sa.Column(
            "created_by",
            sa.Integer,
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint(
            "object_type",
            "object_id",
            "key",
            name="uq_resource_tags_object_type_object_id_key",
        ),
    )
    op.create_index(
        "ix_resource_tags_object_type_object_id",
        "resource_tags",
        ["object_type", "object_id"],
    )
    op.create_index(
        "ix_resource_tags_object_type_key_value",
        "resource_tags",
        ["object_type", "key", "value"],
    )

    with op.batch_alter_table("api_keys") as batch_op:
        batch_op.add_column(sa.Column("scope", sa.String, nullable=True))

    # the project access "kind" discriminator + the experiment->project FK
    with op.batch_alter_table("projects") as batch_op:
        batch_op.add_column(
            sa.Column("kind", sa.String, nullable=False, server_default="TELEMETRY")
        )
        batch_op.create_index("ix_projects_kind", ["kind"])
    with op.batch_alter_table("experiments") as batch_op:
        batch_op.add_column(sa.Column("project_id", sa.Integer, nullable=True))
        batch_op.create_index("ix_experiments_project_id", ["project_id"])
        batch_op.create_foreign_key(
            "fk_experiments_project_id_projects",
            "projects",
            ["project_id"],
            ["id"],
            ondelete="SET NULL",
        )

    # backfill kind for existing rows (precise joins, not name patterns) and the
    # experiment->project FK from the existing project_name. Order matters:
    # evaluator/experiment before the playground singleton.
    op.execute(
        "UPDATE projects SET kind = 'EVALUATOR' WHERE id IN "
        "(SELECT project_id FROM dataset_evaluators WHERE project_id IS NOT NULL)"
    )
    op.execute(
        "UPDATE projects SET kind = 'EXPERIMENT' WHERE name IN "
        "(SELECT project_name FROM experiments WHERE project_name IS NOT NULL) "
        "AND kind = 'TELEMETRY'"
    )
    op.execute("UPDATE projects SET kind = 'PLAYGROUND' WHERE name = 'playground'")
    op.execute(
        "UPDATE experiments SET project_id = "
        "(SELECT projects.id FROM projects WHERE projects.name = experiments.project_name) "
        "WHERE project_name IS NOT NULL"
    )

    # Drop the now-redundant experiments.project_name. The experiment->project link lives
    # solely in project_id; the name is derived from projects.name through it, so the stored
    # copy can only drift. Done after the backfill above, which read it to populate project_id.
    with op.batch_alter_table("experiments") as batch_op:
        batch_op.drop_index("ix_experiments_project_name")
        batch_op.drop_column("project_name")


def downgrade() -> None:
    # Restore the denormalized experiments.project_name, backfilled from project_id, before
    # the FK that now sources it is dropped.
    with op.batch_alter_table("experiments") as batch_op:
        batch_op.add_column(sa.Column("project_name", sa.String, nullable=True))
        batch_op.create_index("ix_experiments_project_name", ["project_name"])
    op.execute(
        "UPDATE experiments SET project_name = "
        "(SELECT projects.name FROM projects WHERE projects.id = experiments.project_id) "
        "WHERE project_id IS NOT NULL"
    )
    with op.batch_alter_table("experiments") as batch_op:
        batch_op.drop_constraint("fk_experiments_project_id_projects", type_="foreignkey")
        batch_op.drop_index("ix_experiments_project_id")
        batch_op.drop_column("project_id")
    with op.batch_alter_table("projects") as batch_op:
        batch_op.drop_index("ix_projects_kind")
        batch_op.drop_column("kind")

    with op.batch_alter_table("api_keys") as batch_op:
        batch_op.drop_column("scope")
    op.drop_index("ix_resource_tags_object_type_key_value", table_name="resource_tags")
    op.drop_index("ix_resource_tags_object_type_object_id", table_name="resource_tags")
    op.drop_table("resource_tags")

    op.drop_index("ix_acls_object_access_lookup", table_name="acls")
    op.drop_index("ix_acls_subject_access_lookup", table_name="acls")
    op.drop_index("ix_acls_subject_kind_subject_id", table_name="acls")
    op.drop_index("ix_acls_object_type_object_id", table_name="acls")
    op.drop_table("acls")

    op.drop_index(
        "ix_permission_set_items_permission_permission_set_id",
        table_name="permission_set_items",
    )
    op.drop_table("permission_set_items")
    op.drop_table("permission_sets")

    op.drop_table("user_group_memberships")
    op.drop_table("user_groups")

    with op.batch_alter_table("user_roles") as batch_op:
        batch_op.drop_column("is_built_in")
    op.drop_table("role_permissions")

    _unscope_sessions_from_project()


def _scope_sessions_to_project() -> None:
    if op.get_bind().dialect.name == "postgresql":
        # column-level unique=True was emitted with the dialect-default name;
        # cover both the Postgres default and the naming-convention spelling.
        op.execute(
            "ALTER TABLE project_sessions DROP CONSTRAINT IF EXISTS project_sessions_session_id_key"
        )
        op.execute(f"ALTER TABLE project_sessions DROP CONSTRAINT IF EXISTS {_UQ_SINGLE}")
        op.create_unique_constraint(_UQ_COMPOSITE, "project_sessions", ["project_id", "session_id"])
    else:
        # SQLite: batch recreate, reflecting and preserving existing indexes + FK.
        with op.batch_alter_table("project_sessions", naming_convention=_NAMING) as batch_op:
            batch_op.drop_constraint(_UQ_SINGLE, type_="unique")
            batch_op.create_unique_constraint(_UQ_COMPOSITE, ["project_id", "session_id"])
        _restore_start_time_desc_index()


def _unscope_sessions_from_project() -> None:
    if op.get_bind().dialect.name == "postgresql":
        op.drop_constraint(_UQ_COMPOSITE, "project_sessions", type_="unique")
        op.create_unique_constraint(_UQ_SINGLE, "project_sessions", ["session_id"])
    else:
        with op.batch_alter_table("project_sessions", naming_convention=_NAMING) as batch_op:
            batch_op.drop_constraint(_UQ_COMPOSITE, type_="unique")
            batch_op.create_unique_constraint(_UQ_SINGLE, ["session_id"])
        _restore_start_time_desc_index()


def _restore_start_time_desc_index() -> None:
    # The SQLite batch recreate reflects the composite index but drops its
    # DESC ordering (see migration 735d3d93c33e). Restore it so SQLite matches
    # Postgres and the pre-migration schema.
    op.execute("DROP INDEX IF EXISTS ix_project_sessions_project_id_start_time")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_project_sessions_project_id_start_time "
        "ON project_sessions (project_id, start_time DESC)"
    )
