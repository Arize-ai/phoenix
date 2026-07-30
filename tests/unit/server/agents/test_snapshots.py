import pytest
import zstandard

from phoenix.server.agents.snapshots import (
    ZSTD_CODEC,
    ZSTD_DICT_CODEC,
    UnsupportedSnapshotCodec,
    decode_snapshot,
    encode_delta,
    encode_snapshot,
)


def _workspace(line_count: int = 40000) -> bytes:
    """Stand in for a bashkit snapshot: large, uncompressed, highly redundant."""
    return b"".join(b"line %d of the workspace file\n" % i for i in range(line_count))


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
    """Snapshots of this shape measure at ~1-3% of their raw size."""
    snapshot = _workspace()
    _, payload = encode_snapshot(snapshot)
    assert len(payload) < len(snapshot) // 30


def test_encode_delta_round_trips_byte_exactly() -> None:
    base = _workspace()
    target = base.replace(b"line 20000 of", b"LINE 20000 of")
    codec, payload = encode_delta(base, target)
    assert codec == ZSTD_DICT_CODEC
    assert decode_snapshot(codec, payload, base) == target


def test_encode_delta_of_a_local_edit_is_far_smaller_than_a_full_snapshot() -> None:
    """The property the whole delta-chain design rests on."""
    base = _workspace()
    target = base.replace(b"line 20000 of", b"LINE 20000 of")
    _, full = encode_snapshot(target)
    _, delta = encode_delta(base, target)
    assert len(delta) < len(full) // 50


def test_encode_delta_handles_an_empty_base() -> None:
    _, payload = encode_delta(b"", b"shell-state")
    assert decode_snapshot(ZSTD_DICT_CODEC, payload, b"") == b"shell-state"


def test_a_delta_chain_replays_to_each_captured_state() -> None:
    """Replaying a chain reproduces every intermediate state byte-exactly."""
    states = [_workspace()]
    for step in range(20):
        states.append(states[-1].replace(b"line %d of" % step, b"LINE %d of" % step))

    codec, payload = encode_snapshot(states[0])
    chain = [(codec, payload)]
    for previous, current in zip(states, states[1:]):
        chain.append(encode_delta(previous, current))

    replayed: list[bytes] = []
    decoded: bytes | None = None
    for index, (row_codec, row_payload) in enumerate(chain):
        decoded = decode_snapshot(row_codec, row_payload, None if index == 0 else decoded)
        replayed.append(decoded)
    assert replayed == states


def test_decode_snapshot_requires_a_base_for_a_delta() -> None:
    _, payload = encode_delta(b"base", b"target")
    with pytest.raises(ValueError):
        decode_snapshot(ZSTD_DICT_CODEC, payload)


def test_decode_snapshot_rejects_the_wrong_base() -> None:
    """A delta decoded against the wrong base must fail, not return garbage."""
    base = _workspace()
    target = base.replace(b"line 20000 of", b"LINE 20000 of")
    _, payload = encode_delta(base, target)
    with pytest.raises(zstandard.ZstdError):
        decode_snapshot(ZSTD_DICT_CODEC, payload, _workspace(10))


def test_decode_snapshot_rejects_an_unknown_codec() -> None:
    _, payload = encode_snapshot(b"shell-state")
    with pytest.raises(UnsupportedSnapshotCodec):
        decode_snapshot("zstd-chunked", payload)


def test_decode_snapshot_rejects_a_corrupt_payload() -> None:
    with pytest.raises(zstandard.ZstdError):
        decode_snapshot(ZSTD_CODEC, b"not-a-zstd-frame")
