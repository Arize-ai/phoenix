"""Larkspur Home's support bot: answers order, shipping, and delivery questions.

Messages arrive from the website chat widget and from the support inbox. Each request
is traced with OpenInference to the `support-bot` project in Phoenix as a
`handle_message` agent span with tool, retriever, and LLM children.
"""

from __future__ import annotations

import json
from typing import Any

from openai import OpenAI

SYSTEM_PROMPT = """You are Larkspur Home's support assistant. Answer the customer's question
about their order, shipping, or delivery. Use only the order record, tracking data, and
help center articles in Context. Keep replies short and friendly."""

client = OpenAI()


def lookup_order(order_id: str) -> dict[str, Any]:
    """Returns the order record: status, items, dates, carrier, and tracking number."""
    raise NotImplementedError("Calls the orders API in production.")


def track_shipment(tracking_number: str) -> dict[str, Any]:
    """Returns the carrier's latest tracking event and delivery estimate."""
    raise NotImplementedError("Calls the carrier tracking API in production.")


def search_help_center(query: str) -> list[dict[str, Any]]:
    """Returns the top help center articles for the question."""
    raise NotImplementedError("Calls the help center search index in production.")


def question_text(payload: dict[str, Any]) -> str:
    """Returns the customer's question from a chat or email payload."""
    if payload["channel"] == "email":
        return f"Subject: {payload['subject']}\n\n{payload['body']}"
    return str(payload["message"])


def handle_message(payload: dict[str, Any], order_id: str) -> str:
    order = lookup_order(order_id)
    tracking = track_shipment(order["tracking_number"]) if order.get("tracking_number") else None
    articles = search_help_center(question_text(payload))
    context = json.dumps(
        {"order": order, "tracking": tracking, "articles": [a["content"] for a in articles]}
    )
    response = client.chat.completions.create(
        model="gpt-5.6-mini",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": question_text(payload)},
            {"role": "user", "content": f"Context: {context}"},
        ],
    )
    return response.choices[0].message.content or ""
