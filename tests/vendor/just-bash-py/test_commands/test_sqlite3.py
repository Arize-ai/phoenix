"""Tests for sqlite3 command."""

import pytest
from just_bash import Bash


class TestSqlite3Basic:
    """Test basic sqlite3 functionality."""

    @pytest.mark.asyncio
    async def test_create_and_select(self):
        """Create table and select data."""
        bash = Bash()
        result = await bash.exec(
            'sqlite3 :memory: "CREATE TABLE users (id INTEGER, name TEXT); '
            "INSERT INTO users VALUES (1, 'Alice'); "
            'SELECT * FROM users;"'
        )
        assert result.exit_code == 0
        assert "1" in result.stdout
        assert "Alice" in result.stdout

    @pytest.mark.asyncio
    async def test_multiple_inserts(self):
        """Insert multiple rows."""
        bash = Bash()
        result = await bash.exec(
            'sqlite3 :memory: "CREATE TABLE t (val INTEGER); '
            "INSERT INTO t VALUES (1); "
            "INSERT INTO t VALUES (2); "
            "INSERT INTO t VALUES (3); "
            'SELECT * FROM t;"'
        )
        assert result.exit_code == 0
        assert "1" in result.stdout
        assert "2" in result.stdout
        assert "3" in result.stdout

    @pytest.mark.asyncio
    async def test_sql_from_stdin(self):
        """Execute SQL from stdin."""
        bash = Bash()
        result = await bash.exec(
            "echo 'SELECT 1 + 1;' | sqlite3 :memory:"
        )
        assert result.exit_code == 0
        assert "2" in result.stdout

    @pytest.mark.asyncio
    async def test_version_flag(self):
        """Show version with -version flag."""
        bash = Bash()
        result = await bash.exec("sqlite3 -version")
        assert result.exit_code == 0
        # Version should be a number like "3.x.x"
        assert "3." in result.stdout

    @pytest.mark.asyncio
    async def test_help_flag(self):
        """Show help with --help flag."""
        bash = Bash()
        result = await bash.exec("sqlite3 --help")
        assert result.exit_code == 0
        assert "Usage" in result.stdout


class TestSqlite3OutputModes:
    """Test different output modes."""

    @pytest.mark.asyncio
    async def test_list_mode_default(self):
        """Default list mode with pipe separator."""
        bash = Bash()
        result = await bash.exec(
            'sqlite3 :memory: "SELECT 1 as a, 2 as b;"'
        )
        assert result.exit_code == 0
        assert "1|2" in result.stdout

    @pytest.mark.asyncio
    async def test_csv_mode(self):
        """CSV output mode."""
        bash = Bash()
        result = await bash.exec(
            'sqlite3 -csv :memory: "SELECT 1 as a, 2 as b;"'
        )
        assert result.exit_code == 0
        assert "1,2" in result.stdout

    @pytest.mark.asyncio
    async def test_json_mode(self):
        """JSON output mode."""
        bash = Bash()
        result = await bash.exec(
            'sqlite3 -json :memory: "CREATE TABLE t (id INTEGER, name TEXT); '
            "INSERT INTO t VALUES (1, 'test'); "
            'SELECT * FROM t;"'
        )
        assert result.exit_code == 0
        assert '"id"' in result.stdout or '"id":' in result.stdout
        assert '"name"' in result.stdout or '"name":' in result.stdout

    @pytest.mark.asyncio
    async def test_line_mode(self):
        """Line output mode (column = value)."""
        bash = Bash()
        result = await bash.exec(
            'sqlite3 -line :memory: "SELECT 1 as col1, 2 as col2;"'
        )
        assert result.exit_code == 0
        assert "col1 = 1" in result.stdout
        assert "col2 = 2" in result.stdout

    @pytest.mark.asyncio
    async def test_column_mode(self):
        """Column output mode (fixed-width)."""
        bash = Bash()
        result = await bash.exec(
            'sqlite3 -column -header :memory: "SELECT 1 as a, 2 as b;"'
        )
        assert result.exit_code == 0
        assert "a" in result.stdout
        assert "b" in result.stdout
        assert "1" in result.stdout
        assert "2" in result.stdout

    @pytest.mark.asyncio
    async def test_tabs_mode(self):
        """Tab-separated output mode."""
        bash = Bash()
        result = await bash.exec(
            'sqlite3 -tabs :memory: "SELECT 1 as a, 2 as b;"'
        )
        assert result.exit_code == 0
        assert "1\t2" in result.stdout

    @pytest.mark.asyncio
    async def test_markdown_mode(self):
        """Markdown table output mode."""
        bash = Bash()
        result = await bash.exec(
            'sqlite3 -markdown :memory: "SELECT 1 as a, 2 as b;"'
        )
        assert result.exit_code == 0
        assert "|" in result.stdout  # Markdown table uses pipes
        assert "-" in result.stdout  # Header separator

    @pytest.mark.asyncio
    async def test_table_mode(self):
        """ASCII table output mode."""
        bash = Bash()
        result = await bash.exec(
            'sqlite3 -table -header :memory: "SELECT 1 as a, 2 as b;"'
        )
        assert result.exit_code == 0
        assert "+" in result.stdout  # Table uses + for corners
        assert "|" in result.stdout


class TestSqlite3Headers:
    """Test header options."""

    @pytest.mark.asyncio
    async def test_header_flag(self):
        """Show headers with -header flag."""
        bash = Bash()
        result = await bash.exec(
            'sqlite3 -header :memory: "SELECT 1 as mycolumn;"'
        )
        assert result.exit_code == 0
        assert "mycolumn" in result.stdout

    @pytest.mark.asyncio
    async def test_noheader_flag(self):
        """Hide headers with -noheader flag."""
        bash = Bash()
        result = await bash.exec(
            'sqlite3 -noheader :memory: "SELECT 1 as mycolumn;"'
        )
        assert result.exit_code == 0
        assert "mycolumn" not in result.stdout
        assert "1" in result.stdout


class TestSqlite3Options:
    """Test other options."""

    @pytest.mark.asyncio
    async def test_separator_flag(self):
        """Custom separator with -separator flag."""
        bash = Bash()
        result = await bash.exec(
            'sqlite3 -separator ";" :memory: "SELECT 1, 2, 3;"'
        )
        assert result.exit_code == 0
        assert "1;2;3" in result.stdout

    @pytest.mark.asyncio
    async def test_nullvalue_flag(self):
        """Custom NULL representation with -nullvalue flag."""
        bash = Bash()
        result = await bash.exec(
            'sqlite3 -nullvalue "NULL" :memory: "SELECT NULL;"'
        )
        assert result.exit_code == 0
        assert "NULL" in result.stdout

    @pytest.mark.asyncio
    async def test_echo_flag(self):
        """Echo SQL before execution with -echo flag."""
        bash = Bash()
        result = await bash.exec(
            'sqlite3 -echo :memory: "SELECT 42;"'
        )
        assert result.exit_code == 0
        assert "SELECT 42" in result.stdout
        assert "42" in result.stdout

    @pytest.mark.asyncio
    async def test_bail_flag(self):
        """Stop on first error with -bail flag."""
        bash = Bash()
        result = await bash.exec(
            'sqlite3 -bail :memory: "SELECT * FROM nonexistent; SELECT 1;"'
        )
        # Should fail on first error
        assert result.exit_code == 1
        assert "Error" in result.stdout or "Error" in result.stderr


class TestSqlite3Errors:
    """Test error handling."""

    @pytest.mark.asyncio
    async def test_sql_error(self):
        """SQL syntax error."""
        bash = Bash()
        result = await bash.exec(
            'sqlite3 :memory: "SELECT * FROM nonexistent_table;"'
        )
        # Should report error
        assert "error" in result.stdout.lower() or "error" in result.stderr.lower()

    @pytest.mark.asyncio
    async def test_missing_database(self):
        """Missing database argument."""
        bash = Bash()
        result = await bash.exec("sqlite3")
        assert result.exit_code == 1
        assert "missing database" in result.stderr.lower() or "missing" in result.stderr.lower()

    @pytest.mark.asyncio
    async def test_unsupported_database(self):
        """Non-memory database not supported."""
        bash = Bash()
        result = await bash.exec('sqlite3 /path/to/db.sqlite "SELECT 1;"')
        assert result.exit_code == 1
        assert "memory" in result.stderr.lower()

    @pytest.mark.asyncio
    async def test_no_sql_provided(self):
        """No SQL provided."""
        bash = Bash()
        result = await bash.exec('echo "" | sqlite3 :memory:')
        assert result.exit_code == 1


class TestSqlite3Queries:
    """Test various SQL queries."""

    @pytest.mark.asyncio
    async def test_aggregate_functions(self):
        """Aggregate functions (COUNT, SUM, etc.)."""
        bash = Bash()
        result = await bash.exec(
            'sqlite3 :memory: "CREATE TABLE t (v INTEGER); '
            "INSERT INTO t VALUES (1), (2), (3), (4), (5); "
            'SELECT COUNT(*), SUM(v), AVG(v) FROM t;"'
        )
        assert result.exit_code == 0
        assert "5" in result.stdout  # COUNT
        assert "15" in result.stdout  # SUM
        assert "3" in result.stdout  # AVG

    @pytest.mark.asyncio
    async def test_join_query(self):
        """JOIN query."""
        bash = Bash()
        result = await bash.exec(
            'sqlite3 :memory: "'
            "CREATE TABLE a (id INTEGER, name TEXT); "
            "CREATE TABLE b (id INTEGER, value INTEGER); "
            "INSERT INTO a VALUES (1, 'one'); "
            "INSERT INTO b VALUES (1, 100); "
            'SELECT a.name, b.value FROM a JOIN b ON a.id = b.id;"'
        )
        assert result.exit_code == 0
        assert "one" in result.stdout
        assert "100" in result.stdout

    @pytest.mark.asyncio
    async def test_where_clause(self):
        """WHERE clause filtering."""
        bash = Bash()
        result = await bash.exec(
            'sqlite3 :memory: "CREATE TABLE t (v INTEGER); '
            "INSERT INTO t VALUES (1), (2), (3); "
            'SELECT * FROM t WHERE v > 1;"'
        )
        assert result.exit_code == 0
        assert "2" in result.stdout
        assert "3" in result.stdout
        # 1 should not be in the filtered output (only in setup)
