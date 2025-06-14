# Streamlit frontend for Observe Agents demo
# Located at examples/observe_agents/streamlit_app.py

"""Streamlit UI for the Observe Agents demo.

Run with:
    streamlit run streamlit_app.py

Features
--------
* Sidebar **Configuration** lets you set environment variables needed by the
  backend agents (OpenAI key, Google/Gmail credentials).  These are stored only
  in Streamlit's `st.session_state` and set via `os.environ` for the current
  Python process.
* Main **Chat** pane provides a chat UI backed by the Coordinator Agent.
  A few example queries are shown to get you started.
"""

from __future__ import annotations

import os
import pathlib
import sys
from typing import List

import streamlit as st
from agents import Runner
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Ensure we can import the coordinator agent
# ---------------------------------------------------------------------------

ROOT_DIR = pathlib.Path(__file__).resolve().parent
if str(ROOT_DIR) not in sys.path:
    sys.path.append(str(ROOT_DIR))

try:
    # pylint: disable=import-error
    from coordinator.coordinator import COORDINATOR_AGENT  # type: ignore
except Exception as exc:  # pragma: no cover
    st.error(f"Failed to import Coordinator Agent: {exc}")
    st.stop()

# ---------------------------------------------------------------------------
# Load any env vars from .env so users can pre-populate the form
# ---------------------------------------------------------------------------

load_dotenv()

# ---------------------------------------------------------------------------
# Sidebar – configuration
# ---------------------------------------------------------------------------

st.sidebar.title("🔧 Configuration")

CONFIG_FIELDS = {
    "OPENAI_API_KEY": {
        "label": "OpenAI API Key",
        "type": "password",
    },
    "GOOGLE_SERVICE_ACCOUNT_JSON": {
        "label": "Google Service Account JSON (Calendar)",
        "type": "file",
    },
    "GMAIL_TOKEN_JSON": {
        "label": "Gmail OAuth Token JSON",
        "type": "file",
    },
    "GMAIL_CLIENT_SECRET_JSON": {
        "label": "Gmail Client Secret JSON",
        "type": "file",
    },
}

changed = False
for env_key, meta in CONFIG_FIELDS.items():
    default_val = os.getenv(env_key, "")
    if meta["type"] == "password":
        val = st.sidebar.text_input(meta["label"], value=default_val, type="password")
    else:
        val = st.sidebar.text_input(meta["label"], value=default_val)
    if val and val != os.getenv(env_key):
        os.environ[env_key] = val
        changed = True

if changed:
    st.sidebar.success("Environment variables updated for this session.")

st.sidebar.markdown("---")
st.sidebar.markdown(
    "Built with **[openai-agents](https://github.com/openai/openai-agents-python)**"
)

# ---------------------------------------------------------------------------
# Main – Chat UI
# ---------------------------------------------------------------------------

st.title("⌚️📬 Personal Assistant Demo")

EXAMPLE_QUERIES: List[str] = [
    "Arrange a 30-minute meeting with Alice next week",
    "Find free slots for Friday afternoon",
    "Schedule a call with Bob and send him an invite email",
]

with st.expander("Example queries", expanded=False):
    for q in EXAMPLE_QUERIES:
        if st.button(q, key=q):
            if "messages" not in st.session_state:
                st.session_state.messages = []
            st.session_state.messages.append({"role": "user", "content": q})
            st.experimental_rerun()

# Initialise chat history
if "messages" not in st.session_state:
    st.session_state.messages = []

# Display chat history
for msg in st.session_state.messages:
    if msg["role"] == "user":
        st.chat_message("user").markdown(msg["content"])
    else:
        st.chat_message("assistant").markdown(msg["content"])

# Chat input
if prompt := st.chat_input("Type your request..."):
    st.session_state.messages.append({"role": "user", "content": prompt})
    st.chat_message("user").markdown(prompt)

    # Run through Coordinator Agent
    with st.spinner("Thinking..."):
        result = Runner.run_sync(COORDINATOR_AGENT, prompt)
        assistant_reply = result.final_output if hasattr(result, "final_output") else str(result)
        st.session_state.messages.append({"role": "assistant", "content": assistant_reply})
        st.chat_message("assistant").markdown(assistant_reply)
