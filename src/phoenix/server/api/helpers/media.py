"""Resolution of prompt media references into the bytes a model provider needs."""

from typing import Iterable, NamedTuple, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.db import models
from phoenix.db.types.media import InlineMedia, parse_media_url


class MediaResolutionError(Exception):
    """Raised when prompt media cannot be resolved into bytes."""


class ResolvedMedia(NamedTuple):
    """Media bytes ready to hand to a model provider."""

    content: bytes
    media_type: str
    file_name: Optional[str] = None
    """The name the media was stored under, when one is known."""


async def resolve_media(
    session: AsyncSession,
    urls: Iterable[str],
) -> dict[str, ResolvedMedia]:
    """
    Resolve prompt media references into their bytes, keyed by reference URL.

    Phoenix-hosted references are read in a single query, so a message carrying
    several images costs one round trip rather than one per image. The media type
    returned here is authoritative — for hosted media it was determined from the
    bytes at upload time, and for inline media it is declared by the data URL —
    whereas the type recorded on a prompt part is advisory.

    Args:
        session: Session used to read Phoenix-hosted media.
        urls: The reference URLs to resolve. Repeated URLs are resolved once.

    Returns:
        A mapping from each reference URL to its resolved bytes and media type.

    Raises:
        MediaResolutionError: A reference is malformed, carries a corrupt inline
            payload, or names hosted media that is no longer present.
    """
    unique_urls = set(urls)
    if not unique_urls:
        return {}

    inline_media: dict[str, InlineMedia] = {}
    hosted_digests: dict[str, str] = {}
    for url in unique_urls:
        try:
            reference = parse_media_url(url)
        except ValueError as error:
            raise MediaResolutionError(str(error)) from error
        if isinstance(reference, InlineMedia):
            inline_media[url] = reference
        else:
            hosted_digests[url] = reference.sha256

    resolved: dict[str, ResolvedMedia] = {}
    for url, reference in inline_media.items():
        try:
            content = reference.decode()
        except ValueError as error:
            raise MediaResolutionError(str(error)) from error
        resolved[url] = ResolvedMedia(content=content, media_type=reference.media_type)

    if hosted_digests:
        digests = set(hosted_digests.values())
        rows = await session.execute(
            select(
                models.MediaFile.sha256,
                models.MediaFile.media_type,
                models.MediaFile.content,
                models.MediaFile.file_name,
            ).where(models.MediaFile.sha256.in_(digests))
        )
        stored = {
            sha256: (media_type, content, file_name)
            for sha256, media_type, content, file_name in rows
        }
        if missing := digests - stored.keys():
            raise MediaResolutionError(
                f"prompt references media that is no longer stored in Phoenix: "
                f"{', '.join(sorted(missing))}"
            )
        for url, sha256 in hosted_digests.items():
            media_type, content, file_name = stored[sha256]
            resolved[url] = ResolvedMedia(
                content=content, media_type=media_type, file_name=file_name
            )

    return resolved
