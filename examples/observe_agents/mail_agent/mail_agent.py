"""Mail Agent implemented using the openai-agents Python SDK.

This script defines an Agent equipped with Gmail-related
tools such as `send_mail`, `fetch_unread`, `search_threads`, and `reply_thread`.
When the Agent decides to call one of these tools the corresponding local
function is executed.

Run the script and interact over stdio, e.g.:

    >>> Check my unread messages
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Dict, List

from agents import Agent, Runner, function_tool
from dotenv import load_dotenv
from openai import OpenAI

from phoenix.otel import register

# ---------------------------------------------------------------------------
# Environment & instrumentation
# ---------------------------------------------------------------------------

load_dotenv()

# Connect to Phoenix at localhost:4317 with auto-instrumentation
tracer_provider = register(
    auto_instrument=True,
    endpoint="http://localhost:4317",
)
tracer = tracer_provider.get_tracer("mail-agent")

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise RuntimeError("OPENAI_API_KEY must be set")
client = OpenAI(api_key=OPENAI_API_KEY)

MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
ASSISTANT_FILE = Path(__file__).with_suffix(".assistant_id")

# ---------------------------------------------------------------------------
# Gmail helpers (placeholder implementations)
# ---------------------------------------------------------------------------

SCOPES = [
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.send",
]


def get_gmail_service() -> Any:
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build  # type: ignore

    token_path = os.getenv("GMAIL_TOKEN_JSON")
    client_secret = os.getenv("GMAIL_CLIENT_SECRET_JSON")
    if not token_path or not client_secret:
        raise RuntimeError("GMAIL_TOKEN_JSON and GMAIL_CLIENT_SECRET_JSON must be set")
    creds = Credentials.from_authorized_user_file(token_path, SCOPES)
    return build("gmail", "v1", credentials=creds)


# ---------------------------------------------------------------------------
# Tool implementations
# ---------------------------------------------------------------------------


@function_tool
def send_mail(to: List[str], subject: str, body: str, attachments: List[str] | None = None) -> str:
    """Send an email via Gmail. Returns the message ID. (Stub)"""
    _ = get_gmail_service()
    print("[stub] Sending mail", to, subject)
    return "MSG_STUB_123"


@function_tool
def fetch_unread(max_results: int = 5) -> List[Dict[str, Any]]:
    _ = get_gmail_service()
    print("[stub] Fetching unread", max_results)
    return []


@function_tool
def search_threads(query: str, max_results: int = 10) -> List[Dict[str, Any]]:
    _ = get_gmail_service()
    print("[stub] Searching threads", query)
    return []


@function_tool
def reply_thread(thread_id: str, body: str) -> str:
    _ = get_gmail_service()
    print("[stub] Replying to thread", thread_id)
    return "MSG_REPLY_STUB_456"


# ---------------------------------------------------------------------------
# Agent definition
# ---------------------------------------------------------------------------

MAIL_AGENT = Agent(
    name="Mail Agent",
    instructions=(
        "You are an email assistant with access to Gmail. "
        "Use the provided tools to send and manage email."
    ),
    tools=[send_mail, fetch_unread, search_threads, reply_thread],
)

# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print("📬 Mail Agent (openai-agents) ready. Type your email-related request ('exit' to quit).")
    while True:
        try:
            user_input = input(">>> ").strip()
        except (KeyboardInterrupt, EOFError):
            print()
            break
        if user_input.lower() in {"exit", "quit"}:
            break
        if user_input:
            result = Runner.run_sync(MAIL_AGENT, user_input)
            print("🤖:", result.final_output)
