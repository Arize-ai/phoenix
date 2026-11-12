"""Grades `compare-experiments` and `compare-experiments-ship`: the ship call and its numbers.

An LLM extracts five claims from the final reply, each with a verbatim quote, without
seeing the expected values. All five must match `truth.json`:

1. `decision`: ship v8, or don't.
2. `v7_safety_pass_rate` and `v8_safety_pass_rate`: the share of the safety slice each
   experiment's `correct` evaluator passed.
3. `v7_overall_pass_rate` and `v8_overall_pass_rate`: the share of all examples each
   experiment passed. Each experiment has one errored run outside the safety slice, so
   either reading passes: counted as a failure, or left out of the denominator.

Numbers pass within 0.011, so rounding to a whole percent is fine. An empty reply fails
without a model call.
"""

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
    found = grading.check_report_claims(claims, EXPECTED, reply)
    alternative = grading.check_report_claims(claims, TRUTH["alternatives"], reply)
    checks = {name: found[name] or alternative.get(name, False) for name in EXPECTED}
    details["claims"] = claims
grading.finish(checks, details)
