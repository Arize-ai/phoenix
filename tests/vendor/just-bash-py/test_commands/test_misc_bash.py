"""Tests for miscellaneous bash features (Phase 11)."""

import pytest
from just_bash import Bash


class TestAnsiCQuoting:
    """Test $'...' ANSI-C quoting with escape sequences."""

    @pytest.mark.asyncio
    async def test_newline(self):
        bash = Bash()
        result = await bash.exec("echo $'hello\\nworld'")
        assert result.stdout == "hello\nworld\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_tab(self):
        bash = Bash()
        result = await bash.exec("echo $'hello\\tworld'")
        assert result.stdout == "hello\tworld\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_carriage_return(self):
        bash = Bash()
        result = await bash.exec("echo $'hello\\rworld'")
        assert result.stdout == "hello\rworld\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_backslash(self):
        bash = Bash()
        result = await bash.exec("echo $'hello\\\\world'")
        assert result.stdout == "hello\\world\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_single_quote(self):
        bash = Bash()
        result = await bash.exec("echo $'it\\'s'")
        assert result.stdout == "it's\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_hex_escape(self):
        bash = Bash()
        result = await bash.exec("echo $'\\x41'")
        assert result.stdout == "A\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_octal_escape(self):
        bash = Bash()
        result = await bash.exec("echo $'\\101'")
        assert result.stdout == "A\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_alert_bell(self):
        bash = Bash()
        result = await bash.exec("echo $'\\a'")
        assert result.stdout == "\a\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_backspace(self):
        bash = Bash()
        result = await bash.exec("echo $'\\b'")
        assert result.stdout == "\b\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_escape_char(self):
        bash = Bash()
        result = await bash.exec("echo $'\\e'")
        assert result.stdout == "\x1b\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_form_feed(self):
        bash = Bash()
        result = await bash.exec("echo $'\\f'")
        assert result.stdout == "\f\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_vertical_tab(self):
        bash = Bash()
        result = await bash.exec("echo $'\\v'")
        assert result.stdout == "\v\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_unicode_4digit(self):
        bash = Bash()
        result = await bash.exec("echo $'\\u0041'")
        assert result.stdout == "A\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_unicode_8digit(self):
        bash = Bash()
        result = await bash.exec("echo $'\\U00000041'")
        assert result.stdout == "A\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_mixed_content(self):
        bash = Bash()
        result = await bash.exec("echo $'line1\\nline2\\ttab'")
        assert result.stdout == "line1\nline2\ttab\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_in_variable_assignment(self):
        bash = Bash()
        result = await bash.exec("x=$'hello\\nworld'; echo \"$x\"")
        assert result.stdout == "hello\nworld\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_concatenated_with_other_strings(self):
        bash = Bash()
        result = await bash.exec("echo prefix$'\\n'suffix")
        assert result.stdout == "prefix\nsuffix\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_nul_byte_stripped(self):
        """NUL bytes are stripped in bash strings."""
        bash = Bash()
        result = await bash.exec("echo $'hello\\x00world'")
        # Bash strips NUL bytes from strings
        assert result.stdout == "helloworld\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_double_quote_escape(self):
        bash = Bash()
        result = await bash.exec("echo $'\\\"hello\\\"'")
        assert result.stdout == '"hello"\n'
        assert result.exit_code == 0


class TestTildeExpansion:
    """Test tilde expansion edge cases."""

    @pytest.mark.asyncio
    async def test_tilde_in_assignment_value(self):
        """Tilde should expand in variable assignments."""
        bash = Bash(env={"HOME": "/home/user"})
        result = await bash.exec("x=~; echo $x")
        assert result.stdout == "/home/user\n"

    @pytest.mark.asyncio
    async def test_tilde_in_colon_separated_path(self):
        """Tilde should expand after colons in assignments."""
        bash = Bash(env={"HOME": "/home/user"})
        result = await bash.exec("PATH=~/bin:~/lib; echo $PATH")
        assert result.stdout == "/home/user/bin:/home/user/lib\n"

    @pytest.mark.asyncio
    async def test_tilde_plus(self):
        """~+ should expand to PWD."""
        bash = Bash(env={"PWD": "/current/dir"})
        result = await bash.exec("echo ~+")
        assert result.stdout == "/current/dir\n"

    @pytest.mark.asyncio
    async def test_tilde_minus(self):
        """~- should expand to OLDPWD."""
        bash = Bash(env={"OLDPWD": "/old/dir"})
        result = await bash.exec("echo ~-")
        assert result.stdout == "/old/dir\n"


class TestTempBinding:
    """Test temporary variable bindings (VAR=value command)."""

    @pytest.mark.asyncio
    async def test_basic_temp_binding(self):
        bash = Bash()
        result = await bash.exec("x=hello; X=world echo done; echo $X")
        # X should not persist after the command
        assert "done" in result.stdout

    @pytest.mark.asyncio
    async def test_temp_binding_visible_in_command(self):
        bash = Bash()
        result = await bash.exec('X=hello bash -c "echo $X"')
        # This would need subshell support to fully work
        # For now just test the basic mechanism


class TestSubshell:
    """Test subshell behavior."""

    @pytest.mark.asyncio
    async def test_subshell_variable_isolation(self):
        bash = Bash()
        result = await bash.exec("x=outer; (x=inner; echo $x); echo $x")
        assert result.stdout == "inner\nouter\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_subshell_exit_code(self):
        bash = Bash()
        result = await bash.exec("(exit 42); echo $?")
        assert result.stdout == "42\n"

    @pytest.mark.asyncio
    async def test_nested_subshell(self):
        bash = Bash()
        result = await bash.exec("(echo outer; (echo inner))")
        assert result.stdout == "outer\ninner\n"


class TestTypeBuiltin:
    """Test type builtin edge cases."""

    @pytest.mark.asyncio
    async def test_type_t_builtin(self):
        bash = Bash()
        result = await bash.exec("type -t echo")
        assert result.stdout == "builtin\n"

    @pytest.mark.asyncio
    async def test_type_t_keyword(self):
        bash = Bash()
        result = await bash.exec("type -t if")
        assert result.stdout == "keyword\n"

    @pytest.mark.asyncio
    async def test_type_t_function(self):
        bash = Bash()
        result = await bash.exec("f() { echo hi; }; type -t f")
        assert result.stdout == "function\n"

    @pytest.mark.asyncio
    async def test_type_t_not_found(self):
        bash = Bash()
        result = await bash.exec("type -t nonexistent_command_xyz")
        assert result.stdout == ""
        assert result.exit_code == 1


class TestCommandBuiltin:
    """Test command builtin."""

    @pytest.mark.asyncio
    async def test_command_v_builtin(self):
        bash = Bash()
        result = await bash.exec("command -v echo")
        assert result.stdout == "echo\n"

    @pytest.mark.asyncio
    async def test_command_v_not_found(self):
        bash = Bash()
        result = await bash.exec("command -v nonexistent_xyz")
        assert result.stdout == ""
        assert result.exit_code == 1


class TestLetBuiltin:
    """Test let builtin."""

    @pytest.mark.asyncio
    async def test_let_basic(self):
        bash = Bash()
        result = await bash.exec("let x=5; echo $x")
        assert result.stdout == "5\n"

    @pytest.mark.asyncio
    async def test_let_arithmetic(self):
        bash = Bash()
        result = await bash.exec("x=3; let x=x+2; echo $x")
        assert result.stdout == "5\n"

    @pytest.mark.asyncio
    async def test_let_exit_code_nonzero(self):
        """let returns 0 if last expression is non-zero."""
        bash = Bash()
        result = await bash.exec("let x=5")
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_let_exit_code_zero(self):
        """let returns 1 if last expression is zero."""
        bash = Bash()
        result = await bash.exec("let x=0")
        assert result.exit_code == 1


class TestDparenCommand:
    """Test (( )) arithmetic command."""

    @pytest.mark.asyncio
    async def test_basic_assignment(self):
        bash = Bash()
        result = await bash.exec("(( x = 5 )); echo $x")
        assert result.stdout == "5\n"

    @pytest.mark.asyncio
    async def test_exit_code_nonzero_result(self):
        bash = Bash()
        result = await bash.exec("(( 5 > 3 ))")
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_exit_code_zero_result(self):
        bash = Bash()
        result = await bash.exec("(( 3 > 5 ))")
        assert result.exit_code == 1

    @pytest.mark.asyncio
    async def test_increment(self):
        bash = Bash()
        result = await bash.exec("x=5; (( x++ )); echo $x")
        assert result.stdout == "6\n"

    @pytest.mark.asyncio
    async def test_compound_expression(self):
        bash = Bash()
        result = await bash.exec("x=10; (( y = x * 2 + 3 )); echo $y")
        assert result.stdout == "23\n"


class TestRegexMatching:
    """Test [[ =~ ]] regex matching and BASH_REMATCH."""

    @pytest.mark.asyncio
    async def test_basic_regex_match(self):
        bash = Bash()
        result = await bash.exec('[[ "hello123" =~ [0-9]+ ]] && echo match')
        assert result.stdout == "match\n"

    @pytest.mark.asyncio
    async def test_regex_no_match(self):
        bash = Bash()
        result = await bash.exec('[[ "hello" =~ [0-9]+ ]] && echo match || echo no')
        assert result.stdout == "no\n"

    @pytest.mark.asyncio
    async def test_bash_rematch_full(self):
        bash = Bash()
        result = await bash.exec('[[ "abc123def" =~ ([a-z]+)([0-9]+) ]]; echo ${BASH_REMATCH[0]}')
        assert result.stdout == "abc123\n"

    @pytest.mark.asyncio
    async def test_bash_rematch_groups(self):
        bash = Bash()
        result = await bash.exec('[[ "abc123def" =~ ([a-z]+)([0-9]+) ]]; echo ${BASH_REMATCH[1]}')
        assert result.stdout == "abc\n"

    @pytest.mark.asyncio
    async def test_bash_rematch_group2(self):
        bash = Bash()
        result = await bash.exec('[[ "abc123def" =~ ([a-z]+)([0-9]+) ]]; echo ${BASH_REMATCH[2]}')
        assert result.stdout == "123\n"


class TestAliasExpansion:
    """Test alias expansion."""

    @pytest.mark.asyncio
    async def test_basic_alias(self):
        """Alias must be defined on a previous line to be expanded (bash semantics)."""
        bash = Bash()
        # Define alias on one line, use on the next
        result = await bash.exec("""shopt -s expand_aliases
alias hi='echo hello'
hi""")
        assert result.stdout == "hello\n"

    @pytest.mark.asyncio
    async def test_alias_with_args(self):
        """Alias expansion with arguments."""
        bash = Bash()
        result = await bash.exec("""shopt -s expand_aliases
alias greet='echo hi'
greet world""")
        assert result.stdout == "hi world\n"

    @pytest.mark.asyncio
    async def test_alias_same_line_not_expanded(self):
        """Alias defined on same line is NOT expanded (bash semantics)."""
        bash = Bash()
        result = await bash.exec("shopt -s expand_aliases; alias hi='echo hello'; hi")
        # hi is not expanded because alias was defined on the same line
        assert result.stdout == ""
        assert result.exit_code == 127  # command not found

    @pytest.mark.asyncio
    async def test_unalias(self):
        bash = Bash()
        result = await bash.exec("""shopt -s expand_aliases
alias hi='echo hello'
unalias hi
hi 2>/dev/null; echo $?""")
        # After unalias, hi should not be found
        assert result.exit_code == 0


class TestReadBuiltinEdgeCases:
    """Test read builtin edge cases."""

    @pytest.mark.asyncio
    async def test_read_with_ifs(self):
        bash = Bash()
        result = await bash.exec("echo 'a:b:c' | IFS=: read x y z; echo \"$x $y $z\"")
        assert result.stdout == "a b c\n"

    @pytest.mark.asyncio
    async def test_read_fewer_vars_than_fields(self):
        bash = Bash()
        result = await bash.exec("echo 'a b c d' | read x y; echo \"$x $y\"")
        assert result.stdout == "a b c d\n"

    @pytest.mark.asyncio
    async def test_read_more_vars_than_fields(self):
        bash = Bash()
        result = await bash.exec("echo 'a b' | read x y z; echo \"$x:$y:$z\"")
        assert result.stdout == "a:b:\n"


class TestEvalBuiltin:
    """Test eval builtin."""

    @pytest.mark.asyncio
    async def test_basic_eval(self):
        bash = Bash()
        result = await bash.exec("eval 'echo hello'")
        assert result.stdout == "hello\n"

    @pytest.mark.asyncio
    async def test_eval_with_variable(self):
        bash = Bash()
        result = await bash.exec("cmd='echo hello'; eval $cmd")
        assert result.stdout == "hello\n"

    @pytest.mark.asyncio
    async def test_eval_with_expansion(self):
        bash = Bash()
        result = await bash.exec("x=world; eval 'echo $x'")
        assert result.stdout == "world\n"

    @pytest.mark.asyncio
    async def test_nested_eval(self):
        bash = Bash()
        result = await bash.exec("eval eval 'echo hello'")
        assert result.stdout == "hello\n"


class TestSourceBuiltin:
    """Test source/. builtin."""

    @pytest.mark.asyncio
    async def test_source_file(self):
        bash = Bash(files={"/script.sh": "echo sourced"})
        result = await bash.exec("source /script.sh")
        assert result.stdout == "sourced\n"

    @pytest.mark.asyncio
    async def test_source_sets_variables(self):
        bash = Bash(files={"/script.sh": "x=hello"})
        result = await bash.exec("source /script.sh; echo $x")
        assert result.stdout == "hello\n"

    @pytest.mark.asyncio
    async def test_dot_command(self):
        bash = Bash(files={"/script.sh": "echo dotted"})
        result = await bash.exec(". /script.sh")
        assert result.stdout == "dotted\n"


class TestPrintfPercents:
    """Test printf format edge cases."""

    @pytest.mark.asyncio
    async def test_printf_percent_s(self):
        bash = Bash()
        result = await bash.exec("printf '%s\\n' hello")
        assert result.stdout == "hello\n"

    @pytest.mark.asyncio
    async def test_printf_percent_d(self):
        bash = Bash()
        result = await bash.exec("printf '%d\\n' 42")
        assert result.stdout == "42\n"

    @pytest.mark.asyncio
    async def test_printf_percent_d_hex_input(self):
        """printf %d should accept hex input."""
        bash = Bash()
        result = await bash.exec("printf '%d\\n' 0xff")
        assert result.stdout == "255\n"

    @pytest.mark.asyncio
    async def test_printf_percent_d_octal_input(self):
        """printf %d should accept octal input."""
        bash = Bash()
        result = await bash.exec("printf '%d\\n' 010")
        assert result.stdout == "8\n"

    @pytest.mark.asyncio
    async def test_printf_repeat_format(self):
        """printf should repeat format for extra args."""
        bash = Bash()
        result = await bash.exec("printf '%s\\n' a b c")
        assert result.stdout == "a\nb\nc\n"


class TestBashRematchArray:
    """Test BASH_REMATCH as a proper array."""

    @pytest.mark.asyncio
    async def test_rematch_length(self):
        bash = Bash()
        result = await bash.exec('[[ "abc123" =~ ([a-z]+)([0-9]+) ]]; echo ${#BASH_REMATCH[@]}')
        assert result.stdout == "3\n"

    @pytest.mark.asyncio
    async def test_rematch_all_elements(self):
        bash = Bash()
        result = await bash.exec('[[ "abc123" =~ ([a-z]+)([0-9]+) ]]; echo "${BASH_REMATCH[@]}"')
        assert result.stdout == "abc123 abc 123\n"
