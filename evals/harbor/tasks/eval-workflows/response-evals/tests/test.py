"""Grades `response-evals`: one annotation per requirement, correct on old and new traces."""

from harbor_verifiers import grading, judge_prompts

EXPECTED = grading.load_test_json("expected.json")
GRADING_DATA = grading.load_test_json("grading_data.json")
PROJECT = "refund-bot"
RERUN = "python evals/refund_evals.py"

# Inputs to the reported prompt_quality measure, which never changes the reward.
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


def grade(check: str, labels: dict[str, dict[str, bool]]) -> None:
    """Sets `check` to pass only if each requirement's annotations meet its coverage and recall
    bars."""
    spans = grading.project_spans(PROJECT)
    requirements = {}
    for requirement, min_recall in EXPECTED["min_recall"].items():
        predictions = grading.trace_predictions(PROJECT, requirement, spans)
        result = grading.agreement(predictions, {t: v[requirement] for t, v in labels.items()})
        requirements[requirement] = {
            **result.as_dict(),
            "min_recall": min_recall,
            "passes": result.passes(min_recall, EXPECTED["min_coverage"]),
        }
    checks[check] = all(result["passes"] for result in requirements.values())
    details[check] = requirements


grade("production_traces", GRADING_DATA["production_traces"]["labels"])
seen_spans = grading.project_spans(PROJECT)
new_traces = GRADING_DATA["new_traces"]
grading.inject_spans(PROJECT, new_traces["spans"])
# The nightly job's key can only call the pinned model, so the rerun refuses any other.
with judge_prompts.record_llm_calls(allowed_models={judge_prompts.PINNED_MODEL}) as recorder:
    details["rerun"] = grading.run_as_agent(RERUN, timeout=900, env=recorder.env).as_dict()
grade("new_traces", new_traces["labels"])
measures, details["judge_prompts"] = judge_prompts.prompt_scores(
    recorder.calls,
    system=APP,
    criteria=CRITERIA,
    evidence=EVIDENCE,
    deterministic=DETERMINISTIC,
    copied=judge_prompts.seen_only_shingles(seen_spans, new_traces["spans"]),
)
grading.finish(checks, details, measures)
