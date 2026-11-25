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
COUNTING_METHODS = {
    "every_run": "Count individual repetitions as separate runs.",
    "cases_passing_all_3": "Count a case as passing only when all its repetitions passed.",
}
METHOD_CONTEXT = (
    "Use the reply's labels, wording, and counts to identify the method. Return null if "
    "the reply gives no rate for this method. If it gives one set of rates and leaves "
    "the method unstated and unclear from context, extract that set for both methods. "
    "Both methods can include or exclude errored runs or cases. If both error policies "
    "are reported, use the same policy for all rates within this method."
)
FIELDS = {"decision": DECISION} | {
    f"{method}_{name}": f"{rate} {rule} {METHOD_CONTEXT}"
    for method, rule in COUNTING_METHODS.items()
    for name, rate in RATES.items()
}

reply, source = read_reply(TRAJECTORY_PATH, ANSWER_PATH)
details = {"reply_source": source, "reply": reply[-4000:], "expected": EXPECTED}
checks = {"decision": False, "numbers": False}
if reply.strip():
    claims = grading.extract_report_claims(reply, FIELDS)
    decision = grading.check_report_claims(claims, {"decision": EXPECTED["decision"]}, reply)
    readings = {}
    for reading, expected_rates in EXPECTED["accepted_pass_rates"].items():
        method = reading.split("_except_", 1)[0]
        method_claims = {name: claims.get(f"{method}_{name}") for name in expected_rates}
        readings[reading] = grading.check_report_claims(method_claims, expected_rates, reply)
    checks = {
        "decision": decision["decision"],
        "numbers": any(all(numbers.values()) for numbers in readings.values()),
    }
    details.update(claims=claims, readings=readings)
grading.finish(checks, details)
