"""drop single indices from traces, project_sessions, and experiment_runs

Revision ID: 272b66ff50f8
Revises: a20694b15f82
Create Date: 2025-08-11 20:37:46.941940

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "272b66ff50f8"
down_revision: Union[str, None] = "a20694b15f82"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_index(
        "ix_traces_project_rowid",
        table_name="traces",
        if_exists=True,
    )
    op.drop_index(
        "ix_traces_start_time",
        table_name="traces",
        if_exists=True,
    )

    op.drop_index(
        "ix_project_sessions_project_id",
        table_name="project_sessions",
        if_exists=True,
    )
    op.drop_index(
        "ix_project_sessions_start_time",
        table_name="project_sessions",
        if_exists=True,
    )

    op.drop_index(
        "ix_experiment_runs_experiment_id",
        table_name="experiment_runs",
        if_exists=True,
    )
    op.drop_index(
        "ix_experiment_run_annotations_experiment_run_id",
        table_name="experiment_run_annotations",
        if_exists=True,
    )

    op.drop_index(
        "ix_dataset_example_revisions_dataset_example_id",
        table_name="dataset_example_revisions",
        if_exists=True,
    )

    op.drop_index(
        "ix_span_cost_details_span_cost_id",
        table_name="span_cost_details",
        if_exists=True,
    )


def downgrade() -> None:
    op.create_index(
        "ix_traces_project_rowid",
        "traces",
        ["project_rowid"],
        if_not_exists=True,
    )
    op.create_index(
        "ix_traces_start_time",
        "traces",
        ["start_time"],
        if_not_exists=True,
    )

    op.create_index(
        "ix_project_sessions_project_id",
        "project_sessions",
        ["project_id"],
        if_not_exists=True,
    )
    op.create_index(
        "ix_project_sessions_start_time",
        "project_sessions",
        ["start_time"],
        if_not_exists=True,
    )

    op.create_index(
        "ix_experiment_runs_experiment_id",
        "experiment_runs",
        ["experiment_id"],
        if_not_exists=True,
    )
    op.create_index(
        "ix_experiment_run_annotations_experiment_run_id",
        "experiment_run_annotations",
        ["experiment_run_id"],
        if_not_exists=True,
    )

    op.create_index(
        "ix_dataset_example_revisions_dataset_example_id",
        "dataset_example_revisions",
        ["dataset_example_id"],
        if_not_exists=True,
    )

    op.create_index(
        "ix_span_cost_details_span_cost_id",
        "span_cost_details",
        ["span_cost_id"],
        if_not_exists=True,
    )
