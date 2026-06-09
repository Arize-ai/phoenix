"""Tests for awk command features (Phase 14)."""

import pytest
from just_bash import Bash


class TestAwkBasic:
    """Test basic awk functionality."""

    @pytest.mark.asyncio
    async def test_print_all(self):
        bash = Bash(files={"/input.txt": "hello\nworld"})
        result = await bash.exec("awk '{print}' /input.txt")
        assert result.stdout == "hello\nworld\n"

    @pytest.mark.asyncio
    async def test_print_field(self):
        bash = Bash(files={"/input.txt": "a b c\nd e f"})
        result = await bash.exec("awk '{print $2}' /input.txt")
        assert result.stdout == "b\ne\n"

    @pytest.mark.asyncio
    async def test_print_last_field(self):
        bash = Bash(files={"/input.txt": "a b c\nd e f"})
        result = await bash.exec("awk '{print $NF}' /input.txt")
        assert result.stdout == "c\nf\n"

    @pytest.mark.asyncio
    async def test_field_separator(self):
        bash = Bash(files={"/input.txt": "a:b:c\nd:e:f"})
        result = await bash.exec("awk -F: '{print $2}' /input.txt")
        assert result.stdout == "b\ne\n"

    @pytest.mark.asyncio
    async def test_nr_variable(self):
        bash = Bash(files={"/input.txt": "a\nb\nc"})
        result = await bash.exec("awk '{print NR}' /input.txt")
        assert result.stdout == "1\n2\n3\n"

    @pytest.mark.asyncio
    async def test_nf_variable(self):
        bash = Bash(files={"/input.txt": "a b\nc d e"})
        result = await bash.exec("awk '{print NF}' /input.txt")
        assert result.stdout == "2\n3\n"

    @pytest.mark.asyncio
    async def test_begin_block(self):
        bash = Bash()
        result = await bash.exec("echo | awk 'BEGIN{print \"start\"}'")
        assert result.stdout == "start\n"

    @pytest.mark.asyncio
    async def test_end_block(self):
        bash = Bash(files={"/input.txt": "a\nb"})
        result = await bash.exec("awk 'END{print NR}' /input.txt")
        assert result.stdout == "2\n"

    @pytest.mark.asyncio
    async def test_stdin(self):
        bash = Bash()
        result = await bash.exec("echo 'hello world' | awk '{print $1}'")
        assert result.stdout == "hello\n"

    @pytest.mark.asyncio
    async def test_v_variable(self):
        bash = Bash()
        result = await bash.exec("echo hello | awk -v x=world '{print x}'")
        assert result.stdout == "world\n"


class TestAwkPatterns:
    """Test awk pattern matching."""

    @pytest.mark.asyncio
    async def test_regex_pattern(self):
        bash = Bash(files={"/input.txt": "hello\nworld\nhello world"})
        result = await bash.exec("awk '/hello/{print}' /input.txt")
        assert result.stdout == "hello\nhello world\n"

    @pytest.mark.asyncio
    async def test_expression_pattern(self):
        bash = Bash(files={"/input.txt": "1\n2\n3\n4\n5"})
        result = await bash.exec("awk 'NR>3{print}' /input.txt")
        assert result.stdout == "4\n5\n"

    @pytest.mark.asyncio
    async def test_negation_pattern(self):
        bash = Bash(files={"/input.txt": "hello\nworld\nfoo"})
        result = await bash.exec("awk '!/world/{print}' /input.txt")
        assert result.stdout == "hello\nfoo\n"


class TestAwkStringFunctions:
    """Test awk string functions."""

    @pytest.mark.asyncio
    async def test_length(self):
        bash = Bash()
        result = await bash.exec("echo hello | awk '{print length($0)}'")
        assert result.stdout == "5\n"

    @pytest.mark.asyncio
    async def test_substr(self):
        bash = Bash()
        result = await bash.exec("echo hello | awk '{print substr($0, 2, 3)}'")
        assert result.stdout == "ell\n"

    @pytest.mark.asyncio
    async def test_index(self):
        bash = Bash()
        result = await bash.exec("echo 'hello world' | awk '{print index($0, \"world\")}'")
        assert result.stdout == "7\n"

    @pytest.mark.asyncio
    async def test_tolower(self):
        bash = Bash()
        result = await bash.exec("echo HELLO | awk '{print tolower($0)}'")
        assert result.stdout == "hello\n"

    @pytest.mark.asyncio
    async def test_toupper(self):
        bash = Bash()
        result = await bash.exec("echo hello | awk '{print toupper($0)}'")
        assert result.stdout == "HELLO\n"

    @pytest.mark.asyncio
    async def test_split(self):
        bash = Bash()
        result = await bash.exec("echo 'a:b:c' | awk '{n=split($0,arr,\":\"); print n, arr[1], arr[2], arr[3]}'")
        assert result.stdout == "3 a b c\n"

    @pytest.mark.asyncio
    async def test_gsub(self):
        bash = Bash()
        result = await bash.exec("echo 'hello world' | awk '{gsub(/o/, \"0\"); print}'")
        assert result.stdout == "hell0 w0rld\n"

    @pytest.mark.asyncio
    async def test_sub(self):
        bash = Bash()
        result = await bash.exec("echo 'hello world' | awk '{sub(/o/, \"0\"); print}'")
        assert result.stdout == "hell0 world\n"

    @pytest.mark.asyncio
    async def test_match(self):
        bash = Bash()
        result = await bash.exec("echo 'hello123world' | awk '{match($0, /[0-9]+/); print RSTART, RLENGTH}'")
        assert result.stdout == "6 3\n"


class TestAwkControlFlow:
    """Test awk control flow statements."""

    @pytest.mark.asyncio
    async def test_if_else(self):
        bash = Bash(files={"/input.txt": "1\n2\n3"})
        result = await bash.exec("awk '{if (NR == 2) print \"match\"; else print \"no\"}' /input.txt")
        assert result.stdout == "no\nmatch\nno\n"

    @pytest.mark.asyncio
    async def test_for_loop(self):
        bash = Bash()
        result = await bash.exec("echo x | awk '{for(i=1; i<=3; i++) printf \"%d \", i; print \"\"}'")
        assert result.stdout == "1 2 3 \n"

    @pytest.mark.asyncio
    async def test_while_loop(self):
        bash = Bash()
        result = await bash.exec("echo x | awk '{i=1; while(i<=3) {printf \"%d \", i; i++}; print \"\"}'")
        assert result.stdout == "1 2 3 \n"

    @pytest.mark.asyncio
    async def test_next(self):
        bash = Bash(files={"/input.txt": "1\n2\n3"})
        result = await bash.exec("awk '{if (NR==2) next; print}' /input.txt")
        assert result.stdout == "1\n3\n"


class TestAwkArithmetic:
    """Test awk arithmetic operations."""

    @pytest.mark.asyncio
    async def test_addition(self):
        bash = Bash()
        result = await bash.exec("echo x | awk '{print 2+3}'")
        assert result.stdout == "5\n"

    @pytest.mark.asyncio
    async def test_multiplication(self):
        bash = Bash()
        result = await bash.exec("echo x | awk '{print 2*3}'")
        assert result.stdout == "6\n"

    @pytest.mark.asyncio
    async def test_accumulate(self):
        bash = Bash(files={"/input.txt": "1\n2\n3\n4\n5"})
        result = await bash.exec("awk '{sum += $1} END{print sum}' /input.txt")
        assert result.stdout == "15\n"

    @pytest.mark.asyncio
    async def test_int_function(self):
        bash = Bash()
        result = await bash.exec("echo x | awk '{print int(3.7)}'")
        assert result.stdout == "3\n"

    @pytest.mark.asyncio
    async def test_modulo(self):
        bash = Bash()
        result = await bash.exec("echo x | awk '{print 10 % 3}'")
        assert result.stdout == "1\n"


class TestAwkArrays:
    """Test awk array operations."""

    @pytest.mark.asyncio
    async def test_basic_array(self):
        bash = Bash()
        result = await bash.exec("echo x | awk '{a[1]=\"hello\"; a[2]=\"world\"; print a[1], a[2]}'")
        assert result.stdout == "hello world\n"

    @pytest.mark.asyncio
    async def test_array_with_string_key(self):
        bash = Bash()
        result = await bash.exec("echo x | awk '{a[\"x\"]=\"hello\"; print a[\"x\"]}'")
        assert result.stdout == "hello\n"

    @pytest.mark.asyncio
    async def test_delete_array(self):
        """Test delete array element."""
        bash = Bash()
        result = await bash.exec("echo x | awk '{a[1]=\"x\"; a[2]=\"y\"; delete a[1]; print a[1], a[2]}'")
        assert result.stdout == " y\n"

    @pytest.mark.asyncio
    async def test_in_operator(self):
        """Test 'in' operator for array membership."""
        bash = Bash()
        result = await bash.exec("echo x | awk '{a[1]=\"x\"; if (1 in a) print \"yes\"; else print \"no\"}'")
        assert result.stdout == "yes\n"

    @pytest.mark.asyncio
    async def test_for_in_array(self):
        """Test for..in loop over array."""
        bash = Bash()
        result = await bash.exec("echo x | awk '{a[\"x\"]=1; a[\"y\"]=2; for(k in a) c++; print c}'")
        assert result.stdout == "2\n"


class TestAwkPrintf:
    """Test awk printf functionality."""

    @pytest.mark.asyncio
    async def test_printf_string(self):
        bash = Bash()
        result = await bash.exec("echo hello | awk '{printf \"%s!\\n\", $1}'")
        assert result.stdout == "hello!\n"

    @pytest.mark.asyncio
    async def test_printf_integer(self):
        bash = Bash()
        result = await bash.exec("echo x | awk '{printf \"%d\\n\", 42}'")
        assert result.stdout == "42\n"

    @pytest.mark.asyncio
    async def test_printf_width(self):
        bash = Bash()
        result = await bash.exec("echo x | awk '{printf \"%10s\\n\", \"hello\"}'")
        assert result.stdout == "     hello\n"

    @pytest.mark.asyncio
    async def test_printf_no_newline(self):
        bash = Bash()
        result = await bash.exec("echo x | awk '{printf \"%s\", \"hello\"}'")
        assert result.stdout == "hello"


class TestAwkOFS:
    """Test awk output field separator."""

    @pytest.mark.asyncio
    async def test_default_ofs(self):
        bash = Bash()
        result = await bash.exec("echo 'a b c' | awk '{print $1, $2}'")
        assert result.stdout == "a b\n"

    @pytest.mark.asyncio
    async def test_custom_ofs(self):
        bash = Bash()
        result = await bash.exec("echo 'a b c' | awk -v OFS=':' '{print $1, $2}'")
        assert result.stdout == "a:b\n"


class TestAwkSprintfFunction:
    """Test awk sprintf function."""

    @pytest.mark.asyncio
    async def test_sprintf_basic(self):
        bash = Bash()
        result = await bash.exec("echo x | awk '{s=sprintf(\"%05d\", 42); print s}'")
        assert result.stdout == "00042\n"


class TestAwkFieldAssignment:
    """Test awk field assignment."""

    @pytest.mark.asyncio
    async def test_assign_field(self):
        bash = Bash()
        result = await bash.exec("echo 'a b c' | awk '{$2=\"X\"; print}'")
        assert result.stdout == "a X c\n"

    @pytest.mark.asyncio
    async def test_assign_new_field(self):
        bash = Bash()
        result = await bash.exec("echo 'a b' | awk '{$4=\"d\"; print}'")
        assert result.stdout == "a b  d\n"
