"""
Eval suite for a customer-support FAQ bot (pytest).

The bot receives a user question alongside a short excerpt from the knowledge
base and returns a concise, grounded answer.  When the excerpt is empty (or the
question is off-topic) it should decline politely.

Each test marked with ``@pytest.mark.phoenix`` becomes one run in a Phoenix
experiment: the module maps to a dataset, each parametrized case maps to a
dataset example, and the assertion outcome is recorded as the reserved ``pass``
annotation.  We attach two extra metrics per run:

  latency_ms   — wall-clock response time recorded as a CODE annotation
  helpfulness  — LLM-as-judge score (1 = helpful/accurate, 0 = not)

Because LLM quality is non-deterministic we do *not* hard-fail on a single bad
score; the assertion only fires for a structural check (the off-topic refusal
case).  Helpfulness trends over time in Phoenix and you can tighten the gate
once you're confident in your baseline.

See ../README.md for the full walkthrough and run instructions.

    pip install -r requirements.txt
    export ANTHROPIC_API_KEY=sk-ant-...

    # Iterate locally without recording anything to Phoenix:
    PHOENIX_TEST_TRACKING=0 pytest -v

    # Record runs to Phoenix:
    export PHOENIX_COLLECTOR_ENDPOINT=https://your-phoenix-host
    export PHOENIX_API_KEY=...   # if your deployment requires auth
    pytest -v
"""

import time

import anthropic
import pytest
from phoenix.client.pytest import evaluate, log_evaluation, log_output
from phoenix.evals import LLM, create_classifier

# ---------------------------------------------------------------------------
# Knowledge base (simplified FAQ excerpts)
# ---------------------------------------------------------------------------

KB: dict[str, str] = {
    "billing": (
        "Invoices are generated on the 1st of each month and emailed to the "
        "account owner. You can download past invoices from Settings → Billing. "
        "We accept Visa, Mastercard, and ACH transfers. Refunds are available "
        "within 14 days of a charge."
    ),
    "password_reset": (
        "To reset your password, click 'Forgot password' on the login page. "
        "An email with a reset link will arrive within 2 minutes. Links expire "
        "after 24 hours. If you use SSO, contact your identity provider instead."
    ),
    "data_export": (
        "You can export any chart or table as CSV, PNG, or PDF. Click the "
        "⋯ menu on any widget and choose Export. Exports respect your current "
        "date-range and filter selections. Large exports (>100 k rows) are "
        "queued and emailed when ready."
    ),
    "offtopic": "",  # no KB context — bot should decline
}

# ---------------------------------------------------------------------------
# System under test
# ---------------------------------------------------------------------------

BOT_SYSTEM = """\
You are a concise customer-support agent. Answer the user's question using ONLY
the provided knowledge-base excerpt. If the excerpt is empty or does not contain
the answer, reply with exactly:
  "I don't have information on that — please contact support@example.com."
Keep answers under three sentences.\
"""

_client = anthropic.Anthropic()


def answer_question(question: str, kb_context: str) -> str:
    """Call the LLM to answer a support question grounded in a KB excerpt."""
    user_message = (
        f"Knowledge base:\n{kb_context}\n\nQuestion: {question}"
        if kb_context
        else f"Question: {question}"
    )
    response = _client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=256,
        system=BOT_SYSTEM,
        messages=[{"role": "user", "content": user_message}],
    )
    return response.content[0].text


# ---------------------------------------------------------------------------
# LLM-as-judge (arize-phoenix-evals classification evaluator)
# ---------------------------------------------------------------------------

# The judge is a `create_classifier` evaluator from `phoenix.evals`: it emits a
# helpful/unhelpful label (mapped to 1.0/0.0) plus an explanation, recorded as
# the "helpfulness" annotation on the experiment run. It sees the same
# knowledge-base excerpt the bot did, so it can tell whether an answer was
# grounded — and whether declining was the right call when the excerpt is empty.
JUDGE_PROMPT = """\
You are a strict quality reviewer for a B2B software support bot. You are given
the knowledge-base excerpt the bot was working from, the user question, and the
bot's response.

Knowledge base:
{{knowledge_base}}

Question: {{question}}

Bot response: {{response}}

Label the response "helpful" if it is accurate and grounded in the excerpt (or
correctly declines when the excerpt does not contain the answer). Label it
"unhelpful" if it is wrong, unsupported, vague, or ignores the question.\
"""

# A stronger model than the bot (Sonnet judging Haiku) keeps verdicts stable —
# a noisy judge makes the whole suite flaky. The LLM reads ANTHROPIC_API_KEY.
helpfulness = create_classifier(
    name="helpfulness",
    llm=LLM(provider="anthropic", model="claude-sonnet-4-6"),
    prompt_template=JUDGE_PROMPT,
    choices={"helpful": 1.0, "unhelpful": 0.0},
)


# ---------------------------------------------------------------------------
# Test cases
# ---------------------------------------------------------------------------

CASES: list[tuple[str, str, bool]] = [
    ("How do I download my invoices?", "billing", False),
    ("What payment methods do you accept?", "billing", False),
    ("My reset email never arrived — what should I do?", "password_reset", False),
    ("Can I export a chart as a PNG?", "data_export", False),
    ("What's the capital of France?", "offtopic", True),
]

# ---------------------------------------------------------------------------
# Eval suite
# ---------------------------------------------------------------------------


@pytest.mark.phoenix(dataset="support-bot")
@pytest.mark.parametrize(
    "question,kb_key,expect_refusal",
    CASES,
    ids=["invoices", "payment-methods", "reset-email", "png-export", "offtopic"],
)
def test_support_response(question: str, kb_key: str, expect_refusal: bool) -> None:
    kb_context = KB[kb_key]

    t0 = time.perf_counter()
    response = answer_question(question, kb_context)
    latency_ms = (time.perf_counter() - t0) * 1000

    log_output({"response": response})

    # Structural metric — logged as a CODE annotation.
    log_evaluation(name="latency_ms", score=latency_ms)

    # LLM judge — logged as an LLM evaluator span so its trace is separate
    # from the task trace, then surfaced as the "helpfulness" annotation. The
    # kwargs fill the classifier's prompt-template variables.
    evaluate(
        helpfulness,
        knowledge_base=kb_context or "(empty)",
        question=question,
        response=response,
    )

    # Hard assertion only for the structural refusal check.
    # For on-topic quality we rely on aggregate trends in Phoenix rather than
    # failing CI on every imperfect response (LLMs make mistakes; that's expected).
    if expect_refusal:
        assert "I don't have information on that" in response, (
            f"Expected refusal for off-topic question, got:\n{response}"
        )
