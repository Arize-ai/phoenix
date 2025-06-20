"""Coordinator Agent implemented using the openai-agents Python SDK.

The agent exposes calendar-related tools and may *handoff* to the Mail Agent
for email-related actions.  Interact via the CLI to plan meetings, and the
Agents SDK will decide which tools to invoke.
"""

from __future__ import annotations

import os
import pathlib
import sys

from agents import Agent, Runner

# Import the agents so we can hand them off when needed
from calendar_agent import CALENDAR_AGENT  # type: ignore
from dotenv import load_dotenv
from mail_agent import MAIL_AGENT  # type: ignore

from phoenix.otel import register

load_dotenv()

tracer_provider = register(
    auto_instrument=True,
    endpoint=os.getenv("PHOENIX_COLLECTOR_ENDPOINT"),
    project_name="observe-agents",
)
tracer = tracer_provider.get_tracer(__name__)

MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

# Ensure observe_agents root is on PYTHONPATH so we can import mail_agent package
ROOT_DIR = pathlib.Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.append(str(ROOT_DIR))

# ---------------------------------------------------------------------------
# Assistant creation / loading
# ---------------------------------------------------------------------------

COORDINATOR_AGENT = Agent(
    name="Coordinator Agent",
    instructions=(
        "You are a scheduling assistant. When you need to perform calendar operations "
        "(check availability, create events, list events, etc.), *handoff* to the Calendar Agent. "
        "When you need to perform email-related tasks (send emails, search emails, etc.), "
        "*handoff* to the Mail Agent. "
        "You coordinate between these agents to help users with scheduling and communication tasks. "
        "Respond with a confirmation once all steps are complete."
    ),
    tools=[],  # No direct tools - we use handoffs to specialized agents
    handoffs=[agent for agent in [MAIL_AGENT, CALENDAR_AGENT] if agent is not None],
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
