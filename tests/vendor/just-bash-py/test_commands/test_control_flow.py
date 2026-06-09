"""Phase 8: Control flow, shell features, and builtins tests."""

import pytest
from just_bash import Bash


class TestBreakContinueN:
    """Test break N and continue N."""

    @pytest.mark.asyncio
    async def test_break_2(self):
        """break 2 exits two levels."""
        bash = Bash()
        result = await bash.exec('''
for i in 1 2 3; do
    for j in a b c; do
        if [ "$j" = "b" ]; then
            break 2
        fi
        echo "$i.$j"
    done
done
echo done
''')
        assert result.stdout == "1.a\ndone\n"

    @pytest.mark.asyncio
    async def test_continue_2(self):
        """continue 2 skips to outer loop."""
        bash = Bash()
        result = await bash.exec('''
for i in 1 2 3; do
    for j in a b c; do
        if [ "$j" = "b" ]; then
            continue 2
        fi
        echo "$i.$j"
    done
done
echo done
''')
        assert result.stdout == "1.a\n2.a\n3.a\ndone\n"

    @pytest.mark.asyncio
    async def test_break_default(self):
        """break without argument exits one level."""
        bash = Bash()
        result = await bash.exec('''
for i in 1 2 3; do
    for j in a b c; do
        if [ "$j" = "b" ]; then
            break
        fi
        echo "$i.$j"
    done
    echo "outer.$i"
done
''')
        assert result.stdout == "1.a\nouter.1\n2.a\nouter.2\n3.a\nouter.3\n"


class TestCaseFallThrough:
    """Test case statement fall-through with ;& and ;;&."""

    @pytest.mark.asyncio
    async def test_case_normal(self):
        """Normal case with ;; termination."""
        bash = Bash()
        result = await bash.exec('''
x=b
case $x in
    a) echo "a" ;;
    b) echo "b" ;;
    c) echo "c" ;;
esac
''')
        assert result.stdout.strip() == "b"

    @pytest.mark.asyncio
    async def test_case_fallthrough(self):
        """Case with ;& fall-through."""
        bash = Bash()
        result = await bash.exec('''
x=b
case $x in
    a) echo "a" ;&
    b) echo "b" ;&
    c) echo "c" ;;
    d) echo "d" ;;
esac
''')
        assert result.stdout == "b\nc\n"

    @pytest.mark.asyncio
    async def test_case_continue(self):
        """Case with ;;& continue testing."""
        bash = Bash()
        result = await bash.exec('''
x=ab
case $x in
    *a*) echo "has a" ;;&
    *b*) echo "has b" ;;&
    *c*) echo "has c" ;;&
    *) echo "default" ;;
esac
''')
        assert result.stdout == "has a\nhas b\ndefault\n"


class TestCStyleFor:
    """Test C-style for loop edge cases."""

    @pytest.mark.asyncio
    async def test_c_for_basic(self):
        """Basic C-style for loop."""
        bash = Bash()
        result = await bash.exec('''
for ((i=0; i<3; i++)); do
    echo $i
done
''')
        assert result.stdout == "0\n1\n2\n"

    @pytest.mark.asyncio
    async def test_c_for_empty_parts(self):
        """C-style for with empty parts."""
        bash = Bash()
        result = await bash.exec('''
i=0
for ((; i<3; i++)); do
    echo $i
done
''')
        assert result.stdout == "0\n1\n2\n"

    @pytest.mark.asyncio
    async def test_c_for_multiple_init(self):
        """C-style for with comma in init."""
        bash = Bash()
        result = await bash.exec('''
for ((i=0, j=10; i<3; i++, j--)); do
    echo "$i $j"
done
''')
        assert result.stdout == "0 10\n1 9\n2 8\n"


class TestCommandBuiltin:
    """Test command -v and related."""

    @pytest.mark.asyncio
    async def test_command_v_builtin(self):
        """command -v for a builtin."""
        bash = Bash()
        result = await bash.exec('command -v echo')
        assert result.stdout.strip() == "echo"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_command_v_not_found(self):
        """command -v for non-existent command."""
        bash = Bash()
        result = await bash.exec('command -v nonexistent_cmd_xyz')
        assert result.exit_code == 1

    @pytest.mark.asyncio
    async def test_command_v_function(self):
        """command -v for a function."""
        bash = Bash()
        result = await bash.exec('''
myfunc() { echo hi; }
command -v myfunc
''')
        assert result.stdout.strip() == "myfunc"

    @pytest.mark.asyncio
    async def test_type_builtin(self):
        """type command identifies types."""
        bash = Bash()
        result = await bash.exec('type echo')
        assert "echo" in result.stdout
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_type_t_builtin(self):
        """type -t shows type keyword."""
        bash = Bash()
        result = await bash.exec('type -t echo')
        assert result.stdout.strip() in ("builtin", "file")

    @pytest.mark.asyncio
    async def test_type_t_function(self):
        """type -t for function returns 'function'."""
        bash = Bash()
        result = await bash.exec('''
myfunc() { echo hi; }
type -t myfunc
''')
        assert result.stdout.strip() == "function"


class TestFunctionFeatures:
    """Test function-related features."""

    @pytest.mark.asyncio
    async def test_funcname(self):
        """$FUNCNAME in function."""
        bash = Bash()
        result = await bash.exec('''
myfunc() { echo "$FUNCNAME"; }
myfunc
''')
        assert result.stdout.strip() == "myfunc"

    @pytest.mark.asyncio
    async def test_return_value(self):
        """return with value."""
        bash = Bash()
        result = await bash.exec('''
myfunc() { return 42; }
myfunc
echo $?
''')
        assert result.stdout.strip() == "42"

    @pytest.mark.asyncio
    async def test_local_scope(self):
        """local variables are scoped."""
        bash = Bash()
        result = await bash.exec('''
x=global
myfunc() {
    local x=local
    echo "$x"
}
myfunc
echo "$x"
''')
        assert result.stdout == "local\nglobal\n"

    @pytest.mark.asyncio
    async def test_nested_functions(self):
        """Nested function calls."""
        bash = Bash()
        result = await bash.exec('''
inner() { echo "inner"; }
outer() { inner; echo "outer"; }
outer
''')
        assert result.stdout == "inner\nouter\n"


class TestSetOptions:
    """Test set -e, set -u, etc."""

    @pytest.mark.asyncio
    async def test_set_e_exits_on_error(self):
        """set -e exits on non-zero status."""
        bash = Bash()
        result = await bash.exec('''
set -e
false
echo "should not reach"
''')
        assert "should not reach" not in result.stdout
        assert result.exit_code != 0

    @pytest.mark.asyncio
    async def test_set_e_if_condition(self):
        """set -e does not exit in if condition."""
        bash = Bash()
        result = await bash.exec('''
set -e
if false; then
    echo "true"
fi
echo "still running"
''')
        assert "still running" in result.stdout

    @pytest.mark.asyncio
    async def test_set_u_unbound(self):
        """set -u errors on unbound variable."""
        bash = Bash()
        result = await bash.exec('''
set -u
echo $undefined_var
echo "should not reach"
''')
        assert "unbound" in result.stderr or "not set" in result.stderr

    @pytest.mark.asyncio
    async def test_pipestatus(self):
        """PIPESTATUS array tracks exit codes."""
        bash = Bash()
        result = await bash.exec('''
true | false | true
echo "${PIPESTATUS[0]} ${PIPESTATUS[1]} ${PIPESTATUS[2]}"
''')
        assert result.stdout.strip() == "0 1 0"


class TestCommandSubstitution:
    """Test command substitution features."""

    @pytest.mark.asyncio
    async def test_nested_command_sub(self):
        """Nested command substitution."""
        bash = Bash()
        result = await bash.exec('echo $(echo $(echo hello))')
        assert result.stdout.strip() == "hello"

    @pytest.mark.asyncio
    async def test_trailing_newline_stripped(self):
        """Command substitution strips trailing newline."""
        bash = Bash()
        result = await bash.exec('''
x=$(echo "hello")
echo "[$x]"
''')
        assert result.stdout.strip() == "[hello]"

    @pytest.mark.asyncio
    async def test_backtick_substitution(self):
        """Backtick command substitution."""
        bash = Bash()
        result = await bash.exec('echo `echo hello`')
        assert result.stdout.strip() == "hello"

    @pytest.mark.asyncio
    async def test_command_sub_in_quotes(self):
        """Command substitution inside double quotes."""
        bash = Bash()
        result = await bash.exec('''
name="world"
echo "hello $(echo $name)"
''')
        assert result.stdout.strip() == "hello world"


class TestGetopts:
    """Test getopts builtin."""

    @pytest.mark.asyncio
    async def test_getopts_basic(self):
        """Basic getopts usage."""
        bash = Bash()
        result = await bash.exec('''
parse_opts() {
    local OPTIND=1
    while getopts "ab:c" opt "$@"; do
        case $opt in
            a) echo "got a" ;;
            b) echo "got b=$OPTARG" ;;
            c) echo "got c" ;;
        esac
    done
}
parse_opts -a -b hello -c
''')
        assert "got a" in result.stdout
        assert "got b=hello" in result.stdout
        assert "got c" in result.stdout

    @pytest.mark.asyncio
    async def test_getopts_returns_false(self):
        """getopts returns non-zero when done."""
        bash = Bash()
        result = await bash.exec('''
parse() {
    local OPTIND=1
    while getopts "a" opt "$@"; do
        echo "opt=$opt"
    done
    echo "done"
}
parse -a
''')
        assert "opt=a" in result.stdout
        assert "done" in result.stdout
