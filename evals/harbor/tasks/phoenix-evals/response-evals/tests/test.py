"""Grades `response-evals`: one annotation per requirement, correct on old and new traces.

1. Each requirement's annotation must cover at least 95% of the 60 production traces
   and catch at least 90% of passing and of failing replies (80% for `grounded`).
2. The verifier adds 40 new traces the agent never saw, runs the agent's nightly
   entry point, and applies the same bar to the new traces.
"""

from harbor_verifiers import grading, judge_prompts

TRUTH = grading.load_test_json("truth.json")
PROJECT = TRUTH["project"]
MIN_RECALL = {"valid_format": 0.9, "correct_amount": 0.9, "no_pii_leak": 0.9, "grounded": 0.8}
MIN_COVERAGE = 0.95
# The nightly key can only call this model, so the rerun refuses any other.
RERUN = "python evals/refund_evals.py"

# Reported beside the reward, never part of it. See `judge_prompts`.
APP = "A refund-support bot for an online store. For each refund request it looks up the order record, searches the refund policies, and finds similar past tickets, then replies with JSON that holds the refund amount and a message to the customer."
CRITERIA = {
    "valid_format": "The reply is exactly one JSON object, with no Markdown fences or extra text. refund_amount is a JSON number and message is a string.",
    "correct_amount": "The refund amount is the refundable_amount from the order record, not what the customer asked for.",
    "no_pii_leak": "The message doesn't reveal another customer's email address or phone number. Repeating the customer's own email is fine.",
    "grounded": "Every factual claim in the message is backed by something the bot looked up: the policy search results, the order record, or the similar-ticket results.",
}
EVIDENCE = {
    "valid_format": "the raw reply text",
    "correct_amount": "the reply's refund amount and the order record's refundable_amount",
    "no_pii_leak": "the reply message and the customer's own email from the order record",
    "grounded": "the reply message, plus everything the bot looked up: the order record, the policy search results, and the similar-ticket results",
}
DETERMINISTIC = ("valid_format", "correct_amount", "no_pii_leak")

checks: dict[str, bool] = {}
details: dict = {}


def grade(cohort: str, labels: dict) -> None:
    spans = grading.project_spans(PROJECT)
    for criterion, min_recall in MIN_RECALL.items():
        predictions = grading.trace_predictions(PROJECT, criterion, spans)
        result = grading.agreement(predictions, {t: v[criterion] for t, v in labels.items()})
        checks[f"{cohort}.{criterion}"] = result.passes(min_recall, MIN_COVERAGE)
        details[f"{cohort}.{criterion}"] = result.as_dict()


grade("production", TRUTH["visible"])
seen_spans = grading.project_spans(PROJECT)
grading.inject_spans(PROJECT, TRUTH["unseen"]["spans"])
with judge_prompts.record_llm_calls(allowed_models={judge_prompts.PINNED_MODEL}) as recorder:
    details["rerun"] = grading.run_as_agent(RERUN, timeout=900, env=recorder.env).as_dict()
grade("new_traces", TRUTH["unseen"]["labels"])
measures, details["judge_prompts"] = judge_prompts.prompt_scores(
    recorder.calls,
    system=APP,
    criteria=CRITERIA,
    evidence=EVIDENCE,
    deterministic=DETERMINISTIC,
    copied=judge_prompts.seen_only_shingles(seen_spans, TRUTH["unseen"]["spans"]),
)
grading.finish(checks, details, measures)
