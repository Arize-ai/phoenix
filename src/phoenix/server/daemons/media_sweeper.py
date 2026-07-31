from __future__ import annotations

import logging
import random
from asyncio import sleep
from datetime import datetime, timedelta, timezone
from typing import Iterable

import sqlalchemy as sa

from phoenix.config import get_env_media_orphan_grace_period_hours
from phoenix.db import models
from phoenix.db.types.media import (
    MEDIA_URL_PREFIX,
    HostedMediaRef,
    MediaContent,
    parse_media_url,
)
from phoenix.db.types.prompts import (
    PromptChatTemplate,
    PromptTemplate,
)
from phoenix.db.types.media_parts import (
    is_media_content_part,
    media_source,
)
from phoenix.server.types import DaemonTask, DbSessionFactory

logger = logging.getLogger(__name__)

_SLEEP_SECONDS = 60 * 60  # 1 hour
_JITTER_SECONDS = 60  # plus or minus 1 minute
_DELETE_BATCH_SIZE = 100


def referenced_digests(templates: Iterable[PromptTemplate]) -> set[str]:
    """
    Collect the digests of Phoenix-hosted media referenced by prompt templates.

    Args:
        templates: The prompt templates to scan.

    Returns:
        The SHA-256 digests referenced by any media part. Inline ``data:`` media
        contributes nothing, since it is carried in the template itself.
    """
    digests: set[str] = set()
    for template in templates:
        if not isinstance(template, PromptChatTemplate):
            continue
        for message in template.messages:
            if isinstance(message.content, str):
                continue
            for part in message.content:
                if not is_media_content_part(part):
                    continue
                source = media_source(part)
                if not isinstance(source, MediaContent):
                    # Media supplied per run names no stored row, so it protects
                    # none. The value a caller supplies is theirs to keep alive.
                    continue
                try:
                    reference = parse_media_url(source.url)
                except ValueError:
                    # A reference Phoenix cannot parse names no stored row, so it
                    # cannot protect one either. Leave it out rather than fail the
                    # whole sweep.
                    continue
                if isinstance(reference, HostedMediaRef):
                    digests.add(reference.sha256)
    return digests


class MediaSweeper(DaemonTask):
    """
    Periodically deletes stored media that no prompt version references.

    Media is uploaded before the prompt version that references it exists — the
    playground stores an image the moment it is attached, which may be long before
    the user saves. Only media older than a grace period is therefore eligible, so
    that an image sitting in an unsaved editor is not swept out from under it.

    The referenced set is recomputed inside the same transaction as the delete. A
    prompt version committed in the window between those two statements could still
    lose its image; the grace period makes that require an editor left open past it.
    The failure mode is a dangling reference, reported by ``resolve_media`` as a
    clear error rather than a corrupt prompt.
    """

    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__()
        self._db = db

    async def _run(self) -> None:
        while self._running:
            try:
                await self._delete_orphaned_media()
            except Exception:
                logger.exception("Failed to sweep orphaned media")
            await sleep(_SLEEP_SECONDS + random.uniform(-_JITTER_SECONDS, _JITTER_SECONDS))

    async def _delete_orphaned_media(self) -> int:
        """
        Delete stored media that is past the grace period and unreferenced.

        Returns:
            The number of media rows deleted.
        """
        cutoff = datetime.now(timezone.utc) - timedelta(
            hours=get_env_media_orphan_grace_period_hours()
        )
        async with self._db() as session:
            candidates = set(
                (
                    await session.scalars(
                        sa.select(models.MediaFile.sha256).where(
                            models.MediaFile.created_at < cutoff
                        )
                    )
                ).all()
            )
            if not candidates:
                return 0

            # Only templates that mention the scheme can hold a reference, so the
            # scan skips the text-only majority instead of deserializing every one.
            templates = (
                await session.scalars(
                    sa.select(models.PromptVersion.template).where(
                        sa.cast(models.PromptVersion.template, sa.Text).contains(MEDIA_URL_PREFIX)
                    )
                )
            ).all()
            orphans = sorted(candidates - referenced_digests(templates))
            if not orphans:
                return 0

            for start in range(0, len(orphans), _DELETE_BATCH_SIZE):
                batch = orphans[start : start + _DELETE_BATCH_SIZE]
                await session.execute(
                    sa.delete(models.MediaFile).where(models.MediaFile.sha256.in_(batch))
                )

        logger.info(f"Deleted {len(orphans)} orphaned media file(s).")
        return len(orphans)
