"""Where an LLM evaluator's pinned prompt version comes from.

An LLM evaluator runs the prompt version its tag pins. Callers name that version by a
source: content for a new evaluator-owned prompt, an existing version to start from, or,
on update, edits to the evaluator's current prompt. Content identical to its starting
version pins that version; content that differs is appended to the starting version's
prompt and pinned.
"""

from dataclasses import dataclass
from typing import Optional, Union

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server.api.exceptions import NotFound
from phoenix.server.api.types.node import from_global_id_with_expected_type


@dataclass(frozen=True)
class NewPrompt:
    """Store the content as the first version of a new evaluator-owned prompt."""

    content: models.PromptVersion


@dataclass(frozen=True)
class FromPromptVersion:
    """Start from an existing version; content that differs is appended to its prompt.
    Without content, the version is pinned as it is."""

    prompt_version_id: GlobalID
    content: Optional[models.PromptVersion] = None


@dataclass(frozen=True)
class EditCurrentPrompt:
    """Start from the version the evaluator's tag pins; differing content is appended."""

    content: models.PromptVersion


CreatePromptSource = Union[NewPrompt, FromPromptVersion]
UpdatePromptSource = Union[EditCurrentPrompt, FromPromptVersion]


async def get_prompt_version(
    session: AsyncSession, prompt_version_id: GlobalID
) -> models.PromptVersion:
    version = await session.get(
        models.PromptVersion,
        from_global_id_with_expected_type(prompt_version_id, "PromptVersion"),
    )
    if version is None:
        raise NotFound(f"Prompt version not found: {prompt_version_id}")
    return version


async def pin_prompt_version(
    session: AsyncSession,
    *,
    base: Optional[models.PromptVersion],
    content: Optional[models.PromptVersion],
    prompt_id: int,
) -> models.PromptVersion:
    """Return base when there is no content or the content is identical to it; otherwise
    append the content to the prompt and return it."""
    if content is None:
        if base is None:
            raise NotFound("Prompt version not found")
        return base
    if base is not None and base.has_identical_content(content):
        return base
    content.prompt_id = prompt_id
    session.add(content)
    await session.flush()
    return content


async def resolve_evaluator_prompt_version(
    session: AsyncSession, evaluator: models.LLMEvaluator
) -> Optional[models.PromptVersion]:
    """The version an evaluator runs: the one its tag pins, or, for an evaluator without a
    tag, its prompt's newest version."""
    version: Optional[models.PromptVersion]
    if evaluator.prompt_version_tag_id is not None:
        version = await session.scalar(
            select(models.PromptVersion)
            .join(
                models.PromptVersionTag,
                models.PromptVersionTag.prompt_version_id == models.PromptVersion.id,
            )
            .where(models.PromptVersionTag.id == evaluator.prompt_version_tag_id)
        )
    else:
        version = await session.scalar(
            select(models.PromptVersion)
            .where(models.PromptVersion.prompt_id == evaluator.prompt_id)
            .order_by(models.PromptVersion.id.desc())
            .limit(1)
        )
    return version
