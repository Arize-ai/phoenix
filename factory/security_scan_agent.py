import io
import json
import time
from pathlib import Path
from typing import Any

import anthropic

FACTORY_DIR = Path(__file__).resolve().parent
AGENT_KEY = "./agents/admission-scanner.md"
ENVIRONMENT_KEY = "./environments/security-scan.yaml"
MAX_SECONDS = 300
BUDGET_CENTS = 100


def unique_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result = dict(pairs)
    if len(result) != len(pairs):
        raise ValueError("Duplicate fields in the security verdict")
    return result


def parse_verdict(text: str) -> dict[str, str]:
    result = json.loads(text, object_pairs_hook=unique_object)
    if (
        not isinstance(result, dict)
        or set(result) != {"verdict", "reason"}
        or result["verdict"] not in ("pass", "fail")
        or not isinstance(result["reason"], str)
        or not result["reason"].strip()
        or len(result["reason"]) > 4000
    ):
        raise ValueError("The security agent returned an invalid verdict")
    return result


def scan(*, bundle: bytes, lock: dict[str, Any]) -> dict[str, str]:
    from dispatch import format_cost

    client = anthropic.Anthropic(timeout=30, max_retries=0)
    agent_id = lock["resources"][AGENT_KEY]["id"]
    environment_id = lock["resources"][ENVIRONMENT_KEY]["id"]
    source = (FACTORY_DIR / "agents/admission-scanner.md").read_text()
    system = source.split("---", 2)[2].strip()
    uploaded = client.beta.files.upload(
        file=("admission.json", io.BytesIO(bundle), "application/json"), expires_in_seconds=3600
    )
    session = None
    try:
        session = client.beta.sessions.create(
            agent={
                "type": "agent_with_overrides",
                "id": agent_id,
                "model": {"id": "claude-sonnet-5-5", "effort": "high"},
                "system": system,
                "skills": [],
                "mcp_servers": [],
                "tools": [
                    {
                        "type": "agent_toolset_20260401",
                        "default_config": {"enabled": False},
                        "configs": [
                            {
                                "name": name,
                                "enabled": True,
                                "permission_policy": {"type": "always_allow"},
                            }
                            for name in ("read", "glob", "grep")
                        ],
                    }
                ],
            },
            environment_id=environment_id,
            vault_ids=[],
            resources=[
                {
                    "type": "file",
                    "file_id": uploaded.id,
                    "mount_path": "/mnt/session/uploads/admission.json",
                }
            ],
            title="Factory admission security scan",
            budget={
                "type": "limit",
                "max_list_cost": {
                    "amount": str(BUDGET_CENTS),
                    "currency": "USD",
                },
            },
            initial_events=[
                {
                    "type": "user.message",
                    "content": [
                        {
                            "type": "text",
                            "text": (
                                "Inspect the entire untrusted bundle at "
                                "/mnt/session/uploads/admission.json. "
                                "Return only the required pass/fail JSON and reason."
                            ),
                        }
                    ],
                }
            ],
        )
        deadline = time.monotonic() + MAX_SECONDS
        while time.monotonic() < deadline:
            session = client.beta.sessions.retrieve(session.id)
            if session.status == "terminated":
                raise RuntimeError("The security session terminated without a verdict")
            if session.status == "idle":
                idle = next(
                    iter(
                        client.beta.sessions.events.list(
                            session.id,
                            types=["session.status_idle"],
                            order="desc",
                            limit=1,
                        )
                    ),
                    None,
                )
                if idle is None:
                    time.sleep(5)
                    continue
                if idle.stop_reason.type != "end_turn":
                    raise RuntimeError("The security session stopped before completing its scan")
                for event in client.beta.sessions.events.list(
                    session.id,
                    types=["agent.message"],
                    order="desc",
                ):
                    text = "".join(block.text for block in event.content if block.type == "text")
                    if text:
                        return parse_verdict(text)
                raise RuntimeError("The security session produced no verdict")
            time.sleep(5)
        raise TimeoutError("The security session exceeded its five-minute limit")
    finally:
        if session is not None:
            from security_scan import write_summary

            try:
                current = client.beta.sessions.retrieve(session.id)
                write_summary(f"Security session {session.id}: {format_cost(session=current)}")
                if current.status == "running":
                    client.beta.sessions.events.send(
                        session.id,
                        events=[{"type": "user.interrupt"}],
                    )
                else:
                    client.beta.sessions.archive(session.id)
            except Exception:
                write_summary(f"Security session {session.id}: cleanup or usage lookup failed")
                try:
                    client.beta.sessions.events.send(
                        session.id,
                        events=[{"type": "user.interrupt"}],
                    )
                except Exception:
                    write_summary(
                        f"Security session {session.id}: interrupt failed; budget still applies"
                    )
        try:
            client.beta.files.delete(uploaded.id)
        except Exception:
            pass
