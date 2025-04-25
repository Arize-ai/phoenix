import json
import re
from typing import Literal

import pytest
from alembic.config import Config
from sqlalchemy import Engine, text

from . import _down, _up, _version_num


def test_change_jsonb_to_json_for_prompts(
    _engine: Engine,
    _alembic_config: Config,
    _db_backend: Literal["sqlite", "postgresql"],
) -> None:
    """
    Test the migration that changes the column type from JSONB to JSON for the
    'tools' and 'response_format' columns in the 'prompt_versions' table.

    This test verifies:
    1. The initial state with JSONB columns
    2. The migration to JSON columns
    3. The downgrade back to JSONB columns

    It also ensures data integrity throughout the migration process.
    """
    # Verify we're starting from a clean state
    with pytest.raises(BaseException, match="alembic_version"):
        _version_num(_engine)

    # Run the migration that creates the prompt_versions table
    _up(_engine, _alembic_config, "bc8fea3c2bc8")

    # Sample data for testing - intentionally using keys in arbitrary order
    # to demonstrate the difference between JSONB and JSON in PostgreSQL
    tools_data = {"ZZZ": 3, "Z": 1, "ZZ": 2}
    response_format_data = {"ZZZ": 3, "Z": 1, "ZZ": 2}

    # Insert test data with JSONB columns
    with _engine.connect() as conn:
        # Create a prompt to reference
        prompt_id = conn.execute(
            text(
                """
                INSERT INTO prompts (name, metadata)
                VALUES ('test_prompt', '{}')
                RETURNING id
                """
            )
        ).scalar()

        # Insert prompt version with JSONB data
        prompt_version_id = conn.execute(
            text(
                """
                INSERT INTO prompt_versions (
                    prompt_id, template_type, template_format,
                    template, invocation_parameters, tools, response_format,
                    model_provider, model_name, metadata
                )
                VALUES (
                    :prompt_id, 'CHAT', 'F_STRING',
                    '{}', '{}', :tools, :response_format,
                    'OPENAI', 'gpt-4', '{}'
                )
                RETURNING id
                """  # noqa: E501
            ),
            {
                "prompt_id": prompt_id,
                "tools": json.dumps(tools_data),
                "response_format": json.dumps(response_format_data),
            },
        ).scalar()
        conn.commit()  # Commit to ensure data is visible to subsequent connections

    # STEP 1: Verify initial state with JSONB columns
    with _engine.connect() as conn:
        # Check column types based on database backend
        if _db_backend == "postgresql":
            # PostgreSQL: Use pg_typeof to check column types
            column_types = conn.execute(
                text(
                    """
                    SELECT pg_typeof(tools)::text, pg_typeof(response_format)::text
                    FROM prompt_versions
                    WHERE id = :id
                    """
                ),
                {"id": prompt_version_id},
            ).first()
            assert column_types is not None
            assert column_types[0] == "jsonb"
            assert column_types[1] == "jsonb"
        else:
            # SQLite: Check table definition from sqlite_master
            table_def = conn.execute(
                text(
                    """
                    SELECT sql FROM sqlite_master
                    WHERE type='table' AND name='prompt_versions';
                    """
                )
            ).scalar()
            assert table_def is not None
            # Verify columns are defined as JSONB
            assert re.search(r"\btools\s+JSONB\b", table_def) is not None
            assert re.search(r"\bresponse_format\s+JSONB\b", table_def) is not None

        # Verify data was inserted correctly
        if _db_backend == "sqlite":
            # SQLite: JSON is stored as a string exactly as inserted
            result = conn.execute(
                text("SELECT tools, response_format FROM prompt_versions WHERE id = :id"),
                {"id": prompt_version_id},
            ).first()
            assert result is not None
            assert result[0] == json.dumps(tools_data)
            assert result[1] == json.dumps(response_format_data)
        else:
            # PostgreSQL: JSONB doesn't preserve key order
            result = conn.execute(
                text(
                    """
                    SELECT tools::text, response_format::text
                    FROM prompt_versions WHERE id = :id
                    """
                ),
                {"id": prompt_version_id},
            ).first()
            assert result is not None
            # Data is semantically equivalent when parsed
            assert json.loads(result[0]) == tools_data
            assert json.loads(result[1]) == response_format_data
            # But serialized string differs due to key reordering in JSONB
            # JSONB stores data in a binary format and reorders keys alphabetically
            assert result[0] != json.dumps(tools_data)
            assert result[1] != json.dumps(response_format_data)

    # STEP 2: Run the migration to change JSONB to JSON
    _up(_engine, _alembic_config, "8a3764fe7f1a")

    # Verify the migration worked correctly
    with _engine.connect() as conn:
        # Check data is still accessible
        result = conn.execute(
            text("SELECT tools, response_format FROM prompt_versions WHERE id = :id"),
            {"id": prompt_version_id},
        ).first()

        assert result is not None
        if _db_backend == "sqlite":
            assert result[0] == json.dumps(tools_data)
            assert result[1] == json.dumps(response_format_data)
        else:
            assert result[0] == tools_data
            assert result[1] == response_format_data

        # Check column types after migration
        if _db_backend == "postgresql":
            # PostgreSQL: Verify columns are now JSON
            column_types = conn.execute(
                text(
                    """
                    SELECT pg_typeof(tools)::text, pg_typeof(response_format)::text
                    FROM prompt_versions
                    WHERE id = :id
                    """
                ),
                {"id": prompt_version_id},
            ).first()
            assert column_types is not None
            assert column_types[0] == "json"
            assert column_types[1] == "json"
        else:
            # SQLite: Verify columns are now JSON
            table_def = conn.execute(
                text(
                    """
                    SELECT sql FROM sqlite_master
                    WHERE type='table' AND name='prompt_versions';
                    """
                )
            ).scalar()
            assert table_def is not None
            # Verify columns are defined as JSON and not JSONB
            assert re.search(r"\btools\s+JSON\b", table_def) is not None
            assert re.search(r"\bresponse_format\s+JSON\b", table_def) is not None

    # STEP 3: Test downgrade back to JSONB
    _down(_engine, _alembic_config, "bc8fea3c2bc8")

    # Verify the downgrade worked correctly
    with _engine.connect() as conn:
        # Check data is still accessible
        result = conn.execute(
            text("SELECT tools, response_format FROM prompt_versions WHERE id = :id"),
            {"id": prompt_version_id},
        ).first()

        assert result is not None
        if _db_backend == "sqlite":
            assert result[0] == json.dumps(tools_data)
            assert result[1] == json.dumps(response_format_data)
        else:
            assert result[0] == tools_data
            assert result[1] == response_format_data

        # Check column types after downgrade
        if _db_backend == "postgresql":
            # PostgreSQL: Verify columns are back to JSONB
            column_types = conn.execute(
                text(
                    """
                    SELECT pg_typeof(tools)::text, pg_typeof(response_format)::text
                    FROM prompt_versions
                    WHERE id = :id
                    """
                ),
                {"id": prompt_version_id},
            ).first()
            assert column_types is not None
            assert column_types[0] == "jsonb"
            assert column_types[1] == "jsonb"
        else:
            # SQLite: Verify columns are back to JSONB
            table_def = conn.execute(
                text(
                    """
                    SELECT sql FROM sqlite_master
                    WHERE type='table' AND name='prompt_versions';
                    """
                )
            ).scalar()
            assert table_def is not None
            assert re.search(r"\btools\s+JSONB\b", table_def) is not None
            assert re.search(r"\bresponse_format\s+JSONB\b", table_def) is not None
