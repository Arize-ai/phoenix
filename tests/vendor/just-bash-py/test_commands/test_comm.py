"""Tests for comm command."""

import pytest
from just_bash import Bash


class TestCommBasic:
    """Test basic comm functionality."""

    @pytest.mark.asyncio
    async def test_comm_identical_files(self):
        """Files with identical content."""
        bash = Bash(files={
            "/file1.txt": "a\nb\nc\n",
            "/file2.txt": "a\nb\nc\n",
        })
        result = await bash.exec("comm /file1.txt /file2.txt")
        assert result.exit_code == 0
        # All lines should be in column 3 (common)
        assert "\t\ta" in result.stdout
        assert "\t\tb" in result.stdout
        assert "\t\tc" in result.stdout

    @pytest.mark.asyncio
    async def test_comm_unique_to_file1(self):
        """Lines unique to first file."""
        bash = Bash(files={
            "/file1.txt": "a\nb\nc\n",
            "/file2.txt": "b\n",
        })
        result = await bash.exec("comm /file1.txt /file2.txt")
        assert result.exit_code == 0
        # 'a' and 'c' should be in column 1 (unique to file1)
        assert result.stdout.startswith("a")  # Column 1, no tab
        assert "c" in result.stdout

    @pytest.mark.asyncio
    async def test_comm_unique_to_file2(self):
        """Lines unique to second file."""
        bash = Bash(files={
            "/file1.txt": "b\n",
            "/file2.txt": "a\nb\nc\n",
        })
        result = await bash.exec("comm /file1.txt /file2.txt")
        assert result.exit_code == 0
        # 'a' and 'c' should be in column 2
        assert "\ta" in result.stdout
        assert "\tc" in result.stdout

    @pytest.mark.asyncio
    async def test_comm_mixed(self):
        """Mix of unique and common lines."""
        bash = Bash(files={
            "/file1.txt": "a\nc\ne\n",
            "/file2.txt": "b\nc\nd\n",
        })
        result = await bash.exec("comm /file1.txt /file2.txt")
        assert result.exit_code == 0
        # a, e unique to file1 (col 1)
        # b, d unique to file2 (col 2)
        # c common (col 3)


class TestCommSuppressColumns:
    """Test column suppression flags."""

    @pytest.mark.asyncio
    async def test_suppress_col1(self):
        """Suppress column 1 with -1."""
        bash = Bash(files={
            "/file1.txt": "a\nb\n",
            "/file2.txt": "b\nc\n",
        })
        result = await bash.exec("comm -1 /file1.txt /file2.txt")
        assert result.exit_code == 0
        # 'a' should NOT be in output (was unique to file1)
        assert "a" not in result.stdout
        # 'b' (common) and 'c' (unique to file2) should be present
        assert "b" in result.stdout
        assert "c" in result.stdout

    @pytest.mark.asyncio
    async def test_suppress_col2(self):
        """Suppress column 2 with -2."""
        bash = Bash(files={
            "/file1.txt": "a\nb\n",
            "/file2.txt": "b\nc\n",
        })
        result = await bash.exec("comm -2 /file1.txt /file2.txt")
        assert result.exit_code == 0
        # 'c' should NOT be in output (was unique to file2)
        assert "c" not in result.stdout
        # 'a' and 'b' should be present
        assert "a" in result.stdout
        assert "b" in result.stdout

    @pytest.mark.asyncio
    async def test_suppress_col3(self):
        """Suppress column 3 with -3."""
        bash = Bash(files={
            "/file1.txt": "a\nb\n",
            "/file2.txt": "b\nc\n",
        })
        result = await bash.exec("comm -3 /file1.txt /file2.txt")
        assert result.exit_code == 0
        # 'b' should NOT be in output (was common)
        # 'a' and 'c' should be present
        assert "a" in result.stdout
        assert "c" in result.stdout

    @pytest.mark.asyncio
    async def test_suppress_12(self):
        """Suppress columns 1 and 2 with -12."""
        bash = Bash(files={
            "/file1.txt": "a\nb\nc\n",
            "/file2.txt": "b\nc\nd\n",
        })
        result = await bash.exec("comm -12 /file1.txt /file2.txt")
        assert result.exit_code == 0
        # Only common lines (b, c) should be output
        assert "b" in result.stdout
        assert "c" in result.stdout
        assert "a" not in result.stdout
        assert "d" not in result.stdout

    @pytest.mark.asyncio
    async def test_suppress_13(self):
        """Suppress columns 1 and 3 with -13."""
        bash = Bash(files={
            "/file1.txt": "a\nb\nc\n",
            "/file2.txt": "b\nc\nd\n",
        })
        result = await bash.exec("comm -13 /file1.txt /file2.txt")
        assert result.exit_code == 0
        # Only lines unique to file2 (d) should be output
        assert "d" in result.stdout
        assert "a" not in result.stdout
        assert "b" not in result.stdout
        assert "c" not in result.stdout

    @pytest.mark.asyncio
    async def test_suppress_23(self):
        """Suppress columns 2 and 3 with -23."""
        bash = Bash(files={
            "/file1.txt": "a\nb\nc\n",
            "/file2.txt": "b\nc\nd\n",
        })
        result = await bash.exec("comm -23 /file1.txt /file2.txt")
        assert result.exit_code == 0
        # Only lines unique to file1 (a) should be output
        assert "a" in result.stdout
        assert "b" not in result.stdout
        assert "c" not in result.stdout
        assert "d" not in result.stdout

    @pytest.mark.asyncio
    async def test_suppress_all(self):
        """Suppress all columns with -123."""
        bash = Bash(files={
            "/file1.txt": "a\nb\n",
            "/file2.txt": "b\nc\n",
        })
        result = await bash.exec("comm -123 /file1.txt /file2.txt")
        assert result.exit_code == 0
        # No output expected
        assert result.stdout == ""


class TestCommEdgeCases:
    """Test edge cases."""

    @pytest.mark.asyncio
    async def test_comm_empty_files(self):
        """Both files empty."""
        bash = Bash(files={
            "/file1.txt": "",
            "/file2.txt": "",
        })
        result = await bash.exec("comm /file1.txt /file2.txt")
        assert result.exit_code == 0
        assert result.stdout == ""

    @pytest.mark.asyncio
    async def test_comm_one_empty(self):
        """One file empty."""
        bash = Bash(files={
            "/file1.txt": "a\nb\n",
            "/file2.txt": "",
        })
        result = await bash.exec("comm /file1.txt /file2.txt")
        assert result.exit_code == 0
        # All lines from file1 should be in column 1
        assert "a" in result.stdout
        assert "b" in result.stdout

    @pytest.mark.asyncio
    async def test_comm_nonexistent_file(self):
        """Nonexistent file error."""
        bash = Bash(files={"/file1.txt": "a\n"})
        result = await bash.exec("comm /file1.txt /nonexistent.txt")
        assert result.exit_code == 1
        assert "No such file" in result.stderr

    @pytest.mark.asyncio
    async def test_comm_missing_operand(self):
        """Missing file argument."""
        bash = Bash()
        result = await bash.exec("comm")
        assert result.exit_code == 1
        assert "missing operand" in result.stderr

    @pytest.mark.asyncio
    async def test_comm_help(self):
        """Help output."""
        bash = Bash()
        result = await bash.exec("comm --help")
        assert result.exit_code == 0
        assert "Usage" in result.stdout
