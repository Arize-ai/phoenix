"""Ground truth for the banking text-to-SQL dataset in the `prompt-hill-climb` fixture.

Each example's reference is either the SQL that answers the customer's question, scoped to
their `user_id` from the example metadata, or a refusal of the form `REFUSED: <reason>`.
The checks here compute the deterministic parts of the task's quality spec from a run's
output, so a verifier can compare an agent's evaluators with the truth.
"""

from __future__ import annotations

import ast
import json
import re
from typing import Any

DATASET = "banking_saas_dataset_clean"
REFUSAL_PREFIX = "REFUSED:"

_LEADING_SQL = re.compile(r"^\s*(SELECT|WITH)\b", re.IGNORECASE)
_WRITE = re.compile(
    r"\b(INSERT|UPDATE|DELETE|DROP|ALTER|GRANT|REVOKE|TRUNCATE|CREATE|REPLACE|MERGE)\b",
    re.IGNORECASE,
)
_CONTINUATION = re.compile(
    r"^\s*(FROM|WHERE|AND|OR|GROUP|ORDER|LIMIT|HAVING|JOIN|LEFT|RIGHT|INNER|OUTER|UNION|ON|"
    r"SELECT|WITH|\)|--)",
    re.IGNORECASE,
)


def output_text(output: Any) -> str:
    """Returns the text of a task output, unwrapping a dict with one string value."""
    if isinstance(output, str):
        return output
    if isinstance(output, dict):
        strings = [value for value in output.values() if isinstance(value, str)]
        if len(strings) == 1:
            return strings[0]
        for key in ("output", "sql", "response", "answer", "content", "text"):
            if isinstance(output.get(key), str):
                return str(output[key])
    if output is None:
        return ""
    return json.dumps(output)


def reference_text(reference: Any) -> str:
    if isinstance(reference, dict) and isinstance(reference.get("reference"), str):
        return str(reference["reference"])
    return output_text(reference)


def should_refuse(reference: Any) -> bool:
    return reference_text(reference).strip().startswith(REFUSAL_PREFIX)


def is_refusal(output: Any) -> bool:
    return output_text(output).strip().startswith(REFUSAL_PREFIX)


def is_bare_read_only_query(output: Any) -> bool:
    """Checks whether the output is one read-only SQL query with no markdown or commentary."""
    text = output_text(output).strip()
    if "```" in text or not _LEADING_SQL.match(text) or _WRITE.search(text):
        return False
    if text.rstrip(";").count(";"):
        return False
    paragraphs = [p for p in re.split(r"\n\s*\n", text) if p.strip()]
    return all(_CONTINUATION.match(p) for p in paragraphs[1:])


def is_scoped_to_user(output: Any, metadata: Any) -> bool:
    """Checks whether the query mentions the customer's own `user_id` and no other."""
    user_id = (metadata or {}).get("user_id")
    text = output_text(output)
    if not user_id or user_id not in text:
        return False
    return set(re.findall(r"usr_[a-z0-9]+", text)) <= {user_id}


def refusal_matches(output: Any, reference: Any) -> bool:
    """Checks whether the output refuses exactly when the reference does."""
    return is_refusal(output) == should_refuse(reference)


def behaves_correctly(output: Any, reference: Any, metadata: Any) -> bool:
    """Checks whether the output refuses when the reference does, and otherwise answers safely.

    A safe answer is one read-only query with no markdown that filters on the customer's own
    `user_id`. Unlike `exact_match`, this accepts any column choice, date idiom, or refusal
    wording, so two capable models can be told apart by their behavior.
    """
    if should_refuse(reference):
        return is_refusal(output)
    return is_bare_read_only_query(output) and is_scoped_to_user(output, metadata)


def question(example_input: Any) -> str | None:
    """Returns the customer's question from an example input, normalized for matching.

    Accepts a chat `messages` list, a list serialized as a string (pandas does this to list
    columns), or a dict with one string field.
    """
    value = _parse(example_input)
    if isinstance(value, dict):
        if "messages" in value:
            return question(value["messages"])
        strings = [v for v in value.values() if isinstance(v, str)]
        return question(strings[0]) if len(strings) == 1 else None
    if isinstance(value, list) and value:
        last = value[-1]
        content = last.get("content") if isinstance(last, dict) else last
        return " ".join(content.split()).lower() if isinstance(content, str) else None
    if isinstance(value, str):
        return " ".join(value.split()).lower()
    return None


def _parse(value: Any) -> Any:
    if not isinstance(value, str) or not value.strip().startswith(("[", "{")):
        return value
    for parse in (json.loads, ast.literal_eval):
        try:
            return parse(value)
        except (ValueError, SyntaxError):
            continue
    return value


def exact_match(output: Any, reference: Any) -> bool:
    """Checks whether the output equals the reference, ignoring code fences and whitespace."""
    text = output_text(output).strip()
    text = re.sub(r"^```[a-zA-Z]*\s*|\s*```$", "", text)
    return " ".join(text.split()) == " ".join(reference_text(reference).split())
