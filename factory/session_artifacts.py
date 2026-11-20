import json
from typing import Any

import anthropic


def record_completion_artifacts(*, client: Any, session: Any, completed_at: str) -> Any:
    try:
        latest = next(
            iter(
                client.beta.sessions.events.list(
                    session.id,
                    types=["agent.message", "user.message"],
                    order="desc",
                    limit=1,
                    created_at_lte=completed_at,
                )
            ),
            None,
        )
        if latest is None or latest.type != "agent.message":
            raise ValueError("Missing artifact report")
        text = "\n".join(block.text for block in latest.content if block.type == "text").strip()
        line = text.rsplit("\n", 1)[-1]
        if not line.startswith("FACTORY_ARTIFACTS="):
            raise ValueError("Missing artifact report")
        report = json.loads(line.removeprefix("FACTORY_ARTIFACTS="))
        if not isinstance(report, dict) or set(report) != {"issues", "prs"}:
            raise ValueError("Artifact report requires issues and prs")
        metadata: dict[str, str] = {}
        for field in ("issues", "prs"):
            existing = json.loads(session.metadata.get(field, "[]"))
            additions = report[field]
            if not isinstance(existing, list) or not isinstance(additions, list):
                raise ValueError("Artifact references must be arrays")
            if any(type(number) is not int or number <= 0 for number in existing + additions):
                raise ValueError("Artifact references must be positive integers")
            encoded = json.dumps(sorted(set(existing + additions)), separators=(",", ":"))
            if len(encoded) > 512:
                raise ValueError("Artifact metadata exceeds the 512-character value limit")
            if encoded != session.metadata.get(field):
                metadata[field] = encoded
        if metadata:
            return client.beta.sessions.update(session.id, metadata=metadata)
    except (ValueError, TypeError) as error:
        print(f"::warning::Factory completion artifacts were not recorded: {error}")
    except anthropic.APIError:
        print("::warning::Factory completion artifact request failed; metadata may be unchanged")
    return session
