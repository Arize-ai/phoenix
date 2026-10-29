"""Evaluate a Prompt Change in Code: two tasks, one code evaluator. Needs no model key."""

# docs:start main
from phoenix.client import Client

client = Client()

dataset = client.datasets.create_dataset(
    name="support-quickstart",
    dataset_description="Support reply examples from the Phoenix quickstart.",
    examples=[
        {
            "id": "invoice-change",
            "input": {"text": "Draft a short reply about why an invoice changed."},
            "output": {
                "text": "Explain that invoice totals can change when usage, taxes, or plan adjustments are applied."
            },
            "metadata": {"kind": "billing"},
        },
        {
            "id": "renewal-plan-change",
            "input": {
                "text": "A customer says their renewal invoice is higher after changing plans."
            },
            "output": {
                "text": "Explain that plan changes can cause prorated usage charges and updated taxes."
            },
            "metadata": {"kind": "billing"},
        },
    ],
)


def baseline_task(input):
    if "renewal" in input["text"]:
        return "Renewal amounts can change after account updates."
    return "Invoice totals can change when billing settings change."


def edited_task(input):
    if "renewal" in input["text"]:
        return (
            "Plan changes can create prorated usage charges and updated taxes on a renewal invoice."
        )
    return "Invoice totals can change when usage, taxes, or plan adjustments are applied."


def covers_billing_context(output):
    text = output.lower()
    has_usage = "usage" in text or "prorat" in text
    has_taxes = "tax" in text
    has_plan = "plan" in text
    return has_usage and has_taxes and has_plan


client.experiments.run_experiment(
    dataset=dataset,
    task=baseline_task,
    evaluators=[covers_billing_context],
    experiment_name="support-response-baseline",
)

client.experiments.run_experiment(
    dataset=dataset,
    task=edited_task,
    evaluators=[covers_billing_context],
    experiment_name="support-response-edited",
)
# docs:end main
