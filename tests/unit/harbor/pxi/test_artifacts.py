from typing import Any

import pytest

from evals.harbor.pxi.criteria import evaluator_output
from evals.harbor.pxi.evaluators.artifacts import assistant_json_match, graphql_query_valid

QUERY = """query Projects($after: String) {
  projects(first: 2, after: $after) {
    edges { node { id name } }
    pageInfo { hasNextPage endCursor }
  }
}"""


@pytest.mark.parametrize(
    "answer,expected,score",
    [
        ('{"b": [1, 2], "a": true}', {"a": True, "b": [1, 2]}, 1),
        ('```json\n{"a": true}\n```', {"a": True}, 1),
        ('{"a": 1}', {"a": True}, 0),
        ('{"a": true, "a": false}', {"a": False}, 0),
        ('{"a": NaN}', {"a": None}, 0),
        ('{"a": Infinity}', {"a": None}, 0),
        ('{"a": 1e999}', {"a": None}, 0),
        ('{"a": [1.0, 0.0]}', {"a": [1, 0]}, 1),
        ('Here is JSON: {"a": true}', {"a": True}, 0),
        ('{"a": true} trailing prose', {"a": True}, 0),
        ('{"a": true, "extra": 1}', {"a": True}, 0),
        (None, {"a": True}, 0),
    ],
)
def test_complete_json_artifact(answer: str | None, expected: Any, score: int) -> None:
    result = assistant_json_match.evaluate(
        {"output": {"final_answer": answer}, "expected": {"assistant_json": expected}}
    )
    assert result[0].score == score


@pytest.mark.parametrize(
    "query,score",
    [
        (QUERY, 1),
        (f"```graphql\n{QUERY}\n```", 1),
        (
            QUERY.replace("node { id name }", "node { ...ProjectFields }")
            + " fragment ProjectFields on Project { id name }",
            1,
        ),
        (QUERY.replace("node { id name }", "node { ... on Project { id name } }"), 1),
        (QUERY.replace("id name", "id imaginaryField"), 0),
        (QUERY.replace("first: 2", "first: 200"), 0),
        (QUERY.replace("hasNextPage endCursor", "hasNextPage"), 0),
        (QUERY.replace("after: $after", "after: null"), 0),
        (QUERY.replace("$after: String", "$after: String!"), 0),
        (QUERY.replace("$after", "$cursor"), 0),
        (QUERY + " query Other { projects { edges { node { id } } } }", 0),
        ("query {", 0),
        ("", 0),
    ],
)
def test_graphql_artifact(query: str, score: int) -> None:
    result = graphql_query_valid.evaluate(
        {"output": {"final_answer": query}, "expected": {"graphql_query": "paginated_projects"}}
    )
    assert result[0].score == score, result[0].explanation


def test_grade_only_the_answer_after_tools() -> None:
    parts: list[dict[str, Any]] = [
        {"type": "text", "text": "I will load the skill."},
        {"type": "tool-load_skill", "input": {"skill_name": "datasets"}},
        {"type": "text", "text": '{"a": true}'},
    ]
    output = evaluator_output([{"role": "assistant", "parts": parts}])
    assert output["final_answer"] == '{"a": true}'
    assert "load the skill" in output["assistant_text"]
    parts.append({"type": "dynamic-tool", "toolName": "execute", "input": {}})
    output = evaluator_output([{"role": "assistant", "parts": parts}])
    result = assistant_json_match.evaluate(
        {"output": output, "expected": {"assistant_json": {"a": True}}}
    )
    assert result[0].score == 0  # A pending tool call is not a final artifact.
