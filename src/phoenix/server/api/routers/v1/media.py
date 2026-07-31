"""REST endpoints for the content-addressed media referenced by prompt templates."""

import hashlib
import logging
import socket
from ipaddress import ip_address
from pathlib import PurePosixPath
from typing import Optional
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Depends, HTTPException, Path, Response, UploadFile
from sqlalchemy import select
from starlette.requests import Request
from starlette.status import (
    HTTP_404_NOT_FOUND,
    HTTP_413_CONTENT_TOO_LARGE,
    HTTP_415_UNSUPPORTED_MEDIA_TYPE,
    HTTP_422_UNPROCESSABLE_ENTITY,
)

from phoenix.config import get_env_max_media_bytes
from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.db.insertion.helpers import OnConflict, insert_on_conflict
from phoenix.db.types.media import SUPPORTED_MEDIA_TYPES, hosted_media_url
from phoenix.server.api.routers.v1.models import V1RoutesBaseModel
from phoenix.server.api.routers.v1.utils import (
    RequestBody,
    ResponseBody,
    add_errors_to_responses,
)
from phoenix.server.authorization import is_not_locked

logger = logging.getLogger(__name__)

router = APIRouter(tags=["media"])

_SHA256_PATH_PATTERN = r"^[0-9a-f]{64}$"

_IMPORT_TIMEOUT_SECONDS = 10.0
"""How long to wait on a third-party host when importing an image by URL."""

_IMMUTABLE_MEDIA_HEADERS = {
    # Safe to cache forever: the URL is the digest of the content it serves.
    "Cache-Control": "public, max-age=31536000, immutable",
    # Phoenix serves user-uploaded bytes from its own origin. Pin the declared
    # type and strip the response of any ambient authority so that a payload
    # which slips past the allowlist still cannot execute as a document.
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
}


def _detect_media_type(content: bytes) -> Optional[str]:
    """
    Identify media from its leading bytes.

    The media type reported by the uploading client is advisory; the type stored
    and later served is derived from the content itself.

    Args:
        content: The uploaded bytes.

    Returns:
        The detected media type, or ``None`` if the bytes match none of the
        supported image formats.
    """
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if content.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if content.startswith((b"GIF87a", b"GIF89a")):
        return "image/gif"
    if content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return "image/webp"
    if content.startswith(b"%PDF-"):
        return "application/pdf"
    if content[4:8] == b"ftyp":
        brand = content[8:12]
        if brand in (b"heic", b"heix", b"hevc", b"hevx"):
            return "image/heic"
        if brand in (b"mif1", b"msf1"):
            return "image/heif"
    return None


class MediaFileData(V1RoutesBaseModel):
    sha256: str
    media_type: str
    size_bytes: int
    url: str


class UploadMediaResponseBody(ResponseBody[MediaFileData]):
    pass


class ImportMediaRequestBody(V1RoutesBaseModel):
    url: str


class ImportMediaRequestBodyWrapper(RequestBody[ImportMediaRequestBody]):
    pass


def _reject_unsafe_host(host: str) -> None:
    """
    Reject a host that resolves anywhere other than the public internet.

    Fetching a caller-supplied URL server-side would otherwise reach anything the
    Phoenix process can reach — cloud metadata endpoints, databases on the private
    network, services on loopback. Every resolved address is checked, not just the
    first, since a hostname can return a mix.

    Args:
        host: The hostname or IP from the URL.

    Raises:
        HTTPException: 422 if the host cannot be resolved or resolves to a
            non-public address.
    """
    try:
        addresses = {info[4][0] for info in socket.getaddrinfo(host, None)}
    except socket.gaierror:
        raise HTTPException(
            status_code=HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Could not resolve {host}.",
        )
    if not addresses:
        raise HTTPException(
            status_code=HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Could not resolve {host}.",
        )
    for address in addresses:
        parsed = ip_address(address)
        if not parsed.is_global or parsed.is_multicast:
            raise HTTPException(
                status_code=HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    f"{host} resolves to a non-public address ({address}). "
                    f"Only images on the public internet can be imported by URL."
                ),
            )


@router.post(
    "/media",
    dependencies=[Depends(is_not_locked)],
    operation_id="uploadMedia",
    summary="Upload media for use in prompts",
    description=(
        "Store a media file and return the URL that references it from a prompt "
        "template. Media is addressed by the SHA-256 digest of its content, so "
        "uploading the same file twice returns the same URL and stores one copy. "
        "The media type is determined from the file's content, not from the "
        "declared content type."
    ),
    response_description="The stored media and the URL that references it",
    responses=add_errors_to_responses([413, 415]),
    response_model_by_alias=True,
    response_model_exclude_defaults=True,
    response_model_exclude_unset=True,
)
async def upload_media(request: Request, file: UploadFile) -> UploadMediaResponseBody:
    """
    Store a media file for use in prompt templates.

    Args:
        request: The FastAPI request object.
        file: The uploaded media file.

    Returns:
        The stored media's digest, type, size, and prompt-template URL.

    Raises:
        HTTPException: 413 if the file exceeds the configured size limit, or 415
            if its content is not a supported image format.
    """
    max_bytes = get_env_max_media_bytes()
    content = await file.read(max_bytes + 1)
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=HTTP_413_CONTENT_TOO_LARGE,
            detail=f"Media exceeds the maximum supported size of {max_bytes} bytes.",
        )
    if not content:
        raise HTTPException(
            status_code=HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Media is empty.",
        )
    return await _store_media(
        request,
        content,
        source=file.filename or "the file",
        file_name=file.filename,
    )


async def _store_media(
    request: Request,
    content: bytes,
    *,
    source: str,
    file_name: Optional[str] = None,
) -> UploadMediaResponseBody:
    """
    Validate media and store it, returning the reference prompts use.

    Shared by every way media arrives so that the type is always determined from
    the bytes, never from what the caller claimed.

    Args:
        request: The FastAPI request object, for the database.
        content: The media bytes.
        source: Where the bytes came from, used only in error messages.
        file_name: The name to remember the media by, when one is known.

    Returns:
        The stored media's digest, type, size, and prompt-template URL.

    Raises:
        HTTPException: 415 if the content is empty or not a supported image.
    """
    if not content:
        raise HTTPException(
            status_code=HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"{source} is empty.",
        )
    media_type = _detect_media_type(content)
    if media_type is None or media_type not in SUPPORTED_MEDIA_TYPES:
        raise HTTPException(
            status_code=HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=(
                f"Unsupported media. Expected one of: {', '.join(sorted(SUPPORTED_MEDIA_TYPES))}."
            ),
        )

    sha256 = hashlib.sha256(content).hexdigest()
    async with request.app.state.db() as session:
        dialect = SupportedSQLDialect(session.bind.dialect.name)
        await session.execute(
            insert_on_conflict(
                dict(
                    sha256=sha256,
                    media_type=media_type,
                    size_bytes=len(content),
                    content=content,
                    file_name=file_name,
                ),
                dialect=dialect,
                table=models.MediaFile,
                unique_by=("sha256",),
                on_conflict=OnConflict.DO_NOTHING,
                constraint_name="pk_media_files",
            )
        )

    return UploadMediaResponseBody(
        data=MediaFileData(
            sha256=sha256,
            media_type=media_type,
            size_bytes=len(content),
            url=hosted_media_url(sha256),
        )
    )


@router.post(
    "/media/import",
    dependencies=[Depends(is_not_locked)],
    operation_id="importMediaFromUrl",
    summary="Import an image from a URL for use in prompts",
    description=(
        "Fetch an image from a public URL once and store it, returning the same "
        "reference an upload would. The URL is not kept: prompts always reference "
        "stored media, so a run never depends on a third-party host still serving "
        "the image, and never fetches a caller-supplied URL."
    ),
    response_description="The stored media and the URL that references it",
    responses=add_errors_to_responses([413, 415, 422]),
    response_model_by_alias=True,
    response_model_exclude_defaults=True,
    response_model_exclude_unset=True,
)
async def import_media_from_url(
    request: Request,
    request_body: ImportMediaRequestBodyWrapper,
) -> UploadMediaResponseBody:
    """
    Store an image fetched from a public URL.

    Args:
        request: The FastAPI request object.
        request_body: The URL to fetch.

    Returns:
        The stored media's digest, type, size, and prompt-template URL.

    Raises:
        HTTPException: 422 if the URL is not an http(s) URL, does not resolve to a
            public address, or cannot be fetched; 413 if the image exceeds the
            configured size limit; 415 if it is not a supported image.
    """
    parsed_url = urlparse(request_body.data.url)
    if parsed_url.scheme not in ("http", "https") or not parsed_url.hostname:
        raise HTTPException(
            status_code=HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Provide an http or https URL for the image.",
        )
    _reject_unsafe_host(parsed_url.hostname)

    max_bytes = get_env_max_media_bytes()
    try:
        async with httpx.AsyncClient(
            timeout=_IMPORT_TIMEOUT_SECONDS,
            # A redirect could land somewhere the host check already rejected.
            follow_redirects=False,
        ) as client:
            response = await client.get(request_body.data.url)
    except httpx.HTTPError as error:
        raise HTTPException(
            status_code=HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Could not fetch the image: {error}.",
        )
    if response.is_redirect:
        raise HTTPException(
            status_code=HTTP_422_UNPROCESSABLE_ENTITY,
            detail="The URL redirects. Use the URL the image is served from.",
        )
    if response.status_code >= 400:
        raise HTTPException(
            status_code=HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"The image URL returned {response.status_code}.",
        )
    content = response.content
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=HTTP_413_CONTENT_TOO_LARGE,
            detail=f"Media exceeds the maximum supported size of {max_bytes} bytes.",
        )
    return await _store_media(
        request,
        content,
        source=request_body.data.url,
        file_name=PurePosixPath(parsed_url.path).name or None,
    )


@router.get(
    "/media/{sha256}",
    operation_id="getMedia",
    summary="Get media by digest",
    description=(
        "Return the raw bytes of stored media. The response is immutable and "
        "safe to cache indefinitely, since the digest in the path identifies the "
        "content being served."
    ),
    response_description="The raw media bytes",
    responses=add_errors_to_responses([404]),
    response_class=Response,
)
async def get_media(
    request: Request,
    sha256: str = Path(
        ...,
        pattern=_SHA256_PATH_PATTERN,
        description="The SHA-256 digest of the media, in lowercase hexadecimal.",
    ),
) -> Response:
    """
    Serve stored media by its digest.

    Args:
        request: The FastAPI request object.
        sha256: The SHA-256 digest of the media, in lowercase hexadecimal.

    Returns:
        The raw media bytes with their stored media type.

    Raises:
        HTTPException: 404 if no media with that digest is stored.
    """
    async with request.app.state.db() as session:
        media_file = (
            await session.execute(
                select(models.MediaFile.media_type, models.MediaFile.content).where(
                    models.MediaFile.sha256 == sha256
                )
            )
        ).first()
    if media_file is None:
        raise HTTPException(
            status_code=HTTP_404_NOT_FOUND,
            detail=f"No media found with digest {sha256}.",
        )
    media_type, content = media_file
    return Response(
        content=content,
        media_type=media_type,
        headers={
            **_IMMUTABLE_MEDIA_HEADERS,
            "Content-Disposition": f'inline; filename="{sha256}"',
        },
    )
