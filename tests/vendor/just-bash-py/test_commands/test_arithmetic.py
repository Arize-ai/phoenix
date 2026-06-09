"""Tests for arithmetic evaluation (Phase 1 spec test remediation)."""

import pytest
from just_bash import Bash


class TestArithmeticDivisionModulo:
    """Test C-style truncation division and modulo."""

    @pytest.mark.asyncio
    async def test_negative_division_truncates_toward_zero(self):
        """In bash, -7/2 == -3 (C truncation), not -4 (Python floor)."""
        bash = Bash()
        result = await bash.exec("echo $((-7 / 2))")
        assert result.stdout == "-3\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_negative_modulo(self):
        """In bash, -7%2 == -1 (C semantics), not 1 (Python)."""
        bash = Bash()
        result = await bash.exec("echo $((-7 % 2))")
        assert result.stdout == "-1\n"

    @pytest.mark.asyncio
    async def test_positive_division(self):
        bash = Bash()
        result = await bash.exec("echo $((7 / 2))")
        assert result.stdout == "3\n"

    @pytest.mark.asyncio
    async def test_positive_modulo(self):
        bash = Bash()
        result = await bash.exec("echo $((7 % 2))")
        assert result.stdout == "1\n"

    @pytest.mark.asyncio
    async def test_division_by_zero(self):
        bash = Bash()
        result = await bash.exec("echo $((1 / 0))")
        assert result.exit_code != 0

    @pytest.mark.asyncio
    async def test_modulo_by_zero(self):
        bash = Bash()
        result = await bash.exec("echo $((1 % 0))")
        assert result.exit_code != 0

    @pytest.mark.asyncio
    async def test_negative_dividend_positive_divisor(self):
        """Test -5 / 3 == -1 (C truncation toward zero)."""
        bash = Bash()
        result = await bash.exec("echo $((-5 / 3))")
        assert result.stdout == "-1\n"

    @pytest.mark.asyncio
    async def test_negative_dividend_modulo(self):
        """Test -5 % 3 == -2 (C semantics)."""
        bash = Bash()
        result = await bash.exec("echo $((-5 % 3))")
        assert result.stdout == "-2\n"


class TestArithmeticShortCircuit:
    """Test short-circuit evaluation for && and ||."""

    @pytest.mark.asyncio
    async def test_and_short_circuit(self):
        """When LHS of && is 0 (false), RHS should not be evaluated."""
        bash = Bash()
        result = await bash.exec("x=5; echo $((0 && (x=10))); echo $x")
        assert result.stdout == "0\n5\n"

    @pytest.mark.asyncio
    async def test_and_no_short_circuit(self):
        """When LHS of && is non-zero (true), RHS should be evaluated."""
        bash = Bash()
        result = await bash.exec("x=5; echo $((1 && (x=10))); echo $x")
        assert result.stdout == "1\n10\n"

    @pytest.mark.asyncio
    async def test_or_short_circuit(self):
        """When LHS of || is non-zero (true), RHS should not be evaluated."""
        bash = Bash()
        result = await bash.exec("x=5; echo $((1 || (x=10))); echo $x")
        assert result.stdout == "1\n5\n"

    @pytest.mark.asyncio
    async def test_or_no_short_circuit(self):
        """When LHS of || is 0 (false), RHS should be evaluated."""
        bash = Bash()
        result = await bash.exec("x=5; echo $((0 || (x=10))); echo $x")
        assert result.stdout == "1\n10\n"


class TestArithmeticIncrementDecrement:
    """Test pre/post increment/decrement."""

    @pytest.mark.asyncio
    async def test_post_increment_returns_old_value(self):
        bash = Bash()
        result = await bash.exec("x=5; echo $((x++)); echo $x")
        assert result.stdout == "5\n6\n"

    @pytest.mark.asyncio
    async def test_pre_increment_returns_new_value(self):
        bash = Bash()
        result = await bash.exec("x=5; echo $((++x)); echo $x")
        assert result.stdout == "6\n6\n"

    @pytest.mark.asyncio
    async def test_post_decrement_returns_old_value(self):
        bash = Bash()
        result = await bash.exec("x=5; echo $((x--)); echo $x")
        assert result.stdout == "5\n4\n"

    @pytest.mark.asyncio
    async def test_pre_decrement_returns_new_value(self):
        bash = Bash()
        result = await bash.exec("x=5; echo $((--x)); echo $x")
        assert result.stdout == "4\n4\n"


class TestArithmeticOctalHex:
    """Test octal and hex constant handling."""

    @pytest.mark.asyncio
    async def test_octal_literal(self):
        bash = Bash()
        result = await bash.exec("echo $((010))")
        assert result.stdout == "8\n"

    @pytest.mark.asyncio
    async def test_hex_literal(self):
        bash = Bash()
        result = await bash.exec("echo $((0xFF))")
        assert result.stdout == "255\n"

    @pytest.mark.asyncio
    async def test_octal_in_variable(self):
        """When a var holds '010', arithmetic context should parse as octal."""
        bash = Bash()
        result = await bash.exec("x=010; echo $((x))")
        assert result.stdout == "8\n"

    @pytest.mark.asyncio
    async def test_hex_in_variable(self):
        """When a var holds '0x10', arithmetic context should parse as hex."""
        bash = Bash()
        result = await bash.exec("x=0x10; echo $((x))")
        assert result.stdout == "16\n"


class TestArithmeticNegativeExponent:
    """Test negative exponent handling."""

    @pytest.mark.asyncio
    async def test_negative_exponent_errors(self):
        """Bash: 2 ** -1 should produce an error (exponent must be >= 0)."""
        bash = Bash()
        result = await bash.exec("echo $((2 ** -1))")
        assert result.exit_code != 0


class TestArithmeticAssignment:
    """Test augmented assignment operators."""

    @pytest.mark.asyncio
    async def test_plus_equals(self):
        bash = Bash()
        result = await bash.exec("x=1; (( x += 3 )); echo $x")
        assert result.stdout == "4\n"

    @pytest.mark.asyncio
    async def test_minus_equals(self):
        bash = Bash()
        result = await bash.exec("x=10; (( x -= 3 )); echo $x")
        assert result.stdout == "7\n"

    @pytest.mark.asyncio
    async def test_multiply_equals(self):
        bash = Bash()
        result = await bash.exec("x=5; (( x *= 3 )); echo $x")
        assert result.stdout == "15\n"

    @pytest.mark.asyncio
    async def test_divide_equals(self):
        bash = Bash()
        result = await bash.exec("x=10; (( x /= 3 )); echo $x")
        assert result.stdout == "3\n"

    @pytest.mark.asyncio
    async def test_modulo_equals(self):
        bash = Bash()
        result = await bash.exec("x=10; (( x %= 3 )); echo $x")
        assert result.stdout == "1\n"

    @pytest.mark.asyncio
    async def test_simple_assignment(self):
        bash = Bash()
        result = await bash.exec("(( x = 42 )); echo $x")
        assert result.stdout == "42\n"

    @pytest.mark.asyncio
    async def test_bitwise_and_equals(self):
        bash = Bash()
        result = await bash.exec("x=15; (( x &= 6 )); echo $x")
        assert result.stdout == "6\n"

    @pytest.mark.asyncio
    async def test_bitwise_or_equals(self):
        bash = Bash()
        result = await bash.exec("x=5; (( x |= 2 )); echo $x")
        assert result.stdout == "7\n"


class TestArithmeticComma:
    """Test comma operator."""

    @pytest.mark.asyncio
    async def test_comma_returns_last(self):
        bash = Bash()
        result = await bash.exec("echo $((1, 2, 3))")
        assert result.stdout == "3\n"

    @pytest.mark.asyncio
    async def test_comma_side_effects(self):
        bash = Bash()
        result = await bash.exec("echo $((x=5, y=10, x+y))")
        assert result.stdout == "15\n"


class TestArithmeticTernary:
    """Test ternary operator."""

    @pytest.mark.asyncio
    async def test_ternary_true(self):
        bash = Bash()
        result = await bash.exec("echo $((1 ? 10 : 20))")
        assert result.stdout == "10\n"

    @pytest.mark.asyncio
    async def test_ternary_false(self):
        bash = Bash()
        result = await bash.exec("echo $((0 ? 10 : 20))")
        assert result.stdout == "20\n"


class TestArithmeticCommand:
    """Test (( )) arithmetic command."""

    @pytest.mark.asyncio
    async def test_arith_command_true(self):
        """(( expr )) returns 0 if expr is non-zero."""
        bash = Bash()
        result = await bash.exec("(( 1 )); echo $?")
        assert result.stdout == "0\n"

    @pytest.mark.asyncio
    async def test_arith_command_false(self):
        """(( expr )) returns 1 if expr is zero."""
        bash = Bash()
        result = await bash.exec("(( 0 )); echo $?")
        assert result.stdout == "1\n"

    @pytest.mark.asyncio
    async def test_arith_command_with_comparison(self):
        bash = Bash()
        result = await bash.exec("x=5; (( x > 3 )); echo $?")
        assert result.stdout == "0\n"

    @pytest.mark.asyncio
    async def test_arith_command_sets_variable(self):
        bash = Bash()
        result = await bash.exec("(( x = 42 )); echo $x")
        assert result.stdout == "42\n"


class TestArithmeticBitwise:
    """Test bitwise operations."""

    @pytest.mark.asyncio
    async def test_bitwise_and(self):
        bash = Bash()
        result = await bash.exec("echo $((12 & 10))")
        assert result.stdout == "8\n"

    @pytest.mark.asyncio
    async def test_bitwise_or(self):
        bash = Bash()
        result = await bash.exec("echo $((12 | 10))")
        assert result.stdout == "14\n"

    @pytest.mark.asyncio
    async def test_bitwise_xor(self):
        bash = Bash()
        result = await bash.exec("echo $((12 ^ 10))")
        assert result.stdout == "6\n"

    @pytest.mark.asyncio
    async def test_bitwise_not(self):
        bash = Bash()
        result = await bash.exec("echo $((~0))")
        assert result.stdout == "-1\n"

    @pytest.mark.asyncio
    async def test_left_shift(self):
        bash = Bash()
        result = await bash.exec("echo $((1 << 4))")
        assert result.stdout == "16\n"

    @pytest.mark.asyncio
    async def test_right_shift(self):
        bash = Bash()
        result = await bash.exec("echo $((16 >> 2))")
        assert result.stdout == "4\n"


class TestArithmeticBaseConstants:
    """Test base-N constants."""

    @pytest.mark.asyncio
    async def test_base_2(self):
        bash = Bash()
        result = await bash.exec("echo $((2#1010))")
        assert result.stdout == "10\n"

    @pytest.mark.asyncio
    async def test_base_8(self):
        bash = Bash()
        result = await bash.exec("echo $((8#77))")
        assert result.stdout == "63\n"

    @pytest.mark.asyncio
    async def test_base_16(self):
        bash = Bash()
        result = await bash.exec("echo $((16#ff))")
        assert result.stdout == "255\n"
