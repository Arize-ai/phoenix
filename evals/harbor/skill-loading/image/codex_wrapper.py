#!/usr/bin/env python3
"""Runs Codex and stops ``codex exec --json`` at its first action that isn't a skill load.

The image installs this file as ``codex`` and the real CLI as ``codex-real``. The wrapper
acts only when ``SKILL_LOADING_STOP=1``. It passes every event through, and when Codex starts
any item other than reasoning or a message, such as a shell command, it checks the item with
:func:`stop_after_skill_load.is_skill_load` and stops Codex if it isn't a skill load.
Harbor then copies the session and builds the trajectory as it would after a normal exit.
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
for line in codex.stdout:
    sys.stdout.write(line)
    sys.stdout.flush()
    try:
        event = json.loads(line)
    except ValueError:
        continue
    item = event.get("item") or {}
    if event.get("type") != "item.started" or item.get("type") in _NOT_ACTIONS:
        continue
    if not is_skill_load(str(item.get("tool") or item.get("type")), json.dumps(item)):
        os.killpg(codex.pid, signal.SIGTERM)
        break
try:
    codex.wait(timeout=5)
except subprocess.TimeoutExpired:
    os.killpg(codex.pid, signal.SIGKILL)
    codex.wait()
