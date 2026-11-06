"""The turn cap on what a session evaluation loads, and its identity in the config
fingerprint.
"""

from __future__ import annotations

import hashlib
import json

SESSION_POLICY_VERSION = "3"
MAX_SESSION_EVAL_TURNS = 1_000


def session_policy_fingerprint() -> str:
    """Identity of the session policy in force, for the config fingerprint.

    Bumping ``SESSION_POLICY_VERSION`` changes the annotation identifier, so results
    under the old and new policies never share one.
    """
    payload = {
        "policy_version": SESSION_POLICY_VERSION,
        "max_turns": MAX_SESSION_EVAL_TURNS,
    }
    serialized = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()
