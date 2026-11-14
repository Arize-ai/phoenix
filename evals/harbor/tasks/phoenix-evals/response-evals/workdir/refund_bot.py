"""Acme Outdoor's refund assistant: drafts a JSON refund reply for each customer request.

Traced with OpenInference to the `refund-bot` project in Phoenix.
"""

from __future__ import annotations

import json

from openai import OpenAI
from tools import find_similar_tickets, get_order, search_policies

SYSTEM_PROMPT = """You are Acme Outdoor's refund assistant. Look up the order, the refund
policy, and similar past tickets, then reply with a JSON object containing
`refund_amount` (a number) and `message` (a short note to the customer)."""

client = OpenAI()


def handle(customer_message: str, order_id: str) -> str:
    order = get_order(order_id)
    policies = search_policies(customer_message)
    similar = find_similar_tickets(order_id, limit=2)
    context = json.dumps({"order": order, "policies": policies, "similar": similar})
    response = client.chat.completions.create(
        model="gpt-5.6-mini",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": customer_message},
            {"role": "user", "content": f"Context: {context}"},
        ],
    )
    return response.choices[0].message.content or ""
