"""Compare a plain-text answer with an expected value.

These matchers grade the text an agent wrote to its answer file. An answer
passes when it states the expected value without hedging between candidates.
"""

from __future__ import annotations

import re
from decimal import ROUND_HALF_UP, Decimal
from typing import Callable, Iterable, Mapping, Sequence

_MARKUP = re.compile(r"[*`]")
_INTEGER = re.compile(r"(?<![\w.])-?\d[\d,]*(?!\w|\.\d)")
_NUMBER = re.compile(r"(?<![\w.])-?\d[\d,]*(?:\.\d+)?(?!\w|\.\d)")
_HEDGE = re.compile(
    r"\b(?:or|either|approximately|approx|about|around|roughly|maybe|perhaps|"
    r"possibly|unsure|unknown|not sure|cannot|can't)\b|~|\?",
    re.IGNORECASE,
)


def plain(text: object) -> str:
    """Strip Markdown emphasis and collapse whitespace, keeping line breaks."""
    if not isinstance(text, str):
        return ""
    lines = (" ".join(line.split()) for line in _MARKUP.sub("", text).splitlines())
    return "\n".join(line for line in lines if line)


def hedged(text: str) -> bool:
    return bool(_HEDGE.search(text))


def integers(text: str) -> list[int]:
    return [int(match.replace(",", "")) for match in _INTEGER.findall(text)]


def numbers(text: str) -> list[Decimal]:
    return [Decimal(match.replace(",", "")) for match in _NUMBER.findall(text)]


def match_integer(answer: object, expected: int) -> bool:
    text = plain(answer)
    return not hedged(text) and expected in integers(text)


def match_number(answer: object, expected: float | int | str, places: int) -> bool:
    text = plain(answer)
    if hedged(text):
        return False
    quantum = Decimal(10) ** -places
    target = Decimal(str(expected)).quantize(quantum, rounding=ROUND_HALF_UP)
    return any(value.quantize(quantum, rounding=ROUND_HALF_UP) == target for value in numbers(text))


_SENTENCE = re.compile(r"(?<=[.;!])\s+|\n+")


def _alias_spans(text: str, aliases: Iterable[str]) -> list[tuple[int, int]]:
    """Whole-word, case-insensitive occurrences of any alias in the text."""
    spans: list[tuple[int, int]] = []
    for alias in aliases:
        pattern = r"(?<!\w)" + re.escape(plain(alias)) + r"(?!\w)"
        spans.extend(match.span() for match in re.finditer(pattern, text, re.IGNORECASE))
    return spans


def _claims(
    text: str,
    aliases: Sequence[str],
    candidates: Callable[[str], list[tuple[int, int, str]]],
) -> list[str]:
    """In each sentence that names the entity, the candidate nearest to its name.

    Sentences end at ``.``, ``;``, ``!``, or a line break, so a value in a
    neighbouring claim never competes with the value in this one.
    """

    def gap(anchor: tuple[int, int], candidate: tuple[int, int, str]) -> int:
        return max(anchor[0] - candidate[1], candidate[0] - anchor[1], 0)

    claims = []
    for sentence in _SENTENCE.split(text):
        anchors = _alias_spans(sentence, aliases)
        found = candidates(sentence)
        if anchors and found:
            claims.append(min((gap(a, c), c[2]) for a in anchors for c in found)[1])
    return claims


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


def match_labeled_number(
    answer: object,
    labels: Mapping[str, tuple[Sequence[str], float | int | str]],
    places: int,
) -> bool:
    """Each label's expected number is the expected number nearest to that label.

    ``labels`` maps a label to its aliases and expected value. Only the expected
    values count as candidates, so unrelated numbers such as span thresholds do
    not compete, while another label's value sitting nearer fails the check.
    Rejects reversed labels and answers that list the numbers without labels.
    """
    text = plain(answer)
    if not labels or hedged(text):
        return False
    quantum = Decimal(10) ** -places
    targets = {
        label: str(Decimal(str(value)).quantize(quantum, rounding=ROUND_HALF_UP))
        for label, (_, value) in labels.items()
    }

    def expected_numbers(sentence: str) -> list[tuple[int, int, str]]:
        found = []
        for match in _NUMBER.finditer(sentence):
            value = Decimal(match.group().replace(",", "")).quantize(quantum, ROUND_HALF_UP)
            if str(value) in targets.values():
                found.append((match.start(), match.end(), str(value)))
        return found

    return all(
        targets[label] in _claims(text, aliases, expected_numbers)
        for label, (aliases, _) in labels.items()
    )


def match_entity_count(answer: object, aliases: Sequence[str], expected: int) -> bool:
    """The integer nearest to the entity's name, in a sentence naming it, is the count.

    Rejects answers where the expected number belongs to another entity's claim.
    """
    text = plain(answer)
    if hedged(text):
        return False

    def all_integers(sentence: str) -> list[tuple[int, int, str]]:
        return [
            (match.start(), match.end(), str(int(match.group().replace(",", ""))))
            for match in _INTEGER.finditer(sentence)
        ]

    return str(expected) in _claims(text, aliases, all_integers)


def match_exact(answer: object, expected: str) -> bool:
    """The answer equals the expected text, ignoring case, emphasis, and end punctuation."""
    return plain(answer).rstrip(".!").casefold() == expected.strip().casefold()
