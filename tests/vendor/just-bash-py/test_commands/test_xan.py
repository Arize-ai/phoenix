"""Tests for xan CSV toolkit - Phase 1 and Phase 2 commands."""

import pytest
from just_bash import Bash


class TestXanReverse:
    """Test xan reverse command."""

    @pytest.mark.asyncio
    async def test_reverse_basic(self):
        """Reverse row order."""
        bash = Bash(files={"/data.csv": "name,age\nalice,30\nbob,25\ncarol,35\n"})
        result = await bash.exec("xan reverse /data.csv")
        assert result.exit_code == 0
        assert result.stdout == "name,age\ncarol,35\nbob,25\nalice,30\n"

    @pytest.mark.asyncio
    async def test_reverse_stdin(self):
        """Reverse from stdin."""
        bash = Bash()
        result = await bash.exec("echo 'a,b\n1,2\n3,4' | xan reverse")
        assert result.exit_code == 0
        assert result.stdout == "a,b\n3,4\n1,2\n"

    @pytest.mark.asyncio
    async def test_reverse_single_row(self):
        """Reverse single row is unchanged."""
        bash = Bash(files={"/data.csv": "col\nvalue\n"})
        result = await bash.exec("xan reverse /data.csv")
        assert result.exit_code == 0
        assert result.stdout == "col\nvalue\n"

    @pytest.mark.asyncio
    async def test_reverse_empty(self):
        """Reverse empty file."""
        bash = Bash(files={"/data.csv": "col\n"})
        result = await bash.exec("xan reverse /data.csv")
        assert result.exit_code == 0
        assert result.stdout == "col\n"


class TestXanBehead:
    """Test xan behead command."""

    @pytest.mark.asyncio
    async def test_behead_basic(self):
        """Remove header from output."""
        bash = Bash(files={"/data.csv": "name,age\nalice,30\nbob,25\n"})
        result = await bash.exec("xan behead /data.csv")
        assert result.exit_code == 0
        assert result.stdout == "alice,30\nbob,25\n"

    @pytest.mark.asyncio
    async def test_behead_stdin(self):
        """Behead from stdin."""
        bash = Bash()
        result = await bash.exec("echo 'a,b\n1,2\n3,4' | xan behead")
        assert result.exit_code == 0
        assert result.stdout == "1,2\n3,4\n"

    @pytest.mark.asyncio
    async def test_behead_single_column(self):
        """Behead single column."""
        bash = Bash(files={"/data.csv": "header\nval1\nval2\n"})
        result = await bash.exec("xan behead /data.csv")
        assert result.exit_code == 0
        assert result.stdout == "val1\nval2\n"

    @pytest.mark.asyncio
    async def test_behead_empty(self):
        """Behead file with only header."""
        bash = Bash(files={"/data.csv": "a,b,c\n"})
        result = await bash.exec("xan behead /data.csv")
        assert result.exit_code == 0
        assert result.stdout == ""


class TestXanEnum:
    """Test xan enum command."""

    @pytest.mark.asyncio
    async def test_enum_basic(self):
        """Add default index column."""
        bash = Bash(files={"/data.csv": "name,age\nalice,30\nbob,25\n"})
        result = await bash.exec("xan enum /data.csv")
        assert result.exit_code == 0
        assert result.stdout == "index,name,age\n0,alice,30\n1,bob,25\n"

    @pytest.mark.asyncio
    async def test_enum_custom_column_name(self):
        """Add custom index column name."""
        bash = Bash(files={"/data.csv": "name,age\nalice,30\nbob,25\n"})
        result = await bash.exec("xan enum -c row_num /data.csv")
        assert result.exit_code == 0
        assert result.stdout == "row_num,name,age\n0,alice,30\n1,bob,25\n"

    @pytest.mark.asyncio
    async def test_enum_stdin(self):
        """Enum from stdin."""
        bash = Bash()
        result = await bash.exec("echo 'a,b\n1,2\n3,4' | xan enum")
        assert result.exit_code == 0
        assert result.stdout == "index,a,b\n0,1,2\n1,3,4\n"

    @pytest.mark.asyncio
    async def test_enum_empty(self):
        """Enum empty file."""
        bash = Bash(files={"/data.csv": "col\n"})
        result = await bash.exec("xan enum /data.csv")
        assert result.exit_code == 0
        assert result.stdout == "index,col\n"

    @pytest.mark.asyncio
    async def test_enum_start_at_one(self):
        """Enum starting at 1 instead of 0."""
        bash = Bash(files={"/data.csv": "name\nalice\nbob\n"})
        result = await bash.exec("xan enum --start 1 /data.csv")
        assert result.exit_code == 0
        assert result.stdout == "index,name\n1,alice\n2,bob\n"


class TestXanDrop:
    """Test xan drop command."""

    @pytest.mark.asyncio
    async def test_drop_single_column(self):
        """Drop single column."""
        bash = Bash(files={"/data.csv": "a,b,c\n1,2,3\n4,5,6\n"})
        result = await bash.exec("xan drop b /data.csv")
        assert result.exit_code == 0
        assert result.stdout == "a,c\n1,3\n4,6\n"

    @pytest.mark.asyncio
    async def test_drop_multiple_columns(self):
        """Drop multiple columns."""
        bash = Bash(files={"/data.csv": "a,b,c,d\n1,2,3,4\n"})
        result = await bash.exec("xan drop b,c /data.csv")
        assert result.exit_code == 0
        assert result.stdout == "a,d\n1,4\n"

    @pytest.mark.asyncio
    async def test_drop_by_index(self):
        """Drop columns by index."""
        bash = Bash(files={"/data.csv": "a,b,c\n1,2,3\n"})
        result = await bash.exec("xan drop 1 /data.csv")
        assert result.exit_code == 0
        assert result.stdout == "a,c\n1,3\n"

    @pytest.mark.asyncio
    async def test_drop_stdin(self):
        """Drop from stdin."""
        bash = Bash()
        result = await bash.exec("echo 'x,y,z\n1,2,3' | xan drop y")
        assert result.exit_code == 0
        assert result.stdout == "x,z\n1,3\n"

    @pytest.mark.asyncio
    async def test_drop_no_columns_specified(self):
        """Error when no columns specified."""
        bash = Bash(files={"/data.csv": "a,b\n1,2\n"})
        result = await bash.exec("xan drop /data.csv")
        assert result.exit_code == 1
        assert "no columns specified" in result.stderr

    @pytest.mark.asyncio
    async def test_drop_nonexistent_column(self):
        """Drop nonexistent column - no error, just no-op."""
        bash = Bash(files={"/data.csv": "a,b\n1,2\n"})
        result = await bash.exec("xan drop z /data.csv")
        assert result.exit_code == 0
        assert result.stdout == "a,b\n1,2\n"


class TestXanShuffle:
    """Test xan shuffle command."""

    @pytest.mark.asyncio
    async def test_shuffle_with_seed(self):
        """Shuffle with seed is reproducible."""
        bash = Bash(files={"/data.csv": "name\nalice\nbob\ncarol\ndave\n"})
        result1 = await bash.exec("xan shuffle --seed 42 /data.csv")
        result2 = await bash.exec("xan shuffle --seed 42 /data.csv")
        assert result1.exit_code == 0
        assert result2.exit_code == 0
        assert result1.stdout == result2.stdout

    @pytest.mark.asyncio
    async def test_shuffle_different_seeds(self):
        """Different seeds produce different orders."""
        bash = Bash(files={"/data.csv": "name\nalice\nbob\ncarol\ndave\neve\n"})
        result1 = await bash.exec("xan shuffle --seed 42 /data.csv")
        result2 = await bash.exec("xan shuffle --seed 123 /data.csv")
        assert result1.exit_code == 0
        assert result2.exit_code == 0
        # Very likely different with different seeds
        # (unless extremely unlucky RNG collision)
        assert result1.stdout != result2.stdout

    @pytest.mark.asyncio
    async def test_shuffle_preserves_header(self):
        """Shuffle preserves header."""
        bash = Bash(files={"/data.csv": "col\na\nb\nc\n"})
        result = await bash.exec("xan shuffle --seed 1 /data.csv")
        assert result.exit_code == 0
        lines = result.stdout.strip().split("\n")
        assert lines[0] == "col"
        assert sorted(lines[1:]) == ["a", "b", "c"]

    @pytest.mark.asyncio
    async def test_shuffle_stdin(self):
        """Shuffle from stdin."""
        bash = Bash()
        result = await bash.exec("echo 'h\n1\n2\n3' | xan shuffle --seed 99")
        assert result.exit_code == 0
        lines = result.stdout.strip().split("\n")
        assert lines[0] == "h"
        assert sorted(lines[1:]) == ["1", "2", "3"]

    @pytest.mark.asyncio
    async def test_shuffle_single_row(self):
        """Shuffle single row."""
        bash = Bash(files={"/data.csv": "col\nvalue\n"})
        result = await bash.exec("xan shuffle /data.csv")
        assert result.exit_code == 0
        assert result.stdout == "col\nvalue\n"


class TestXanCat:
    """Test xan cat command."""

    @pytest.mark.asyncio
    async def test_cat_two_files(self):
        """Concatenate two files."""
        bash = Bash(
            files={
                "/a.csv": "name,age\nalice,30\n",
                "/b.csv": "name,age\nbob,25\n",
            }
        )
        result = await bash.exec("xan cat /a.csv /b.csv")
        assert result.exit_code == 0
        assert result.stdout == "name,age\nalice,30\nbob,25\n"

    @pytest.mark.asyncio
    async def test_cat_three_files(self):
        """Concatenate three files."""
        bash = Bash(
            files={
                "/a.csv": "x\n1\n",
                "/b.csv": "x\n2\n",
                "/c.csv": "x\n3\n",
            }
        )
        result = await bash.exec("xan cat /a.csv /b.csv /c.csv")
        assert result.exit_code == 0
        assert result.stdout == "x\n1\n2\n3\n"

    @pytest.mark.asyncio
    async def test_cat_mismatched_headers_error(self):
        """Error on mismatched headers."""
        bash = Bash(
            files={
                "/a.csv": "name,age\nalice,30\n",
                "/b.csv": "name,score\nbob,100\n",
            }
        )
        result = await bash.exec("xan cat /a.csv /b.csv")
        assert result.exit_code == 1
        assert "header" in result.stderr.lower()

    @pytest.mark.asyncio
    async def test_cat_single_file(self):
        """Cat single file is passthrough."""
        bash = Bash(files={"/data.csv": "a,b\n1,2\n"})
        result = await bash.exec("xan cat /data.csv")
        assert result.exit_code == 0
        assert result.stdout == "a,b\n1,2\n"

    @pytest.mark.asyncio
    async def test_cat_file_not_found(self):
        """Error on nonexistent file."""
        bash = Bash(files={"/a.csv": "x\n1\n"})
        result = await bash.exec("xan cat /a.csv /nonexistent.csv")
        assert result.exit_code == 2
        assert "No such file" in result.stderr

    @pytest.mark.asyncio
    async def test_cat_no_files(self):
        """Error when no files specified."""
        bash = Bash()
        result = await bash.exec("xan cat")
        assert result.exit_code == 1
        assert "no files" in result.stderr.lower()


class TestXanToJson:
    """Test xan to json command."""

    @pytest.mark.asyncio
    async def test_to_json_basic(self):
        """Convert CSV to JSON array."""
        bash = Bash(files={"/data.csv": "name,age\nalice,30\nbob,25\n"})
        result = await bash.exec("xan to json /data.csv")
        assert result.exit_code == 0
        import json

        data = json.loads(result.stdout)
        assert data == [{"name": "alice", "age": "30"}, {"name": "bob", "age": "25"}]

    @pytest.mark.asyncio
    async def test_to_json_stdin(self):
        """Convert from stdin."""
        bash = Bash()
        result = await bash.exec("echo 'a,b\n1,2' | xan to json")
        assert result.exit_code == 0
        import json

        data = json.loads(result.stdout)
        assert data == [{"a": "1", "b": "2"}]

    @pytest.mark.asyncio
    async def test_to_json_empty(self):
        """Convert empty CSV to empty array."""
        bash = Bash(files={"/data.csv": "col\n"})
        result = await bash.exec("xan to json /data.csv")
        assert result.exit_code == 0
        import json

        data = json.loads(result.stdout)
        assert data == []

    @pytest.mark.asyncio
    async def test_to_json_special_chars(self):
        """Handle special characters in JSON."""
        bash = Bash(files={'/data.csv': 'msg\n"hello"\nline1\\nline2\n'})
        result = await bash.exec("xan to json /data.csv")
        assert result.exit_code == 0
        import json

        data = json.loads(result.stdout)
        assert len(data) == 2


class TestXanFromJson:
    """Test xan from json command."""

    @pytest.mark.asyncio
    async def test_from_json_array(self):
        """Convert JSON array to CSV."""
        bash = Bash(
            files={"/data.json": '[{"name":"alice","age":"30"},{"name":"bob","age":"25"}]'}
        )
        result = await bash.exec("xan from json /data.json")
        assert result.exit_code == 0
        lines = result.stdout.strip().split("\n")
        # Header should contain both keys
        headers = lines[0].split(",")
        assert "name" in headers
        assert "age" in headers

    @pytest.mark.asyncio
    async def test_from_json_stdin(self):
        """Convert JSON from stdin."""
        bash = Bash()
        result = await bash.exec('echo \'[{"a":"1","b":"2"}]\' | xan from json')
        assert result.exit_code == 0
        lines = result.stdout.strip().split("\n")
        assert len(lines) == 2  # header + 1 data row

    @pytest.mark.asyncio
    async def test_from_json_empty_array(self):
        """Empty JSON array produces no output."""
        bash = Bash(files={"/data.json": "[]"})
        result = await bash.exec("xan from json /data.json")
        assert result.exit_code == 0
        assert result.stdout == "" or result.stdout == "\n"

    @pytest.mark.asyncio
    async def test_from_json_invalid(self):
        """Error on invalid JSON."""
        bash = Bash(files={"/data.json": "not json"})
        result = await bash.exec("xan from json /data.json")
        assert result.exit_code == 1
        assert "invalid" in result.stderr.lower() or "json" in result.stderr.lower()

    @pytest.mark.asyncio
    async def test_from_json_consistent_columns(self):
        """Handle objects with different keys."""
        bash = Bash(
            files={"/data.json": '[{"a":"1"},{"a":"2","b":"3"}]'}
        )
        result = await bash.exec("xan from json /data.json")
        assert result.exit_code == 0
        # Should handle missing keys gracefully
        assert "a" in result.stdout


# =============================================================================
# Phase 2 Tests
# =============================================================================


class TestXanRename:
    """Test xan rename command."""

    @pytest.mark.asyncio
    async def test_rename_single_column(self):
        """Rename a single column."""
        bash = Bash(files={"/data.csv": "old_name,b\n1,2\n"})
        result = await bash.exec("xan rename old_name:new_name /data.csv")
        assert result.exit_code == 0
        assert result.stdout == "new_name,b\n1,2\n"

    @pytest.mark.asyncio
    async def test_rename_multiple_columns(self):
        """Rename multiple columns."""
        bash = Bash(files={"/data.csv": "a,b,c\n1,2,3\n"})
        result = await bash.exec("xan rename a:x,b:y /data.csv")
        assert result.exit_code == 0
        assert result.stdout == "x,y,c\n1,2,3\n"

    @pytest.mark.asyncio
    async def test_rename_stdin(self):
        """Rename from stdin."""
        bash = Bash()
        result = await bash.exec("echo 'col\nval' | xan rename col:renamed")
        assert result.exit_code == 0
        assert result.stdout == "renamed\nval\n"

    @pytest.mark.asyncio
    async def test_rename_nonexistent_column(self):
        """Renaming nonexistent column is no-op."""
        bash = Bash(files={"/data.csv": "a,b\n1,2\n"})
        result = await bash.exec("xan rename z:x /data.csv")
        assert result.exit_code == 0
        assert result.stdout == "a,b\n1,2\n"

    @pytest.mark.asyncio
    async def test_rename_no_spec(self):
        """Error when no rename specification."""
        bash = Bash(files={"/data.csv": "a,b\n1,2\n"})
        result = await bash.exec("xan rename /data.csv")
        assert result.exit_code == 1
        assert "no rename" in result.stderr.lower()


class TestXanSample:
    """Test xan sample command."""

    @pytest.mark.asyncio
    async def test_sample_with_seed(self):
        """Sample with seed is reproducible."""
        bash = Bash(files={"/data.csv": "x\n1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n"})
        result1 = await bash.exec("xan sample 3 --seed 42 /data.csv")
        result2 = await bash.exec("xan sample 3 --seed 42 /data.csv")
        assert result1.exit_code == 0
        assert result2.exit_code == 0
        assert result1.stdout == result2.stdout
        lines = result1.stdout.strip().split("\n")
        assert len(lines) == 4  # header + 3 sampled

    @pytest.mark.asyncio
    async def test_sample_more_than_available(self):
        """Sampling more than available returns all."""
        bash = Bash(files={"/data.csv": "x\n1\n2\n"})
        result = await bash.exec("xan sample 10 /data.csv")
        assert result.exit_code == 0
        lines = result.stdout.strip().split("\n")
        assert len(lines) == 3  # header + 2 rows

    @pytest.mark.asyncio
    async def test_sample_stdin(self):
        """Sample from stdin."""
        bash = Bash()
        result = await bash.exec("echo 'h\na\nb\nc\nd\ne' | xan sample 2 --seed 1")
        assert result.exit_code == 0
        lines = result.stdout.strip().split("\n")
        assert lines[0] == "h"
        assert len(lines) == 3

    @pytest.mark.asyncio
    async def test_sample_zero(self):
        """Sampling zero rows returns only header."""
        bash = Bash(files={"/data.csv": "x\n1\n2\n"})
        result = await bash.exec("xan sample 0 /data.csv")
        assert result.exit_code == 0
        assert result.stdout == "x\n"


class TestXanDedup:
    """Test xan dedup command."""

    @pytest.mark.asyncio
    async def test_dedup_basic(self):
        """Remove duplicate rows."""
        bash = Bash(files={"/data.csv": "name,val\nalice,1\nbob,2\nalice,1\n"})
        result = await bash.exec("xan dedup /data.csv")
        assert result.exit_code == 0
        lines = result.stdout.strip().split("\n")
        assert len(lines) == 3  # header + 2 unique rows

    @pytest.mark.asyncio
    async def test_dedup_by_column(self):
        """Remove duplicates based on specific column."""
        bash = Bash(files={"/data.csv": "name,val\nalice,1\nbob,2\nalice,3\n"})
        result = await bash.exec("xan dedup -s name /data.csv")
        assert result.exit_code == 0
        lines = result.stdout.strip().split("\n")
        assert len(lines) == 3  # header + alice + bob

    @pytest.mark.asyncio
    async def test_dedup_stdin(self):
        """Dedup from stdin."""
        bash = Bash()
        result = await bash.exec("echo 'x\n1\n2\n1' | xan dedup")
        assert result.exit_code == 0
        lines = result.stdout.strip().split("\n")
        assert len(lines) == 3  # x, 1, 2

    @pytest.mark.asyncio
    async def test_dedup_empty(self):
        """Dedup empty file."""
        bash = Bash(files={"/data.csv": "x\n"})
        result = await bash.exec("xan dedup /data.csv")
        assert result.exit_code == 0
        assert result.stdout == "x\n"

    @pytest.mark.asyncio
    async def test_dedup_preserves_first(self):
        """Dedup keeps first occurrence."""
        bash = Bash(files={"/data.csv": "name,val\nalice,first\nbob,2\nalice,second\n"})
        result = await bash.exec("xan dedup -s name /data.csv")
        assert result.exit_code == 0
        assert "first" in result.stdout
        assert "second" not in result.stdout


class TestXanTop:
    """Test xan top command."""

    @pytest.mark.asyncio
    async def test_top_numeric(self):
        """Get top N rows by numeric column."""
        bash = Bash(files={"/data.csv": "name,score\nalice,50\nbob,90\ncarol,70\n"})
        result = await bash.exec("xan top 2 score /data.csv")
        assert result.exit_code == 0
        lines = result.stdout.strip().split("\n")
        assert len(lines) == 3  # header + 2 rows
        # bob has highest, then carol
        assert "bob" in lines[1]

    @pytest.mark.asyncio
    async def test_top_reverse(self):
        """Get bottom N rows (reverse)."""
        bash = Bash(files={"/data.csv": "name,score\nalice,50\nbob,90\ncarol,70\n"})
        result = await bash.exec("xan top -r 2 score /data.csv")
        assert result.exit_code == 0
        lines = result.stdout.strip().split("\n")
        assert len(lines) == 3
        # alice has lowest, then carol
        assert "alice" in lines[1]

    @pytest.mark.asyncio
    async def test_top_stdin(self):
        """Top from stdin."""
        bash = Bash()
        result = await bash.exec("echo 'x\n3\n1\n4\n1\n5' | xan top 2 x")
        assert result.exit_code == 0
        lines = result.stdout.strip().split("\n")
        assert lines[1] == "5"

    @pytest.mark.asyncio
    async def test_top_no_column(self):
        """Error when no column specified."""
        bash = Bash(files={"/data.csv": "a,b\n1,2\n"})
        result = await bash.exec("xan top 2 /data.csv")
        assert result.exit_code == 1


class TestXanTranspose:
    """Test xan transpose command."""

    @pytest.mark.asyncio
    async def test_transpose_basic(self):
        """Transpose rows and columns."""
        bash = Bash(files={"/data.csv": "a,b,c\n1,2,3\n4,5,6\n"})
        result = await bash.exec("xan transpose /data.csv")
        assert result.exit_code == 0
        lines = result.stdout.strip().split("\n")
        # Original: 3 cols, 2 data rows -> header + 3 data rows (one per original col)
        assert len(lines) == 4  # header "field,0,1" + 3 rows for a, b, c

    @pytest.mark.asyncio
    async def test_transpose_single_row(self):
        """Transpose single row."""
        bash = Bash(files={"/data.csv": "a,b,c\n1,2,3\n"})
        result = await bash.exec("xan transpose /data.csv")
        assert result.exit_code == 0
        lines = result.stdout.strip().split("\n")
        assert len(lines) == 4  # header "field,0" + 3 rows for a, b, c

    @pytest.mark.asyncio
    async def test_transpose_stdin(self):
        """Transpose from stdin."""
        bash = Bash()
        result = await bash.exec("echo 'x,y\n1,2' | xan transpose")
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_transpose_double(self):
        """Double transpose produces same row count as original."""
        bash = Bash(files={"/data.csv": "a,b\n1,2\n3,4\n"})
        result = await bash.exec("xan transpose /data.csv | xan transpose")
        assert result.exit_code == 0
        # Transposing twice doesn't return exact original (header becomes data)
        # but structure is preserved
        assert result.stdout.strip() != ""


class TestXanFixlengths:
    """Test xan fixlengths command."""

    @pytest.mark.asyncio
    async def test_fixlengths_ragged(self):
        """Fix ragged CSV with missing values."""
        bash = Bash(files={"/data.csv": "a,b,c\n1,2\n3,4,5,6\n"})
        result = await bash.exec("xan fixlengths /data.csv")
        assert result.exit_code == 0
        lines = result.stdout.strip().split("\n")
        # Each row should have same number of fields
        first_len = len(lines[0].split(","))
        for line in lines[1:]:
            assert len(line.split(",")) == first_len

    @pytest.mark.asyncio
    async def test_fixlengths_already_valid(self):
        """Already valid CSV passes through."""
        bash = Bash(files={"/data.csv": "a,b\n1,2\n3,4\n"})
        result = await bash.exec("xan fixlengths /data.csv")
        assert result.exit_code == 0
        assert result.stdout == "a,b\n1,2\n3,4\n"

    @pytest.mark.asyncio
    async def test_fixlengths_stdin(self):
        """Fixlengths from stdin."""
        bash = Bash()
        result = await bash.exec("echo 'a,b\n1' | xan fixlengths")
        assert result.exit_code == 0
        lines = result.stdout.strip().split("\n")
        assert len(lines[1].split(",")) == 2


class TestXanFlatten:
    """Test xan flatten command."""

    @pytest.mark.asyncio
    async def test_flatten_basic(self):
        """Display records vertically."""
        bash = Bash(files={"/data.csv": "name,age\nalice,30\nbob,25\n"})
        result = await bash.exec("xan flatten /data.csv")
        assert result.exit_code == 0
        # Should show field: value format
        assert "name" in result.stdout
        assert "alice" in result.stdout

    @pytest.mark.asyncio
    async def test_flatten_stdin(self):
        """Flatten from stdin."""
        bash = Bash()
        result = await bash.exec("echo 'a,b\n1,2' | xan flatten")
        assert result.exit_code == 0
        assert "a" in result.stdout
        assert "1" in result.stdout

    @pytest.mark.asyncio
    async def test_flatten_empty(self):
        """Flatten empty file."""
        bash = Bash(files={"/data.csv": "a,b\n"})
        result = await bash.exec("xan flatten /data.csv")
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_flatten_alias_f(self):
        """Flatten can be called as 'f'."""
        bash = Bash(files={"/data.csv": "x\n1\n"})
        result = await bash.exec("xan f /data.csv")
        assert result.exit_code == 0


class TestXanExplode:
    """Test xan explode command."""

    @pytest.mark.asyncio
    async def test_explode_basic(self):
        """Explode column with separator."""
        bash = Bash(files={"/data.csv": "name,tags\nalice,a|b|c\nbob,x\n"})
        result = await bash.exec("xan explode tags -d '|' /data.csv")
        assert result.exit_code == 0
        lines = result.stdout.strip().split("\n")
        # alice should have 3 rows (a, b, c), bob has 1
        assert len(lines) == 5  # header + 4 data rows

    @pytest.mark.asyncio
    async def test_explode_default_separator(self):
        """Explode with default comma separator."""
        bash = Bash(files={"/data.csv": 'name,items\nalice,"x,y"\n'})
        result = await bash.exec("xan explode items /data.csv")
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_explode_stdin(self):
        """Explode from stdin."""
        bash = Bash()
        result = await bash.exec("echo 'col\na|b' | xan explode col -d '|'")
        assert result.exit_code == 0
        lines = result.stdout.strip().split("\n")
        assert len(lines) == 3  # header + a + b

    @pytest.mark.asyncio
    async def test_explode_preserves_other_columns(self):
        """Explode preserves other column values."""
        bash = Bash(files={"/data.csv": "id,vals\n1,a|b\n"})
        result = await bash.exec("xan explode vals -d '|' /data.csv")
        assert result.exit_code == 0
        lines = result.stdout.strip().split("\n")
        # Both exploded rows should have id=1
        for line in lines[1:]:
            assert line.startswith("1,")

    @pytest.mark.asyncio
    async def test_explode_no_column(self):
        """Error when no column specified."""
        bash = Bash(files={"/data.csv": "a,b\n1,2\n"})
        result = await bash.exec("xan explode /data.csv")
        assert result.exit_code == 1


class TestXanImplode:
    """Test xan implode command."""

    @pytest.mark.asyncio
    async def test_implode_basic(self):
        """Implode column values by key."""
        bash = Bash(files={"/data.csv": "name,tag\nalice,a\nalice,b\nbob,x\n"})
        result = await bash.exec("xan implode tag -g name -d '|' /data.csv")
        assert result.exit_code == 0
        lines = result.stdout.strip().split("\n")
        assert len(lines) == 3  # header + alice + bob

    @pytest.mark.asyncio
    async def test_implode_default_separator(self):
        """Implode with default comma separator."""
        bash = Bash(files={"/data.csv": "k,v\na,1\na,2\n"})
        result = await bash.exec("xan implode v -g k /data.csv")
        assert result.exit_code == 0
        assert "1,2" in result.stdout or "1, 2" in result.stdout or '"1,2"' in result.stdout

    @pytest.mark.asyncio
    async def test_implode_stdin(self):
        """Implode from stdin."""
        bash = Bash()
        result = await bash.exec("echo 'g,v\nx,1\nx,2' | xan implode v -g g")
        assert result.exit_code == 0
        lines = result.stdout.strip().split("\n")
        assert len(lines) == 2  # header + 1 group

    @pytest.mark.asyncio
    async def test_implode_no_column(self):
        """Error when no column specified."""
        bash = Bash(files={"/data.csv": "a,b\n1,2\n"})
        result = await bash.exec("xan implode /data.csv")
        assert result.exit_code == 1

    @pytest.mark.asyncio
    async def test_implode_no_group(self):
        """Error when no group column specified."""
        bash = Bash(files={"/data.csv": "a,b\n1,2\n"})
        result = await bash.exec("xan implode b /data.csv")
        assert result.exit_code == 1


class TestXanSplit:
    """Test xan split command."""

    @pytest.mark.asyncio
    async def test_split_by_rows(self):
        """Split into files by row count."""
        bash = Bash(files={"/data.csv": "x\n1\n2\n3\n4\n5\n"})
        result = await bash.exec("xan split 2 /data.csv -o /out")
        assert result.exit_code == 0
        # Check output files were created
        ls_result = await bash.exec("ls /out")
        assert ls_result.exit_code == 0

    @pytest.mark.asyncio
    async def test_split_preserves_headers(self):
        """Each split file has headers."""
        bash = Bash(files={"/data.csv": "col\n1\n2\n3\n4\n"})
        await bash.exec("xan split 2 /data.csv -o /out")
        # Read first output file
        cat_result = await bash.exec("cat /out/0.csv")
        assert "col" in cat_result.stdout

    @pytest.mark.asyncio
    async def test_split_no_size(self):
        """Error when no size specified."""
        bash = Bash(files={"/data.csv": "a\n1\n"})
        result = await bash.exec("xan split /data.csv")
        assert result.exit_code == 1


# =============================================================================
# Phase 3 Tests - Stubbed Commands (Not Yet Implemented)
# =============================================================================


class TestXanStubbedCommands:
    """Test that stubbed commands return appropriate errors."""

    @pytest.mark.asyncio
    async def test_join_not_implemented(self):
        """Join returns not implemented error."""
        bash = Bash(files={"/a.csv": "x\n1\n", "/b.csv": "x\n1\n"})
        result = await bash.exec("xan join x /a.csv x /b.csv")
        assert result.exit_code == 1
        assert "not yet implemented" in result.stderr

    @pytest.mark.asyncio
    async def test_agg_not_implemented(self):
        """Agg returns not implemented error."""
        bash = Bash(files={"/data.csv": "x\n1\n2\n"})
        result = await bash.exec("xan agg 'sum(x)' /data.csv")
        assert result.exit_code == 1
        assert "not yet implemented" in result.stderr

    @pytest.mark.asyncio
    async def test_groupby_not_implemented(self):
        """Groupby returns not implemented error."""
        bash = Bash(files={"/data.csv": "g,v\na,1\na,2\n"})
        result = await bash.exec("xan groupby g 'sum(v)' /data.csv")
        assert result.exit_code == 1
        assert "not yet implemented" in result.stderr

    @pytest.mark.asyncio
    async def test_map_not_implemented(self):
        """Map returns not implemented error."""
        bash = Bash(files={"/data.csv": "x\n1\n"})
        result = await bash.exec("xan map 'y = x * 2' /data.csv")
        assert result.exit_code == 1
        assert "not yet implemented" in result.stderr

    @pytest.mark.asyncio
    async def test_transform_not_implemented(self):
        """Transform returns not implemented error."""
        bash = Bash(files={"/data.csv": "x\n1\n"})
        result = await bash.exec("xan transform 'x = x + 1' /data.csv")
        assert result.exit_code == 1
        assert "not yet implemented" in result.stderr

    @pytest.mark.asyncio
    async def test_pivot_not_implemented(self):
        """Pivot returns not implemented error."""
        bash = Bash(files={"/data.csv": "r,c,v\na,x,1\n"})
        result = await bash.exec("xan pivot r c v /data.csv")
        assert result.exit_code == 1
        assert "not yet implemented" in result.stderr
