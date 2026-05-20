from __future__ import annotations

from phoenix.server.agents.capabilities.skills.resource import SkillResource


def create_file_based_resource(
    name: str,
    uri: str,
    description: str | None = None,
) -> SkillResource:
    """Create a file-based resource.

    Args:
        name: Resource name (e.g., "FORMS.md", "data.json").
        uri: Path to the resource file.
        description: Optional resource description.

    Returns:
        SkillResource instance whose ``load()`` reads from the given URI.
    """
    return SkillResource(
        name=name,
        uri=uri,
        description=description,
    )
