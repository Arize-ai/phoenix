"""Discovery of skills in directories Phoenix does not control.

Scans a source root, validates each candidate, and builds ``Skill`` objects. Every
failure is isolated to the skill that caused it: a malformed directory yields a
diagnostic and is skipped, so one bad skill cannot take down startup or a chat turn.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

from phoenix.server.agents.capabilities.skills import Skill, parse_skill_md
from phoenix.server.agents.skills.external.diagnostics import (
    SkillDiagnostic,
    SkillDiagnosticCode,
)
from phoenix.server.agents.skills.external.validation import (
    BODY_MAX_BYTES,
    DESCRIPTION_MAX_CHARS,
    UNSUPPORTED_FIELDS,
    describe_invalid_name,
    is_safe_segment,
    is_valid_skill_name,
    resolve_within,
)

SKILL_FILE_NAME = "SKILL.md"


@dataclass
class DiscoveryResult:
    """Skills found in a source, plus everything that went wrong finding them.

    Attributes:
        skills: Successfully loaded skills, in directory-name order.
        diagnostics: Non-fatal findings. Never empty-checked for correctness — a source
            can produce both skills and diagnostics.
    """

    skills: list[Skill] = field(default_factory=list)
    diagnostics: list[SkillDiagnostic] = field(default_factory=list)


def discover_skills_in_directory(root: Path, *, source: str) -> DiscoveryResult:
    """Discover skills under ``root``.

    A root containing ``SKILL.md`` directly is itself one skill. Otherwise each child
    directory holding a ``SKILL.md`` is one skill; children without one are ignored
    silently, so a source may hold unrelated files.

    A missing root is a diagnostic, not an error — an operator pointing at a directory
    that a deployment has not mounted yet should not prevent the server from starting.

    Args:
        root: Directory to scan.
        source: Configured source string, for diagnostics.

    Returns:
        The skills found and any diagnostics raised.
    """
    result = DiscoveryResult()
    if not root.is_dir():
        result.diagnostics.append(
            SkillDiagnostic(
                code=SkillDiagnosticCode.SOURCE_MISSING,
                message=f"skills source directory {root} does not exist; skipping",
                source=source,
            )
        )
        return result

    if (root / SKILL_FILE_NAME).is_file():
        # The root directory is the source itself — for a remote it is the cache
        # directory, named after the repo — so its name says nothing about the
        # skill and must not be matched against it.
        _load_into(result, root, root=root, source=source, match_directory_name=False)
        return result

    try:
        children = sorted(entry for entry in root.iterdir() if entry.is_dir())
    except OSError as error:
        result.diagnostics.append(
            SkillDiagnostic(
                code=SkillDiagnosticCode.UNREADABLE,
                message=f"could not list {root}: {error}",
                source=source,
            )
        )
        return result

    for child in children:
        if (child / SKILL_FILE_NAME).is_file():
            _load_into(result, child, root=root, source=source)
    return result


def _load_into(
    result: DiscoveryResult,
    directory: Path,
    *,
    root: Path,
    source: str,
    match_directory_name: bool = True,
) -> None:
    """Load the skill in ``directory``, appending a skill or a diagnostic to ``result``.

    ``root`` is the containment boundary: a symlink may point elsewhere inside the
    source tree, but not outside it.
    """
    directory_name = directory.name

    if not is_safe_segment(directory_name):
        result.diagnostics.append(
            SkillDiagnostic(
                code=SkillDiagnosticCode.UNSAFE_PATH,
                message=f"skill directory name {directory_name!r} is not a safe path segment",
                source=source,
            )
        )
        return

    skill_file = resolve_within(root, directory / SKILL_FILE_NAME)
    if skill_file is None:
        result.diagnostics.append(
            SkillDiagnostic(
                code=SkillDiagnosticCode.UNSAFE_PATH,
                message=(
                    f"{SKILL_FILE_NAME} in {directory_name!r} resolves outside the source "
                    "root, which a symlink escape would do; skipping"
                ),
                source=source,
                skill_name=directory_name,
            )
        )
        return

    try:
        body_bytes = skill_file.stat().st_size
    except OSError as error:
        result.diagnostics.append(
            SkillDiagnostic(
                code=SkillDiagnosticCode.UNREADABLE,
                message=f"could not stat {skill_file}: {error}",
                source=source,
                skill_name=directory_name,
            )
        )
        return

    if body_bytes > BODY_MAX_BYTES:
        # The model reads this file with `cat`, so nothing downstream truncates it.
        result.diagnostics.append(
            SkillDiagnostic(
                code=SkillDiagnosticCode.TOO_LARGE,
                message=(
                    f"{SKILL_FILE_NAME} is {body_bytes} bytes, over the "
                    f"{BODY_MAX_BYTES} byte maximum; skipping"
                ),
                source=source,
                skill_name=directory_name,
            )
        )
        return

    # Frontmatter is parsed here, ahead of `Skill.from_file`, purely to tell a malformed
    # document apart from a well-formed one with a bad name. Classifying from the
    # exception message instead would misfile a YAML error that happens to mention a
    # field name.
    try:
        raw = skill_file.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError) as error:
        result.diagnostics.append(
            SkillDiagnostic(
                code=SkillDiagnosticCode.UNREADABLE,
                message=f"could not read {skill_file}: {error}",
                source=source,
                skill_name=directory_name,
            )
        )
        return

    try:
        frontmatter, _ = parse_skill_md(raw)
    except ValueError as error:
        result.diagnostics.append(
            SkillDiagnostic(
                code=SkillDiagnosticCode.MALFORMED,
                message=str(error),
                source=source,
                skill_name=directory_name,
            )
        )
        return

    name = frontmatter.get("name")
    if not isinstance(name, str) or not is_valid_skill_name(name):
        result.diagnostics.append(
            SkillDiagnostic(
                code=SkillDiagnosticCode.INVALID_NAME,
                message=describe_invalid_name(name if isinstance(name, str) else ""),
                source=source,
                skill_name=directory_name,
            )
        )
        return

    try:
        skill = Skill.from_file(skill_file)
    except (OSError, UnicodeDecodeError, ValueError) as error:
        result.diagnostics.append(
            SkillDiagnostic(
                code=SkillDiagnosticCode.MALFORMED,
                message=f"could not load {skill_file}: {error}",
                source=source,
                skill_name=directory_name,
            )
        )
        return

    if match_directory_name and skill.name != directory_name:
        # The name becomes the mount directory, so a mismatch would put the skill at a
        # path its own resources' relative links do not resolve against.
        result.diagnostics.append(
            SkillDiagnostic(
                code=SkillDiagnosticCode.NAME_MISMATCH,
                message=(
                    f"skill name {skill.name!r} does not match its directory "
                    f"{directory_name!r}; skipping"
                ),
                source=source,
                skill_name=skill.name,
            )
        )
        return

    description = skill.description.strip()
    if not description:
        result.diagnostics.append(
            SkillDiagnostic(
                code=SkillDiagnosticCode.INVALID_DESCRIPTION,
                message="description is empty; the model would have nothing to trigger on",
                source=source,
                skill_name=skill.name,
            )
        )
        return
    if len(description) > DESCRIPTION_MAX_CHARS:
        result.diagnostics.append(
            SkillDiagnostic(
                code=SkillDiagnosticCode.INVALID_DESCRIPTION,
                message=(
                    f"description is {len(description)} characters, over the "
                    f"{DESCRIPTION_MAX_CHARS} maximum; skipping"
                ),
                source=source,
                skill_name=skill.name,
            )
        )
        return

    for unsupported in UNSUPPORTED_FIELDS:
        if skill.metadata and unsupported in skill.metadata:
            result.diagnostics.append(
                SkillDiagnostic(
                    code=SkillDiagnosticCode.IGNORED_FIELD,
                    message=(
                        f"frontmatter field {unsupported!r} is not honored by Phoenix and "
                        "has no effect"
                    ),
                    source=source,
                    skill_name=skill.name,
                )
            )

    result.skills.append(skill)
