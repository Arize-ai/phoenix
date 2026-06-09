"""Tests for array operations.

Covers: array.test.sh failures
Key areas: local arrays, word splitting, multi-line init, ${a[@]} vs ${a[*]},
           empty arrays with :-, array export behavior
"""

import pytest
from just_bash import Bash


class TestArrayDeclaration:
    """Test array declaration and initialization."""

    @pytest.mark.asyncio
    async def test_array_simple(self):
        """Simple array declaration."""
        bash = Bash()
        result = await bash.exec('''
arr=(one two three)
echo ${arr[0]} ${arr[1]} ${arr[2]}
''')
        assert result.stdout.strip() == "one two three"

    @pytest.mark.asyncio
    async def test_array_length(self):
        """Array length with ${#arr[@]}."""
        bash = Bash()
        result = await bash.exec('''
arr=(a b c d e)
echo ${#arr[@]}
''')
        assert result.stdout.strip() == "5"

    @pytest.mark.asyncio
    async def test_array_empty(self):
        """Empty array declaration."""
        bash = Bash()
        result = await bash.exec('''
arr=()
echo "len: ${#arr[@]}"
''')
        assert "len: 0" in result.stdout

    @pytest.mark.asyncio
    async def test_array_with_spaces(self):
        """Array elements with spaces."""
        bash = Bash()
        result = await bash.exec('''
arr=("hello world" "foo bar")
echo "${arr[0]}"
echo "${arr[1]}"
''')
        lines = result.stdout.strip().split('\n')
        assert lines[0] == "hello world"
        assert lines[1] == "foo bar"

    @pytest.mark.asyncio
    async def test_declare_array_with_empty_strings(self):
        """declare -a should preserve empty string elements."""
        bash = Bash()
        result = await bash.exec('''
declare -a A=('' x "" '')
argv.py "${A[@]}"
''')
        assert result.stdout == "['', 'x', '', '']\n"

    @pytest.mark.asyncio
    async def test_array_with_empty_strings(self):
        """Regular array assignment should preserve empty string elements."""
        bash = Bash()
        result = await bash.exec('''
A=('' x "" '')
argv.py "${A[@]}"
''')
        assert result.stdout == "['', 'x', '', '']\n"


class TestArrayLocalScope:
    """Test local array in functions."""

    @pytest.mark.asyncio
    async def test_local_array_basic(self):
        """local -a creates local array in function."""
        bash = Bash()
        result = await bash.exec('''
f() {
    local -a arr=(1 2 3)
    echo "${arr[@]}"
}
f
''')
        assert result.stdout.strip() == "1 2 3"

    @pytest.mark.asyncio
    async def test_local_array_does_not_leak(self):
        """Local array doesn't affect outer scope."""
        bash = Bash()
        result = await bash.exec('''
arr=(outer)
f() {
    local -a arr=(inner)
    echo "in: ${arr[@]}"
}
f
echo "out: ${arr[@]}"
''')
        assert "in: inner" in result.stdout
        assert "out: outer" in result.stdout

    @pytest.mark.asyncio
    async def test_local_array_unset(self):
        """Local array can be unset."""
        bash = Bash()
        result = await bash.exec('''
f() {
    local -a arr=(1 2 3)
    unset arr
    echo "len: ${#arr[@]}"
}
f
''')
        assert "len: 0" in result.stdout


class TestArrayExpansion:
    """Test ${arr[@]} vs ${arr[*]} differences."""

    @pytest.mark.asyncio
    async def test_at_expansion_quoted(self):
        """Quoted ${arr[@]} preserves element boundaries."""
        bash = Bash()
        result = await bash.exec('''
arr=("a b" "c d")
for x in "${arr[@]}"; do echo "[$x]"; done
''')
        assert "[a b]" in result.stdout
        assert "[c d]" in result.stdout

    @pytest.mark.asyncio
    async def test_star_expansion_quoted(self):
        """Quoted ${arr[*]} joins with first char of IFS."""
        bash = Bash()
        result = await bash.exec('''
arr=(a b c)
IFS=,
echo "${arr[*]}"
''')
        assert "a,b,c" in result.stdout

    @pytest.mark.asyncio
    async def test_at_expansion_unquoted(self):
        """Unquoted ${arr[@]} undergoes word splitting."""
        bash = Bash()
        result = await bash.exec('''
arr=("a b" "c d")
for x in ${arr[@]}; do echo "[$x]"; done
''')
        # Without quotes, "a b" splits into "a" "b"
        assert "[a]" in result.stdout
        assert "[b]" in result.stdout

    @pytest.mark.asyncio
    async def test_star_join_custom_ifs(self):
        """${arr[*]} joins with custom IFS."""
        bash = Bash()
        result = await bash.exec('''
arr=(1 2 3)
IFS=:
echo "${arr[*]}"
''')
        assert "1:2:3" in result.stdout

    @pytest.mark.asyncio
    async def test_empty_ifs_join(self):
        """${arr[*]} with empty IFS concatenates."""
        bash = Bash()
        result = await bash.exec('''
arr=(a b c)
IFS=''
echo "${arr[*]}"
''')
        assert "abc" in result.stdout


class TestArrayDefaultValue:
    """Test empty array with :- default value."""

    @pytest.mark.asyncio
    async def test_empty_array_default(self):
        """Empty array with :- uses default."""
        bash = Bash()
        result = await bash.exec('''
arr=()
echo "${arr[@]:-default}"
''')
        assert result.stdout.strip() == "default"

    @pytest.mark.asyncio
    async def test_nonempty_array_no_default(self):
        """Non-empty array ignores default."""
        bash = Bash()
        result = await bash.exec('''
arr=(value)
echo "${arr[@]:-default}"
''')
        assert result.stdout.strip() == "value"

    @pytest.mark.asyncio
    async def test_unset_array_default(self):
        """Unset array with :- uses default."""
        bash = Bash()
        result = await bash.exec('''
unset arr
echo "${arr[@]:-nothing}"
''')
        assert result.stdout.strip() == "nothing"


class TestArrayMultiLine:
    """Test multi-line array initialization."""

    @pytest.mark.asyncio
    async def test_multiline_array(self):
        """Array can span multiple lines."""
        bash = Bash()
        result = await bash.exec('''
arr=(
    one
    two
    three
)
echo ${#arr[@]}
''')
        assert result.stdout.strip() == "3"

    @pytest.mark.asyncio
    async def test_multiline_with_comments(self):
        """Array with inline comments."""
        bash = Bash()
        result = await bash.exec('''
arr=(
    one   # first
    two   # second
    three # third
)
echo "${arr[@]}"
''')
        assert "one two three" in result.stdout


class TestArrayIndexing:
    """Test array index operations."""

    @pytest.mark.asyncio
    async def test_negative_index(self):
        """Negative index accesses from end."""
        bash = Bash()
        result = await bash.exec('''
arr=(a b c d)
echo "${arr[-1]}"
''')
        assert result.stdout.strip() == "d"

    @pytest.mark.asyncio
    async def test_all_indices(self):
        """${!arr[@]} gives all indices."""
        bash = Bash()
        result = await bash.exec('''
arr=(a b c)
echo "${!arr[@]}"
''')
        assert "0 1 2" in result.stdout

    @pytest.mark.asyncio
    async def test_sparse_array_indices(self):
        """Sparse array indices."""
        bash = Bash()
        result = await bash.exec('''
arr=()
arr[0]=a
arr[5]=b
arr[10]=c
echo "${!arr[@]}"
''')
        assert "0 5 10" in result.stdout


class TestArraySlicing:
    """Test array slicing operations."""

    @pytest.mark.asyncio
    async def test_slice_from_index(self):
        """Slice starting from index."""
        bash = Bash()
        result = await bash.exec('''
arr=(a b c d e)
echo "${arr[@]:2}"
''')
        assert "c d e" in result.stdout

    @pytest.mark.asyncio
    async def test_slice_with_length(self):
        """Slice with length."""
        bash = Bash()
        result = await bash.exec('''
arr=(a b c d e)
echo "${arr[@]:1:3}"
''')
        assert "b c d" in result.stdout

    @pytest.mark.asyncio
    async def test_slice_negative_offset(self):
        """Slice with negative offset."""
        bash = Bash()
        result = await bash.exec('''
arr=(a b c d e)
echo "${arr[@]: -2}"
''')
        assert "d e" in result.stdout

    @pytest.mark.asyncio
    async def test_slice_negative_length_is_error(self):
        """Negative length in array slice is an error in bash 4.2+."""
        bash = Bash()
        result = await bash.exec('''
a=(1 2 3 4 5)
echo "${a[@]: 1: -3}"
''')
        # Bash returns error for negative length in array slices
        assert result.exit_code == 1
        assert "substring expression" in result.stderr.lower() or "bad" in result.stderr.lower()


class TestArrayAppend:
    """Test array append operations."""

    @pytest.mark.asyncio
    async def test_append_element(self):
        """Append element with arr+=(x)."""
        bash = Bash()
        result = await bash.exec('''
arr=(a b)
arr+=(c)
echo "${arr[@]}"
''')
        assert "a b c" in result.stdout

    @pytest.mark.asyncio
    async def test_append_multiple(self):
        """Append multiple elements."""
        bash = Bash()
        result = await bash.exec('''
arr=(a)
arr+=(b c d)
echo "${arr[@]}"
''')
        assert "a b c d" in result.stdout

    @pytest.mark.asyncio
    async def test_append_to_empty(self):
        """Append to empty array."""
        bash = Bash()
        result = await bash.exec('''
arr=()
arr+=(first)
echo "${arr[@]}"
''')
        assert result.stdout.strip() == "first"


class TestArrayAssignment:
    """Test array assignment patterns."""

    @pytest.mark.asyncio
    async def test_assign_by_index(self):
        """Assign by index creates array."""
        bash = Bash()
        result = await bash.exec('''
arr[0]=first
arr[1]=second
echo "${arr[@]}"
''')
        assert "first second" in result.stdout

    @pytest.mark.asyncio
    async def test_assign_middle_index(self):
        """Assign to middle index."""
        bash = Bash()
        result = await bash.exec('''
arr=(a b c)
arr[1]=X
echo "${arr[@]}"
''')
        assert "a X c" in result.stdout

    @pytest.mark.asyncio
    async def test_assign_negative_index(self):
        """Assign to element with negative index."""
        bash = Bash()
        result = await bash.exec('''
a=(1 2 3)
a[-1]=X
echo "${a[@]}"
''')
        assert result.stdout.strip() == "1 2 X"

    @pytest.mark.asyncio
    async def test_append_negative_index(self):
        """Append to last element with negative index."""
        bash = Bash()
        result = await bash.exec('''
a=(1 '2 3')
a[-1]+=' 4'
echo "${a[@]}"
''')
        # Element count should be 2, last element should be "2 3 4"
        assert result.stdout.strip() == "1 2 3 4"

    @pytest.mark.asyncio
    async def test_assign_negative_index_two(self):
        """Assign to second-to-last element."""
        bash = Bash()
        result = await bash.exec('''
a=(a b c d)
a[-2]=X
echo "${a[@]}"
''')
        assert result.stdout.strip() == "a b X d"

    @pytest.mark.asyncio
    async def test_assign_negative_out_of_bounds(self):
        """Negative index that resolves to out-of-bounds should error."""
        bash = Bash()
        result = await bash.exec('''
a[9]=x
a[-11]=E
echo "done"
''')
        assert "bad array subscript" in result.stderr
        # Script should still continue after the error
        assert "done" in result.stdout

    @pytest.mark.asyncio
    async def test_assign_with_nested_array_index(self):
        """Assign using array element as index: a[a[1]]=X."""
        bash = Bash()
        result = await bash.exec('''
a=(1 2 3)
a[a[1]]=X
echo ${a[@]}
''')
        # a[1] is 2, so a[2]=X, result is 1 2 X
        assert result.stdout.strip() == "1 2 X"

    @pytest.mark.asyncio
    async def test_assign_with_param_expansion_index(self):
        """Assign using ${arr[idx]} as index."""
        bash = Bash()
        result = await bash.exec('''
a=(1 '2 3')
i=(0 1)
a[${i[1]}]=9
echo "${a[@]}"
''')
        # i[1] is 1, so a[1]=9, result is 1 9
        assert result.stdout.strip() == "1 9"

    @pytest.mark.asyncio
    async def test_read_with_command_sub_index(self):
        """Read array element with command substitution index."""
        bash = Bash()
        result = await bash.exec('''
a=(1 '2 3')
echo "${a[$(echo 1)]}"
''')
        assert result.stdout.strip() == "2 3"


class TestArrayUnset:
    """Test unsetting array elements."""

    @pytest.mark.asyncio
    async def test_unset_element(self):
        """Unset single element."""
        bash = Bash()
        result = await bash.exec('''
arr=(a b c)
unset 'arr[1]'
echo "${arr[@]}"
echo "${!arr[@]}"
''')
        lines = result.stdout.strip().split('\n')
        assert "a c" in lines[0]
        assert "0 2" in lines[1]

    @pytest.mark.asyncio
    async def test_unset_entire_array(self):
        """Unset entire array."""
        bash = Bash()
        result = await bash.exec('''
arr=(a b c)
unset arr
echo "len: ${#arr[@]}"
''')
        assert "len: 0" in result.stdout

    @pytest.mark.asyncio
    async def test_unset_negative_index(self):
        """Unset element with negative index."""
        bash = Bash()
        result = await bash.exec('''
a=(0 1 2 3)
unset a[-1]
echo "len=${#a[@]}"
unset a[-1]
echo "len=${#a[@]}"
''')
        lines = result.stdout.strip().split('\n')
        assert lines[0] == "len=3"
        assert lines[1] == "len=2"


class TestArrayInLoop:
    """Test arrays in loops."""

    @pytest.mark.asyncio
    async def test_iterate_array(self):
        """Iterate over array with for loop."""
        bash = Bash()
        result = await bash.exec('''
arr=(one two three)
for item in "${arr[@]}"; do
    echo "- $item"
done
''')
        assert "- one" in result.stdout
        assert "- two" in result.stdout
        assert "- three" in result.stdout

    @pytest.mark.asyncio
    async def test_iterate_indices(self):
        """Iterate over indices."""
        bash = Bash()
        result = await bash.exec('''
arr=(a b c)
for i in "${!arr[@]}"; do
    echo "$i: ${arr[$i]}"
done
''')
        assert "0: a" in result.stdout
        assert "1: b" in result.stdout
        assert "2: c" in result.stdout


class TestAssociativeArrays:
    """Test associative arrays (declare -A)."""

    @pytest.mark.asyncio
    async def test_assoc_array_basic(self):
        """Basic associative array."""
        bash = Bash()
        result = await bash.exec('''
declare -A arr
arr[name]="John"
arr[age]="30"
echo "name: ${arr[name]}, age: ${arr[age]}"
''')
        assert "name: John, age: 30" in result.stdout

    @pytest.mark.asyncio
    async def test_assoc_array_keys(self):
        """Get associative array keys."""
        bash = Bash()
        result = await bash.exec('''
declare -A arr=([a]=1 [b]=2 [c]=3)
echo "${!arr[@]}"
''')
        # Keys may be in any order
        out = result.stdout.strip()
        assert "a" in out
        assert "b" in out
        assert "c" in out

    @pytest.mark.asyncio
    async def test_assoc_array_values(self):
        """Get associative array values."""
        bash = Bash()
        result = await bash.exec('''
declare -A arr=([x]=10 [y]=20)
echo "${arr[@]}"
''')
        out = result.stdout.strip()
        assert "10" in out
        assert "20" in out

    @pytest.mark.asyncio
    async def test_assoc_array_quoted_key_with_special_chars(self):
        """Associative array key with special characters should work."""
        bash = Bash()
        result = await bash.exec('''
declare -A a
a["aa"]=b
a["foo"]=bar
a['a+1']=c
echo "${a["aa"]}" "${a["foo"]}" "${a["a+1"]}"
''')
        assert result.stdout.strip() == "b bar c"

    @pytest.mark.asyncio
    async def test_assoc_array_separate_declaration_and_assignment(self):
        """Assoc array: declare -A then a=([key]=value) syntax."""
        bash = Bash()
        result = await bash.exec('''
declare -A a
a=([aa]=b [foo]=bar ['a+1']=c)
echo ${a["aa"]}
echo ${a["foo"]}
echo ${a["a+1"]}
''')
        assert result.stdout.strip() == "b\nbar\nc"


class TestLocalArrayWithoutFlag:
    """Test local array initialization without -a flag."""

    @pytest.mark.asyncio
    async def test_local_array_without_flag(self):
        """local a=(1 2) should work without -a flag."""
        bash = Bash()
        result = await bash.exec('''
f() {
    local a=(1 2 3)
    echo "${a[0]} ${a[1]} ${a[2]}"
}
f
''')
        assert result.stdout.strip() == "1 2 3"

    @pytest.mark.asyncio
    async def test_local_array_with_quoted_element(self):
        """local a=(1 '2 3') should preserve quoted element."""
        bash = Bash()
        result = await bash.exec('''
f() {
    local a=(1 '2 3')
    argv.py "${a[0]}"
}
f
''')
        assert result.stdout == "['1']\n"

    @pytest.mark.asyncio
    async def test_local_array_element_with_space(self):
        """local a=(1 '2 3') second element has space."""
        bash = Bash()
        result = await bash.exec('''
f() {
    local a=(1 '2 3')
    argv.py "${a[1]}"
}
f
''')
        assert result.stdout == "['2 3']\n"

    @pytest.mark.asyncio
    async def test_local_array_length(self):
        """local a=(x y z) should have length 3."""
        bash = Bash()
        result = await bash.exec('''
f() {
    local a=(x y z)
    echo ${#a[@]}
}
f
''')
        assert result.stdout.strip() == "3"

    @pytest.mark.asyncio
    async def test_declare_array_without_flag(self):
        """declare a=(1 2) should work without -a flag."""
        bash = Bash()
        result = await bash.exec('''
declare a=(1 2 3)
echo "${a[0]} ${a[1]} ${a[2]}"
''')
        assert result.stdout.strip() == "1 2 3"
