from __future__ import annotations

import base64
import hashlib

import pytest

from phoenix.db import models
from phoenix.db.types.media import hosted_media_url
from phoenix.server.api.helpers.media import MediaResolutionError, resolve_media
from phoenix.server.types import DbSessionFactory

_PNG_BYTES = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg=="
)
_PNG_DIGEST = hashlib.sha256(_PNG_BYTES).hexdigest()
_JPEG_BYTES = b"\xff\xd8\xff\xe0 pretend jpeg"
_JPEG_DIGEST = hashlib.sha256(_JPEG_BYTES).hexdigest()


@pytest.fixture
async def stored_media(db: DbSessionFactory) -> None:
    async with db() as session:
        session.add(
            models.MediaFile(
                sha256=_PNG_DIGEST,
                media_type="image/png",
                size_bytes=len(_PNG_BYTES),
                content=_PNG_BYTES,
            )
        )
        session.add(
            models.MediaFile(
                sha256=_JPEG_DIGEST,
                media_type="image/jpeg",
                size_bytes=len(_JPEG_BYTES),
                content=_JPEG_BYTES,
            )
        )


class TestResolveMedia:
    async def test_returns_empty_for_no_input(self, db: DbSessionFactory) -> None:
        async with db() as session:
            assert await resolve_media(session, []) == {}

    async def test_resolves_hosted_media(
        self,
        db: DbSessionFactory,
        stored_media: None,
    ) -> None:
        url = hosted_media_url(_PNG_DIGEST)
        async with db() as session:
            resolved = await resolve_media(session, [url])
        assert resolved[url].content == _PNG_BYTES
        assert resolved[url].media_type == "image/png"

    async def test_resolves_inline_media(self, db: DbSessionFactory) -> None:
        url = f"data:image/png;base64,{base64.b64encode(_PNG_BYTES).decode()}"
        async with db() as session:
            resolved = await resolve_media(session, [url])
        assert resolved[url].content == _PNG_BYTES
        assert resolved[url].media_type == "image/png"

    async def test_resolves_hosted_and_inline_together(
        self,
        db: DbSessionFactory,
        stored_media: None,
    ) -> None:
        hosted = hosted_media_url(_PNG_DIGEST)
        inline = f"data:image/jpeg;base64,{base64.b64encode(_JPEG_BYTES).decode()}"
        async with db() as session:
            resolved = await resolve_media(session, [hosted, inline])
        assert resolved[hosted].content == _PNG_BYTES
        assert resolved[inline].content == _JPEG_BYTES

    async def test_resolves_repeated_reference_once(
        self,
        db: DbSessionFactory,
        stored_media: None,
    ) -> None:
        url = hosted_media_url(_PNG_DIGEST)
        async with db() as session:
            resolved = await resolve_media(session, [url, url, url])
        assert len(resolved) == 1
        assert resolved[url].content == _PNG_BYTES

    async def test_returns_stored_media_type(
        self,
        db: DbSessionFactory,
        stored_media: None,
    ) -> None:
        url = hosted_media_url(_JPEG_DIGEST)
        async with db() as session:
            resolved = await resolve_media(session, [url])
        assert resolved[url].media_type == "image/jpeg"

    async def test_raises_when_hosted_media_is_missing(self, db: DbSessionFactory) -> None:
        async with db() as session:
            with pytest.raises(MediaResolutionError, match="no longer stored in Phoenix"):
                await resolve_media(session, [hosted_media_url("b" * 64)])

    async def test_raises_when_some_hosted_media_is_missing(
        self,
        db: DbSessionFactory,
        stored_media: None,
    ) -> None:
        async with db() as session:
            with pytest.raises(MediaResolutionError, match="c" * 64):
                await resolve_media(
                    session,
                    [hosted_media_url(_PNG_DIGEST), hosted_media_url("c" * 64)],
                )

    async def test_raises_on_corrupt_inline_payload(self, db: DbSessionFactory) -> None:
        async with db() as session:
            with pytest.raises(MediaResolutionError, match="not valid base64"):
                await resolve_media(session, ["data:image/png;base64,!!!not-base64!!!"])

    async def test_raises_on_unsupported_scheme(self, db: DbSessionFactory) -> None:
        async with db() as session:
            with pytest.raises(MediaResolutionError, match="unsupported media URL scheme"):
                await resolve_media(session, ["https://example.com/cat.png"])
