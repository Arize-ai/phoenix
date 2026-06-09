"""Tests for array operations (Phase 5)."""

import pytest
from just_bash import Bash


class TestIndexedArrayBasic:
    """Basic indexed array operations."""

    @pytest.mark.asyncio
    async def test_array_creation(self):
        bash = Bash()
        result = await bash.exec('a=(one two three); echo "${a[0]}"')
        assert result.stdout == "one\n"

    @pytest.mark.asyncio
    async def test_array_all_elements(self):
        bash = Bash()
        result = await bash.exec('a=(one two three); echo "${a[@]}"')
        assert result.stdout == "one two three\n"

    @pytest.mark.asyncio
    async def test_array_length(self):
        bash = Bash()
        result = await bash.exec('a=(one two three); echo "${#a[@]}"')
        assert result.stdout == "3\n"

    @pytest.mark.asyncio
    async def test_array_element_assignment(self):
        bash = Bash()
        result = await bash.exec('a=(x y z); a[1]=w; echo "${a[@]}"')
        assert result.stdout == "x w z\n"


class TestSparseArray:
    """Test sparse array operations."""

    @pytest.mark.asyncio
    async def test_sparse_creation(self):
        """Setting non-consecutive indices creates sparse array."""
        bash = Bash()
        result = await bash.exec('a[5]=x; a[10]=y; echo "${a[@]}"')
        assert result.stdout == "x y\n"

    @pytest.mark.asyncio
    async def test_sparse_length(self):
        """Length counts actual elements, not max index."""
        bash = Bash()
        result = await bash.exec('a[5]=x; a[10]=y; echo "${#a[@]}"')
        assert result.stdout == "2\n"

    @pytest.mark.asyncio
    async def test_sparse_indices(self):
        """${!a[@]} shows actual indices."""
        bash = Bash()
        result = await bash.exec('a[5]=x; a[10]=y; echo "${!a[@]}"')
        assert result.stdout == "5 10\n"


class TestNegativeIndex:
    """Test negative array indices."""

    @pytest.mark.asyncio
    async def test_negative_index_last(self):
        """a[-1] should be last element."""
        bash = Bash()
        result = await bash.exec('a=(a b c); echo "${a[-1]}"')
        assert result.stdout == "c\n"

    @pytest.mark.asyncio
    async def test_negative_index_second_last(self):
        """a[-2] should be second-to-last."""
        bash = Bash()
        result = await bash.exec('a=(a b c); echo "${a[-2]}"')
        assert result.stdout == "b\n"


class TestAssocArray:
    """Test associative array operations."""

    @pytest.mark.asyncio
    async def test_assoc_basic(self):
        bash = Bash()
        result = await bash.exec('declare -A a; a[key]=value; echo "${a[key]}"')
        assert result.stdout == "value\n"

    @pytest.mark.asyncio
    async def test_assoc_literal(self):
        bash = Bash()
        result = await bash.exec('declare -A a=([k1]=v1 [k2]=v2); echo "${a[k1]} ${a[k2]}"')
        assert result.stdout == "v1 v2\n"

    @pytest.mark.asyncio
    async def test_assoc_keys(self):
        """${!a[@]} should return keys."""
        bash = Bash()
        result = await bash.exec('declare -A a=([x]=1 [y]=2); keys="${!a[@]}"; echo "$keys"')
        assert "x" in result.stdout
        assert "y" in result.stdout

    @pytest.mark.asyncio
    async def test_assoc_all_values(self):
        """${a[@]} should return all values."""
        bash = Bash()
        result = await bash.exec('declare -A a=([x]=1 [y]=2); echo "${a[@]}"')
        assert "1" in result.stdout
        assert "2" in result.stdout

    @pytest.mark.asyncio
    async def test_assoc_length(self):
        """${#a[@]} should count elements."""
        bash = Bash()
        result = await bash.exec('declare -A a=([x]=1 [y]=2 [z]=3); echo "${#a[@]}"')
        assert result.stdout == "3\n"


class TestArrayInArithmetic:
    """Test array decay in arithmetic context."""

    @pytest.mark.asyncio
    async def test_array_decays_to_first(self):
        """In arithmetic, bare array name should use a[0]."""
        bash = Bash()
        result = await bash.exec('a=(10 20 30); echo $((a + 5))')
        assert result.stdout == "15\n"


class TestArraySlicing:
    """Test ${arr[@]:offset:length} array slicing."""

    @pytest.mark.asyncio
    async def test_array_slice_offset(self):
        """${a[@]:1} should skip first element."""
        bash = Bash()
        result = await bash.exec('a=(a b c d); echo "${a[@]:1}"')
        assert result.stdout == "b c d\n"

    @pytest.mark.asyncio
    async def test_array_slice_offset_length(self):
        """${a[@]:1:2} should return 2 elements from offset 1."""
        bash = Bash()
        result = await bash.exec('a=(a b c d); echo "${a[@]:1:2}"')
        assert result.stdout == "b c\n"


class TestArrayPatternOps:
    """Test per-element pattern operations on arrays."""

    @pytest.mark.asyncio
    async def test_array_prefix_removal(self):
        """${a[@]#prefix} should apply per-element."""
        bash = Bash()
        result = await bash.exec('a=(foobar foobaz); echo "${a[@]#foo}"')
        assert result.stdout == "bar baz\n"

    @pytest.mark.asyncio
    async def test_array_suffix_removal(self):
        """${a[@]%suffix} should apply per-element."""
        bash = Bash()
        result = await bash.exec('a=(file.txt file.sh); echo "${a[@]%.txt}"')
        # Only the first one matches
        assert "file" in result.stdout
        assert "file.sh" in result.stdout

    @pytest.mark.asyncio
    async def test_array_replacement(self):
        """${a[@]/pat/rep} should apply per-element."""
        bash = Bash()
        result = await bash.exec('a=(hello world); echo "${a[@]/o/0}"')
        assert result.stdout == "hell0 w0rld\n"


class TestArrayElementLength:
    """Test ${#a[idx]} element length."""

    @pytest.mark.asyncio
    async def test_element_length(self):
        bash = Bash()
        result = await bash.exec('a=(hello world); echo "${#a[0]}"')
        assert result.stdout == "5\n"

    @pytest.mark.asyncio
    async def test_array_length_vs_element(self):
        """${#a} should be length of a[0], ${#a[@]} should be count."""
        bash = Bash()
        result = await bash.exec('a=(hello world foo); echo "${#a[@]}" "${#a}"')
        assert result.stdout == "3 5\n"
