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

import asyncio
import os
import pathlib
import sys
from typing import List, Optional

import streamlit as st
from agents import Runner
from dotenv import load_dotenv
from opentelemetry import trace
from opentelemetry.trace import Status, StatusCode, format_span_id, get_current_span

from phoenix.client import Client

tracer = trace.get_tracer(__name__)

# ---------------------------------------------------------------------------
# Ensure we can import the coordinator agent
# ---------------------------------------------------------------------------

ROOT_DIR = pathlib.Path(__file__).resolve().parent
if str(ROOT_DIR) not in sys.path:
    sys.path.append(str(ROOT_DIR))

try:
    # Import from the current directory (simplified structure)
    from coordinator import COORDINATOR_AGENT  # type: ignore
except Exception as exc:  # pragma: no cover
    st.error(f"Failed to import Coordinator Agent: {exc}")
    st.stop()

# ---------------------------------------------------------------------------
# Load any env vars from .env so users can pre-populate the form
# ---------------------------------------------------------------------------

load_dotenv()

# ---------------------------------------------------------------------------
# Phoenix client initialization
# ---------------------------------------------------------------------------

# Initialize Phoenix client for logging annotations
try:
    phoenix_client = Client(base_url=os.getenv("PHOENIX_BASE_URL"))
except Exception as e:
    st.error(f"Failed to initialize Phoenix client: {e}")
    phoenix_client = None

# ---------------------------------------------------------------------------
# Async wrapper for agent execution
# ---------------------------------------------------------------------------


async def run_agent_async(agent, prompt):
    """Run the agent asynchronously."""
    return await Runner.run(agent, prompt)


def run_agent_sync(agent, prompt):
    """Run the agent synchronously by creating a new event loop."""
    try:
        # Try to get the existing event loop
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # If we're in a running loop (like Jupyter), we need to use nest_asyncio
            import nest_asyncio

            nest_asyncio.apply()
            return loop.run_until_complete(run_agent_async(agent, prompt))
        else:
            return loop.run_until_complete(run_agent_async(agent, prompt))
    except RuntimeError:
        # No event loop exists, create a new one
        return asyncio.run(run_agent_async(agent, prompt))


# ---------------------------------------------------------------------------
# Agent execution function
# ---------------------------------------------------------------------------


def execute_agent(prompt: str):
    """Execute the agent with the given prompt and return the result."""
    try:
        with tracer.start_as_current_span("run_agent") as span:
            span.set_attribute("input.value", prompt)
            span.set_attribute("openinference.span.kind", "CHAIN")

            result = run_agent_sync(COORDINATOR_AGENT, prompt)
            assistant_reply = (
                result.final_output if hasattr(result, "final_output") else str(result)
            )

            span.set_attribute("output.value", assistant_reply)

            # Try to get span ID from the OpenTelemetry context
            span_id = None
            try:
                current_span = get_current_span()
                if current_span and current_span.get_span_context().span_id != 0:
                    span_id = format_span_id(current_span.get_span_context().span_id)
            except Exception as span_error:
                st.warning(f"Could not capture span ID: {span_error}")
                span_id = None

            span.set_status(Status(StatusCode.OK))
            return assistant_reply, span_id

    except Exception as e:
        span.set_status(Status(StatusCode.ERROR))
        error_msg = f"❌ Error processing request: {str(e)}"
        st.error("Please check your configuration and try again.")
        return error_msg, None


# ---------------------------------------------------------------------------
# Feedback functions
# ---------------------------------------------------------------------------


def log_feedback_to_phoenix(
    span_id: str, rating: str, score: float, explanation: Optional[str] = None
):
    """Log human feedback annotation to Phoenix."""
    if not phoenix_client:
        st.error("Phoenix client not available")
        return False

    try:
        phoenix_client.annotations.add_span_annotation(
            annotation_name="user_feedback",
            annotator_kind="HUMAN",
            span_id=span_id,
            label=rating,
            score=score,
            explanation=explanation,
            metadata={"source": "streamlit_ui", "rating_system": "3_category"},
        )
        return True
    except Exception as e:
        st.error(f"Failed to log feedback to Phoenix: {e}")
        return False


def render_feedback_ui(message_index: int, span_id: Optional[str] = None):
    """Render feedback UI for a message."""
    if not span_id:
        return

    # Check if feedback was already given for this message
    feedback_key = f"feedback_given_{message_index}"
    if st.session_state.get(feedback_key, False):
        st.success("✅ Feedback already submitted for this response")
        return

    # Create a more compact feedback UI
    st.markdown(
        "<div style='background-color: #f0f2f6; padding: 10px; border-radius: 5px; margin: 10px 0;'>",
        unsafe_allow_html=True,
    )

    col1, col2, col3, col4 = st.columns([1, 1, 1, 3])

    with col1:
        if st.button(
            "👍 Good", key=f"good_{message_index}", help="Response was helpful and accurate"
        ):
            success = log_feedback_to_phoenix(span_id, "good", 1.0, "User rated response as good")
            if success:
                st.session_state[feedback_key] = True
                st.rerun()

    with col2:
        if st.button(
            "👌 Okay",
            key=f"okay_{message_index}",
            help="Response was acceptable but could be better",
        ):
            success = log_feedback_to_phoenix(span_id, "okay", 0.5, "User rated response as okay")
            if success:
                st.session_state[feedback_key] = True
                st.rerun()

    with col3:
        if st.button(
            "👎 Bad", key=f"bad_{message_index}", help="Response was unhelpful or incorrect"
        ):
            success = log_feedback_to_phoenix(span_id, "bad", 0.0, "User rated response as bad")
            if success:
                st.session_state[feedback_key] = True
                st.rerun()

    # Expandable section for additional text feedback
    with st.expander("💬 Add detailed feedback (optional)", expanded=False):
        feedback_text = st.text_area(
            "Tell us more about your rating:",
            key=f"text_{message_index}",
            placeholder="What was good or bad about this response? How could it be improved?",
            max_chars=500,
        )
        if st.button("Submit Detailed Feedback", key=f"text_submit_{message_index}"):
            if feedback_text.strip():
                success = log_feedback_to_phoenix(span_id, "detailed_feedback", 0.5, feedback_text)
                if success:
                    st.success("Detailed feedback logged!", icon="✅")
            else:
                st.warning("Please enter some feedback text.")

    st.markdown("</div>", unsafe_allow_html=True)


# ---------------------------------------------------------------------------
# Sidebar – configuration
# ---------------------------------------------------------------------------

st.sidebar.title("🔧 Configuration")

CONFIG_FIELDS = {
    "OPENAI_API_KEY": {
        "label": "OpenAI API Key",
        "type": "password",
    },
    "GMAIL_TOKEN_JSON": {
        "label": "Gmail OAuth Token JSON",
        "type": "text",
    },
    "GMAIL_CLIENT_SECRET_JSON": {
        "label": "Gmail Client Secret JSON",
        "type": "text",
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
    "**🔗 Links:**\n"
    "- [openai-agents](https://github.com/openai/openai-agents-python)\n"
    "- [Phoenix Observability](http://localhost:6006)"
)

st.sidebar.markdown("---")
st.sidebar.markdown(
    "**📊 Feedback System:**\n"
    "Rate assistant responses to help improve the system:\n"
    "- 👍 **Good**: Response was helpful and accurate\n"
    "- 👌 **Okay**: Response was acceptable but could be better\n"
    "- 👎 **Bad**: Response was unhelpful or incorrect\n\n"
    "Your feedback is logged to Phoenix for analysis."
)

# ---------------------------------------------------------------------------
# Main – Chat UI
# ---------------------------------------------------------------------------

st.title("⌚️📬 Personal Assistant Demo")

st.markdown(
    "This demo showcases **Python-based agents** that collaborate using the OpenAI Agents "
    "framework while being fully **observable with Phoenix**. The coordinator agent will "
    "hand off to specialized calendar and mail agents as needed."
)

st.info(
    "💡 **Human Feedback Enabled**: After each assistant response, you can rate the quality "
    "using the 3-category system (Good/Okay/Bad). Your feedback is automatically logged to "
    "Phoenix as annotations for analysis and improvement."
)

EXAMPLE_QUERIES: List[str] = [
    "Arrange a 30-minute meeting with Alice next week",
    "Find free slots for Friday afternoon",
    "Schedule a call with Bob and send him an invite email",
    "Check my availability tomorrow morning",
    "List my upcoming events for this week",
    "Send an email to team@company.com about the quarterly review",
]

with st.expander("💡 Example queries", expanded=False):
    for q in EXAMPLE_QUERIES:
        if st.button(q, key=q):
            if "messages" not in st.session_state:
                st.session_state.messages = []

            # Add user message
            st.session_state.messages.append({"role": "user", "content": q})

            # Execute agent
            with st.spinner("🤖 Processing your request..."):
                assistant_reply, span_id = execute_agent(q)

                # Store message with span ID for feedback
                message_data = {"role": "assistant", "content": assistant_reply}
                if span_id:
                    message_data["span_id"] = span_id

                st.session_state.messages.append(message_data)

            st.rerun()

# Initialise chat history
if "messages" not in st.session_state:
    st.session_state.messages = []

# Display chat history
for i, msg in enumerate(st.session_state.messages):
    if msg["role"] == "user":
        st.chat_message("user").markdown(msg["content"])
    else:
        # Display assistant message
        st.chat_message("assistant").markdown(msg["content"])

        # Add feedback UI for assistant messages
        span_id = msg.get("span_id")
        if span_id:
            with st.container():
                st.markdown("**Rate this response:**")
                render_feedback_ui(i, span_id)
        else:
            st.info("⚠️ No span ID available for feedback on this message")

# Chat input
if prompt := st.chat_input("Type your request..."):
    st.session_state.messages.append({"role": "user", "content": prompt})
    st.chat_message("user").markdown(prompt)

    # Run through Coordinator Agent
    with st.spinner("🤖 Processing your request..."):
        assistant_reply, span_id = execute_agent(prompt)

        # Store message with span ID for feedback
        message_data = {"role": "assistant", "content": assistant_reply}
        if span_id:
            message_data["span_id"] = span_id

        st.session_state.messages.append(message_data)
        st.chat_message("assistant").markdown(assistant_reply)

        # Show feedback UI for this new message
        if span_id:
            with st.container():
                st.markdown("**Rate this response:**")
                render_feedback_ui(len(st.session_state.messages) - 1, span_id)
        else:
            st.info("⚠️ No span ID captured for feedback on this message")

if __name__ == "__main__":
    import subprocess
    import sys

    # Check if we're already running under Streamlit by looking for Streamlit's runtime
    try:
        from streamlit.runtime.scriptrunner import get_script_run_ctx

        if get_script_run_ctx() is not None:
            # We're already running under Streamlit, do nothing
            pass
        else:
            # Not running under Streamlit, launch it
            subprocess.run([sys.executable, "-m", "streamlit", "run", __file__])
    except ImportError:
        # Streamlit not available or older version, try to launch anyway
        subprocess.run([sys.executable, "-m", "streamlit", "run", __file__])
