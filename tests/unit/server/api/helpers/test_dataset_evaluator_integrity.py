from sqlalchemy.exc import IntegrityError as SQLAlchemyIntegrityError
from sqlean.dbapi2 import IntegrityError as SQLiteIntegrityError  # type: ignore[import-untyped]

from phoenix.server.api.helpers.dataset_evaluator_service import _is_foreign_key_violation


class _SqlStateError(Exception):
    def __init__(self, message: str, sqlstate: str) -> None:
        super().__init__(message)
        self.sqlstate = sqlstate


def test_unique_violation_whose_values_contain_foreign_is_not_a_missing_dataset() -> None:
    error = SQLAlchemyIntegrityError(
        "INSERT INTO dataset_evaluators (name, description) VALUES (%(name)s, %(description)s)",
        {"name": "foreign", "description": "mentions a foreign model"},
        Exception(
            "UNIQUE constraint failed: dataset_evaluators.dataset_id, dataset_evaluators.name"
        ),
    )
    assert "foreign" in str(error).lower()
    assert not _is_foreign_key_violation(error)


def test_postgres_foreign_key_sqlstate_is_a_missing_dataset() -> None:
    error = SQLAlchemyIntegrityError(
        "INSERT INTO dataset_evaluators (dataset_id) VALUES (%(dataset_id)s)",
        {"dataset_id": 1, "name": "foreign"},
        _SqlStateError("insert or update violates foreign key constraint", "23503"),
    )
    assert _is_foreign_key_violation(error)


def test_postgres_unique_sqlstate_is_not_a_missing_dataset_even_when_the_value_says_foreign_key() -> (
    None
):
    error = SQLAlchemyIntegrityError(
        "INSERT INTO dataset_evaluators (description) VALUES (%(description)s)",
        {"description": "foreign key"},
        _SqlStateError("duplicate key value violates unique constraint", "23505"),
    )
    assert not _is_foreign_key_violation(error)


def test_sqlite_driver_message_distinguishes_foreign_key_from_unique() -> None:
    foreign_key = SQLAlchemyIntegrityError(
        "INSERT",
        {"name": "ok"},
        SQLiteIntegrityError("FOREIGN KEY constraint failed"),
    )
    unique = SQLiteIntegrityError(
        "UNIQUE constraint failed: dataset_evaluators.dataset_id, dataset_evaluators.name"
    )
    assert _is_foreign_key_violation(foreign_key)
    assert _is_foreign_key_violation(SQLiteIntegrityError("FOREIGN KEY constraint failed"))
    assert not _is_foreign_key_violation(unique)
