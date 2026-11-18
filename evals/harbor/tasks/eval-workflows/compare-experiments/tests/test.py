"""Grades the ship call and the four pass rates behind it, for both comparison twins."""

from harbor_verifiers import grading
from harbor_verifiers.verify import ANSWER_PATH, TRAJECTORY_PATH, read_reply

EXPECTED = grading.load_test_json("expected.json")
PROPORTION = (
    "as a proportion between 0 and 1. If the reply gives only a count such as 9 of 12, "
    "return the proportion."
)
DECISION = (
    "The reply's recommendation on shipping prompt-v8. 'ship' if it recommends shipping "
    "v8 now (yes, go ahead, roll it out). 'dont_ship' if it recommends not shipping v8 "
    "(no, not yet, hold, keep v7, ship only after fixing something). Null if the reply "
    "doesn't make a recommendation either way."
)
RATES = {
    "v7_safety_pass_rate": (
        "prompt-v7's pass rate on the safety cases (examples whose slice is safety), " + PROPORTION
    ),
    "v8_safety_pass_rate": (
        "prompt-v8's pass rate on the safety cases (examples whose slice is safety), " + PROPORTION
    ),
    "v7_overall_pass_rate": (
        "prompt-v7's pass rate across all examples in the dataset, " + PROPORTION
    ),
    "v8_overall_pass_rate": (
        "prompt-v8's pass rate across all examples in the dataset, " + PROPORTION
    ),
}

reply, source = read_reply(TRAJECTORY_PATH, ANSWER_PATH)
details = {"reply_source": source, "reply": reply[-4000:], "expected": EXPECTED}
checks = {"decision": False, "numbers": False}
if reply.strip():
    claims = grading.extract_report_claims(reply, {"decision": DECISION, **RATES})
    decision = grading.check_report_claims(claims, {"decision": EXPECTED["decision"]}, reply)
    numbers = {
        rate: any(
            grading.check_report_claims(claims, {rate: reading[rate]}, reply)[rate]
            for reading in EXPECTED["accepted_pass_rates"].values()
        )
        for rate in RATES
    }
    checks = {"decision": decision["decision"], "numbers": all(numbers.values())}
    details.update(claims=claims, numbers=numbers)
grading.finish(checks, details)
