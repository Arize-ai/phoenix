"""Loading external skills from every configured source.

This is the entry point the server calls once at startup. It resolves sources, fetches
remote ones, discovers skills, and resolves name collisions against the first-party
catalog. It never raises for a bad source or an unreachable network.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Sequence

from phoenix.server.agents.capabilities.skills import Skill
from phoenix.server.agents.skills.external.diagnostics import (
    SkillDiagnostic,
    SkillDiagnosticCode,
    log_diagnostics,
)
from phoenix.server.agents.skills.external.discovery import discover_skills_in_directory
from phoenix.server.agents.skills.external.fetch import (
    DEFAULT_FETCH_TIMEOUT_SECONDS,
    fetch_remote_source,
)
from phoenix.server.agents.skills.external.sources import (
    LocalSkillSource,
    RemoteSkillSource,
    SkillSource,
    SkillSourceError,
    parse_skill_sources,
)
from phoenix.server.agents.skills.external.validation import resolve_within


@dataclass
class ExternalSkills:
    """Everything loaded from ``PHOENIX_AGENTS_SKILLS_SOURCES``.

    Attributes:
        skills: Loaded skills, collisions already resolved.
        diagnostics: Non-fatal findings, already logged.
    """

    skills: list[Skill] = field(default_factory=list)
    diagnostics: list[SkillDiagnostic] = field(default_factory=list)

    @property
    def names(self) -> set[str]:
        return {skill.name for skill in self.skills}


def load_external_skills(
    *,
    sources_setting: str | None,
    cache_dir: Path,
    reserved_names: Sequence[str] = (),
    fetch_timeout_seconds: float = DEFAULT_FETCH_TIMEOUT_SECONDS,
) -> ExternalSkills:
    """Load every skill from the configured sources.

    Args:
        sources_setting: Raw ``PHOENIX_AGENTS_SKILLS_SOURCES`` value. Unset yields
            nothing, which is exactly today's behavior.
        cache_dir: Where remote sources are cached.
        reserved_names: First-party skill names. An external skill claiming one of these
            is skipped — first-party wins — because two mounts cannot share a directory.
        fetch_timeout_seconds: Per-request timeout for remote sources.

    Returns:
        The loaded skills and any diagnostics. Diagnostics are logged before returning.
    """
    result = ExternalSkills()
    try:
        sources = parse_skill_sources(sources_setting)
    except SkillSourceError as error:
        result.diagnostics.append(
            SkillDiagnostic(code=SkillDiagnosticCode.SOURCE_MISSING, message=str(error))
        )
        log_diagnostics(result.diagnostics)
        return result

    claimed = set(reserved_names)
    for source in sources:
        root, fetch_diagnostics = _materialize(
            source, cache_dir=cache_dir, timeout_seconds=fetch_timeout_seconds
        )
        result.diagnostics.extend(fetch_diagnostics)
        if root is None:
            continue

        found = discover_skills_in_directory(root, source=source.raw)
        result.diagnostics.extend(found.diagnostics)
        for skill in found.skills:
            if skill.name in claimed:
                result.diagnostics.append(
                    SkillDiagnostic(
                        code=SkillDiagnosticCode.NAME_COLLISION,
                        message=(
                            f"skill {skill.name!r} is already provided by a higher-priority "
                            "source; skipping the shadowed copy"
                        ),
                        source=source.raw,
                        skill_name=skill.name,
                    )
                )
                continue
            claimed.add(skill.name)
            result.skills.append(skill)

    log_diagnostics(result.diagnostics)
    return result


def _materialize(
    source: SkillSource, *, cache_dir: Path, timeout_seconds: float
) -> tuple[Path | None, list[SkillDiagnostic]]:
    """Return the local directory for ``source``, fetching it first if remote."""
    if isinstance(source, LocalSkillSource):
        return source.path, []
    if isinstance(source, RemoteSkillSource):
        fetched, diagnostics = fetch_remote_source(
            source, cache_dir=cache_dir, timeout_seconds=timeout_seconds
        )
        if fetched is None:
            return None, diagnostics
        if source.subdirectory is None:
            return fetched.path, diagnostics
        # The subdirectory comes from configuration rather than the archive, but it is
        # still joined onto a path, so confirm it lands inside what was fetched.
        scoped = resolve_within(fetched.path, fetched.path / source.subdirectory)
        if scoped is None or not scoped.is_dir():
            diagnostics.append(
                SkillDiagnostic(
                    code=SkillDiagnosticCode.SOURCE_MISSING,
                    message=(
                        f"subdirectory {source.subdirectory!r} does not exist in "
                        f"{source.slug}; skipping"
                    ),
                    source=source.raw,
                )
            )
            return None, diagnostics
        return scoped, diagnostics
    return None, []
