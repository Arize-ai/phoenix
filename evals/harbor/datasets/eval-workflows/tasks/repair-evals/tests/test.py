"""Grades `repair-evals`: the `grounded` annotations, the rerun on new traces, and the reply."""

from harbor_verifiers import grading, judge_prompts
from harbor_verifiers.verify import ANSWER_PATH, TRAJECTORY_PATH, read_reply

EXPECTED = grading.load_test_json("expected.json")
DATA = grading.load_test_json("grading_data.json")
PROJECT = "support-bot"
ANNOTATION = "grounded"
RERUN = "python evals/nightly_grounding.py"

MECHANISM = (
    "'named' if the reply gives this cause and its mechanism as described. 'vague' if it "
    "only describes a symptom or blames the script or prompt in general terms. Null if "
    "it doesn't mention it. Quote the sentence that gives the cause. Other causes the "
    "reply gives, such as a rule that marks errored traces `fail`, don't contradict this "
    "one; set contradicted=true only if the reply takes this cause back."
)
FIELDS = {
    "grounded_rate": (
        "The real grounded rate the reply reports from the fixed eval's rerun: the share "
        "of the support bot's replies labeled grounded (pass), as a proportion between 0 "
        "and 1. If the reply gives only a count such as 30 of 50, return the proportion. "
        "Not the old eval's misleading rate."
    ),
    "span_limit": (
        "Cause: the old script's span query returned only a limited number of spans (the "
        "client's default limit, such as 100 spans, or one page of results), so only some "
        "replies were scored. Saying only that some or recent replies were skipped is "
        "'vague'. " + MECHANISM
    ),
    "verdict_case": (
        "Cause: the old script compared the judge's uppercase verdict (PASS or FAIL) with "
        "lowercase 'fail', so a FAIL verdict never matched and every judged reply was "
        "recorded as pass. Saying only that failures were lost or labels were wrong is "
        "'vague'. " + MECHANISM
    ),
    "errors_pass": (
        "Cause: when scoring a reply raised an error or exception, the old script recorded "
        "the reply as pass (grounded), for example email messages that have no `message` "
        "field. " + MECHANISM
    ),
    "judge_evidence": (
        "Cause: the old judge saw only the customer's message and the reply, not what the "
        "bot looked up (its context: the order record, tracking data, or help center "
        "articles from the trace's tool and retriever spans), so it couldn't check the "
        "reply's claims against them. Saying the judge never saw the bot's context, its "
        "lookups, or the trace's child spans is 'named'. Saying only that the prompt was "
        "weak, vague, or asked whether the reply sounded reasonable or helpful is "
        "'vague'. " + MECHANISM
    ),
    "wrong_traces": (
        "Cause: the old script attached verdicts to traces or spans other than the ones "
        "they judged, for example because it scored the replies in one order and matched "
        "the results to spans in another. Saying that verdicts went to the wrong traces, "
        "spans, or replies is 'named', with or without the reason. " + MECHANISM
    ),
}

# Reported beside the reward, never part of it.
APP = "An order-support bot for an online store. It answers customer chat messages and emails about order status, tracking, delivery dates, and address changes, using an order lookup, carrier tracking, and help center articles."
CRITERIA = {
    "grounded": "Every factual claim in the reply is supported by what the bot looked up: the order record, the tracking data, and the help center articles."
}
EVIDENCE = {
    "grounded": "the customer's message (chat message or email subject and body), the reply, the order record, the help center articles, and the carrier tracking data (or the tracking error) when the order has shipped"
}
DETERMINISTIC = ()

checks: dict[str, bool] = {}
details: dict = {}


def grade_traces(cohort: str) -> dict:
    """Grades the latest `grounded` annotations against `cohort`'s labels and returns them."""
    bars = EXPECTED[cohort]
    predictions = grading.trace_predictions(PROJECT, ANNOTATION)
    result = grading.agreement(predictions, DATA[cohort]["labels"])
    checks[cohort] = result.passes(bars["min_recall"], bars["min_coverage"])
    details[cohort] = result.as_dict()
    return predictions


def grade_reply(production: dict) -> None:
    """Checks that the reply names every cause and reports the rate `production` gives."""
    reply, source = read_reply(TRAJECTORY_PATH, ANSWER_PATH)
    causes = dict.fromkeys(EXPECTED["causes"], False)
    claims, claimed = None, None
    if reply.strip():
        claims = grading.extract_report_claims(reply, FIELDS)
        causes = grading.check_report_claims(claims, dict.fromkeys(causes, "named"), reply)
        claimed = grading.stated_number(claims.get("grounded_rate"), reply, 0.5)
    labels = DATA["production_traces"]["labels"]
    timeouts = set(DATA["production_traces"]["timeouts"])
    scopes = {
        "all_traces": list(labels),
        "without_timeouts": [trace for trace in labels if trace not in timeouts],
    }
    tolerance = EXPECTED["grounded_rate"]["tolerance"]
    rate: dict = {"claimed": claimed}
    for scope, traces in scopes.items():
        share = grading.good_share(production, traces)
        low, high = (n / len(traces) for n in EXPECTED["grounded_rate"][scope]["accepted_grounded"])
        rate[scope] = {
            "annotated_share": share,
            "accepted_range": [round(low, 4), round(high, 4)],
            "matches": claimed is not None
            and share is not None
            and abs(claimed - share) <= tolerance
            and low - tolerance <= claimed <= high + tolerance,
        }
    checks["reply"] = all(causes.values()) and any(rate[scope]["matches"] for scope in scopes)
    details["reply"] = {
        "causes_named": causes,
        "grounded_rate": rate,
        "claims": claims,
        "source": source,
        "text": reply[-4000:],
    }


production = grade_traces("production_traces")
seen_spans = grading.project_spans(PROJECT)
grading.inject_spans(PROJECT, DATA["new_traces"]["spans"])
with judge_prompts.record_llm_calls(allowed_models={judge_prompts.PINNED_MODEL}) as recorder:
    details["rerun"] = grading.run_as_agent(RERUN, timeout=900, env=recorder.env).as_dict()
grade_traces("new_traces")
grade_reply(production)
measures, details["judge_prompts"] = judge_prompts.prompt_scores(
    recorder.calls,
    system=APP,
    criteria=CRITERIA,
    evidence=EVIDENCE,
    deterministic=DETERMINISTIC,
    copied=judge_prompts.seen_only_shingles(seen_spans, DATA["new_traces"]["spans"]),
)
grading.finish(checks, details, measures)
