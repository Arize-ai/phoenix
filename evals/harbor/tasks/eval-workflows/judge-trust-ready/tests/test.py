"""Grades `judge-trust` and `judge-trust-ready`: the reply's decision and its numbers.

An LLM extracts three claims from the final reply, each with a verbatim quote, without
seeing the expected values. All three must match `truth.json`:

1. `decision`: turn the judge on, or don't.
2. `unsafe_recall`: the share of reviewer-unsafe replies the judge labels unsafe.
3. `unsafe_precision`: the share of the judge's unsafe labels that reviewers also mark
   unsafe. A stated false-alarm share (1 minus precision) passes too, because the
   request frames the threshold that way.

Both metrics count only traces with a reviewer label and a successful judge label.
Numbers pass within 0.011, so rounding to a whole percent is fine. An empty reply fails
without a model call.
"""

from harbor_verifiers import grading
from harbor_verifiers.verify import ANSWER_PATH, TRAJECTORY_PATH, read_reply

EXPECTED = grading.load_test_json("truth.json")["expected"]
SCOPE = (
    "Count only traces that have both a reviewer `human_safety` label and a `safety_judge` "
    "label, as a proportion between 0 and 1. If the reply gives only a count such as "
    "7 of 12, return the proportion."
)
FIELDS = {
    "decision": (
        "The reply's recommendation on turning on the safety_judge to auto-block unsafe "
        "replies. 'turn_on' if it recommends turning it on now (yes, go ahead, safe to "
        "enable, ship it). 'dont_turn_on' if it recommends not turning it on (no, not yet, "
        "hold off, keep it in shadow mode, only after the judge is fixed or retested). Null "
        "if the reply doesn't make a recommendation either way."
    ),
    "unsafe_recall": (
        "Of the replies reviewers labeled unsafe, the share the judge also labeled unsafe "
        "(the judge's recall, catch rate, or sensitivity on unsafe replies). " + SCOPE
    ),
    "unsafe_precision": (
        "Of the replies the judge labeled unsafe, the share reviewers also labeled unsafe "
        "(the judge's precision on unsafe replies). " + SCOPE
    ),
    "false_alarm_share": (
        "Of the replies the judge labeled unsafe (what it would block), the share reviewers "
        "labeled safe (false alarms among blocked replies). Not the share of all safe "
        "replies that the judge flags. " + SCOPE
    ),
}

reply, source = read_reply(TRAJECTORY_PATH, ANSWER_PATH)
details = {"reply_source": source, "reply": reply[-4000:], "expected": EXPECTED}
checks = dict.fromkeys(EXPECTED, False)
if reply.strip():
    claims = grading.extract_report_claims(reply, FIELDS)
    found = grading.check_report_claims(
        claims,
        {**EXPECTED, "false_alarm_share": round(1 - EXPECTED["unsafe_precision"], 4)},
        reply,
    )
    checks = {
        "decision": found["decision"],
        "unsafe_recall": found["unsafe_recall"],
        "unsafe_precision": found["unsafe_precision"] or found["false_alarm_share"],
    }
    details["claims"] = claims
grading.finish(checks, details)
