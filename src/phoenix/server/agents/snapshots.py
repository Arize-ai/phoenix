"""Encoding for persisted bashkit shell snapshots.

``Bash.snapshot()`` returns uncompressed bytes that are highly redundant: a
~3 MB snapshot compresses to ~1-3% of its raw size with zstd. Snapshots are
written once per persisted turn and read once when a turn restores a shell,
so the encoding is well off the hot path.

The stored ``codec`` makes each row self-describing, so the compression
settings below can change without a migration or a backfill.
"""

from typing import Final

import zstandard

ZSTD_CODEC: Final = "zstd"
"""Whole snapshot compressed with a standalone zstd frame."""

_COMPRESSION_LEVEL: Final = 3
"""Level 3 encodes a ~1 MB snapshot in ~2 ms for ~3% of its raw size.

Higher levels buy little here: the win comes from how redundant the snapshot
format is, not from the match finder.
"""


class UnsupportedSnapshotCodec(Exception):
    """Raised when a stored snapshot uses a codec this version cannot decode."""

    def __init__(self, codec: str) -> None:
        super().__init__(f"Unsupported bashkit snapshot codec: {codec!r}")
        self.codec = codec


def encode_snapshot(snapshot: bytes) -> tuple[str, bytes]:
    """Compress a raw bashkit snapshot, returning its codec and payload."""
    compressor = zstandard.ZstdCompressor(level=_COMPRESSION_LEVEL)
    return ZSTD_CODEC, compressor.compress(snapshot)


def decode_snapshot(codec: str, payload: bytes) -> bytes:
    """Reconstruct the exact bytes that ``encode_snapshot`` was given.

    Raises:
        UnsupportedSnapshotCodec: the row was written by a newer Phoenix.
        zstandard.ZstdError: the payload is truncated or corrupt.
    """
    if codec != ZSTD_CODEC:
        raise UnsupportedSnapshotCodec(codec)
    return zstandard.ZstdDecompressor().decompress(payload)
