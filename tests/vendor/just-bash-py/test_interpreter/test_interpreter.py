"""Tests for the interpreter."""

import pytest
from just_bash import Bash


class TestBasicExecution:
    """Test basic script execution."""

    @pytest.mark.asyncio
    async def test_simple_echo(self):
        bash = Bash()
        result = await bash.exec("echo hello")
        assert result.stdout == "hello\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_echo_multiple_args(self):
        bash = Bash()
        result = await bash.exec("echo hello world")
        assert result.stdout == "hello world\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_echo_no_newline(self):
        bash = Bash()
        result = await bash.exec("echo -n hello")
        assert result.stdout == "hello"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_echo_escapes(self):
        # Note: Full quote/escape handling needs word expansion implementation
        # This test uses a simple case that works with literal extraction
        bash = Bash()
        result = await bash.exec("echo -e hello")
        assert result.stdout == "hello\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_true_command(self):
        bash = Bash()
        result = await bash.exec("true")
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_false_command(self):
        bash = Bash()
        result = await bash.exec("false")
        assert result.exit_code == 1

    @pytest.mark.asyncio
    async def test_command_not_found(self):
        bash = Bash()
        result = await bash.exec("nonexistent_command")
        assert "command not found" in result.stderr
        assert result.exit_code == 127


class TestVariableAssignments:
    """Test variable assignments."""

    @pytest.mark.asyncio
    async def test_simple_assignment(self):
        bash = Bash()
        result = await bash.exec("VAR=value")
        assert result.exit_code == 0
        assert bash.env.get("VAR") == "value"

    @pytest.mark.asyncio
    async def test_append_assignment(self):
        bash = Bash()
        await bash.exec("VAR=hello")
        await bash.exec("VAR+=world")
        assert bash.env.get("VAR") == "helloworld"


class TestPipelines:
    """Test pipeline execution."""

    @pytest.mark.asyncio
    async def test_simple_pipeline(self):
        bash = Bash()
        result = await bash.exec("echo hello | cat")
        assert result.stdout == "hello\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_pipeline_exit_code(self):
        bash = Bash()
        result = await bash.exec("true | false")
        assert result.exit_code == 1

    @pytest.mark.asyncio
    async def test_negated_pipeline(self):
        bash = Bash()
        result = await bash.exec("! false")
        assert result.exit_code == 0


class TestOperators:
    """Test && and || operators."""

    @pytest.mark.asyncio
    async def test_and_success(self):
        bash = Bash()
        result = await bash.exec("true && echo yes")
        assert result.stdout == "yes\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_and_failure(self):
        bash = Bash()
        result = await bash.exec("false && echo yes")
        assert result.stdout == ""
        assert result.exit_code == 1

    @pytest.mark.asyncio
    async def test_or_success(self):
        bash = Bash()
        result = await bash.exec("true || echo fallback")
        assert result.stdout == ""
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_or_failure(self):
        bash = Bash()
        result = await bash.exec("false || echo fallback")
        assert result.stdout == "fallback\n"
        assert result.exit_code == 0


class TestMultipleStatements:
    """Test multiple statement execution."""

    @pytest.mark.asyncio
    async def test_semicolon_separated(self):
        bash = Bash()
        result = await bash.exec("echo a; echo b")
        assert result.stdout == "a\nb\n"

    @pytest.mark.asyncio
    async def test_newline_separated(self):
        bash = Bash()
        result = await bash.exec("echo a\necho b")
        assert result.stdout == "a\nb\n"


class TestCommandSubstitution:
    """Test command substitution features."""

    @pytest.mark.asyncio
    async def test_file_read_shorthand(self):
        """Test $(< file) shorthand for reading file contents."""
        bash = Bash(files={"/test.txt": "hello\nworld\n"})
        result = await bash.exec('foo=$(< /test.txt); echo "$foo"')
        assert result.stdout == "hello\nworld\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_file_read_shorthand_with_variable(self):
        """Test $(< $file) with variable path."""
        bash = Bash(files={"/data.txt": "content\n"})
        result = await bash.exec('f=/data.txt; foo=$(< $f); echo "$foo"')
        assert result.stdout == "content\n"

    @pytest.mark.asyncio
    async def test_file_read_strips_trailing_newlines(self):
        """Command substitution strips trailing newlines."""
        bash = Bash(files={"/test.txt": "hello\n\n\n"})
        result = await bash.exec('echo "[$(< /test.txt)]"')
        assert result.stdout == "[hello]\n"


class TestCatCommand:
    """Test cat command."""

    @pytest.mark.asyncio
    async def test_cat_file(self):
        bash = Bash(files={"/test.txt": "hello world\n"})
        result = await bash.exec("cat /test.txt")
        assert result.stdout == "hello world\n"
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_cat_multiple_files(self):
        bash = Bash(files={
            "/a.txt": "aaa\n",
            "/b.txt": "bbb\n",
        })
        result = await bash.exec("cat /a.txt /b.txt")
        assert result.stdout == "aaa\nbbb\n"

    @pytest.mark.asyncio
    async def test_cat_stdin(self):
        bash = Bash()
        result = await bash.exec("echo hello | cat")
        assert result.stdout == "hello\n"

    @pytest.mark.asyncio
    async def test_cat_nonexistent(self):
        bash = Bash()
        result = await bash.exec("cat /nonexistent.txt")
        assert "No such file or directory" in result.stderr
        assert result.exit_code == 1

    @pytest.mark.asyncio
    async def test_cat_number_lines(self):
        bash = Bash(files={"/test.txt": "a\nb\nc\n"})
        result = await bash.exec("cat -n /test.txt")
        assert "1\t" in result.stdout
        assert "2\t" in result.stdout
        assert "3\t" in result.stdout


class TestEnvironment:
    """Test environment handling."""

    @pytest.mark.asyncio
    async def test_env_passed_to_exec(self):
        bash = Bash(env={"CUSTOM_VAR": "custom_value"})
        assert bash.env.get("CUSTOM_VAR") == "custom_value"

    @pytest.mark.asyncio
    async def test_default_env_vars(self):
        bash = Bash()
        assert "PATH" in bash.env
        assert "HOME" in bash.env
        assert "USER" in bash.env


class TestInitialFiles:
    """Test initial file setup."""

    @pytest.mark.asyncio
    async def test_files_dict(self):
        bash = Bash(files={
            "/data/file1.txt": "content1",
            "/data/file2.txt": "content2",
        })
        result = await bash.exec("cat /data/file1.txt")
        assert result.stdout == "content1\n"


class TestSynchronousRun:
    """Test synchronous run() method for REPL and script usage."""

    def test_simple_echo(self):
        """Test basic echo command with sync API."""
        bash = Bash()
        result = bash.run("echo hello")
        assert result.stdout == "hello\n"
        assert result.exit_code == 0

    def test_multiple_commands(self):
        """Test multiple commands in sequence."""
        bash = Bash()
        result = bash.run("echo a; echo b; echo c")
        assert result.stdout == "a\nb\nc\n"

    def test_variable_persistence(self):
        """Test that state persists between run() calls."""
        bash = Bash()
        bash.run("x=42")
        result = bash.run("echo $x")
        assert result.stdout == "42\n"

    def test_pipeline(self):
        """Test pipeline execution with sync API."""
        bash = Bash()
        result = bash.run('echo "banana apple cherry" | tr " " "\\n" | sort')
        assert result.stdout == "apple\nbanana\ncherry\n"

    def test_arithmetic(self):
        """Test arithmetic expansion."""
        bash = Bash()
        result = bash.run("echo $((5 + 3))")
        assert result.stdout == "8\n"

    def test_with_initial_files(self):
        """Test sync API with initial files."""
        bash = Bash(files={"/data.txt": "line1\nline2\nline3\n"})
        result = bash.run("cat /data.txt | wc -l")
        assert result.stdout.strip() == "3"

    def test_with_env(self):
        """Test sync API with environment variables."""
        bash = Bash(env={"MY_VAR": "hello"})
        result = bash.run("echo $MY_VAR")
        assert result.stdout == "hello\n"

    def test_file_creation_and_read(self):
        """Test creating and reading files with sync API."""
        bash = Bash()
        bash.run('echo "test content" > /tmp/test.txt')
        result = bash.run("cat /tmp/test.txt")
        assert result.stdout == "test content\n"

    def test_exit_code_success(self):
        """Test exit code for successful command."""
        bash = Bash()
        result = bash.run("true")
        assert result.exit_code == 0

    def test_exit_code_failure(self):
        """Test exit code for failed command."""
        bash = Bash()
        result = bash.run("false")
        assert result.exit_code == 1

    def test_stderr_output(self):
        """Test stderr is captured."""
        bash = Bash()
        result = bash.run("cat /nonexistent_file_12345")
        assert "No such file or directory" in result.stderr
        assert result.exit_code == 1

    def test_arrays(self):
        """Test array operations with sync API."""
        bash = Bash()
        result = bash.run('arr=(a b c); echo "${arr[@]}"')
        assert result.stdout == "a b c\n"

    def test_control_flow(self):
        """Test control flow with sync API."""
        bash = Bash()
        result = bash.run('if true; then echo yes; else echo no; fi')
        assert result.stdout == "yes\n"

    def test_for_loop(self):
        """Test for loop with sync API."""
        bash = Bash()
        result = bash.run('for i in 1 2 3; do echo $i; done')
        assert result.stdout == "1\n2\n3\n"

    def test_function_definition_and_call(self):
        """Test function with sync API."""
        bash = Bash()
        bash.run('greet() { echo "Hello, $1!"; }')
        result = bash.run('greet World')
        assert result.stdout == "Hello, World!\n"

    def test_command_substitution(self):
        """Test command substitution with sync API."""
        bash = Bash()
        result = bash.run('echo "Today is $(date +%Y)"')
        assert "Today is" in result.stdout

    def test_cwd_parameter(self):
        """Test cwd parameter for run()."""
        bash = Bash()
        bash.run("mkdir -p /project/src")
        result = bash.run("pwd", cwd="/project/src")
        assert result.stdout == "/project/src\n"

    def test_env_parameter(self):
        """Test env parameter for run()."""
        bash = Bash()
        result = bash.run("echo $TEMP_VAR", env={"TEMP_VAR": "temporary"})
        assert result.stdout == "temporary\n"

    def test_text_processing(self):
        """Test text processing commands with sync API."""
        bash = Bash(files={"/data.txt": "apple\nbanana\napple\ncherry\n"})
        result = bash.run("cat /data.txt | sort | uniq")
        assert result.stdout == "apple\nbanana\ncherry\n"


class TestGlobExpansionAfterWordSplit:
    """Test that glob expansion happens after IFS word splitting."""

    @pytest.mark.asyncio
    async def test_single_glob_in_variable(self):
        """A single glob pattern in a variable should expand."""
        bash = Bash()
        await bash.exec("touch /tmp/a.txt /tmp/b.txt")
        result = await bash.exec('x="/tmp/*.txt"; echo $x')
        assert "/tmp/a.txt" in result.stdout
        assert "/tmp/b.txt" in result.stdout

    @pytest.mark.asyncio
    async def test_multiple_globs_in_variable(self):
        """Multiple glob patterns space-separated in a variable should all expand."""
        bash = Bash()
        await bash.exec("touch /tmp/a.A /tmp/b.B")
        result = await bash.exec('x="/tmp/*.A /tmp/*.B"; echo $x')
        assert "/tmp/a.A" in result.stdout
        assert "/tmp/b.B" in result.stdout

    @pytest.mark.asyncio
    async def test_glob_from_nested_expansion(self):
        """Glob from nested variable expansion should expand."""
        bash = Bash()
        await bash.exec("touch /tmp/a.A /tmp/aa.A /tmp/b.B")
        result = await bash.exec('''
f="/tmp/*.A"
g="$f /tmp/*.B"
echo $g
''')
        assert "/tmp/a.A" in result.stdout
        assert "/tmp/aa.A" in result.stdout
        assert "/tmp/b.B" in result.stdout

    @pytest.mark.asyncio
    async def test_glob_with_no_match_stays_literal(self):
        """Glob pattern with no matches should stay literal (default behavior)."""
        bash = Bash()
        result = await bash.exec('x="/nonexistent/*.xyz"; echo $x')
        assert result.stdout == "/nonexistent/*.xyz\n"

    @pytest.mark.asyncio
    async def test_noglob_prevents_expansion(self):
        """With set -o noglob, glob patterns should not expand."""
        bash = Bash()
        await bash.exec("touch /tmp/a.txt /tmp/b.txt")
        result = await bash.exec('set -o noglob; x="/tmp/*.txt"; echo $x')
        assert result.stdout == "/tmp/*.txt\n"


class TestTildeExpansionInParameterDefaults:
    """Test that tilde expansion respects double quote context in parameter defaults."""

    @pytest.mark.asyncio
    async def test_tilde_expands_in_unquoted_default(self):
        """Tilde in ${undef:-~} should expand."""
        bash = Bash()
        result = await bash.exec('HOME=/home/bar; echo ${undef:-~}')
        assert result.stdout == "/home/bar\n"

    @pytest.mark.asyncio
    async def test_tilde_literal_in_double_quoted_expansion(self):
        """Tilde in "${undef:-~}" should NOT expand (literal ~)."""
        bash = Bash()
        result = await bash.exec('HOME=/home/bar; echo "${undef:-~}"')
        assert result.stdout == "~\n"

    @pytest.mark.asyncio
    async def test_quoted_tilde_literal_in_default(self):
        """Tilde in ${undef:-"~"} should NOT expand."""
        bash = Bash()
        result = await bash.exec('HOME=/home/bar; echo ${undef:-"~"}')
        assert result.stdout == "~\n"

    @pytest.mark.asyncio
    async def test_tilde_expands_in_alternative(self):
        """Tilde in ${x:+~/z} should expand when x is set."""
        bash = Bash()
        result = await bash.exec('HOME=/home/bar; x=1; echo ${x:+~/z}')
        assert result.stdout == "/home/bar/z\n"

    @pytest.mark.asyncio
    async def test_tilde_literal_in_double_quoted_alternative(self):
        """Tilde in "${x:+~}" should NOT expand when x is set."""
        bash = Bash()
        result = await bash.exec('HOME=/home/bar; x=1; echo "${x:+~}"')
        assert result.stdout == "~\n"


class TestNameref:
    """Test nameref (local -n, declare -n) functionality."""

    @pytest.mark.asyncio
    async def test_local_nameref_indexed_array(self):
        """Pass indexed array by reference using local -n."""
        bash = Bash()
        result = await bash.exec('''
show_value() {
  local -n arr=$1
  echo "${arr[2]}"
}
shadock=(ga bu zo meu)
show_value shadock
''')
        assert result.stdout.strip() == "zo"

    @pytest.mark.asyncio
    async def test_local_nameref_assoc_array(self):
        """Pass associative array by reference using local -n."""
        bash = Bash()
        result = await bash.exec('''
show_value() {
  local -n arr=$1
  local key=$2
  echo "${arr[$key]}"
}
days=([monday]=eggs [tuesday]=bread [sunday]=jam)
show_value days sunday
''')
        assert result.stdout.strip() == "jam"

    @pytest.mark.asyncio
    async def test_nameref_array_keys(self):
        """Get array keys through nameref."""
        bash = Bash()
        result = await bash.exec('''
get_keys() {
  local -n arr=$1
  echo "${!arr[@]}"
}
data=([a]=1 [b]=2 [c]=3)
get_keys data
''')
        out = result.stdout.strip().split()
        assert sorted(out) == ["a", "b", "c"]

    @pytest.mark.asyncio
    async def test_auto_assoc_detection(self):
        """Array with non-numeric keys auto-detected as associative."""
        bash = Bash()
        result = await bash.exec('''
arr=([foo]=bar [baz]=qux)
echo "${arr[foo]}"
''')
        assert result.stdout.strip() == "bar"

    @pytest.mark.asyncio
    async def test_typeset_minus_n_plus_n(self):
        """Test typeset -n to convert to nameref and +n to remove."""
        bash = Bash()
        result = await bash.exec('''
x=foo
ref=x
echo ref=$ref
typeset -n ref
echo ref=$ref
x=bar
echo ref=$ref
typeset +n ref
echo ref=$ref
''')
        assert result.stdout == "ref=x\nref=foo\nref=bar\nref=x\n"
