#!/usr/bin/env python3
"""Runs Codex and stops ``codex exec --json`` once it does something besides loading skills.

The image installs this file as ``codex`` and the real CLI as ``codex-real``. The wrapper
acts only when ``SKILL_LOADING_STOP=1``. It passes every event through and checks each action
Codex starts, such as a shell command, with :func:`stop_after_skill_load.is_skill_load`.

Codex often starts several actions from one model response, for example a ``SKILL.md`` read
next to a file listing, and writes them to its session only after they finish. So after an
action that isn't a skill load, the wrapper lets the open actions finish and stops Codex when
its next model response begins. Harbor then copies the session and builds the trajectory as
it would after a normal exit.
"""

import json
import os
import signal
import subprocess
import sys

sys.path.insert(0, "/opt/skill-loading")
from stop_after_skill_load import is_skill_load  # noqa: E402

REAL_CODEX = "/usr/local/bin/codex-real"
_NOT_ACTIONS = {"reasoning", "agent_message", "error", "todo_list"}

args = sys.argv[1:]
if os.environ.get("SKILL_LOADING_STOP") != "1" or args[:1] != ["exec"] or "--json" not in args:
    os.execv(REAL_CODEX, [REAL_CODEX, *args])

# Codex's Node launcher starts the native binary as a child, so the wrapper signals the
# whole process group.
codex = subprocess.Popen(
    [REAL_CODEX, *args], stdout=subprocess.PIPE, text=True, start_new_session=True
)
assert codex.stdout is not None
open_actions: set[str] = set()
stop = False
for line in codex.stdout:
    sys.stdout.write(line)
    sys.stdout.flush()
    try:
        event = json.loads(line)
    except ValueError:
        continue
    item = event.get("item") or {}
    is_action = item.get("type") not in _NOT_ACTIONS
    if event.get("type") == "item.started" and is_action:
        loads_skill = is_skill_load(str(item.get("tool") or item.get("type")), json.dumps(item))
        if stop and not open_actions and not loads_skill:
            break  # The next model response started another batch.
        open_actions.add(str(item.get("id")))
        stop = stop or not loads_skill
    elif event.get("type") == "item.completed":
        open_actions.discard(str(item.get("id")))
        if stop and not open_actions and not is_action:
            break  # The next model response started with a message.
if codex.poll() is None:
    os.killpg(codex.pid, signal.SIGTERM)
    try:
        codex.wait(timeout=5)
    except subprocess.TimeoutExpired:
        os.killpg(codex.pid, signal.SIGKILL)
        codex.wait()
