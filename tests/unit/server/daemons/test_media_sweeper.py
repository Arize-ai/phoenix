from __future__ import annotations

import hashlib
from datetime import datetime, timedelta, timezone
from typing import Optional

import pytest
from sqlalchemy import select

from phoenix.db import models
from phoenix.db.types.identifier import Identifier
from phoenix.db.types.media import MediaContent, hosted_media_url
from phoenix.db.types.model_provider import ModelProvider
from phoenix.db.types.prompts import (
    ImageContentPart,
    PromptChatTemplate,
    PromptMessage,
    PromptOpenAIInvocationParameters,
    PromptOpenAIInvocationParametersContent,
    PromptTemplateFormat,
    PromptTemplateType,
    TextContentPart,
)
from phoenix.server.daemons.media_sweeper import MediaSweeper, referenced_digests
from phoenix.server.types import DbSessionFactory


def _digest(seed: str) -> str:
    return hashlib.sha256(seed.encode()).hexdigest()


async def _store_media(
    db: DbSessionFactory,
    sha256: str,
    *,
    age: timedelta = timedelta(days=7),
) -> None:
    async with db() as session:
        session.add(
            models.MediaFile(
                sha256=sha256,
                media_type="image/png",
                size_bytes=3,
                content=b"png",
                created_at=datetime.now(timezone.utc) - age,
            )
        )


async def _store_prompt_with_image(
    db: DbSessionFactory,
    name: str,
    image_url: Optional[str],
) -> None:
    content: list[TextContentPart | ImageContentPart] = [
        TextContentPart(type="text", text="describe this")
    ]
    if image_url is not None:
        content.append(
            ImageContentPart(
                type="image",
                image=MediaContent(url=image_url, media_type="image/png"),
            )
        )
    async with db() as session:
        prompt = models.Prompt(name=Identifier(root=name), metadata_={})
        session.add(prompt)
        await session.flush()
        session.add(
            models.PromptVersion(
                prompt_id=prompt.id,
                template_type=PromptTemplateType.CHAT,
                template_format=PromptTemplateFormat.MUSTACHE,
                template=PromptChatTemplate(
                    type="chat",
                    messages=[PromptMessage(role="user", content=content)],
                ),
                invocation_parameters=PromptOpenAIInvocationParameters(
                    type="openai",
                    openai=PromptOpenAIInvocationParametersContent(),
                ),
                model_provider=ModelProvider.OPENAI,
                model_name="gpt-4o",
                metadata_={},
            )
        )


async def _stored_digests(db: DbSessionFactory) -> set[str]:
    async with db() as session:
        return set((await session.scalars(select(models.MediaFile.sha256))).all())


class TestReferencedDigests:
    def test_collects_hosted_references(self) -> None:
        digest = _digest("a")
        template = PromptChatTemplate(
            type="chat",
            messages=[
                PromptMessage(
                    role="user",
                    content=[
                        TextContentPart(type="text", text="hi"),
                        ImageContentPart(
                            type="image",
                            image=MediaContent(
                                url=hosted_media_url(digest), media_type="image/png"
                            ),
                        ),
                    ],
                )
            ],
        )
        assert referenced_digests([template]) == {digest}

    def test_ignores_inline_media(self) -> None:
        template = PromptChatTemplate(
            type="chat",
            messages=[
                PromptMessage(
                    role="user",
                    content=[
                        ImageContentPart(
                            type="image",
                            image=MediaContent(
                                url="data:image/png;base64,aGk=", media_type="image/png"
                            ),
                        )
                    ],
                )
            ],
        )
        assert referenced_digests([template]) == set()

    def test_handles_text_only_and_string_content(self) -> None:
        templates = [
            PromptChatTemplate(
                type="chat",
                messages=[
                    PromptMessage(role="user", content=[TextContentPart(type="text", text="hi")]),
                    PromptMessage(role="system", content="you are helpful"),
                ],
            )
        ]
        assert referenced_digests(templates) == set()


class TestMediaSweeper:
    async def test_deletes_unreferenced_media(self, db: DbSessionFactory) -> None:
        orphan = _digest("orphan")
        await _store_media(db, orphan)

        deleted = await MediaSweeper(db)._delete_orphaned_media()

        assert deleted == 1
        assert await _stored_digests(db) == set()

    async def test_keeps_referenced_media(self, db: DbSessionFactory) -> None:
        referenced = _digest("referenced")
        await _store_media(db, referenced)
        await _store_prompt_with_image(db, "keeper", hosted_media_url(referenced))

        deleted = await MediaSweeper(db)._delete_orphaned_media()

        assert deleted == 0
        assert await _stored_digests(db) == {referenced}

    async def test_keeps_media_inside_the_grace_period(self, db: DbSessionFactory) -> None:
        """The playground uploads before the prompt is saved, so fresh media is safe."""
        fresh = _digest("fresh")
        await _store_media(db, fresh, age=timedelta(minutes=5))

        deleted = await MediaSweeper(db)._delete_orphaned_media()

        assert deleted == 0
        assert await _stored_digests(db) == {fresh}

    async def test_respects_a_configured_grace_period(
        self,
        db: DbSessionFactory,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        aged = _digest("aged")
        await _store_media(db, aged, age=timedelta(hours=48))
        monkeypatch.setenv("PHOENIX_MEDIA_ORPHAN_GRACE_PERIOD_HOURS", "72")

        assert await MediaSweeper(db)._delete_orphaned_media() == 0
        assert await _stored_digests(db) == {aged}

        monkeypatch.setenv("PHOENIX_MEDIA_ORPHAN_GRACE_PERIOD_HOURS", "24")

        assert await MediaSweeper(db)._delete_orphaned_media() == 1
        assert await _stored_digests(db) == set()

    async def test_sweeps_only_the_unreferenced_rows(self, db: DbSessionFactory) -> None:
        keep, drop = _digest("keep"), _digest("drop")
        await _store_media(db, keep)
        await _store_media(db, drop)
        await _store_prompt_with_image(db, "keeper", hosted_media_url(keep))

        deleted = await MediaSweeper(db)._delete_orphaned_media()

        assert deleted == 1
        assert await _stored_digests(db) == {keep}

    async def test_deletes_media_once_its_last_prompt_is_gone(
        self,
        db: DbSessionFactory,
    ) -> None:
        digest = _digest("abandoned")
        await _store_media(db, digest)
        await _store_prompt_with_image(db, "doomed", hosted_media_url(digest))

        assert await MediaSweeper(db)._delete_orphaned_media() == 0

        async with db() as session:
            prompt = await session.scalar(select(models.Prompt))
            assert prompt is not None
            await session.delete(prompt)

        assert await MediaSweeper(db)._delete_orphaned_media() == 1
        assert await _stored_digests(db) == set()

    async def test_is_a_noop_with_no_media(self, db: DbSessionFactory) -> None:
        assert await MediaSweeper(db)._delete_orphaned_media() == 0

    async def test_ignores_prompts_that_carry_no_media(self, db: DbSessionFactory) -> None:
        orphan = _digest("orphan")
        await _store_media(db, orphan)
        await _store_prompt_with_image(db, "text-only", None)

        assert await MediaSweeper(db)._delete_orphaned_media() == 1

    async def test_deletes_more_rows_than_one_batch(self, db: DbSessionFactory) -> None:
        digests = {_digest(f"bulk-{index}") for index in range(150)}
        for digest in digests:
            await _store_media(db, digest)

        assert await MediaSweeper(db)._delete_orphaned_media() == 150
        assert await _stored_digests(db) == set()
