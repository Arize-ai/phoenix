import re
from typing import Any, Optional

import anthropic


def find_head_problem(*, pr: dict[str, Any], expected_sha: str) -> Optional[str]:
    if expected_sha and not re.fullmatch(r"[0-9a-f]{40}", expected_sha):
        return "the requested commit is not a full commit SHA"
    if expected_sha and pr["headRefOid"] != expected_sha:
        return "the head changed since this run was requested; reapply the label to admit it"
    return None


def stop_on_checkout_error(*, client: anthropic.Anthropic, session_id: str) -> None:
    for event in client.beta.sessions.events.list(session_id, type="session.error"):
        if event.error.type in ("repository_checkout_error", "repository_clone_error"):
            client.beta.sessions.events.send(session_id, events=[{"type": "user.interrupt"}])
            raise RuntimeError("The pinned repository could not be mounted; session interrupted")
