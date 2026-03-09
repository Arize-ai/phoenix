"""
[Experimental] Retrieve a conversation view of a session.

This example shows how to use `client.sessions.get_session_conversation()`
to fetch the ordered input/output turns for a session, along with the full
root span for each turn.

NOTE: This API is experimental and may change in future releases.

Prerequisites:
    - A running Phoenix server (default: http://localhost:6006)
    - At least one project with session data (traces grouped by session_id)

Usage:
    # Set the session ID and project name below, then run:
    uv run --project packages/phoenix-client python \
        packages/phoenix-client/examples/sessions/get_session_conversation_example.py
"""

from phoenix.client import Client

# -- Configuration (update these to match your data) --------------------------
SESSION_ID = "my-session"
PROJECT_NAME = "default"
# -----------------------------------------------------------------------------

client = Client()

# 1. List available sessions for the project
sessions = client.sessions.list(project_name=PROJECT_NAME, limit=5)
print(f"Found {len(sessions)} session(s) in project '{PROJECT_NAME}':\n")
for s in sessions:
    print(f"  session_id={s['session_id']}  traces={len(s['traces'])}")

if not sessions:
    print("\nNo sessions found. Populate your project with session traces first.")
    raise SystemExit(1)

# Use the first session if the configured one isn't found
session_ids = [s["session_id"] for s in sessions]
target = SESSION_ID if SESSION_ID in session_ids else sessions[0]["session_id"]
print(f"\nUsing session: {target}\n")

# 2. [Experimental] Get the conversation turns
turns = client.sessions.get_session_conversation(session_id=target)

print(f"Conversation ({len(turns)} turn(s)):")
print("-" * 60)
for i, turn in enumerate(turns, 1):
    user_input = turn.get("input", {}).get("value", "<no input>")
    assistant_output = turn.get("output", {}).get("value", "<no output>")
    print(f"\n--- Turn {i} (trace_id={turn['trace_id']}) ---")
    print(f"  Input:  {user_input}")
    print(f"  Output: {assistant_output}")
print()
