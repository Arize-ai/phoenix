"""Encoding for persisted bashkit shell snapshots and the deltas between them.

``Bash.snapshot()`` is deterministic and uncompressed: the same shell state
always produces the same bytes, and successive snapshots differ only locally.
That makes generic binary deltas extremely effective — a one-line file change
against a ~1 MB snapshot encodes in a few hundred bytes, versus ~30 KB for a
compressed full snapshot.

Two codecs are stored, both of which reconstruct byte-exactly:

``zstd``
    A standalone frame holding a whole snapshot. Used for checkpoints, which
    anchor a chain and bound how far a restore has to walk back.

``zstd-dict``
    A frame encoded against the previous snapshot supplied as a raw-content
    dictionary — the same technique as ``zstd --patch-from``. Decoding needs
    the exact base bytes, so these rows are only meaningful as part of a chain.

The stored ``codec`` makes each row self-describing, so these settings can
change without a migration: existing rows keep decoding under the codec they
were written with.
"""

from typing import Final

import zstandard

ZSTD_CODEC: Final = "zstd"
"""Whole snapshot compressed as a standalone zstd frame."""

ZSTD_DICT_CODEC: Final = "zstd-dict"
"""Snapshot encoded against its base snapshot as a raw-content dictionary."""

_FULL_LEVEL: Final = 3
"""Level 3 encodes a ~1 MB snapshot in ~2 ms for ~3% of its raw size.

Higher levels buy little for a standalone frame: the win comes from how
redundant the snapshot format is, not from the match finder.
"""

_DELTA_LEVEL: Final = 16
"""Levels >=16 select the btopt/btultra match finders.

This is the cliff that makes patch-from work: below 16 the match finder does
not search the whole dictionary window, and deltas degrade from a few hundred
bytes to ~2% of the full snapshot size.
"""

_MIN_WINDOW_LOG: Final = 10
_MAX_WINDOW_LOG: Final = 27
"""Bounds zstd accepts for ``window_log`` on a 32-bit-safe build."""


class UnsupportedSnapshotCodec(Exception):
    """Raised when a stored snapshot uses a codec this version cannot decode."""

    def __init__(self, codec: str) -> None:
        super().__init__(f"Unsupported bashkit snapshot codec: {codec!r}")
        self.codec = codec


def _window_log(base_size: int) -> int:
    """Size the match window to the base snapshot.

    Matches beyond the window are invisible to the encoder, so a window
    smaller than the base would silently degrade deltas to ordinary
    compression.
    """
    return max(_MIN_WINDOW_LOG, min(_MAX_WINDOW_LOG, max(1, base_size - 1).bit_length()))


def _raw_dict(base: bytes) -> zstandard.ZstdCompressionDict:
    return zstandard.ZstdCompressionDict(base, dict_type=zstandard.DICT_TYPE_RAWCONTENT)


def encode_snapshot(snapshot: bytes) -> tuple[str, bytes]:
    """Compress a whole snapshot, returning its codec and payload."""
    compressor = zstandard.ZstdCompressor(level=_FULL_LEVEL)
    return ZSTD_CODEC, compressor.compress(snapshot)


def encode_delta(base: bytes, snapshot: bytes) -> tuple[str, bytes]:
    """Encode ``snapshot`` against ``base``, returning its codec and payload.

    ``base`` must be the exact bytes the previous snapshot decodes to; the
    payload is meaningless against anything else.
    """
    compression_params = zstandard.ZstdCompressionParameters.from_level(
        _DELTA_LEVEL,
        enable_ldm=True,
        window_log=_window_log(len(base)),
    )
    compressor = zstandard.ZstdCompressor(
        dict_data=_raw_dict(base),
        compression_params=compression_params,
    )
    return ZSTD_DICT_CODEC, compressor.compress(snapshot)


def decode_snapshot(codec: str, payload: bytes, base: bytes | None = None) -> bytes:
    """Reconstruct the exact bytes that were encoded.

    Args:
        codec: the codec the row was written with.
        payload: the stored bytes.
        base: the decoded base snapshot, required for ``zstd-dict`` payloads.

    Raises:
        UnsupportedSnapshotCodec: the row was written by a newer Phoenix.
        ValueError: a delta payload was given without its base.
        zstandard.ZstdError: the payload is truncated, corrupt, or was encoded
            against a different base.
    """
    if codec == ZSTD_CODEC:
        return zstandard.ZstdDecompressor().decompress(payload)
    if codec == ZSTD_DICT_CODEC:
        if base is None:
            raise ValueError(f"Decoding a {ZSTD_DICT_CODEC!r} snapshot requires its base snapshot")
        return zstandard.ZstdDecompressor(dict_data=_raw_dict(base)).decompress(payload)
    raise UnsupportedSnapshotCodec(codec)
