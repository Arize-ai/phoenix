"""Ridgeline Outfitters' support assistant: answers one question from a signed-in customer.

The assistant's instructions are the latest version of the `support-system` prompt in
Phoenix. Each call sends that version's messages, then one user message with the rules
from the policy handbook (`policies.md`), the signed-in customer, the order records the
question needs, and the question. The handbook's reply standards aren't sent: how the
assistant replies is the prompt's job. The app always calls `MODEL`; the prompt
version's model settings aren't used.

    python support_app.py C-1001 "Can I return the boots from order R-50112?"
"""

from __future__ import annotations

import json
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

from openai import OpenAI
from phoenix.client import Client
from phoenix.client.types.prompts import PromptVersion

HERE = Path(__file__).resolve().parent
MODEL = "gpt-5.4-mini"
PROMPT_NAME = "support-system"
# The rules only. The reply standards above them are for whoever writes the prompt.
RULES = "## Rules" + (HERE / "policies.md").read_text().split("## Rules", 1)[1]
# A snapshot of the order system. The app treats its `as_of` time as now.
DATA = json.loads((HERE / "orders.json").read_text())
NOW = datetime.fromisoformat(DATA["as_of"])
ORDER_ID = re.compile(r"\bR-\d{5}\b")

_openai: OpenAI | None = None


def latest_prompt() -> PromptVersion:
    """Returns the latest version of the `support-system` prompt from Phoenix."""
    return Client().prompts.get(prompt_identifier=PROMPT_NAME)


def order_record(order: dict[str, Any]) -> dict[str, Any]:
    """Returns an order as the assistant sees it, with its age worked out."""
    record = dict(order)
    placed = datetime.fromisoformat(order["placed_at"])
    record["hours_since_placed"] = round((NOW - placed).total_seconds() / 3600, 1)
    if order.get("delivered_on"):
        delivered = datetime.fromisoformat(order["delivered_on"])
        record["days_since_delivery"] = (NOW.date() - delivered.date()).days
    return record


def build_context(question: str, customer_id: str) -> str:
    """Returns the user message: handbook rules, signed-in customer, orders, and question.

    The order records are the customer's own orders plus any order the question
    mentions by number.
    """
    customer = DATA["customers"][customer_id]
    orders = DATA["orders"]
    wanted = [o for o in orders if o["customer_id"] == customer_id]
    for order_id in ORDER_ID.findall(question):
        wanted += [o for o in orders if o["order_id"] == order_id and o not in wanted]
    records = json.dumps([order_record(o) for o in wanted], indent=1) if wanted else "None"
    return (
        f"Policy handbook:\n{RULES}\n"
        f"Current time: {NOW:%Y-%m-%d %H:%M}\n\n"
        f"Signed-in customer: {customer['name']} ({customer_id}, {customer['email']})\n\n"
        f"Order records:\n{records}\n\n"
        f"Customer question:\n{question}"
    )


def answer(question: str, customer_id: str, prompt: PromptVersion | None = None) -> str:
    """Returns the assistant's reply to a signed-in customer's question.

    Args:
        question: The customer's message.
        customer_id: The signed-in customer's ID, such as `C-1001`.
        prompt: A prompt version to use instead of the latest `support-system` version.
            Pass one to try a candidate prompt without saving it.
    """
    global _openai
    _openai = _openai or OpenAI()
    version = prompt or latest_prompt()
    messages: list[Any] = list(version.format().messages)
    messages.append({"role": "user", "content": build_context(question, customer_id)})
    response = _openai.chat.completions.create(model=MODEL, messages=messages)
    return response.choices[0].message.content or ""


if __name__ == "__main__":
    print(answer(sys.argv[2], sys.argv[1]))
