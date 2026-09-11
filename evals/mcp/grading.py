"""Small final-answer comparisons shared by task-local verifiers."""

from __future__ import annotations

import math
import re
from decimal import ROUND_HALF_UP, Decimal
from typing import Any


def plain(answer: Any) -> str:
    return re.sub(r"[*`_]", "", answer).strip() if isinstance(answer, str) else ""


def exact_integer(answer: Any, expected: Any, unit: str) -> bool:
    if type(expected) is not int or expected < 0:
        raise ValueError("Missing trusted integer reference")
    text = plain(answer)
    if not text or re.search(
        r"\b(not|no|maybe|perhaps|guess|example|quoted|might|approximately|about|whether|mentions?|unknown|unsure|cannot|can't)\b|\?",
        text,
        re.I,
    ):
        return False
    # All numbers must agree, and the number must be the answer, not incidental evidence.
    numbers = re.findall(
        r"(?<![\w.])-?\d[\d,]*(?:\.\d+)?(?!\w|\.\d)",
        re.sub(r"\b\d[\d,]*\s+(?:spans|tokens|seconds|pages)\b", "", text, flags=re.I),
    )
    if not numbers or any(
        not n.replace(",", "").isdigit() or int(n.replace(",", "")) != expected for n in numbers
    ):
        return False
    bare = re.fullmatch(r"\d[\d,]*[.!]?", text)
    statement = re.search(r"\b\d[\d,]*\s+" + unit + r"\b", text, re.I)
    labelled = re.fullmatch(
        r"(?:the )?(?:count|maximum|total)(?: is|:| =)\s*\d[\d,]*[.!]?", text, re.I
    )
    return bool(bare or statement or labelled)


def numeric(answer: Any, expected: Any, *, kind: str, places: int) -> bool:
    if type(expected) not in (float, int) or not math.isfinite(expected):
        raise ValueError("Missing trusted numeric reference")
    text = plain(answer)
    if re.search(r"\b(not|maybe|guess|example|might)\b|\?", text, re.I):
        return False
    pattern = (
        r"\$\s*([\d,]+(?:\.\d+)?)|([\d,]+(?:\.\d+)?)\s*(?:USD|(?:US )?dollars)"
        if kind == "cost"
        else r"(\d+(?:\.\d+)?)\s*%"
    )
    found = re.findall(pattern, text, re.I)
    values = [next(x for x in item if x) if isinstance(item, tuple) else item for item in found]
    if not values and re.fullmatch(r"\d+(?:\.\d+)?", text):
        values = [text]
    quantum = Decimal(10) ** -places
    target = Decimal(str(expected)).quantize(quantum, rounding=ROUND_HALF_UP)
    return bool(values) and all(
        Decimal(v.replace(",", "")).quantize(quantum, rounding=ROUND_HALF_UP) == target
        for v in values
    )


def identity(answer: Any, winners: list[list[str]], *, all_winners: bool = True) -> bool:
    if not winners:
        raise ValueError("Missing trusted winner reference")
    text = plain(answer)
    if re.search(r"\b(not|maybe|guess|example|might)\b|\?", text, re.I):
        return False
    matches = [
        any(
            re.search(r"(?<!\w)" + re.escape(plain(alias)) + r"(?!\w)", text, re.I)
            for alias in group
        )
        for group in winners
    ]
    return all(matches) if all_winners else any(matches)
