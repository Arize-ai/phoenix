"""Tests for glob and pattern matching features."""

import pytest
from just_bash import Bash


class TestBasicGlob:
    """Test basic glob expansion against filesystem."""

    @pytest.mark.asyncio
    async def test_star_glob(self):
        """Star matches files in directory."""
        bash = Bash(files={"/tmp/a.txt": "a", "/tmp/b.txt": "b", "/tmp/c.log": "c"})
        result = await bash.exec("echo /tmp/*.txt")
        assert result.exit_code == 0
        assert "/tmp/a.txt" in result.stdout
        assert "/tmp/b.txt" in result.stdout
        assert "/tmp/c.log" not in result.stdout

    @pytest.mark.asyncio
    async def test_question_glob(self):
        """Question mark matches single character."""
        bash = Bash(files={"/tmp/a1": "a", "/tmp/a2": "b", "/tmp/ab": "c"})
        result = await bash.exec("echo /tmp/a?")
        assert result.exit_code == 0
        assert "/tmp/a1" in result.stdout
        assert "/tmp/a2" in result.stdout
        assert "/tmp/ab" in result.stdout

    @pytest.mark.asyncio
    async def test_bracket_glob(self):
        """Bracket matches character class."""
        bash = Bash(files={"/tmp/a1": "a", "/tmp/a2": "b", "/tmp/a3": "c"})
        result = await bash.exec("echo /tmp/a[12]")
        assert result.exit_code == 0
        assert "/tmp/a1" in result.stdout
        assert "/tmp/a2" in result.stdout
        assert "/tmp/a3" not in result.stdout

    @pytest.mark.asyncio
    async def test_no_match_returns_pattern(self):
        """When no files match, the pattern is returned literally."""
        bash = Bash()
        result = await bash.exec("echo /nonexistent/*.xyz")
        assert result.exit_code == 0
        assert "/nonexistent/*.xyz" in result.stdout


class TestDotglob:
    """Test dotglob shopt option."""

    @pytest.mark.asyncio
    async def test_star_skips_dotfiles_by_default(self):
        """By default, * does not match dotfiles."""
        bash = Bash(files={"/tmp/.hidden": "h", "/tmp/visible": "v"})
        result = await bash.exec("echo /tmp/*")
        assert "visible" in result.stdout
        assert ".hidden" not in result.stdout

    @pytest.mark.asyncio
    async def test_dotglob_matches_dotfiles(self):
        """shopt -s dotglob makes * match dotfiles."""
        bash = Bash(files={"/tmp/.hidden": "h", "/tmp/visible": "v"})
        result = await bash.exec("shopt -s dotglob; echo /tmp/*")
        assert "visible" in result.stdout
        assert ".hidden" in result.stdout

    @pytest.mark.asyncio
    async def test_explicit_dot_pattern(self):
        """Explicit .* matches dotfiles regardless of dotglob."""
        bash = Bash(files={"/tmp/.hidden": "h", "/tmp/visible": "v"})
        result = await bash.exec("echo /tmp/.*")
        assert ".hidden" in result.stdout
        assert "visible" not in result.stdout


class TestExtglob:
    """Test extended glob patterns."""

    @pytest.mark.asyncio
    async def test_extglob_at_pattern(self):
        """@(pat1|pat2) matches exactly one of the patterns."""
        bash = Bash(files={"/tmp/foo.c": "", "/tmp/foo.h": "", "/tmp/foo.o": ""})
        result = await bash.exec("shopt -s extglob; echo /tmp/foo.@(c|h)")
        assert "/tmp/foo.c" in result.stdout
        assert "/tmp/foo.h" in result.stdout
        assert "/tmp/foo.o" not in result.stdout

    @pytest.mark.asyncio
    async def test_extglob_question_pattern(self):
        """?(pat1|pat2) matches zero or one of the patterns."""
        bash = Bash(files={"/tmp/foo": "", "/tmp/foobar": "", "/tmp/foobarbaz": ""})
        result = await bash.exec("shopt -s extglob; echo /tmp/foo?(bar)")
        assert "/tmp/foo" in result.stdout
        assert "/tmp/foobar" in result.stdout
        assert "/tmp/foobarbaz" not in result.stdout

    @pytest.mark.asyncio
    async def test_extglob_star_pattern(self):
        """*(pat1|pat2) matches zero or more of the patterns."""
        bash = Bash(files={"/tmp/foo": "", "/tmp/foobar": "", "/tmp/foobarbar": ""})
        result = await bash.exec("shopt -s extglob; echo /tmp/foo*(bar)")
        assert "/tmp/foo" in result.stdout
        assert "/tmp/foobar" in result.stdout
        assert "/tmp/foobarbar" in result.stdout

    @pytest.mark.asyncio
    async def test_extglob_plus_pattern(self):
        """+(pat1|pat2) matches one or more of the patterns."""
        bash = Bash(files={"/tmp/foo": "", "/tmp/foobar": "", "/tmp/foobarbar": ""})
        result = await bash.exec("shopt -s extglob; echo /tmp/foo+(bar)")
        assert "/tmp/foo" not in result.stdout.split()
        assert "/tmp/foobar" in result.stdout
        assert "/tmp/foobarbar" in result.stdout

    @pytest.mark.asyncio
    async def test_extglob_bang_pattern(self):
        """!(pat1|pat2) matches anything except the patterns."""
        bash = Bash(files={"/tmp/foo.c": "", "/tmp/foo.h": "", "/tmp/foo.o": ""})
        result = await bash.exec("shopt -s extglob; echo /tmp/foo.!(o)")
        assert "/tmp/foo.c" in result.stdout
        assert "/tmp/foo.h" in result.stdout
        assert "/tmp/foo.o" not in result.stdout


class TestExtglobInPatternMatching:
    """Test extglob in variable pattern operations."""

    @pytest.mark.asyncio
    async def test_extglob_in_case(self):
        """Extglob patterns work in case statements."""
        bash = Bash()
        result = await bash.exec('''
shopt -s extglob
x=hello
case $x in
    @(hello|world)) echo "matched";;
    *) echo "no match";;
esac
''')
        assert result.stdout.strip() == "matched"

    @pytest.mark.asyncio
    async def test_extglob_in_patsub(self):
        """Extglob patterns work in parameter substitution."""
        bash = Bash()
        result = await bash.exec('''
shopt -s extglob
x="foobarbar"
echo "${x/+(bar)/X}"
''')
        assert result.stdout.strip() == "fooX"

    @pytest.mark.asyncio
    async def test_extglob_in_strip(self):
        """Extglob patterns work in parameter stripping."""
        bash = Bash()
        result = await bash.exec('''
shopt -s extglob
x="foobarbar"
echo "${x%%+(bar)}"
''')
        assert result.stdout.strip() == "foo"

    @pytest.mark.asyncio
    async def test_extglob_in_double_bracket(self):
        """Extglob patterns work in [[ == ]] comparisons."""
        bash = Bash()
        result = await bash.exec('''
shopt -s extglob
x=hello
if [[ $x == @(hello|world) ]]; then
    echo "yes"
else
    echo "no"
fi
''')
        assert result.stdout.strip() == "yes"


class TestNullglob:
    """Test nullglob shopt option."""

    @pytest.mark.asyncio
    async def test_nullglob_returns_nothing(self):
        """With nullglob, non-matching patterns expand to nothing."""
        bash = Bash()
        result = await bash.exec("shopt -s nullglob; echo /nonexistent/*.xyz")
        assert result.stdout.strip() == ""

    @pytest.mark.asyncio
    async def test_failglob_errors(self):
        """With failglob, non-matching patterns cause an error."""
        bash = Bash()
        result = await bash.exec("shopt -s failglob; echo /nonexistent/*.xyz 2>&1")
        assert result.exit_code != 0 or "no match" in result.stderr.lower()


class TestGlobstar:
    """Test globstar (**) pattern."""

    @pytest.mark.asyncio
    async def test_globstar_recursive(self):
        """** matches directories recursively."""
        bash = Bash(files={
            "/tmp/a.txt": "",
            "/tmp/sub/b.txt": "",
            "/tmp/sub/deep/c.txt": "",
        })
        result = await bash.exec("shopt -s globstar; echo /tmp/**/*.txt")
        assert "a.txt" in result.stdout
        assert "b.txt" in result.stdout
        assert "c.txt" in result.stdout
