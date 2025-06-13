"""Coordinator Agent implemented using the openai-agents Python SDK.

The agent exposes calendar-related tools and may *handoff* to the Mail Agent
for email-related actions.  Interact via the CLI to plan meetings, and the
Agents SDK will decide which tools to invoke.
"""

from __future__ import annotations

import os
import pathlib
import sys
from typing import Dict, List

from agents import Agent, Runner, function_tool
from dotenv import load_dotenv

from phoenix.otel import register

load_dotenv()

# Connect to Phoenix at localhost:4317 with auto-instrumentation
tracer_provider = register(
    auto_instrument=True,
    endpoint="http://localhost:4317",
)
tracer = tracer_provider.get_tracer("coordinator-agent")

MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

# Ensure observe_agents root is on PYTHONPATH so we can import mail_agent package
ROOT_DIR = pathlib.Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.append(str(ROOT_DIR))

# Import the mail agent so we can hand it off when needed
try:
    from mail_agent.mail_agent import MAIL_AGENT  # type: ignore
except ImportError:
    # Fallback stub if mail_agent isn't on PYTHONPATH when running standalone
    MAIL_AGENT = None  # type: ignore

# ---------------------------------------------------------------------------
# Stubbed tool implementations – replace with real integrations
# ---------------------------------------------------------------------------


@function_tool
def calendar_list_availability(timeMin: str, timeMax: str) -> List[Dict[str, str]]:
    """Return a list of free time slots between `timeMin` and `timeMax`. (Stub)"""
    print("[stub] calendar_list_availability", timeMin, timeMax)
    return [{"start": timeMin, "end": timeMax}]


@function_tool
def calendar_create_event(summary: str, start: str, end: str, attendees: List[str]) -> str:
    print("[stub] calendar_create_event", summary, start, end, attendees)
    return "EVENT_STUB_123"


def mail_send_mail(
    to: List[str], subject: str, body: str, attachments: List[str] | None = None
) -> str:
    print("[stub] mail_send_mail", to, subject)
    return "MSG_STUB_123"


# ---------------------------------------------------------------------------
# Assistant creation / loading
# ---------------------------------------------------------------------------

COORDINATOR_AGENT = Agent(
    name="Coordinator Agent",
    instructions=(
        "You are a scheduling assistant. Use the calendar tools to find availability "
        "and create events. When an email needs to be sent, *handoff* to the Mail "
        "Agent.  Respond with a confirmation once all steps are complete."
    ),
    tools=[calendar_list_availability, calendar_create_event],
    handoffs=[MAIL_AGENT] if MAIL_AGENT else None,  # type: ignore[arg-type]
    model=MODEL,
)

# ---------------------------------------------------------------------------
# CLI entry-point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print("🤝 Coordinator Agent (openai-agents) ready.  Type your request ('exit' to quit).")
    while True:
        try:
            user_input = input(">>> ").strip()
        except (KeyboardInterrupt, EOFError):
            print()
            break
        if user_input.lower() in {"exit", "quit"}:
            break
        if user_input:
            result = Runner.run_sync(COORDINATOR_AGENT, user_input)
            print("🤖:", result.final_output)
