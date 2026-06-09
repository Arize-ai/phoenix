"""Tests for assignment and append operations (Phase 4)."""

import pytest
from just_bash import Bash


class TestArrayAppend:
    """Test += for arrays."""

    @pytest.mark.asyncio
    async def test_string_append(self):
        """Basic string += should concatenate."""
        bash = Bash()
        result = await bash.exec('x=hello; x+=world; echo "$x"')
        assert result.stdout == "helloworld\n"

    @pytest.mark.asyncio
    async def test_array_append_elements(self):
        """a+=(2 3) should add elements to array."""
        bash = Bash()
        result = await bash.exec('a=(1); a+=(2 3); echo "${a[@]}"')
        assert result.stdout == "1 2 3\n"

    @pytest.mark.asyncio
    async def test_array_append_single(self):
        """a+=(x) should add one element."""
        bash = Bash()
        result = await bash.exec('a=(a b); a+=(c); echo "${a[@]}"')
        assert result.stdout == "a b c\n"

    @pytest.mark.asyncio
    async def test_array_append_preserves_indices(self):
        """Appending to array uses next index after highest."""
        bash = Bash()
        result = await bash.exec('a=(x y z); a+=(w); echo "${a[3]}"')
        assert result.stdout == "w\n"


class TestArraySubscriptAppend:
    """Test a[idx]+=suffix."""

    @pytest.mark.asyncio
    async def test_array_element_string_append(self):
        """a[0]+=suffix should concat to element."""
        bash = Bash()
        result = await bash.exec('a=(hello); a[0]+=world; echo "${a[0]}"')
        assert result.stdout == "helloworld\n"


class TestArrayLiteralAssignment:
    """Test array literal assignment syntax."""

    @pytest.mark.asyncio
    async def test_indexed_array_literal(self):
        """a=([0]=x [1]=y) should set indexed elements."""
        bash = Bash()
        result = await bash.exec('a=([0]=x [1]=y [2]=z); echo "${a[1]}"')
        assert result.stdout == "y\n"

    @pytest.mark.asyncio
    async def test_simple_array_literal(self):
        """a=(a b c) should set sequential elements."""
        bash = Bash()
        result = await bash.exec('a=(a b c); echo "${a[0]} ${a[1]} ${a[2]}"')
        assert result.stdout == "a b c\n"


class TestAssocArrayAssignment:
    """Test associative array assignment."""

    @pytest.mark.asyncio
    async def test_declare_assoc_with_values(self):
        """declare -A a=([key]=val) should work."""
        bash = Bash()
        result = await bash.exec('declare -A a=([foo]=bar [baz]=qux); echo "${a[foo]}"')
        assert result.stdout == "bar\n"

    @pytest.mark.asyncio
    async def test_assoc_key_access(self):
        """Accessing associative array by key."""
        bash = Bash()
        result = await bash.exec('declare -A a; a[name]=alice; echo "${a[name]}"')
        assert result.stdout == "alice\n"

    @pytest.mark.asyncio
    async def test_assoc_all_values(self):
        """${a[@]} for assoc array returns all values."""
        bash = Bash()
        result = await bash.exec('declare -A a=([x]=1 [y]=2); echo "${a[@]}"')
        # Order may vary for assoc arrays
        assert "1" in result.stdout
        assert "2" in result.stdout

    @pytest.mark.asyncio
    async def test_assoc_all_keys(self):
        """${!a[@]} for assoc array returns all keys."""
        bash = Bash()
        result = await bash.exec('declare -A a=([x]=1 [y]=2); echo "${!a[@]}"')
        assert "x" in result.stdout
        assert "y" in result.stdout


class TestDeclareAppend:
    """Test declare with append."""

    @pytest.mark.asyncio
    async def test_declare_string_value(self):
        """declare x=value should set variable."""
        bash = Bash()
        result = await bash.exec('declare x=hello; echo "$x"')
        assert result.stdout == "hello\n"

    @pytest.mark.asyncio
    async def test_declare_integer(self):
        """declare -i x should make integer variable."""
        bash = Bash()
        result = await bash.exec('declare -i x=5+3; echo "$x"')
        assert result.stdout == "8\n"

    @pytest.mark.asyncio
    async def test_declare_uppercase(self):
        """declare -u x should uppercase."""
        bash = Bash()
        result = await bash.exec('declare -u x=hello; echo "$x"')
        assert result.stdout == "HELLO\n"

    @pytest.mark.asyncio
    async def test_declare_lowercase(self):
        """declare -l x should lowercase."""
        bash = Bash()
        result = await bash.exec('declare -l x=HELLO; echo "$x"')
        assert result.stdout == "hello\n"


class TestUnsetArrayElement:
    """Test unset 'a[idx]'."""

    @pytest.mark.asyncio
    async def test_unset_array_element(self):
        """unset a[1] should remove single element."""
        bash = Bash()
        result = await bash.exec("a=(x y z); unset 'a[1]'; echo \"${a[@]}\"")
        assert result.stdout == "x z\n"

    @pytest.mark.asyncio
    async def test_unset_whole_array(self):
        """unset a should remove entire array."""
        bash = Bash()
        result = await bash.exec('a=(x y z); unset a; echo "${a[@]}"')
        assert result.stdout == "\n"


class TestTypesetAppendScalar:
    """Test typeset/declare += for scalar variables."""

    @pytest.mark.asyncio
    async def test_typeset_append_creates_var(self):
        """typeset s+=foo should create variable with value foo."""
        bash = Bash()
        result = await bash.exec('typeset s+=foo; echo "s=$s"')
        assert result.stdout == "s=foo\n"

    @pytest.mark.asyncio
    async def test_typeset_append_twice(self):
        """typeset s+=foo twice should concatenate."""
        bash = Bash()
        result = await bash.exec('typeset t+=foo; typeset t+=foo; echo "t=$t"')
        assert result.stdout == "t=foofoo\n"

    @pytest.mark.asyncio
    async def test_typeset_append_array_elem0(self):
        """typeset a+=s on an array should append to element 0."""
        bash = Bash()
        result = await bash.exec('typeset a=(x y); typeset a+=s; argv.py "${a[@]}"')
        assert result.stdout == "['xs', 'y']\n"


class TestExportAppend:
    """Test export with += syntax."""

    @pytest.mark.asyncio
    async def test_export_append_creates_var(self):
        """export e+=foo should create exported variable."""
        bash = Bash()
        result = await bash.exec('export e+=foo; echo "e=$e"')
        assert result.stdout == "e=foo\n"

    @pytest.mark.asyncio
    async def test_export_append_twice(self):
        """export e+=foo twice should concatenate."""
        bash = Bash()
        result = await bash.exec('export e+=foo; export e+=foo; echo "e=$e"')
        assert result.stdout == "e=foofoo\n"


class TestLocalAppend:
    """Test local with += syntax."""

    @pytest.mark.asyncio
    async def test_local_append_twice(self):
        """local s+=foo twice should concatenate."""
        bash = Bash()
        result = await bash.exec("""
f() {
    local s+=foo
    local s+=foo
    echo "s=$s"
}
f
""")
        assert result.stdout == "s=foofoo\n"


class TestEnvPrefixAppend:
    """Test += in env prefix assignments."""

    @pytest.mark.asyncio
    async def test_env_prefix_append(self):
        """A+=a cmd should see concatenated value in env."""
        bash = Bash()
        result = await bash.exec('A=a; A+=a printenv.py A')
        assert result.stdout == "aa\n"
