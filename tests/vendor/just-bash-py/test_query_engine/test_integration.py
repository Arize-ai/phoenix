"""Integration tests for query-engine consistency across commands."""

import json
import pytest
from just_bash import Bash


class TestQueryEngineIntegration:
    """Tests that verify query-engine works consistently across commands."""

    @pytest.mark.asyncio
    async def test_same_filter_jq_yq(self):
        """Same filter produces same results in jq and yq."""
        json_data = '{"users": [{"name": "Alice"}, {"name": "Bob"}]}'
        yaml_data = """users:
  - name: Alice
  - name: Bob"""
        filter_expr = '.users[].name'

        # Test via jq
        bash = Bash(files={"/data.json": json_data})
        jq_result = await bash.exec(f"jq '{filter_expr}' /data.json")
        assert jq_result.exit_code == 0
        assert '"Alice"' in jq_result.stdout
        assert '"Bob"' in jq_result.stdout

        # Test via yq (JSON output)
        bash = Bash(files={"/data.yaml": yaml_data})
        yq_result = await bash.exec(f"yq -o json '{filter_expr}' /data.yaml")
        assert yq_result.exit_code == 0
        assert '"Alice"' in yq_result.stdout
        assert '"Bob"' in yq_result.stdout

    @pytest.mark.asyncio
    async def test_complex_filter_jq(self):
        """Complex filter works in jq."""
        filter_expr = '.[] | select(.age > 30) | .name'
        data = [{"name": "Alice", "age": 25}, {"name": "Bob", "age": 35}]

        bash = Bash(files={"/data.json": json.dumps(data)})
        result = await bash.exec(f"jq '{filter_expr}' /data.json")
        assert result.exit_code == 0
        assert result.stdout.strip() == '"Bob"'

    @pytest.mark.asyncio
    async def test_builtin_consistency_sort(self):
        """Sort builtin works consistently."""
        data = '{"nums": [3, 1, 2, 1]}'

        bash = Bash(files={"/data.json": data})
        result = await bash.exec("jq '.nums | sort' /data.json")
        assert result.exit_code == 0
        assert "1" in result.stdout
        assert "2" in result.stdout
        assert "3" in result.stdout

    @pytest.mark.asyncio
    async def test_builtin_consistency_unique(self):
        """Unique builtin works consistently."""
        data = '{"nums": [3, 1, 2, 1]}'

        bash = Bash(files={"/data.json": data})
        result = await bash.exec("jq '.nums | unique' /data.json")
        assert result.exit_code == 0
        parsed = json.loads(result.stdout.strip())
        assert set(parsed) == {1, 2, 3}

    @pytest.mark.asyncio
    async def test_builtin_consistency_add(self):
        """Add builtin works consistently."""
        data = '{"nums": [1, 2, 3, 1]}'

        bash = Bash(files={"/data.json": data})
        result = await bash.exec("jq '.nums | add' /data.json")
        assert result.exit_code == 0
        assert result.stdout.strip() == "7"

    @pytest.mark.asyncio
    async def test_map_select_chain(self):
        """Test map and select chaining (common pattern)."""
        data = '[{"status": "active", "value": 10}, {"status": "inactive", "value": 5}]'

        bash = Bash(files={"/data.json": data})
        result = await bash.exec(
            """jq '[.[] | select(.status == "active") | .value]' /data.json"""
        )
        assert result.exit_code == 0
        parsed = json.loads(result.stdout.strip())
        assert parsed == [10]

    @pytest.mark.asyncio
    async def test_object_construction(self):
        """Object construction with computed keys."""
        data = '{"firstName": "John", "lastName": "Doe"}'

        bash = Bash(files={"/data.json": data})
        result = await bash.exec(
            """jq '{name: (.firstName + " " + .lastName)}' /data.json"""
        )
        assert result.exit_code == 0
        assert "John Doe" in result.stdout

    @pytest.mark.asyncio
    async def test_reduce_aggregation(self):
        """Test reduce for aggregation."""
        data = '[1, 2, 3, 4, 5]'

        bash = Bash(files={"/data.json": data})
        result = await bash.exec(
            """jq 'reduce .[] as $x (0; . + $x)' /data.json"""
        )
        assert result.exit_code == 0
        assert result.stdout.strip() == "15"

    @pytest.mark.asyncio
    async def test_group_by(self):
        """Test group_by builtin."""
        data = '[{"type": "a", "val": 1}, {"type": "b", "val": 2}, {"type": "a", "val": 3}]'

        bash = Bash(files={"/data.json": data})
        result = await bash.exec("jq 'group_by(.type)' /data.json")
        assert result.exit_code == 0
        parsed = json.loads(result.stdout.strip())
        assert len(parsed) == 2  # Two groups

    @pytest.mark.asyncio
    async def test_sort_by(self):
        """Test sort_by builtin."""
        data = '[{"name": "Bob", "age": 35}, {"name": "Alice", "age": 25}]'

        bash = Bash(files={"/data.json": data})
        result = await bash.exec("jq 'sort_by(.age)' /data.json")
        assert result.exit_code == 0
        parsed = json.loads(result.stdout.strip())
        assert parsed[0]["name"] == "Alice"
        assert parsed[1]["name"] == "Bob"

    @pytest.mark.asyncio
    async def test_conditional_expression(self):
        """Test if-then-else expression."""
        data = '{"x": 5}'

        bash = Bash(files={"/data.json": data})
        result = await bash.exec(
            """jq 'if .x > 3 then "big" else "small" end' /data.json"""
        )
        assert result.exit_code == 0
        assert result.stdout.strip() == '"big"'

    @pytest.mark.asyncio
    async def test_alternative_operator(self):
        """Test alternative operator (//)."""
        data = '{"a": null}'

        bash = Bash(files={"/data.json": data})
        result = await bash.exec("""jq '.b // "default"' /data.json""")
        assert result.exit_code == 0
        assert result.stdout.strip() == '"default"'

    @pytest.mark.asyncio
    async def test_update_operator(self):
        """Test update operator (|=)."""
        data = '{"a": 1}'

        bash = Bash(files={"/data.json": data})
        result = await bash.exec("jq '.a |= . + 1' /data.json")
        assert result.exit_code == 0
        parsed = json.loads(result.stdout.strip())
        assert parsed["a"] == 2

    @pytest.mark.asyncio
    async def test_recursive_descent(self):
        """Test recursive descent (..)."""
        data = '{"a": {"b": {"c": 1}}}'

        bash = Bash(files={"/data.json": data})
        result = await bash.exec("jq '.. | numbers' /data.json")
        assert result.exit_code == 0
        assert "1" in result.stdout

    @pytest.mark.asyncio
    async def test_string_functions(self):
        """Test string manipulation functions."""
        data = '"Hello, World!"'

        bash = Bash(files={"/data.json": data})

        # ascii_downcase
        result = await bash.exec("jq 'ascii_downcase' /data.json")
        assert result.exit_code == 0
        assert '"hello, world!"' in result.stdout

        # split and join
        result = await bash.exec("""jq 'split(", ")' /data.json""")
        assert result.exit_code == 0
        assert "Hello" in result.stdout

    @pytest.mark.asyncio
    async def test_format_functions(self):
        """Test format functions (@base64, @uri, etc.)."""
        bash = Bash(files={"/data.json": '"hello world"'})

        # @base64
        result = await bash.exec("jq '@base64' /data.json")
        assert result.exit_code == 0
        assert "aGVsbG8gd29ybGQ" in result.stdout

        # @uri
        result = await bash.exec("jq '@uri' /data.json")
        assert result.exit_code == 0
        assert "hello%20world" in result.stdout

    @pytest.mark.asyncio
    async def test_math_functions(self):
        """Test math functions."""
        bash = Bash(files={"/data.json": "3.7"})

        result = await bash.exec("jq 'floor' /data.json")
        assert result.exit_code == 0
        assert result.stdout.strip() == "3"

        result = await bash.exec("jq 'ceil' /data.json")
        assert result.exit_code == 0
        assert result.stdout.strip() == "4"

    @pytest.mark.asyncio
    async def test_type_functions(self):
        """Test type filtering functions."""
        data = '[1, "two", true, null, [3], {"four": 4}]'

        bash = Bash(files={"/data.json": data})

        result = await bash.exec("jq '.[] | numbers' /data.json")
        assert result.exit_code == 0
        assert result.stdout.strip() == "1"

        result = await bash.exec("jq '.[] | strings' /data.json")
        assert result.exit_code == 0
        assert result.stdout.strip() == '"two"'

    @pytest.mark.asyncio
    async def test_entry_functions(self):
        """Test to_entries and from_entries."""
        data = '{"a": 1, "b": 2}'

        bash = Bash(files={"/data.json": data})

        # to_entries
        result = await bash.exec("jq 'to_entries' /data.json")
        assert result.exit_code == 0
        parsed = json.loads(result.stdout.strip())
        assert len(parsed) == 2
        assert any(e["key"] == "a" and e["value"] == 1 for e in parsed)

        # from_entries
        entries = '[{"key": "x", "value": 10}]'
        bash = Bash(files={"/data.json": entries})
        result = await bash.exec("jq 'from_entries' /data.json")
        assert result.exit_code == 0
        parsed = json.loads(result.stdout.strip())
        assert parsed == {"x": 10}

    @pytest.mark.asyncio
    async def test_yq_json_processing(self):
        """Test yq with JSON input."""
        data = '{"name": "Test", "value": 42}'

        bash = Bash(files={"/data.json": data})
        result = await bash.exec("yq -p json '.name' /data.json")
        assert result.exit_code == 0
        assert "Test" in result.stdout

    @pytest.mark.asyncio
    async def test_yq_yaml_to_json(self):
        """Test yq converting YAML to JSON."""
        yaml_data = """name: Test
value: 42"""

        bash = Bash(files={"/data.yaml": yaml_data})
        result = await bash.exec("yq -o json '.' /data.yaml")
        assert result.exit_code == 0
        parsed = json.loads(result.stdout.strip())
        assert parsed["name"] == "Test"
        assert parsed["value"] == 42

    @pytest.mark.asyncio
    async def test_multiple_outputs(self):
        """Test expressions that produce multiple outputs."""
        data = '{"a": 1, "b": 2, "c": 3}'

        bash = Bash(files={"/data.json": data})
        result = await bash.exec("jq '.a, .b, .c' /data.json")
        assert result.exit_code == 0
        lines = result.stdout.strip().split("\n")
        assert lines == ["1", "2", "3"]

    @pytest.mark.asyncio
    async def test_variable_binding(self):
        """Test variable binding with 'as'."""
        data = '{"x": 5}'

        bash = Bash(files={"/data.json": data})
        result = await bash.exec("jq '.x as $n | $n * $n' /data.json")
        assert result.exit_code == 0
        assert result.stdout.strip() == "25"

    @pytest.mark.asyncio
    async def test_try_catch(self):
        """Test try-catch error handling."""
        data = '{"a": 1}'

        bash = Bash(files={"/data.json": data})
        result = await bash.exec("""jq 'try error catch "caught"' /data.json""")
        # Should catch the error and return "caught"
        assert "caught" in result.stdout

    @pytest.mark.asyncio
    async def test_has_function(self):
        """Test has function."""
        data = '{"a": 1}'

        bash = Bash(files={"/data.json": data})

        result = await bash.exec("""jq 'has("a")' /data.json""")
        assert result.exit_code == 0
        assert result.stdout.strip() == "true"

        result = await bash.exec("""jq 'has("b")' /data.json""")
        assert result.exit_code == 0
        assert result.stdout.strip() == "false"

    @pytest.mark.asyncio
    async def test_contains_function(self):
        """Test contains function."""
        data = '[1, 2, 3, 4, 5]'

        bash = Bash(files={"/data.json": data})

        result = await bash.exec("jq 'contains([2, 4])' /data.json")
        assert result.exit_code == 0
        assert result.stdout.strip() == "true"

        result = await bash.exec("jq 'contains([2, 6])' /data.json")
        assert result.exit_code == 0
        assert result.stdout.strip() == "false"
