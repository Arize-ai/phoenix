"""Filesystem-based skill discovery and management.

This module provides [`SkillsDirectory`][pydantic_ai_skills.SkillsDirectory]
for discovering and loading skills from a filesystem directory.

Supports nested skill directories with configurable depth limits and provides
internal helper functions for skill validation, metadata parsing, and resource/script discovery.
"""

from __future__ import annotations

import os
import warnings
from pathlib import Path

from ._parsing import parse_skill_md, validate_skill_metadata
from .local import (
    CallableSkillScriptExecutor,
    LocalSkillScriptExecutor,
    create_file_based_resource,
    create_file_based_script,
)
from .types import Skill, SkillResource, SkillScript

_SUPPORTED_SCRIPT_EXTENSIONS = {".py", ".sh", ".bash", ".zsh", ".fish", ".ps1", ".bat", ".cmd"}
_WINDOWS_EXECUTABLE_EXTENSIONS = {".exe", ".bat", ".cmd", ".com", ".ps1"}
_IGNORED_SCRIPT_NAMES = {"__init__.py", "SKILL.md"}


def _is_script_candidate(script_file: Path) -> bool:
    """Check if a file should be treated as a script."""
    if script_file.name in _IGNORED_SCRIPT_NAMES or not script_file.is_file():
        return False

    suffix = script_file.suffix.lower()
    if suffix in _SUPPORTED_SCRIPT_EXTENSIONS:
        return True

    if os.name == "nt":
        return suffix in _WINDOWS_EXECUTABLE_EXTENSIONS

    try:
        return bool(script_file.stat().st_mode & 0o111)
    except OSError:
        return False


def _iter_script_directories(skill_folder: Path) -> list[Path]:
    """Return directories to scan for scripts."""
    scripts_dir = skill_folder / "scripts"
    if scripts_dir.is_dir():
        return [skill_folder, scripts_dir]
    return [skill_folder]


def _resolve_script_path(script_file: Path, skill_folder_resolved: Path) -> Path | None:
    """Resolve script path and reject symlink escapes."""
    resolved_path = script_file.resolve()
    try:
        resolved_path.relative_to(skill_folder_resolved)
    except ValueError:
        warnings.warn(
            f"Script '{script_file}' resolves outside skill directory "
            "(symlink escape detected). Skipping.",
            UserWarning,
            stacklevel=4,
        )
        return None
    return resolved_path


__all__ = ["SkillsDirectory", "discover_skills", "parse_skill_md", "validate_skill_metadata"]


def _discover_resources(skill_folder: Path) -> list[SkillResource]:
    """Discover resource files in a skill folder.

    Resources are text files other than SKILL.md in any subdirectory.
    Supported: .md, .json, .yaml, .yml, .csv, .xml, .txt

    Security validates that resolved paths remain within skill_folder
    after symlink resolution to prevent traversal attacks.

    Args:
        skill_folder: Path to the skill directory.

    Returns:
        List of discovered SkillResource objects.
    """
    resources: list[SkillResource] = []
    supported_extensions = [".md", ".json", ".yaml", ".yml", ".csv", ".xml", ".txt"]
    skill_folder_resolved = skill_folder.resolve()

    for extension in supported_extensions:
        for resource_file in skill_folder.rglob(f"*{extension}"):
            if resource_file.name.upper() != "SKILL.MD":
                resolved_path = resource_file.resolve()
                try:
                    resolved_path.relative_to(skill_folder_resolved)
                except ValueError:
                    warnings.warn(
                        f"Resource '{resource_file}' resolves outside skill directory "
                        "(symlink escape detected). Skipping.",
                        UserWarning,
                        stacklevel=2,
                    )
                    continue

                rel_path = resource_file.relative_to(skill_folder)
                name = rel_path.as_posix()
                resources.append(
                    create_file_based_resource(
                        name=name,
                        uri=str(resolved_path),
                    )
                )

    return resources


def _find_skill_files(root_dir: Path, max_depth: int | None) -> list[Path]:
    """Find SKILL.md files with depth-limited search using glob patterns.

    Args:
        root_dir: Root directory to search from.
        max_depth: Maximum depth to search. None for unlimited.

    Returns:
        List of paths to SKILL.md files.
    """
    if max_depth is None:
        return list(root_dir.glob("**/SKILL.md"))

    skill_files: list[Path] = []

    for depth in range(max_depth + 1):
        if depth == 0:
            pattern = "SKILL.md"
        else:
            pattern = "/".join(["*"] * depth) + "/SKILL.md"

        skill_files.extend(root_dir.glob(pattern))

    return skill_files


def _discover_scripts(
    skill_folder: Path,
    skill_name: str,
    executor: LocalSkillScriptExecutor | CallableSkillScriptExecutor,
) -> list[SkillScript]:
    """Discover executable scripts in a skill folder.

    Looks for script files and executables in the root and scripts/ subdirectory.
    Security validates that resolved paths remain within skill_folder
    after symlink resolution to prevent traversal attacks.

    Args:
        skill_folder: Path to the skill directory.
        skill_name: Name of the parent skill.
        executor: Executor for running file-based scripts.

    Returns:
        List of discovered SkillScript objects.
    """
    scripts: list[SkillScript] = []
    skill_folder_resolved = skill_folder.resolve()

    for directory in _iter_script_directories(skill_folder):
        for script_file in directory.iterdir():
            if not _is_script_candidate(script_file):
                continue

            resolved_path = _resolve_script_path(script_file, skill_folder_resolved)
            if resolved_path is None:
                continue

            scripts.append(
                create_file_based_script(
                    name=script_file.relative_to(skill_folder).as_posix(),
                    uri=str(resolved_path),
                    skill_name=skill_name,
                    executor=executor,
                )
            )

    return scripts


def discover_skills(
    path: str | Path,
    validate: bool = True,
    max_depth: int | None = 3,
    script_executor: LocalSkillScriptExecutor | CallableSkillScriptExecutor | None = None,
) -> list[Skill]:
    """Discover skills from a filesystem directory.

    Searches for SKILL.md files in the given directory and loads
    skill metadata and structure.

    Args:
        path: Directory path to search for skills.
        validate: Whether to validate skill structure (requires name and description).
        max_depth: Maximum depth to search for SKILL.md files. None for unlimited.
            Default is 3 levels deep to prevent performance issues with large trees.
        script_executor: Optional custom script executor for file-based scripts.

    Returns:
        List of discovered Skill objects.

    Raises:
        ValueError: If validation is enabled and a skill is invalid, or if a
            skill file fails to load due to malformed contents or I/O errors.
    """
    skills: list[Skill] = []
    dir_path = Path(path).expanduser().resolve()

    if not dir_path.exists():
        return skills

    if not dir_path.is_dir():
        return skills

    executor = script_executor or LocalSkillScriptExecutor()
    skill_files = _find_skill_files(dir_path, max_depth)
    for skill_file in skill_files:
        try:
            skill = Skill.from_file(skill_file, validate=validate, script_executor=executor)
            skills.append(skill)
        except ValueError as ve:
            if validate:
                raise
            else:
                warnings.warn(
                    f"Skipping invalid skill at {skill_file}: {ve}", UserWarning, stacklevel=2
                )
        except (OSError, KeyError) as e:
            raise ValueError(f"Failed to load skill from {skill_file}: {e}") from e

    return skills


class SkillsDirectory:
    """Skill source for a single filesystem directory.

    Discovers and loads skills from a local directory by finding SKILL.md files
    and automatically discovering associated resources and scripts.

    File-based scripts are executed using the configured script executor
    (LocalSkillScriptExecutor or CallableSkillScriptExecutor).
    """

    def __init__(
        self,
        *,
        path: str | Path,
        validate: bool = True,
        max_depth: int | None = 3,
        script_executor: LocalSkillScriptExecutor | CallableSkillScriptExecutor | None = None,
    ) -> None:
        """Initialize the skills directory source.

        Args:
            path: Directory path to search for skills.
            validate: Validate skill structure on discovery.
            max_depth: Maximum depth for skill discovery (None for unlimited).
            script_executor: Optional custom script executor for file-based scripts.
                Can be LocalSkillScriptExecutor or CallableSkillScriptExecutor.
                If None, uses LocalSkillScriptExecutor with default settings.

        Example:
            ```python
            # Discovery mode - single directory
            source = SkillsDirectory(path="./skills")

            # With custom executor
            from pydantic_ai.toolsets.skills import LocalSkillScriptExecutor

            executor = LocalSkillScriptExecutor(timeout=60)
            source = SkillsDirectory(path="./skills", script_executor=executor)

            # With callable executor
            from pydantic_ai.toolsets.skills import CallableSkillScriptExecutor

            async def my_executor(script, args=None, skill_uri=None):
                return f"Executed {script.name}"

            executor = CallableSkillScriptExecutor(func=my_executor)
            source = SkillsDirectory(path="./skills", script_executor=executor)
            ```
        """
        self._path = Path(path).expanduser().resolve()
        self._validate = validate
        self._max_depth = max_depth
        self._script_executor = script_executor or LocalSkillScriptExecutor()

        # Discover skills from directory
        self._skills: dict[str, Skill] = self.get_skills()

    def get_skills(self) -> dict[str, Skill]:
        """Get all skills from this source.

        Returns:
            Dictionary of skill URI to Skill object.
        """
        skills = discover_skills(
            path=self._path,
            validate=self._validate,
            max_depth=self._max_depth,
            script_executor=self._script_executor,
        )

        return {skill.uri: skill for skill in skills if skill.uri is not None}

    @property
    def skills(self) -> dict[str, Skill]:
        """Get the dictionary of loaded skills.

        Returns:
            Dictionary mapping skill URI to Skill objects.
        """
        return self._skills

    def load_skill(self, skill_uri: str) -> Skill:
        """Load full instructions for a skill.

        Args:
            skill_uri: URI of the skill to load (skill name for filesystem skills).

        Returns:
            Loaded Skill object.

        Raises:
            KeyError: If skill is not found.
        """
        skill = self._skills.get(skill_uri)

        if skill is None:
            raise KeyError(f"Skill '{skill_uri}' not found in {self._path.as_posix()}.")

        return skill
