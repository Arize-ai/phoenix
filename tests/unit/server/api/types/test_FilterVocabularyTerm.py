"""Exercises the filter AI-query vocabulary generators and their drift checks."""

import ast
import re
import subprocess
import sys
from pathlib import Path

import pytest

from phoenix.trace.dsl.trace_filter import TraceFilter


def _trace_filter_snippet_expressions() -> list[str]:
    repo_root = Path(__file__).parents[5]
    source = (repo_root / "js/app/src/pages/project/traceFilterDSL.ts").read_text()
    string_literal = r'("(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\')'
    snippets = [
        ast.literal_eval(match.group(1))
        for match in re.finditer(rf"\bsnippet:\s*{string_literal}", source)
    ]
    assert len(snippets) == source.count("snippet:")
    return [re.sub(r"\$\{([^{}]*)\}", r"\1", snippet) for snippet in snippets]


def test_session_filter_ai_query_vocabulary_check_detects_drift(tmp_path: Path) -> None:
    repo_root = Path(__file__).parents[5]
    generator = repo_root / "scripts/generate_session_filter_ai_query_vocabulary.py"
    output = tmp_path / "sessionFilterCoreVocabulary.generated.ts"

    subprocess.run(
        [sys.executable, generator, "--output", output],
        check=True,
        cwd=repo_root,
    )
    subprocess.run(
        [sys.executable, generator, "--check", "--output", output],
        check=True,
        cwd=repo_root,
    )

    output.write_text(f"{output.read_text()}// drift\n")
    result = subprocess.run(
        [sys.executable, generator, "--check", "--output", output],
        check=False,
        capture_output=True,
        cwd=repo_root,
        text=True,
    )

    assert result.returncode == 1
    assert "is stale" in result.stdout


def test_trace_filter_ai_query_vocabulary_check_detects_drift(tmp_path: Path) -> None:
    repo_root = Path(__file__).parents[5]
    generator = repo_root / "scripts/generate_trace_filter_ai_query_vocabulary.py"
    output = tmp_path / "traceFilterCoreVocabulary.generated.ts"

    subprocess.run(
        [sys.executable, generator, "--output", output],
        check=True,
        cwd=repo_root,
    )
    subprocess.run(
        [sys.executable, generator, "--check", "--output", output],
        check=True,
        cwd=repo_root,
    )

    output.write_text(f"{output.read_text()}// drift\n")
    result = subprocess.run(
        [sys.executable, generator, "--check", "--output", output],
        check=False,
        capture_output=True,
        cwd=repo_root,
        text=True,
    )

    assert result.returncode == 1
    assert "is stale" in result.stdout


@pytest.mark.parametrize("condition", _trace_filter_snippet_expressions())
def test_trace_filter_snippets_compile(condition: str) -> None:
    TraceFilter(condition)
