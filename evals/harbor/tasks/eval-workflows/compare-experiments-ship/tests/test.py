"""Grades `compare-experiments` and `compare-experiments-ship`: the ship call and its numbers."""

from harbor_verifiers import grading
from harbor_verifiers.verify import ANSWER_PATH, TRAJECTORY_PATH, read_reply

TRUTH = grading.load_test_json("truth.json")
EXPECTED = TRUTH["expected"]
PROPORTION = (
    "as a proportion between 0 and 1. If the reply gives only a count such as 9 of 12, "
    "return the proportion."
)
FIELDS = {
    "decision": (
        "The reply's recommendation on shipping prompt-v8. 'ship' if it recommends shipping "
        "v8 now (yes, go ahead, roll it out). 'dont_ship' if it recommends not shipping v8 "
        "(no, not yet, hold, keep v7, ship only after fixing something). Null if the reply "
        "doesn't make a recommendation either way."
    ),
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
checks = dict.fromkeys(EXPECTED, False)
if reply.strip():
    claims = grading.extract_report_claims(reply, FIELDS)
    readings = [EXPECTED, *TRUTH["alternatives"]]
    found = [grading.check_report_claims(claims, reading, reply) for reading in readings]
    checks = {name: any(match.get(name, False) for match in found) for name in EXPECTED}
    details["claims"] = claims
grading.finish(checks, details)
