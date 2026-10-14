"""
Fetches the model cost manifest after startup and then daily, and applies it if it is newer.

This picks up new models and prices without upgrading Phoenix. The fetch runs in a daemon, not
at startup, so a slow or unreachable host never delays boot; a failed fetch is logged and the
next one is tried a day later. The prices already in the database stay in use either way.
"""

from __future__ import annotations

import asyncio
import http.client
import logging
import random
import urllib.error
import urllib.request
from asyncio import sleep
from typing import NamedTuple, Optional

from phoenix.server.cost_tracking.apply_manifest import apply_manifest_if_newer
from phoenix.server.cost_tracking.manifest import ManifestError, parse_manifest
from phoenix.server.daemons.generative_model_store import GenerativeModelStore
from phoenix.server.types import DaemonTask, DbSessionFactory

logger = logging.getLogger(__name__)

_SLEEP_SECONDS = 24 * 60 * 60
_JITTER_SECONDS = 60 * 60
# Per socket operation, not total and not DNS. stop() cancels the await, but process exit
# still waits for a stalled urlopen thread, as with the WASM prefetch in sandbox/_download.py.
_TIMEOUT_SECONDS = 30
# The manifest is about 250 KB; anything this large is not one.
_MAX_MANIFEST_BYTES = 5 * 1024 * 1024


class _Download(NamedTuple):
    body: bytes
    etag: Optional[str]


class ModelCostManifestFetcher(DaemonTask):
    """Periodically fetches the model cost manifest and applies it if it is newer."""

    def __init__(
        self,
        db: DbSessionFactory,
        url: str,
        generative_model_store: GenerativeModelStore,
    ) -> None:
        super().__init__()
        self._db = db
        self._url = url
        self._generative_model_store = generative_model_store
        # The ETag of the last manifest that was applied or found not newer. Kept in memory
        # only, so each boot downloads the manifest once.
        self._etag: Optional[str] = None

    async def _run(self) -> None:
        while self._running:
            try:
                await self._fetch_and_apply()
            except (OSError, http.client.HTTPException, ManifestError) as error:
                logger.warning(f"Failed to fetch the model cost manifest from {self._url}: {error}")
            except Exception:
                logger.exception(
                    f"Failed to fetch or apply the model cost manifest from {self._url}"
                )
            await sleep(_SLEEP_SECONDS + random.uniform(-_JITTER_SECONDS, _JITTER_SECONDS))

    async def _fetch_and_apply(self) -> None:
        download = await asyncio.to_thread(_download, self._url, self._etag)
        if download is None:
            return
        manifest = parse_manifest(download.body)
        async with self._db() as session:
            await apply_manifest_if_newer(
                session, manifest, dialect=self._db.dialect, source="remote", url=self._url
            )
        # Refetch even if it wasn't newer: another replica may have applied it, with rows
        # stamped before our store's cursor that its incremental fetch would miss.
        self._generative_model_store.request_full_refetch()
        self._etag = download.etag


def _download(url: str, etag: Optional[str]) -> Optional[_Download]:
    """
    Downloads the manifest, or returns None if it hasn't changed since the given ETag.

    Raises:
        OSError: If the request fails or times out (including HTTP errors).
        ManifestError: If the body is larger than any manifest should be.
    """
    request = urllib.request.Request(url, headers={"If-None-Match": etag} if etag else {})
    try:
        with urllib.request.urlopen(request, timeout=_TIMEOUT_SECONDS) as response:  # noqa: S310
            body = response.read(_MAX_MANIFEST_BYTES + 1)
            new_etag = response.headers.get("ETag")
    except urllib.error.HTTPError as error:
        error.close()
        if error.code == 304:
            return None
        raise
    if len(body) > _MAX_MANIFEST_BYTES:
        raise ManifestError(f"Model cost manifest is larger than {_MAX_MANIFEST_BYTES} bytes")
    return _Download(body=body, etag=new_etag)
