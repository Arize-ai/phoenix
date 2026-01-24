"""
Test for experiments_dataset_examples junction table migration with backfill.

This test verifies that the migration correctly:
1. Creates the junction table with proper schema
2. Backfills existing experiments with appropriate dataset example revisions
3. Handles edge cases like multiple revisions and DELETE operations
4. Maintains data integrity throughout the migration process
"""

from datetime import datetime, timezone
from typing import Any, Dict, Literal

import pytest
from alembic.config import Config
from sqlalchemy import Engine, MetaData, text

from . import _down, _up, _version_num


def test_experiments_dataset_examples_backfill_migration(
    _engine: Engine,
    _alembic_config: Config,
    _db_backend: Literal["sqlite", "postgresql"],
    _schema: str,
) -> None:
    """
    Test the experiments_dataset_examples junction table migration with backfill.

    This test verifies:
    1. Junction table creation with correct schema
    2. Backfill of existing experiments with appropriate revisions
    3. Proper handling of multiple revisions per example
    4. Exclusion of DELETE revisions from backfill
    5. Correct foreign key relationships and constraints

    Args:
        _engine: Database engine fixture
        _alembic_config: Alembic configuration fixture
        _db_backend: Database backend type ('sqlite' or 'postgresql')
        _schema: Database schema name fixture
    """

    # Verify clean state
    with pytest.raises(BaseException, match="alembic_version"):
        _version_num(_engine, _schema)

    # Migrate to the revision before our target migration
    _up(_engine, _alembic_config, "58228d933c91", _schema)

    # Set up test data before migration
    test_data = _setup_test_data(_engine)

    # Verify pre-migration state
    _verify_pre_migration_state(_engine, test_data)

    # Run the target migration
    _up(_engine, _alembic_config, "e76cbd66ffc3", _schema)

    # Verify post-migration state
    _verify_post_migration_state(_engine, test_data)

    # Test downgrade
    _down(_engine, _alembic_config, "58228d933c91", _schema)

    # Verify table is dropped
    _verify_downgrade_state(_engine)


def _setup_test_data(_engine: Engine) -> Dict[str, Any]:
    """Set up test data before migration."""

    # Use current timestamp for cross-database compatibility
    now = datetime.now(timezone.utc).isoformat()

    with _engine.connect() as conn:
        # Create test datasets
        dataset1_id = conn.execute(
            text("""
            INSERT INTO datasets (name, description, metadata, created_at, updated_at)
            VALUES ('test_dataset_1', 'Test Dataset 1', '{}', :now, :now)
            RETURNING id
        """),
            {"now": now},
        ).scalar()

        dataset2_id = conn.execute(
            text("""
            INSERT INTO datasets (name, description, metadata, created_at, updated_at)
            VALUES ('test_dataset_2', 'Test Dataset 2', '{}', :now, :now)
            RETURNING id
        """),
            {"now": now},
        ).scalar()

        # Create dataset versions
        version1_id = conn.execute(
            text("""
            INSERT INTO dataset_versions (dataset_id, description, metadata, created_at)
            VALUES (:dataset_id, 'Version 1', '{}', :now)
            RETURNING id
        """),
            {"dataset_id": dataset1_id, "now": now},
        ).scalar()

        version2_id = conn.execute(
            text("""
            INSERT INTO dataset_versions (dataset_id, description, metadata, created_at)
            VALUES (:dataset_id, 'Version 2', '{}', :now)
            RETURNING id
        """),
            {"dataset_id": dataset1_id, "now": now},
        ).scalar()

        version3_id = conn.execute(
            text("""
            INSERT INTO dataset_versions (dataset_id, description, metadata, created_at)
            VALUES (:dataset_id, 'Version 1', '{}', :now)
            RETURNING id
        """),
            {"dataset_id": dataset2_id, "now": now},
        ).scalar()

        # Create dataset examples
        example1_id = conn.execute(
            text("""
            INSERT INTO dataset_examples (dataset_id, created_at)
            VALUES (:dataset_id, :now)
            RETURNING id
        """),
            {"dataset_id": dataset1_id, "now": now},
        ).scalar()

        example2_id = conn.execute(
            text("""
            INSERT INTO dataset_examples (dataset_id, created_at)
            VALUES (:dataset_id, :now)
            RETURNING id
        """),
            {"dataset_id": dataset1_id, "now": now},
        ).scalar()

        example3_id = conn.execute(
            text("""
            INSERT INTO dataset_examples (dataset_id, created_at)
            VALUES (:dataset_id, :now)
            RETURNING id
        """),
            {"dataset_id": dataset2_id, "now": now},
        ).scalar()

        # Create dataset example revisions with different scenarios
        # Example 1: Multiple revisions across versions
        revision1_1_id = conn.execute(
            text("""
            INSERT INTO dataset_example_revisions
            (dataset_example_id, dataset_version_id, input, output, metadata, revision_kind, created_at)
            VALUES (:example_id, :version_id, '{"input": "v1"}', '{"output": "v1"}', '{}', 'CREATE', :now)
            RETURNING id
        """),
            {"example_id": example1_id, "version_id": version1_id, "now": now},
        ).scalar()

        revision1_2_id = conn.execute(
            text("""
            INSERT INTO dataset_example_revisions
            (dataset_example_id, dataset_version_id, input, output, metadata, revision_kind, created_at)
            VALUES (:example_id, :version_id, '{"input": "v2"}', '{"output": "v2"}', '{}', 'PATCH', :now)
            RETURNING id
        """),
            {"example_id": example1_id, "version_id": version2_id, "now": now},
        ).scalar()

        # Example 2: Single revision, then DELETE (should be excluded)
        revision2_1_id = conn.execute(
            text("""
            INSERT INTO dataset_example_revisions
            (dataset_example_id, dataset_version_id, input, output, metadata, revision_kind, created_at)
            VALUES (:example_id, :version_id, '{"input": "v1"}', '{"output": "v1"}', '{}', 'CREATE', :now)
            RETURNING id
        """),
            {"example_id": example2_id, "version_id": version1_id, "now": now},
        ).scalar()

        # DELETE revision - should be excluded from backfill
        conn.execute(
            text("""
            INSERT INTO dataset_example_revisions
            (dataset_example_id, dataset_version_id, input, output, metadata, revision_kind, created_at)
            VALUES (:example_id, :version_id, '{"input": "deleted"}', '{"output": "deleted"}', '{}', 'DELETE', :now)
        """),
            {"example_id": example2_id, "version_id": version2_id, "now": now},
        )

        # Example 3: Different dataset
        revision3_1_id = conn.execute(
            text("""
            INSERT INTO dataset_example_revisions
            (dataset_example_id, dataset_version_id, input, output, metadata, revision_kind, created_at)
            VALUES (:example_id, :version_id, '{"input": "other"}', '{"output": "other"}', '{}', 'CREATE', :now)
            RETURNING id
        """),
            {"example_id": example3_id, "version_id": version3_id, "now": now},
        ).scalar()

        # Create experiments
        experiment1_id = conn.execute(
            text("""
            INSERT INTO experiments
            (dataset_id, dataset_version_id, name, description, repetitions, metadata, created_at, updated_at)
            VALUES (:dataset_id, :version_id, 'Experiment 1', 'Test Exp 1', 1, '{}', :now, :now)
            RETURNING id
        """),
            {"dataset_id": dataset1_id, "version_id": version1_id, "now": now},
        ).scalar()

        experiment2_id = conn.execute(
            text("""
            INSERT INTO experiments
            (dataset_id, dataset_version_id, name, description, repetitions, metadata, created_at, updated_at)
            VALUES (:dataset_id, :version_id, 'Experiment 2', 'Test Exp 2', 1, '{}', :now, :now)
            RETURNING id
        """),
            {"dataset_id": dataset1_id, "version_id": version2_id, "now": now},
        ).scalar()

        experiment3_id = conn.execute(
            text("""
            INSERT INTO experiments
            (dataset_id, dataset_version_id, name, description, repetitions, metadata, created_at, updated_at)
            VALUES (:dataset_id, :version_id, 'Experiment 3', 'Test Exp 3', 1, '{}', :now, :now)
            RETURNING id
        """),
            {"dataset_id": dataset2_id, "version_id": version3_id, "now": now},
        ).scalar()

        conn.commit()

        return {
            "datasets": [dataset1_id, dataset2_id],
            "versions": [version1_id, version2_id, version3_id],
            "examples": [example1_id, example2_id, example3_id],
            "revisions": {
                "revision1_1": revision1_1_id,
                "revision1_2": revision1_2_id,
                "revision2_1": revision2_1_id,
                "revision3_1": revision3_1_id,
            },
            "experiments": [experiment1_id, experiment2_id, experiment3_id],
        }


def _verify_pre_migration_state(_engine: Engine, test_data: Dict[str, Any]) -> None:
    """Verify state before migration."""

    # Check junction table doesn't exist (use separate transaction for PostgreSQL)
    with _engine.connect() as conn:
        try:
            conn.execute(text("SELECT 1 FROM experiments_dataset_examples LIMIT 1"))
            assert False, "Junction table should not exist before migration"
        except Exception:
            # Expected - table doesn't exist (different backends raise different exceptions)
            pass

    # Verify other tables exist (separate transaction)
    with _engine.connect() as conn:
        # Verify experiments exist
        result = conn.execute(text("SELECT COUNT(*) FROM experiments"))
        assert result.scalar() == 3, "Should have 3 experiments"

        # Verify examples and revisions exist
        result = conn.execute(text("SELECT COUNT(*) FROM dataset_examples"))
        assert result.scalar() == 3, "Should have 3 dataset examples"

        result = conn.execute(text("SELECT COUNT(*) FROM dataset_example_revisions"))
        assert result.scalar() == 5, "Should have 5 revisions (including DELETE)"


def _verify_post_migration_state(_engine: Engine, test_data: Dict[str, Any]) -> None:
    """Verify state after migration and backfill."""

    with _engine.connect() as conn:
        # Verify junction table exists with correct schema
        metadata = MetaData()
        metadata.reflect(bind=_engine)

        assert "experiments_dataset_examples" in metadata.tables, "Junction table should exist"

        table = metadata.tables["experiments_dataset_examples"]
        columns = {col.name for col in table.columns}
        expected_columns = {
            "experiment_id",
            "dataset_example_id",
            "dataset_example_revision_id",
        }
        assert columns == expected_columns, f"Expected columns {expected_columns}, got {columns}"

        # Verify primary key constraint
        pk_cols = {col.name for col in table.primary_key.columns}
        expected_pk = {"experiment_id", "dataset_example_id"}
        assert pk_cols == expected_pk, f"Expected PK {expected_pk}, got {pk_cols}"

        # Verify foreign key constraints
        fk_count = len(table.foreign_keys)
        assert fk_count == 3, f"Expected 3 foreign keys, got {fk_count}"

        # Verify backfill data
        result = conn.execute(
            text("""
            SELECT experiment_id, dataset_example_id, dataset_example_revision_id
            FROM experiments_dataset_examples
            ORDER BY experiment_id, dataset_example_id
        """)
        )

        backfill_data = result.fetchall()

        # Expected backfill results:
        # Experiment 1 (version 1): example1 -> revision1_1, example2 -> revision2_1
        # Experiment 2 (version 2): example1 -> revision1_2 (example2 DELETED, excluded)
        # Experiment 3 (dataset2): example3 -> revision3_1

        assert len(backfill_data) == 4, f"Expected 4 junction records, got {len(backfill_data)}"

        # Verify specific mappings
        exp1_id, exp2_id, exp3_id = test_data["experiments"]
        ex1_id, ex2_id, ex3_id = test_data["examples"]
        rev1_1_id = test_data["revisions"]["revision1_1"]
        rev1_2_id = test_data["revisions"]["revision1_2"]
        rev2_1_id = test_data["revisions"]["revision2_1"]
        rev3_1_id = test_data["revisions"]["revision3_1"]

        expected_mappings = {
            (exp1_id, ex1_id, rev1_1_id),  # Exp1 -> Ex1 -> latest for version 1
            (exp1_id, ex2_id, rev2_1_id),  # Exp1 -> Ex2 -> latest for version 1
            (exp2_id, ex1_id, rev1_2_id),  # Exp2 -> Ex1 -> latest for version 2
            # Note: Exp2 -> Ex2 excluded because Ex2 was DELETED in version 2
            (exp3_id, ex3_id, rev3_1_id),  # Exp3 -> Ex3 -> latest for version 1
        }

        actual_mappings = {(row[0], row[1], row[2]) for row in backfill_data}
        assert actual_mappings == expected_mappings, (
            f"Expected {expected_mappings}, got {actual_mappings}"
        )

        # Verify no DELETE revisions were included
        result = conn.execute(
            text("""
            SELECT COUNT(*) FROM experiments_dataset_examples ede
            JOIN dataset_example_revisions der ON ede.dataset_example_revision_id = der.id
            WHERE der.revision_kind = 'DELETE'
        """)
        )
        assert result.scalar() == 0, "No DELETE revisions should be in junction table"


def _verify_downgrade_state(_engine: Engine) -> None:
    """Verify state after downgrade."""

    # Check junction table is dropped (use separate transaction for PostgreSQL)
    with _engine.connect() as conn:
        try:
            conn.execute(text("SELECT 1 FROM experiments_dataset_examples LIMIT 1"))
            assert False, "Junction table should be dropped after downgrade"
        except Exception:
            # Expected - table doesn't exist (different backends raise different exceptions)
            pass

    # Verify other tables still exist (separate transaction)
    with _engine.connect() as conn:
        result = conn.execute(text("SELECT COUNT(*) FROM experiments"))
        assert result.scalar() == 3, "Experiments should still exist after downgrade"
