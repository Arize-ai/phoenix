"""Acme's customer-support bot.

The bot answers questions about customers, orders, and store policies. It calls an
OpenAI chat model through the company's LLM gateway and gives the model two tools:
`run_sql` over the store database and `get_policy` for policy documents.

Run it with `python support_bot.py`. Each conversation in `CONVERSATIONS` runs as one
chat, and every answer prints to stdout.
"""

from __future__ import annotations

import json
import os
import sqlite3
import uuid
from typing import cast

from openai import OpenAI
from openai.types.chat import ChatCompletionMessageParam, ChatCompletionToolParam

MODEL = "gpt-4o-mini"
GATEWAY_URL = os.environ.get("ACME_LLM_GATEWAY_URL", "http://127.0.0.1:8100/v1")
MAX_TOOL_ROUNDS = 4

SYSTEM_PROMPT = (
    "You are the support assistant for Acme. Use run_sql to look up customers and "
    "orders, and get_policy for store policies. Answer only from tool results."
)

TOOLS: list[ChatCompletionToolParam] = [
    {
        "type": "function",
        "function": {
            "name": "run_sql",
            "description": "Run a read-only SQL query against the store database.",
            "parameters": {
                "type": "object",
                "properties": {"query": {"type": "string"}},
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_policy",
            "description": "Return the text of a store policy: refunds, shipping, warranty, or all.",
            "parameters": {
                "type": "object",
                "properties": {"topic": {"type": "string"}},
                "required": ["topic"],
            },
        },
    },
]

POLICIES = {
    "refunds": "Refunds are available within 30 days of delivery for unused items.",
    "shipping": "Standard shipping takes 3 to 5 business days. Express takes 1 day.",
    "warranty": "Hardware carries a 1-year limited warranty against defects.",
}
# The full handbook is long enough that a request containing it exceeds the gateway's
# tokens-per-minute limit.
HANDBOOK = "\n\n".join(f"Section {i}. " + " ".join(POLICIES.values()) * 40 for i in range(1, 31))

CONVERSATIONS: list[list[str]] = [
    ["What's the status of order 1001?", "And when will it arrive?"],
    ["What is your refund policy?"],
    ["How many enterprise customers do we have, and what are their emails?"],
    ["What's the status of order 1004?"],
    ["Summarize every store policy for me."],
    ["Do you have a warranty on hardware?", "What's the status of order 1002?"],
]


def open_store() -> sqlite3.Connection:
    """Returns an in-memory store database with sample customers and orders."""
    db = sqlite3.connect(":memory:")
    db.executescript(
        """
        CREATE TABLE customers (id INTEGER PRIMARY KEY, email TEXT NOT NULL, plan TEXT);
        CREATE TABLE orders (
            id INTEGER PRIMARY KEY, customer_id INTEGER, status TEXT, eta TEXT
        );
        INSERT INTO customers VALUES
            (1, 'ana@example.com', 'enterprise'),
            (2, 'bo@example.com', 'free'),
            (3, 'cy@example.com', 'enterprise');
        INSERT INTO orders VALUES
            (1001, 1, 'shipped', '2026-11-05'),
            (1002, 2, 'processing', '2026-11-09'),
            (1004, 3, 'delivered', '2026-10-30');
        """
    )
    return db


class SupportBot:
    """A support bot that answers questions with tool calls."""

    def __init__(self) -> None:
        self.client = OpenAI(base_url=GATEWAY_URL, api_key="gateway", max_retries=0)
        self.store = open_store()

    def run_sql(self, query: str) -> str:
        """Returns the query's rows as JSON, or the error the database raised."""
        try:
            rows = self.store.execute(query).fetchall()
        except sqlite3.Error as error:
            return json.dumps({"error": f"{type(error).__name__}: {error}", "rows": []})
        return json.dumps({"rows": rows})

    def get_policy(self, topic: str) -> str:
        """Returns the policy text for a topic."""
        if topic == "all":
            return HANDBOOK
        return POLICIES.get(topic, f"No policy named {topic}.")

    def call_tool(self, name: str, arguments: str) -> str:
        """Runs one tool call from the model and returns its output."""
        args = json.loads(arguments)
        if name == "run_sql":
            return self.run_sql(args["query"])
        if name == "get_policy":
            return self.get_policy(args["topic"])
        return f"Unknown tool {name}."

    def answer(self, question: str, history: list[ChatCompletionMessageParam]) -> str:
        """Returns the bot's reply to a question and appends the turn to the history."""
        history.append({"role": "user", "content": question})
        for _ in range(MAX_TOOL_ROUNDS):
            response = self.client.chat.completions.create(
                model=MODEL,
                messages=[{"role": "system", "content": SYSTEM_PROMPT}, *history],
                tools=TOOLS,
            )
            message = response.choices[0].message
            history.append(cast(ChatCompletionMessageParam, message.model_dump(exclude_none=True)))
            if not message.tool_calls:
                return message.content or ""
            for call in message.tool_calls:
                if call.type != "function":
                    continue
                output = self.call_tool(call.function.name, call.function.arguments)
                history.append({"role": "tool", "tool_call_id": call.id, "content": output})
        return "Sorry, I couldn't finish that request."

    def chat(self, conversation_id: str, questions: list[str]) -> list[str]:
        """Answers each question in order as one conversation."""
        history: list[ChatCompletionMessageParam] = []
        replies = []
        for question in questions:
            try:
                replies.append(self.answer(question, history))
            except Exception as error:  # The bot apologizes instead of crashing the chat.
                replies.append(f"Sorry, something went wrong ({type(error).__name__}).")
        return replies


def main() -> None:
    bot = SupportBot()
    for questions in CONVERSATIONS:
        conversation_id = str(uuid.uuid4())
        for question, reply in zip(questions, bot.chat(conversation_id, questions)):
            print(f"[{conversation_id[:8]}] Q: {question}\n           A: {reply}")


if __name__ == "__main__":
    main()
