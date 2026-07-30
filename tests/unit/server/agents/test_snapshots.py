import pytest
import zstandard

from phoenix.server.agents.snapshots import (
    ZSTD_CODEC,
    UnsupportedSnapshotCodec,
    decode_snapshot,
    encode_snapshot,
)


@pytest.mark.parametrize(
    "snapshot",
    [
        pytest.param(b"", id="empty"),
        pytest.param(b"shell-state", id="short"),
        pytest.param(bytes(range(256)) * 4096, id="megabyte_scale"),
    ],
)
def test_encode_snapshot_round_trips_byte_exactly(snapshot: bytes) -> None:
    codec, payload = encode_snapshot(snapshot)
    assert codec == ZSTD_CODEC
    assert decode_snapshot(codec, payload) == snapshot


def test_encode_snapshot_compresses_redundant_bytes() -> None:
    """Bashkit snapshots are uncompressed and highly redundant."""
    snapshot = b"snapshot-payload" * 65536  # 1 MiB
    _, payload = encode_snapshot(snapshot)
    assert len(payload) < len(snapshot) // 100


def test_decode_snapshot_rejects_an_unknown_codec() -> None:
    """A row written by a newer Phoenix is reported rather than silently misread."""
    _, payload = encode_snapshot(b"shell-state")
    with pytest.raises(UnsupportedSnapshotCodec):
        decode_snapshot("zstd-dict", payload)


def test_decode_snapshot_rejects_a_corrupt_payload() -> None:
    with pytest.raises(zstandard.ZstdError):
        decode_snapshot(ZSTD_CODEC, b"not-a-zstd-frame")
