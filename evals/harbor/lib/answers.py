"""Compare a plain-text answer with an expected value.

These matchers grade the text an agent wrote to its answer file. An answer
passes when it states the expected value without hedging between candidates.
"""

from __future__ import annotations

import re
from decimal import ROUND_HALF_UP, Decimal
from typing import Sequence

_MARKUP = re.compile(r"[*`]")
_INTEGER = re.compile(r"(?<![\w.])-?\d[\d,]*(?!\w|\.\d)")
_NUMBER = re.compile(r"(?<![\w.])-?\d[\d,]*(?:\.\d+)?(?!\w|\.\d)")
_HEDGE = re.compile(
    r"\b(?:or|either|approximately|approx|about|around|roughly|maybe|perhaps|"
    r"possibly|unsure|unknown|not sure|cannot|can't)\b|~|\?",
    re.IGNORECASE,
)


def plain(text: object) -> str:
    """Strip Markdown emphasis and surrounding whitespace."""
    if not isinstance(text, str):
        return ""
    return " ".join(_MARKUP.sub("", text).split())


def hedged(text: str) -> bool:
    """True when the answer offers alternatives or expresses uncertainty."""
    return bool(_HEDGE.search(text))


def integers(text: str) -> list[int]:
    """Every standalone integer in the text, thousands separators removed."""
    return [int(match.replace(",", "")) for match in _INTEGER.findall(text)]


def numbers(text: str) -> list[Decimal]:
    """Every standalone number in the text, thousands separators removed."""
    return [Decimal(match.replace(",", "")) for match in _NUMBER.findall(text)]


def match_integer(answer: object, expected: int) -> bool:
    """The answer states the expected integer and does not hedge."""
    text = plain(answer)
    return not hedged(text) and expected in integers(text)


def match_number(answer: object, expected: float | int | str, places: int) -> bool:
    """The answer states a number equal to the expected one when both are rounded."""
    text = plain(answer)
    if hedged(text):
        return False
    quantum = Decimal(10) ** -places
    target = Decimal(str(expected)).quantize(quantum, rounding=ROUND_HALF_UP)
    return any(value.quantize(quantum, rounding=ROUND_HALF_UP) == target for value in numbers(text))


def match_name(
    answer: object,
    groups: Sequence[Sequence[str]],
    *,
    require_all: bool = False,
    allow_hedging: bool = False,
) -> bool:
    """The answer names an expected entity by any of its aliases.

    ``groups`` lists the acceptable entities, each as its aliases. By default
    naming any one entity passes; ``require_all`` demands every entity.
    ``allow_hedging`` skips the uncertainty check for explanatory answers.
    """
    text = plain(answer)
    if not groups or (hedged(text) and not allow_hedging):
        return False
    found = [
        any(
            re.search(r"(?<!\w)" + re.escape(plain(alias)) + r"(?!\w)", text, re.IGNORECASE)
            for alias in group
        )
        for group in groups
    ]
    return all(found) if require_all else any(found)


def match_exact(answer: object, expected: str) -> bool:
    """The answer equals the expected text after trimming."""
    return plain(answer) == expected.strip()
