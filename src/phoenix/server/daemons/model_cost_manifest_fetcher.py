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
        body = await asyncio.to_thread(_download, self._url)
        manifest = parse_manifest(body)
        async with self._db() as session:
            await apply_manifest_if_newer(
                session, manifest, dialect=self._db.dialect, source="remote", url=self._url
            )
        # Refetch even if it wasn't newer: another replica may have applied it, with rows
        # stamped before our store's cursor that its incremental fetch would miss.
        self._generative_model_store.request_full_refetch()


def _download(url: str) -> bytes:
    """
    Downloads the manifest.

    Raises:
        OSError: If the request fails or times out (including HTTP errors).
        ManifestError: If the body is larger than any manifest should be.
    """
    try:
        with urllib.request.urlopen(url, timeout=_TIMEOUT_SECONDS) as response:  # noqa: S310
            body: bytes = response.read(_MAX_MANIFEST_BYTES + 1)
    except urllib.error.HTTPError as error:
        # urlopen raises it before the with block, holding the error response open. Python
        # 3.14 emits a ResourceWarning when it is garbage-collected unclosed.
        error.close()
        raise
    if len(body) > _MAX_MANIFEST_BYTES:
        raise ManifestError(f"Model cost manifest is larger than {_MAX_MANIFEST_BYTES} bytes")
    return body
