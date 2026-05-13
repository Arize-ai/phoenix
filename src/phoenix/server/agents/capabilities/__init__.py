from __future__ import annotations

from pydantic_ai.capabilities import AbstractCapability

from phoenix.server.agents.capabilities.skills import build_skills_capability
from phoenix.server.agents.dependencies import ChatDependencies


def build_capabilities() -> list[AbstractCapability[ChatDependencies]]:
    """Return the pydantic-ai capabilities to attach to the PXI agent."""
    return [build_skills_capability()]


__all__ = [
    "build_capabilities",
]
