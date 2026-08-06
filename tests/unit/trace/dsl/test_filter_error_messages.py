"""Every rejection must produce a message written for the person who typed it.

The filter field renders `errorMessage` verbatim, so a message is the entire
experience of getting a condition wrong. Spot-checking the messages we thought
to write does not establish that -- the ones that matter are produced by input
nobody enumerated.

So the corpus here is generated: every prefix of a valid condition (which is
what someone mid-keystroke sends), plus mutations, plus the hand-written cases.
Anything rejected has its message checked against the bar below.
"""

import string
from typing import Iterator

import pytest

from phoenix.trace.dsl.filter import SpanFilter

# Realistic conditions, chosen to span the grammar: names, annotations, casts,
# collections, datetimes, nesting, and each accessor form.
VALID_CONDITIONS = [
    "span_kind == 'LLM'",
    "latency_ms > 100",
    "annotations['quality'].score >= 0.5",
    "name == 'x' and status_code == 'OK'",
    "'hi' in input.value",
    "parent_span is None",
    "attributes['a']['b'] == 1",
    "start_time > '2024-01-01T00:00:00Z'",
    "not (name == 'z')",
    "span_kind in ['LLM', 'TOOL']",
    "float(attributes['n']) > 1",
    "metadata['flag'] is True",
    "llm.token_count.total > 5",
    "0.5 < latency_ms < 1000",
    "span.total_cost > 0.1",
    "span.total_cost_per_token > 0.0001 and span.total_tokens > 100",
    "any(d.cost > 1 for d in span.cost_details)",
    "sum(d.tokens for d in span.cost_details if d.token_type == 'input') > 1000",
]

# Substrings that mean the message is describing Python, or our implementation,
# rather than the condition.
LEAKED_INTERNALS = (
    "<unknown>",
    "<string>",
    "Traceback",
    "object at 0x",
    "assert",
    "NoneType",
    "ast.",
    "self.",
)


def _corpus() -> Iterator[str]:
    """Conditions a user could plausibly submit, most of them broken."""
    for condition in VALID_CONDITIONS:
        yield condition
        # every prefix: what the server sees while someone is still typing
        for end in range(1, len(condition)):
            yield condition[:end]
        # single-character deletions and duplications: ordinary typos
        for index in range(len(condition)):
            yield condition[:index] + condition[index + 1 :]
            yield condition[:index] + condition[index] * 2 + condition[index:]
    # operators and punctuation on their own
    for char in "=<>!+-*/%()[]{}'\",.:;&|^~@#$?\\":
        yield char
        yield f"name {char} 'x'"
    for word in ("and", "or", "not", "in", "is", "None", "True"):
        yield word
        yield f"name == 'x' {word}"
    yield ""
    yield "   "
    yield string.punctuation


def _rejection_messages() -> list[tuple[str, str]]:
    rejected = []
    for condition in _corpus():
        try:
            SpanFilter(condition)
        except SyntaxError as error:
            rejected.append((condition, str(error)))
    return rejected


REJECTIONS = _rejection_messages()


def test_the_corpus_actually_exercises_rejections() -> None:
    """Guards the guard: a corpus that stopped producing errors would make every
    assertion below vacuous."""
    assert len(REJECTIONS) > 500, f"only {len(REJECTIONS)} rejections generated"
    assert len({message for _, message in REJECTIONS}) > 15, "suspiciously few distinct messages"


def test_no_message_leaks_python_or_implementation_detail() -> None:
    """`str()` on a parser error appends `(<unknown>, line 1)` -- a file the user
    never wrote in. Any such leak means a path is reporting Python's error rather
    than the condition's."""
    offenders = {
        message for _, message in REJECTIONS if any(bad in message for bad in LEAKED_INTERNALS)
    }
    assert not offenders, "messages leaking internals:\n" + "\n".join(
        f"  {message!r}" for message in sorted(offenders)[:20]
    )


def test_no_message_is_empty_or_truncated() -> None:
    """An empty tail is how `invalid expression: ` reached users: the code
    interpolated something that renders as the empty string."""
    offenders = {
        (condition, message)
        for condition, message in REJECTIONS
        if not message.strip() or message.rstrip().endswith((":", "-", ","))
    }
    assert not offenders, "empty or dangling messages:\n" + "\n".join(
        f"  {c!r} -> {m!r}" for c, m in sorted(offenders)[:20]
    )


def test_messages_bound_echoed_fragments() -> None:
    """Messages name the offending fragment, which reflects condition text into
    the UI, logs, and GraphQL responses. The error boundary truncates the echo
    so a multi-kilobyte expression cannot ride along; advice precedes the echo
    in every message, so nothing actionable is lost."""
    with pytest.raises(SyntaxError) as exc_info:
        SpanFilter("latency_ms == " + "9" * 2000)
    message = str(exc_info.value)
    assert len(message) <= 300
    assert message.startswith("invalid numeric literal")
    # Fragment-first messages must keep their guidance: the fragment is
    # bounded at the format site, because tail truncation at the boundary
    # would otherwise eat the advice -- a 1000-character literal in boolean
    # position once produced 300 characters of echo and no advice at all.
    with pytest.raises(SyntaxError) as exc_info:
        SpanFilter("name == 'x' and " + "'" + "y" * 1000 + "'")
    message = str(exc_info.value)
    assert len(message) <= 300
    assert "expected a comparison" in message
    with pytest.raises(SyntaxError) as exc_info:
        SpanFilter("name is " + "'" + "z" * 1000 + "'")
    message = str(exc_info.value)
    assert len(message) <= 300
    assert "use `==`" in message
    # Past CPython's 4300-digit conversion guard, the parser itself rejects
    # the literal -- with advice about `sys.set_int_max_str_digits()`, which
    # is Python's remedy rather than the condition's. Reworded at the
    # boundary.
    with pytest.raises(SyntaxError, match="too many digits"):
        SpanFilter("latency_ms == " + "9" * 5000)


def test_nul_in_the_source_has_one_message_on_every_python() -> None:
    """CPython reports a NUL in the source as `ValueError` on 3.10 and as
    `SyntaxError` from 3.11 on. Both must read as the same condition error --
    not the tokenizer's 'source code string cannot contain null bytes', which
    describes source code the user never wrote. Which branch this exercises
    depends on the interpreter running it, which is the point: on a >= 3.11
    leg it is the real end-to-end check, and it fails loudly if CPython ever
    changes the exception's type or wording again."""
    with pytest.raises(SyntaxError, match="cannot contain a NUL character"):
        SpanFilter("name == 'a\x00b'")


def test_every_message_says_something() -> None:
    """A message has to carry more than a label. The bar is deliberately low --
    it catches placeholders, not prose quality."""
    offenders = {
        (condition, message) for condition, message in REJECTIONS if len(message.strip()) < 12
    }
    assert not offenders, "uninformatively short messages:\n" + "\n".join(
        f"  {c!r} -> {m!r}" for c, m in sorted(offenders)[:20]
    )


@pytest.mark.parametrize(
    "condition,expected",
    [
        pytest.param("name == ", "invalid syntax", id="trailing-operator"),
        pytest.param("name == 'x", "unterminated string literal", id="unterminated-string"),
        pytest.param("span_kind in ['LLM'", "never closed", id="unclosed-bracket"),
        pytest.param("name ==== 1", "invalid syntax", id="malformed-operator"),
    ],
)
def test_parser_errors_are_reported_against_the_condition(condition: str, expected: str) -> None:
    """The parser's own wording is kept -- it is accurate and specific -- but the
    file-and-line suffix is not, and the column is added because it is the only
    thing that locates the problem in a one-line condition."""
    with pytest.raises(SyntaxError) as exc_info:
        SpanFilter(condition)
    message = str(exc_info.value)
    assert expected in message
    assert "<unknown>" not in message
