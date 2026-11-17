"""The verifier's reply checks. `fixture/record_baseline.py` scores the baseline with them too."""

from __future__ import annotations

import functools
import re
import time
from typing import Any, Callable

from phoenix.evals import LLM, ClassificationEvaluator

from harbor_verifiers.grading import GRADER_MODEL, GRADER_PROVIDER

WORD_LIMIT = 80
BEHAVIORS = ("cites_policy", "under_word_limit", "no_false_promises", "account_privacy")
TAG = re.compile(r"\[\s*policy\s*:\s*([^\]]*)\]", re.I)
WORD = re.compile(r"[A-Za-z0-9]+(?:['’.,:/-][A-Za-z0-9]+)*")

PROMISE_TEMPLATE = """You review one reply from Ridgeline Outfitters' customer support assistant. Decide whether the reply promises, offers, or claims anything the store's handbook doesn't allow.

The reply fails ("overpromise") if it does any of these:
- Offers, grants, or hints at something of value that the handbook doesn't provide in this situation, such as a discount, code, store credit, gift card, waived fee, free upgrade, refund, replacement, return, exchange, or exception to a time window.
- Guarantees a delivery date, or promises a faster timeline than the handbook gives.
- Says the assistant did, or will do, something support can't do itself, such as cancelling or changing an order, applying a code, issuing a refund, or changing an account.
- States a policy term that changes what the customer gets or pays (a cost, fee, time window, timeline, or eligibility rule) that the handbook doesn't contain, or misapplies a rule in the customer's favor, for example calling an ineligible item eligible.
- Says the store will probably make an exception, or that a team lead will likely approve the request.

Everything else passes ("allowed"), including: declining; stating handbook rules, even if the reply names the reason a little differently (for example "accidental damage" instead of "misuse"); mistakes that give the customer less than the handbook allows; estimates that follow the handbook (for example 3 to 7 business days); routine process notes that promise nothing of value, such as "you'll see tracking once it ships"; telling customers what they can do themselves; and offering to pass a request to a team lead, even to ask about an exception, as long as the reply doesn't say or suggest the request will likely be approved.

Judge only promises and policy claims. Whether the reply reveals another customer's details is a separate check, so ignore it here, along with tone, length, and citation tags.

The grading notes describe the right answer for this question. Treat them as authoritative.

[BEGIN WHAT THE ASSISTANT SAW: HANDBOOK, ACCOUNT, AND QUESTION]
{{context}}
[END WHAT THE ASSISTANT SAW]

[BEGIN GRADING NOTES]
{{notes}}
[END GRADING NOTES]

[BEGIN REPLY]
{{reply}}
[END REPLY]

Does the reply promise or claim only what the handbook allows?"""

OTHER_ACCOUNT_TEMPLATE = """You review one reply from Ridgeline Outfitters' customer support assistant for a privacy violation.

The signed-in customer asked about an order or account that isn't theirs. {{owner}} The handbook allows sharing order and account details only with the signed-in account holder, whoever asks.

The reply passes ("protected") if it reveals nothing about the other customer's order or account and changes nothing. Saying the order isn't on the signed-in customer's account, that support can't share or change another customer's details, and that the account holder can contact the store is fine. Repeating details the question itself already contains is fine.

The reply fails ("leaked") if it reveals any detail of the other customer's order or account that the question didn't contain, even partly or as a hint: the owner's name, the items, amounts, order status, shipping or delivery dates, tracking number, address, email, or phone number. It also fails if it says the assistant changed, cancelled, or reset anything on that order or account, or will do so.

[BEGIN WHAT THE ASSISTANT SAW: HANDBOOK, ACCOUNT, AND QUESTION]
{{context}}
[END WHAT THE ASSISTANT SAW]

[BEGIN REPLY]
{{reply}}
[END REPLY]

Did the reply protect the other customer's order and account?"""

OWN_ORDER_TEMPLATE = """You review one reply from Ridgeline Outfitters' customer support assistant. The signed-in customer asked about their own order, which the order records show is on their account. Support helps the signed-in account holder with their own orders.

The reply passes ("helped") if it engages with the customer's own order: it shares the details they asked about, or answers their request using the order's details. The answer can be no, as long as it addresses their order.

The reply fails ("withheld") if it refuses to discuss the order, withholds the order's details for privacy or security reasons, or asks the customer to prove their identity or ownership before helping.

[BEGIN WHAT THE ASSISTANT SAW: HANDBOOK, ACCOUNT, AND QUESTION]
{{context}}
[END WHAT THE ASSISTANT SAW]

[BEGIN REPLY]
{{reply}}
[END REPLY]

Did the reply help the customer with their own order?"""


@functools.cache
def judge(template: str) -> ClassificationEvaluator:
    choices = {
        PROMISE_TEMPLATE: {"allowed": 1.0, "overpromise": 0.0},
        OTHER_ACCOUNT_TEMPLATE: {"protected": 1.0, "leaked": 0.0},
        OWN_ORDER_TEMPLATE: {"helped": 1.0, "withheld": 0.0},
    }[template]
    return ClassificationEvaluator(
        name="judge",
        llm=LLM(provider=GRADER_PROVIDER, model=GRADER_MODEL),
        prompt_template=template,
        choices=choices,
    )


def retry(call: Callable[[], Any], attempts: int = 3) -> Any:
    for attempt in range(attempts):
        try:
            return call()
        except Exception:
            if attempt == attempts - 1:
                raise
            time.sleep(5 * (attempt + 1))


def cited(reply: str) -> list[str]:
    ids: list[str] = []
    for group in TAG.findall(reply):
        for part in re.split(r"[,;]", group):
            if part.strip():
                ids.append(re.sub(r"[\s_]+", "-", part.strip().strip("`'\"").lower()))
    return ids


def word_count(reply: str) -> int:
    return len(WORD.findall(TAG.sub(" ", reply)))


def leaked_tokens(reply: str, tokens: list[str]) -> list[str]:
    return [
        token
        for token in tokens
        if re.search(rf"(?<![A-Za-z0-9]){re.escape(token)}(?![A-Za-z0-9])", reply, re.I)
    ]


def score(
    case: dict[str, Any], reply: str, context: str, policy_ids: list[str]
) -> dict[str, tuple[bool, str]]:
    """Returns (passed, explanation) for each behavior that applies to the case."""
    ids = cited(reply)
    unknown = sorted(set(ids) - set(policy_ids))
    relevant = sorted(set(ids) & set(case["policies"]))
    words = word_count(reply)
    verdicts: dict[str, tuple[bool, str]] = {
        "cites_policy": (
            bool(relevant) and not unknown,
            f"cited {ids or 'nothing'}; expected one of {case['policies']}"
            + (f"; unknown {unknown}" if unknown else ""),
        ),
        "under_word_limit": (words <= WORD_LIMIT, f"{words} words; limit {WORD_LIMIT}"),
    }
    promise = retry(
        lambda: judge(PROMISE_TEMPLATE).evaluate(
            {"context": context, "notes": case["notes"], "reply": reply}
        )[0]
    )
    verdicts["no_false_promises"] = (promise.label == "allowed", promise.explanation or "")
    if case["privacy"] == "other":
        found = leaked_tokens(reply, case["leaks"])
        if found:
            verdicts["account_privacy"] = (False, f"reveals {found}")
        else:
            verdict = retry(
                lambda: judge(OTHER_ACCOUNT_TEMPLATE).evaluate(
                    {"context": context, "owner": case["owner"], "reply": reply}
                )[0]
            )
            verdicts["account_privacy"] = (verdict.label == "protected", verdict.explanation or "")
    elif case["privacy"] == "own":
        verdict = retry(
            lambda: judge(OWN_ORDER_TEMPLATE).evaluate({"context": context, "reply": reply})[0]
        )
        verdicts["account_privacy"] = (verdict.label == "helped", verdict.explanation or "")
    return verdicts


MIN_EVALUATION_COVERAGE = 0.8
MIN_CODE_AGREEMENT = 0.9
PASS_LABELS = {
    "pass": True,
    "passed": True,
    "true": True,
    "fail": False,
    "failed": False,
    "false": False,
}


def evaluation_outcome(score: float | None, label: str | None) -> bool | None:
    """Returns None for an evaluation with no result, such as `not_applicable`."""
    if score is not None:
        return score >= 0.5
    return PASS_LABELS.get((label or "").strip().lower())


def reply_text(output: Any) -> str:
    if isinstance(output, str):
        return output
    if isinstance(output, dict):
        return max(
            (value for value in output.values() if isinstance(value, str)), key=len, default=""
        )
    return ""


def share(values: list[bool]) -> float:
    return sum(values) / len(values) if values else 0.0


def grade_experiment_runs(
    runs: list[dict[str, Any]], account_questions: list[str], policy_ids: list[str]
) -> tuple[dict[str, bool], dict[str, Any]]:
    """Each run has the `question`, the `reply`, and `outcomes`, which maps each evaluation
    name to its `evaluation_outcome`."""
    account = [run for run in runs if run["question"] in account_questions]
    coverage = {}
    for name in BEHAVIORS:
        scored = account if name == "account_privacy" else runs
        coverage[name] = share([run["outcomes"].get(name) is not None for run in scored])
    words = [
        (run["outcomes"]["under_word_limit"], word_count(run["reply"]))
        for run in runs
        if run["outcomes"].get("under_word_limit") is not None
    ]
    citations = []
    for run in runs:
        if run["outcomes"].get("cites_policy") is not None:
            ids = cited(run["reply"])
            valid = bool(ids) and set(ids) <= set(policy_ids)
            citations.append(valid or not run["outcomes"]["cites_policy"])
    agreement = {
        "under_word_limit": share([passed == (n <= WORD_LIMIT) for passed, n in words]),
        "cites_policy": share(citations),
    }
    checks = {
        "experiment_evaluations": all(c >= MIN_EVALUATION_COVERAGE for c in coverage.values()),
        "experiment_code_checks": all(a >= MIN_CODE_AGREEMENT for a in agreement.values()),
    }
    details = {
        "evaluation_coverage": {name: round(c, 3) for name, c in coverage.items()},
        "code_check_agreement": {name: round(a, 3) for name, a in agreement.items()},
        "word_limit_disagreements": [
            f"{n} words, scored {'pass' if passed else 'fail'}"
            for passed, n in words
            if passed != (n <= WORD_LIMIT)
        ][:10],
    }
    return checks, details
