from secrets import token_hex
from typing import Any

import pytest
from sqlalchemy import select

from phoenix.db import models
from phoenix.server.types import DbSessionFactory


async def test_projects_with_session_injection(
    db: DbSessionFactory,
    project: Any,
) -> None:
    # this test demonstrates parametrizing the session fixture
    statement = select(models.Project).where(models.Project.name == "test_project")
    async with db() as session:
        result = (await session.execute(statement)).scalars().first()
    assert result is not None


async def test_projects_with_db_injection(
    db: DbSessionFactory,
    project: Any,
) -> None:
    # this test demonstrates mixing the db and model fixtures
    statement = select(models.Project).where(models.Project.name == "test_project")
    async with db() as session:
        result = (await session.execute(statement)).scalars().first()
    assert result is not None


async def test_empty_projects(
    db: DbSessionFactory,
) -> None:
    # shows that databases are reset between tests
    statement = select(models.Project).where(models.Project.name == "test_project")
    async with db() as session:
        result = (await session.execute(statement)).scalars().first()
    assert not result


class TestCaseInsensitiveContains:
    @pytest.fixture
    async def _case_insensitive_data(
        self,
        db: DbSessionFactory,
    ) -> list[models.Project]:
        """Create test data for case-insensitive filtering with unicode characters."""
        # Create comprehensive test data that covers various Unicode and special character scenarios
        descriptions = [
            "Hello Wörld",  # 0: Basic Unicode (German umlaut)
            "HELLO wörld",  # 1: Mixed case Unicode
            "Café Naïve",  # 2: French accents
            "café naïve",  # 3: Lowercase French accents
            "test_underscore%percent",  # 4: LIKE special characters
            "path\\to\\file",  # 5: Backslashes
            "query_like_%_pattern",  # 6: Multiple LIKE special chars
            "  Space123  ",  # 7: Whitespace and numbers
            "Hello 世界",  # 8: Chinese characters
            "'; dRoP tAbLe UsErS;--",  # 9: SQL injection patterns
            "repeat_pattern_" * 10,  # 10: Long repeated pattern
            "café",  # 11: Unicode normalization test
            "completely different",  # 12: Control case
            "αβγ ñoño",  # 13: Greek + Spanish
            "C:\\Windows\\System32",  # 14: Windows paths
            "data%%%multiple",  # 15: Multiple consecutive percent signs
            "test___underscores",  # 16: Multiple consecutive underscores
            "path\\\\\\escaped",  # 17: Multiple consecutive backslashes
            "%_mixed_special_%",  # 18: Mixed special chars at boundaries
            "unicode_café%wörld",  # 19: Unicode combined with special chars
            "\\%escaped_percent",  # 20: Escaped percent sign
            "\\_escaped_underscore",  # 21: Escaped underscore
            "sql%_injection'--",  # 22: Complex SQL injection with special chars
            "regex[.*]%like_",  # 23: Regex-like pattern with special chars
            None,  # 24: None
        ]

        projects = [
            models.Project(
                name=token_hex(8),
                description=description,
            )
            for description in descriptions
        ]
        async with db() as session:
            session.add_all(projects)

        return projects

    async def test_case_insensitive_contains(
        self,
        _case_insensitive_data: list[models.Project],
        db: DbSessionFactory,
    ) -> None:
        """Comprehensive test for CaseInsensitiveContains covering Unicode,
        special chars, security, and edge cases."""

        def get_expected_indices(search_term: str) -> list[int]:
            if search_term == "":
                return [
                    i
                    for i, project in enumerate(_case_insensitive_data)
                    if project.description is not None
                ]
            search_lower = search_term.lower()
            # Use the actual project descriptions from the database
            return [
                i
                for i, project in enumerate(_case_insensitive_data)
                if project.description is not None
                if search_lower in project.description.lower()
            ]

        test_cases = [
            # Unicode case-insensitivity
            ("hello", "Unicode: basic case-insensitive matching"),
            ("WÖRLD", "Unicode: German umlauts case-insensitive"),
            ("café", "Unicode: French accents"),
            ("NAÏVE", "Unicode: French accents case-insensitive"),
            ("ö", "Unicode: single character"),
            ("世界", "Unicode: Chinese characters"),
            ("αβγ", "Unicode: Greek letters"),
            ("ñoño", "Unicode: Spanish with tildes"),
            # LIKE special character escaping
            ("%", "Special chars: literal percent"),
            ("_", "Special chars: literal underscore"),
            ("\\", "Special chars: literal backslash"),
            ("test_underscore", "Special chars: word with underscore"),
            ("%percent", "Special chars: trailing percent"),
            ("_pattern", "Special chars: leading underscore"),
            ("C:\\Windows", "Special chars: Windows path"),
            ("query_like_%_pattern", "Special chars: multiple special chars"),
            # Advanced escaping edge cases
            ("%%%", "Escaping: multiple consecutive percent signs"),
            ("___", "Escaping: multiple consecutive underscores"),
            ("\\\\\\", "Escaping: multiple consecutive backslashes"),
            ("%_", "Escaping: mixed special chars"),
            ("_%", "Escaping: underscore followed by percent"),
            ("café%", "Escaping: Unicode with special chars"),
            ("\\%", "Escaping: escaped percent sign"),
            ("\\_", "Escaping: escaped underscore"),
            ("injection'--", "Escaping: SQL injection with quote and comment"),
            ("[.*]", "Escaping: regex-like patterns"),
            ("%like_", "Escaping: percent and underscore combination"),
            # SQL injection protection
            ("'", "Security: single quote"),
            ("DROP", "Security: SQL keyword"),
            ("--", "Security: SQL comment"),
            ("'; DROP TABLE users;--", "Security: full injection attempt"),
            # Edge cases and boundary conditions
            ("", "Edge case: empty string matches all"),
            ("  ", "Edge case: double space"),
            ("123", "Edge case: numbers"),
            ("Space123", "Edge case: mixed content"),
            ("repeat_pattern_", "Edge case: long pattern matching"),
            ("nonexistent", "Edge case: no matches"),
            ("completely different", "Edge case: exact match"),
        ]

        for substring, test_description in test_cases:
            expected_indices = get_expected_indices(substring)
            async with db() as session:
                stmt = select(models.Project).where(
                    models.CaseInsensitiveContains(models.Project.description, substring)
                )
                results = (await session.scalars(stmt)).all()
                actual_ids = {project.id for project in results}
                expected_ids = {_case_insensitive_data[i].id for i in expected_indices}

                assert actual_ids == expected_ids, f"{test_description} failed for '{substring}'"
