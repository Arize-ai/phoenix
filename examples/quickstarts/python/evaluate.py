"""Evaluate Your Agent: a dataset, an LLM judge, and two experiments."""

# docs:start main
from openai import OpenAI
from phoenix.client import Client
from phoenix.evals import LLM, bind_evaluator, create_classifier

phoenix = Client()  # reads PHOENIX_ENDPOINT, default http://localhost:6006
openai = OpenAI()

dataset = phoenix.datasets.create_dataset(
    name="travel-support",
    examples=[
        {
            "input": {"question": "How long do I have to cancel a Basic fare for a full refund?"},
            "output": {
                "expected_answer": "Basic fares can be cancelled for a full refund within 48 hours of booking."
            },
        },
        {
            "input": {"question": "Can I change the date on a Basic fare, and what does it cost?"},
            "output": {
                "expected_answer": "Basic fares can be changed once for a 40 dollar fee, plus any difference in price."
            },
        },
        {
            "input": {
                "question": "How many checked bags come with a Basic fare, and what does a second bag cost?"
            },
            "output": {
                "expected_answer": "Basic fares include one checked bag. A second bag is 45 dollars."
            },
        },
    ],
)

judge = create_classifier(
    name="correctness",
    llm=LLM(provider="openai", model="gpt-4o-mini"),
    prompt_template="""Compare the provided answer to the reference answer. Label true if it states the same policy: same time windows, fees, and quantities, in any wording. Label false if it contradicts the reference, hedges, or leaves out a fee, limit, or condition.

Reference answer: {{reference}}
Provided answer: {{output}}""",
    choices={"true": 1.0, "false": 0.0},
)

# The expected output is {"expected_answer": ...}; hand the judge just the answer.
correctness = bind_evaluator(
    evaluator=judge, input_mapping={"reference": "reference.expected_answer"}
)


def run(prompt, name):
    def task(input):
        response = openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt.format(**input)}],
        )
        return response.choices[0].message.content

    return phoenix.experiments.run_experiment(
        dataset=dataset, task=task, evaluators=[correctness], experiment_name=name
    )


BASELINE = "You are a travel support agent. Answer the customer's question.\n\nQuestion: {question}"
POLICY = """You are a travel support agent. Answer the customer's question using this policy.

Basic fare policy:
- Full refund if cancelled within 48 hours of booking.
- Can be changed once for a 40 dollar fee, plus any price difference.
- Includes one checked bag. A second bag is 45 dollars.

Question: {question}"""

run(BASELINE, "baseline")
run(POLICY, "with-policy")
# docs:end main
