"""Tests for the bash parser."""

import pytest
from just_bash.parser import Parser, parse, ParseException
from just_bash.ast import (
    ScriptNode,
    StatementNode,
    PipelineNode,
    SimpleCommandNode,
    LiteralPart,
    ParameterExpansionPart,
)


class TestSimpleCommands:
    """Test simple command parsing."""

    def test_single_command(self):
        result = parse("echo hello")
        assert isinstance(result, ScriptNode)
        assert len(result.statements) == 1

        stmt = result.statements[0]
        assert isinstance(stmt, StatementNode)
        assert len(stmt.pipelines) == 1

        pipeline = stmt.pipelines[0]
        assert isinstance(pipeline, PipelineNode)
        assert len(pipeline.commands) == 1

        cmd = pipeline.commands[0]
        assert isinstance(cmd, SimpleCommandNode)
        assert cmd.name is not None
        assert len(cmd.name.parts) == 1
        assert cmd.name.parts[0].value == "echo"

    def test_command_with_args(self):
        result = parse("echo hello world")
        cmd = result.statements[0].pipelines[0].commands[0]
        assert len(cmd.args) == 2

    def test_multiple_commands_semicolon(self):
        result = parse("echo a; echo b")
        assert len(result.statements) == 2

    def test_multiple_commands_newline(self):
        result = parse("echo a\necho b")
        assert len(result.statements) == 2


class TestPipelines:
    """Test pipeline parsing."""

    def test_simple_pipeline(self):
        result = parse("cat file | grep pattern")
        assert len(result.statements) == 1

        pipeline = result.statements[0].pipelines[0]
        assert len(pipeline.commands) == 2

    def test_multi_stage_pipeline(self):
        result = parse("cat file | grep pattern | sort | uniq")
        pipeline = result.statements[0].pipelines[0]
        assert len(pipeline.commands) == 4

    def test_negated_pipeline(self):
        result = parse("! grep pattern file")
        pipeline = result.statements[0].pipelines[0]
        assert pipeline.negated is True


class TestOperators:
    """Test && and || operator parsing."""

    def test_and_and(self):
        result = parse("true && echo yes")
        stmt = result.statements[0]
        assert len(stmt.pipelines) == 2
        assert stmt.operators == ("&&",)

    def test_or_or(self):
        result = parse("false || echo fallback")
        stmt = result.statements[0]
        assert len(stmt.pipelines) == 2
        assert stmt.operators == ("||",)

    def test_mixed_operators(self):
        result = parse("cmd1 && cmd2 || cmd3")
        stmt = result.statements[0]
        assert len(stmt.pipelines) == 3
        assert stmt.operators == ("&&", "||")


class TestAssignments:
    """Test variable assignment parsing."""

    def test_simple_assignment(self):
        result = parse("VAR=value")
        cmd = result.statements[0].pipelines[0].commands[0]
        assert len(cmd.assignments) == 1
        assert cmd.assignments[0].name == "VAR"
        assert cmd.name is None  # Assignment-only command

    def test_assignment_with_command(self):
        result = parse("VAR=value echo $VAR")
        cmd = result.statements[0].pipelines[0].commands[0]
        assert len(cmd.assignments) == 1
        assert cmd.name is not None

    def test_append_assignment(self):
        result = parse("VAR+=more")
        cmd = result.statements[0].pipelines[0].commands[0]
        assert cmd.assignments[0].append is True


class TestRedirections:
    """Test redirection parsing."""

    def test_output_redirect(self):
        result = parse("echo hello > file.txt")
        cmd = result.statements[0].pipelines[0].commands[0]
        assert len(cmd.redirections) == 1
        assert cmd.redirections[0].operator == ">"

    def test_append_redirect(self):
        result = parse("echo hello >> file.txt")
        cmd = result.statements[0].pipelines[0].commands[0]
        assert cmd.redirections[0].operator == ">>"

    def test_input_redirect(self):
        result = parse("cat < file.txt")
        cmd = result.statements[0].pipelines[0].commands[0]
        assert cmd.redirections[0].operator == "<"

    def test_stderr_redirect(self):
        result = parse("cmd 2> error.log")
        cmd = result.statements[0].pipelines[0].commands[0]
        assert cmd.redirections[0].fd == 2
        assert cmd.redirections[0].operator == ">"


class TestExpansions:
    """Test word expansion parsing."""

    def test_variable_expansion(self):
        result = parse("echo $VAR")
        cmd = result.statements[0].pipelines[0].commands[0]
        arg = cmd.args[0]
        # Check that we have a parameter expansion part
        has_param_expansion = any(
            isinstance(p, ParameterExpansionPart) for p in arg.parts
        )
        assert has_param_expansion

    def test_braced_expansion(self):
        result = parse("echo ${VAR}")
        cmd = result.statements[0].pipelines[0].commands[0]
        arg = cmd.args[0]
        has_param_expansion = any(
            isinstance(p, ParameterExpansionPart) for p in arg.parts
        )
        assert has_param_expansion


class TestBackground:
    """Test background execution parsing."""

    def test_background_command(self):
        result = parse("sleep 10 &")
        stmt = result.statements[0]
        assert stmt.background is True


class TestEdgeCases:
    """Test edge cases and error handling."""

    def test_empty_input(self):
        result = parse("")
        assert len(result.statements) == 0

    def test_only_whitespace(self):
        result = parse("   \n\n   ")
        assert len(result.statements) == 0

    def test_only_comment(self):
        result = parse("# this is a comment")
        assert len(result.statements) == 0

    def test_command_after_comment(self):
        result = parse("# comment\necho hello")
        assert len(result.statements) == 1
