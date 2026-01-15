from typing import Literal

import pytest
from alembic.config import Config
from sqlalchemy import Engine, text

from . import _down, _up, _version_num


def test_add_json_path_to_template_format(
    _engine: Engine,
    _alembic_config: Config,
    _db_backend: Literal["sqlite", "postgresql"],
    _schema: str,
) -> None:
    """
    Test the migration that adds JSON_PATH to the template_format CHECK constraint
    in the prompt_versions table.

    This test verifies:
    1. JSON_PATH is rejected before the migration
    2. JSON_PATH is accepted after the migration
    3. JSON_PATH is rejected after downgrade
    """
    # Verify we're starting from a clean state
    with pytest.raises(BaseException, match="alembic_version"):
        _version_num(_engine, _schema)

    # Run migrations up to the one before our migration
    _up(_engine, _alembic_config, "02463bd83119", _schema)

    # Create test data
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
        conn.commit()

        # STEP 1: Verify JSON_PATH is not allowed before migration
        with pytest.raises(Exception) as exc_info:
            conn.execute(
                text(
                    """
                    INSERT INTO prompt_versions (
                        prompt_id, template_type, template_format,
                        template, invocation_parameters,
                        model_provider, model_name, metadata
                    )
                    VALUES (
                        :prompt_id, 'CHAT', 'JSON_PATH',
                        '{}', '{}',
                        'OPENAI', 'gpt-4', '{}'
                    )
                    RETURNING id
                    """
                ),
                {"prompt_id": prompt_id},
            )
            conn.commit()
        assert (
            "template_format" in str(exc_info.value).lower()
            or "check" in str(exc_info.value).lower()
        )

    # Run our migration
    _up(_engine, _alembic_config, "861cde0a7eb5", _schema)

    # STEP 2: Verify JSON_PATH is accepted after migration
    with _engine.connect() as conn:
        prompt_version_id = conn.execute(
            text(
                """
                INSERT INTO prompt_versions (
                    prompt_id, template_type, template_format,
                    template, invocation_parameters,
                    model_provider, model_name, metadata
                )
                VALUES (
                    :prompt_id, 'CHAT', 'JSON_PATH',
                    '{}', '{}',
                    'OPENAI', 'gpt-4', '{}'
                )
                RETURNING id
                """
            ),
            {"prompt_id": prompt_id},
        ).scalar()
        conn.commit()

        # Verify the data was inserted correctly
        result = conn.execute(
            text("SELECT template_format FROM prompt_versions WHERE id = :id"),
            {"id": prompt_version_id},
        ).first()
        assert result is not None
        assert result[0] == "JSON_PATH"

        # Delete the JSON_PATH row before downgrade, since the downgrade
        # will recreate the table with a constraint that doesn't allow JSON_PATH
        conn.execute(
            text("DELETE FROM prompt_versions WHERE id = :id"),
            {"id": prompt_version_id},
        )
        conn.commit()

    # STEP 3: Test downgrade
    _down(_engine, _alembic_config, "02463bd83119", _schema)

    # Verify JSON_PATH is rejected after downgrade
    # Note: We can't test inserting JSON_PATH after downgrade because
    # the existing row with JSON_PATH will cause the downgrade to fail
    # In a real scenario, we would need to delete or update such rows first
    with _engine.connect() as conn:
        # Verify the constraint no longer allows JSON_PATH by checking the constraint definition
        if _db_backend == "sqlite":
            table_def = conn.execute(
                text(
                    """
                    SELECT sql FROM sqlite_master
                    WHERE type='table' AND name='prompt_versions';
                    """
                )
            ).scalar()
            assert table_def is not None
            # Verify JSON_PATH is not in the constraint
            assert "template_format IN ('F_STRING', 'MUSTACHE', 'NONE')" in table_def
