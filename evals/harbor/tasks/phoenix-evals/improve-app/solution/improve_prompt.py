"""Save a better `support-system` prompt and compare it with the baseline in an experiment.

Run from `/app`. The script saves `support_system_v2.txt` as a new version of the
`support-system` prompt, then runs the app with that version on every
`support-questions` example and scores each reply against the handbook's reply standards:
three code evaluators and one LLM judge for promises.
"""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, os.getcwd())
import support_app  # noqa: E402
from phoenix.client import Client  # noqa: E402
from phoenix.client.types.prompts import PromptVersion  # noqa: E402
from phoenix.evals import LLM, ClassificationEvaluator  # noqa: E402

HERE = Path(__file__).resolve().parent
RULE_IDS = set(re.findall(r"^### (\S+)", (Path.cwd() / "policies.md").read_text(), re.M))
TAG = re.compile(r"\[policy:\s*([a-z-]+)\s*\]", re.I)
WORD = re.compile(r"[A-Za-z0-9]+(?:['’.,:/-][A-Za-z0-9]+)*")
ORDERS = {o["order_id"]: o for o in support_app.DATA["orders"]}

PROMISE_JUDGE = ClassificationEvaluator(
    name="no_false_promises",
    llm=LLM(provider="openai", model=os.environ.get("EVAL_MODEL", "gpt-5-nano")),
    prompt_template="""A support assistant answered a customer using the handbook rules and order records below.

{{context}}

Reply:
{{reply}}

Does the reply offer, guarantee, or claim anything the handbook doesn't allow in this situation, such as a discount, credit, waived fee, exception, guaranteed date, or an action support can't take itself? Offering to pass a request to a team lead without promising an outcome is allowed. Answer "allowed" or "overpromise".""",
    choices={"allowed": 1.0, "overpromise": 0.0},
)


def cites_policy(output: str) -> dict[str, Any]:
    ids = [i.lower() for i in TAG.findall(output)]
    ok = bool(ids) and set(ids) <= RULE_IDS
    return {"score": float(ok), "label": "pass" if ok else "fail", "explanation": str(ids)}


def under_word_limit(output: str) -> dict[str, Any]:
    words = len(WORD.findall(TAG.sub(" ", output)))
    ok = words <= 80
    return {"score": float(ok), "label": "pass" if ok else "fail", "explanation": f"{words} words"}


def account_privacy(input: dict[str, Any], output: str) -> dict[str, Any]:
    others = [
        ORDERS[i]
        for i in re.findall(r"R-\d{5}", input["question"])
        if i in ORDERS and ORDERS[i]["customer_id"] != input["customer_id"]
    ]
    if not others:
        return {"label": "not_applicable"}
    details = []
    for order in others:
        details += [order["ship_to"]["name"], order["ship_to"]["phone"], order["tracking_number"]]
        details += [item["name"].split(" (")[0] for item in order["items"]]
    leaked = [d for d in details if d and d.lower() in output.lower()]
    return {
        "score": float(not leaked),
        "label": "fail" if leaked else "pass",
        "explanation": f"reveals {leaked}" if leaked else "",
    }


def no_false_promises(input: dict[str, Any], output: str) -> dict[str, Any]:
    context = support_app.build_context(input["question"], input["customer_id"])
    score = PROMISE_JUDGE.evaluate({"context": context, "reply": output})[0]
    return {"score": score.score, "label": score.label, "explanation": score.explanation}


def main() -> None:
    client = Client()
    version = client.prompts.create(
        name=support_app.PROMPT_NAME,
        version=PromptVersion(
            [{"role": "system", "content": (HERE / "support_system_v2.txt").read_text()}],
            model_name=support_app.MODEL,
            template_format="NONE",
            description="Follows the handbook's reply standards",
        ),
    )
    latest = support_app.latest_prompt()
    assert latest.id == version.id, "the app doesn't load the new version"

    def task(input: dict[str, Any]) -> str:
        return support_app.answer(input["question"], input["customer_id"], prompt=latest)

    dataset = client.datasets.get_dataset(dataset="support-questions")
    experiment = client.experiments.run_experiment(
        dataset=dataset,
        task=task,
        evaluators=[cites_policy, under_word_limit, account_privacy, no_false_promises],
        experiment_name="support-system-v2",
        experiment_description="Handbook reply standards in the system prompt",
        experiment_metadata={"prompt": support_app.PROMPT_NAME, "prompt_version_id": version.id},
    )
    print(
        json.dumps({"prompt_version_id": version.id, "experiment_id": experiment["experiment_id"]})
    )


if __name__ == "__main__":
    main()
