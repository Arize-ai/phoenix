from __future__ import annotations

from dataclasses import dataclass


@dataclass
class ServerAgentDependencies:
    """Dependencies for the GraphQL server agent.

    Currently empty: the server agent's only tool closes over the per-request
    schema/context/identity at construction time, so nothing needs to flow through
    ``RunContext.deps``. This type remains the extensible home for any genuinely
    per-run server-agent state added later.
    """
