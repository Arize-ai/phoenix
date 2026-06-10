"""Tests for variable operations and parameter expansion (Phase 2)."""

import pytest
from phoenix.vendor.just_bash import Bash


class TestPatternRemovalPOSIXClasses:
    """Test pattern matching with POSIX character classes."""

    @pytest.mark.asyncio
    async def test_strip_alpha_class(self):
        bash = Bash()
        result = await bash.exec('x="hello123"; echo "${x%%[[:alpha:]]*}"')
        assert result.stdout == "\n"

    @pytest.mark.asyncio
    async def test_strip_digit_class(self):
        bash = Bash()
        result = await bash.exec('x="hello123"; echo "${x%%[[:digit:]]*}"')
        assert result.stdout == "hello\n"

    @pytest.mark.asyncio
    async def test_suffix_strip_digit(self):
        bash = Bash()
        result = await bash.exec('x="abc123"; echo "${x%[[:digit:]]}"')
        assert result.stdout == "abc12\n"


class TestVariableIndirection:
    """Test ${!prefix*} and ${!prefix@} listing."""

    @pytest.mark.asyncio
    async def test_indirection_simple(self):
        bash = Bash()
        result = await bash.exec('x=hello; ref=x; echo "${!ref}"')
        assert result.stdout == "hello\n"

    @pytest.mark.asyncio
    async def test_prefix_star(self):
        bash = Bash()
        result = await bash.exec('MYVAR1=a; MYVAR2=b; MYVAR3=c; echo "${!MYVAR*}"')
        assert result.stdout == "MYVAR1 MYVAR2 MYVAR3\n"

    @pytest.mark.asyncio
    async def test_prefix_at(self):
        bash = Bash()
        result = await bash.exec('MYVAR1=a; MYVAR2=b; echo "${!MYVAR@}"')
        assert result.stdout == "MYVAR1 MYVAR2\n"


class TestCaseConversion:
    """Test ${var^^} and ${var,,} case conversion."""

    @pytest.mark.asyncio
    async def test_uppercase_all(self):
        bash = Bash()
        result = await bash.exec('x=hello; echo "${x^^}"')
        assert result.stdout == "HELLO\n"

    @pytest.mark.asyncio
    async def test_uppercase_first(self):
        bash = Bash()
        result = await bash.exec('x=hello; echo "${x^}"')
        assert result.stdout == "Hello\n"

    @pytest.mark.asyncio
    async def test_lowercase_all(self):
        bash = Bash()
        result = await bash.exec('x=HELLO; echo "${x,,}"')
        assert result.stdout == "hello\n"

    @pytest.mark.asyncio
    async def test_lowercase_first(self):
        bash = Bash()
        result = await bash.exec('x=HELLO; echo "${x,}"')
        assert result.stdout == "hELLO\n"


class TestSubstring:
    """Test ${var:offset:length} substring operations."""

    @pytest.mark.asyncio
    async def test_substring_offset(self):
        bash = Bash()
        result = await bash.exec('x=hello; echo "${x:1}"')
        assert result.stdout == "ello\n"

    @pytest.mark.asyncio
    async def test_substring_offset_length(self):
        bash = Bash()
        result = await bash.exec('x=hello; echo "${x:1:3}"')
        assert result.stdout == "ell\n"

    @pytest.mark.asyncio
    async def test_substring_negative_offset(self):
        """Negative offset counts from end."""
        bash = Bash()
        result = await bash.exec('x=hello; echo "${x: -2}"')
        assert result.stdout == "lo\n"

    @pytest.mark.asyncio
    async def test_substring_negative_length(self):
        """Negative length means offset from end."""
        bash = Bash()
        result = await bash.exec('x=hello; echo "${x:1:-1}"')
        assert result.stdout == "ell\n"


class TestDefaultValue:
    """Test ${var:-default} and ${var-default}."""

    @pytest.mark.asyncio
    async def test_default_unset(self):
        bash = Bash()
        result = await bash.exec('echo "${x:-default}"')
        assert result.stdout == "default\n"

    @pytest.mark.asyncio
    async def test_default_empty(self):
        bash = Bash()
        result = await bash.exec('x=""; echo "${x:-default}"')
        assert result.stdout == "default\n"

    @pytest.mark.asyncio
    async def test_default_set(self):
        bash = Bash()
        result = await bash.exec('x=value; echo "${x:-default}"')
        assert result.stdout == "value\n"

    @pytest.mark.asyncio
    async def test_no_colon_default_empty(self):
        """${var-default} only applies to unset, not empty."""
        bash = Bash()
        result = await bash.exec('x=""; echo "${x-default}"')
        assert result.stdout == "\n"


class TestErrorIfUnset:
    """Test ${var:?message}."""

    @pytest.mark.asyncio
    async def test_error_if_unset(self):
        bash = Bash()
        result = await bash.exec('echo "${x:?variable not set}"')
        assert result.exit_code != 0
        assert "variable not set" in result.stderr

    @pytest.mark.asyncio
    async def test_error_if_set(self):
        bash = Bash()
        result = await bash.exec('x=hello; echo "${x:?variable not set}"')
        assert result.stdout == "hello\n"
        assert result.exit_code == 0


class TestAlternativeValue:
    """Test ${var:+alternative}."""

    @pytest.mark.asyncio
    async def test_alternative_set(self):
        bash = Bash()
        result = await bash.exec('x=hello; echo "${x:+alt}"')
        assert result.stdout == "alt\n"

    @pytest.mark.asyncio
    async def test_alternative_unset(self):
        bash = Bash()
        result = await bash.exec('echo "${x:+alt}"')
        assert result.stdout == "\n"


class TestAssignDefault:
    """Test ${var:=default}."""

    @pytest.mark.asyncio
    async def test_assign_default(self):
        bash = Bash()
        result = await bash.exec('echo "${x:=default}"; echo "$x"')
        assert result.stdout == "default\ndefault\n"


class TestLength:
    """Test ${#var} length."""

    @pytest.mark.asyncio
    async def test_string_length(self):
        bash = Bash()
        result = await bash.exec('x=hello; echo "${#x}"')
        assert result.stdout == "5\n"

    @pytest.mark.asyncio
    async def test_empty_length(self):
        bash = Bash()
        result = await bash.exec('x=""; echo "${#x}"')
        assert result.stdout == "0\n"


class TestPatternRemoval:
    """Test ${var#pattern} and ${var%pattern} removal."""

    @pytest.mark.asyncio
    async def test_prefix_shortest(self):
        bash = Bash()
        result = await bash.exec('x="/usr/local/bin"; echo "${x#*/}"')
        assert result.stdout == "usr/local/bin\n"

    @pytest.mark.asyncio
    async def test_prefix_longest(self):
        bash = Bash()
        result = await bash.exec('x="/usr/local/bin"; echo "${x##*/}"')
        assert result.stdout == "bin\n"

    @pytest.mark.asyncio
    async def test_suffix_shortest(self):
        bash = Bash()
        result = await bash.exec('x="file.tar.gz"; echo "${x%.*}"')
        assert result.stdout == "file.tar\n"

    @pytest.mark.asyncio
    async def test_suffix_longest(self):
        bash = Bash()
        result = await bash.exec('x="file.tar.gz"; echo "${x%%.*}"')
        assert result.stdout == "file\n"


class TestPatternReplacement:
    """Test ${var/pattern/replacement}."""

    @pytest.mark.asyncio
    async def test_replace_first(self):
        bash = Bash()
        result = await bash.exec('x="hello world hello"; echo "${x/hello/bye}"')
        assert result.stdout == "bye world hello\n"

    @pytest.mark.asyncio
    async def test_replace_all(self):
        bash = Bash()
        result = await bash.exec('x="hello world hello"; echo "${x//hello/bye}"')
        assert result.stdout == "bye world bye\n"

    @pytest.mark.asyncio
    async def test_replace_prefix(self):
        bash = Bash()
        result = await bash.exec('x="hello world"; echo "${x/#hello/bye}"')
        assert result.stdout == "bye world\n"

    @pytest.mark.asyncio
    async def test_replace_suffix(self):
        bash = Bash()
        result = await bash.exec('x="hello world"; echo "${x/%world/earth}"')
        assert result.stdout == "hello earth\n"


class TestTransformOperators:
    """Test ${var@Q}, ${var@a}, etc."""

    @pytest.mark.asyncio
    async def test_transform_q(self):
        """@Q should produce shell-quoted form."""
        bash = Bash()
        result = await bash.exec("x='hello world'; echo \"${x@Q}\"")
        assert result.stdout == "'hello world'\n"

    @pytest.mark.asyncio
    async def test_transform_a_regular(self):
        """@a should return attributes (empty for regular var)."""
        bash = Bash()
        result = await bash.exec('x=hello; echo "${x@a}"')
        assert result.stdout == "\n"


class TestAtStarVarOps:
    """Test $@ and $* in parameter expansion operations like ${@-}, ${@+}."""

    @pytest.mark.asyncio
    async def test_at_minus_with_params(self):
        """${@-minus} should NOT use default when params are set."""
        bash = Bash()
        result = await bash.exec('''
f() { argv.py ${@-minus}; }
f "hello"
''')
        assert result.stdout.strip() == "['hello']"

    @pytest.mark.asyncio
    async def test_at_plus_with_params(self):
        """${@+plus} should use alt when params are set."""
        bash = Bash()
        result = await bash.exec('''
f() { argv.py ${@+plus}; }
f ""
''')
        assert result.stdout.strip() == "['plus']"

    @pytest.mark.asyncio
    async def test_at_minus_no_params(self):
        """${@-minus} should use default when no params."""
        bash = Bash()
        result = await bash.exec('''
f() { argv.py ${@-minus}; }
f
''')
        assert result.stdout.strip() == "['minus']"

    @pytest.mark.asyncio
    async def test_at_plus_no_params(self):
        """${@+plus} should NOT use alt when no params."""
        bash = Bash()
        result = await bash.exec('''
f() { argv.py ${@+plus}; }
f
''')
        assert result.stdout.strip() == "[]"

    @pytest.mark.asyncio
    async def test_star_minus_with_params(self):
        """${*-minus} should NOT use default when params are set."""
        bash = Bash()
        result = await bash.exec('''
f() { argv.py "${*-minus}"; }
f ""
''')
        assert result.stdout.strip() == "['']"

    @pytest.mark.asyncio
    async def test_star_plus_with_params(self):
        """${*+plus} should use alt when params are set."""
        bash = Bash()
        result = await bash.exec('''
f() { argv.py "${*+plus}"; }
f ""
''')
        assert result.stdout.strip() == "['plus']"

    @pytest.mark.asyncio
    async def test_colon_minus_empty_param(self):
        """${@:-minus} should use default when param is empty."""
        bash = Bash()
        result = await bash.exec('''
f() { argv.py ${@:-minus}; }
f ""
''')
        assert result.stdout.strip() == "['minus']"

    @pytest.mark.asyncio
    async def test_colon_plus_empty_param(self):
        """${@:+plus} should NOT use alt when param is empty."""
        bash = Bash()
        result = await bash.exec('''
f() { argv.py ${@:+plus}; }
f ""
''')
        assert result.stdout.strip() == "[]"


class TestDeclarationGlobSuppression:
    """Test that declaration builtins suppress glob expansion on RHS."""

    @pytest.mark.asyncio
    async def test_declare_no_glob(self):
        """declare x=* should store literal '*', not expand."""
        bash = Bash(files={"/tmp/a.txt": "", "/tmp/b.txt": ""})
        result = await bash.exec('''
cd /tmp
declare foo=*
echo "$foo"
''')
        assert result.stdout.strip() == "*"

    @pytest.mark.asyncio
    async def test_export_no_glob(self):
        """export x=* should store literal '*'."""
        bash = Bash(files={"/tmp/a.txt": "", "/tmp/b.txt": ""})
        result = await bash.exec('''
cd /tmp
export foo=*
echo "$foo"
''')
        assert result.stdout.strip() == "*"

    @pytest.mark.asyncio
    async def test_local_no_glob(self):
        """local x=* should store literal '*'."""
        bash = Bash(files={"/tmp/a.txt": "", "/tmp/b.txt": ""})
        result = await bash.exec('''
f() {
    cd /tmp
    local foo=*
    echo "$foo"
}
f
''')
        assert result.stdout.strip() == "*"

    @pytest.mark.asyncio
    async def test_typeset_no_glob(self):
        """typeset x=* should store literal '*'."""
        bash = Bash(files={"/tmp/a.txt": "", "/tmp/b.txt": ""})
        result = await bash.exec('''
cd /tmp
typeset foo=*
echo "$foo"
''')
        assert result.stdout.strip() == "*"

    @pytest.mark.asyncio
    async def test_readonly_no_glob(self):
        """readonly x=* should store literal '*'."""
        bash = Bash(files={"/tmp/a.txt": "", "/tmp/b.txt": ""})
        result = await bash.exec('''
cd /tmp
readonly foo=*
echo "$foo"
''')
        assert result.stdout.strip() == "*"
