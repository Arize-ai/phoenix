"""Policy governing scheduled evaluation work: scheduling delays and the turn cap on
what a session evaluation loads.
"""

from __future__ import annotations

import hashlib
import json

# What to do about an over-limit sandbox payload. Shared with the preview
# mutation so a preview run under the online limits reports the rejection in the
# same words the scheduled evaluation would.
ONLINE_SANDBOX_PAYLOAD_LIMIT_REMEDIATION = (
    "Narrow the slot with a path mapping, reduce the evaluator source, or raise the "
    "limit with PHOENIX_ONLINE_EVAL_MAX_SANDBOX_PAYLOAD_BYTES."
)

SESSION_POLICY_VERSION = "3"
MAX_SESSION_EVAL_TURNS = 1_000


def session_policy_fingerprint() -> str:
    """Identity of the session policy in force, for the config fingerprint.

    Bumping ``SESSION_POLICY_VERSION`` is what expires pending session work, so
    old and new results never share an annotation identifier.
    """
    payload = {
        "policy_version": SESSION_POLICY_VERSION,
        "max_turns": MAX_SESSION_EVAL_TURNS,
    }
    serialized = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()
