"""Covers when the snapshot chain writes a delta and when it checkpoints."""

from phoenix.server.agents.snapshots import ZSTD_CODEC, ZSTD_DICT_CODEC
from phoenix.server.api.routers.agents import (
    SNAPSHOT_CHECKPOINT_INTERVAL,
    _encode_for_chain,
    _SnapshotChainTip,
)


def _workspace(line_count: int = 40000) -> bytes:
    return b"".join(b"line %d of the workspace file\n" % i for i in range(line_count))


def _tip(snapshot: bytes, *, chain_depth: int = 0, rowid: int = 7) -> _SnapshotChainTip:
    return _SnapshotChainTip(snapshot_rowid=rowid, chain_depth=chain_depth, snapshot=snapshot)


def test_the_first_snapshot_of_a_session_is_a_checkpoint() -> None:
    encoded = _encode_for_chain(_workspace(), None)
    assert encoded.kind == "full"
    assert encoded.codec == ZSTD_CODEC
    assert encoded.base_snapshot_rowid is None
    assert encoded.chain_depth == 0


def test_a_local_edit_is_stored_as_a_delta_against_the_tip() -> None:
    base = _workspace()
    encoded = _encode_for_chain(
        base.replace(b"line 20000 of", b"LINE 20000 of"),
        _tip(base, chain_depth=3, rowid=42),
    )
    assert encoded.kind == "delta"
    assert encoded.codec == ZSTD_DICT_CODEC
    assert encoded.base_snapshot_rowid == 42
    assert encoded.chain_depth == 4


def test_the_chain_checkpoints_once_the_interval_is_reached() -> None:
    """Bounds how many deltas a restore has to replay."""
    base = _workspace()
    encoded = _encode_for_chain(
        base.replace(b"line 20000 of", b"LINE 20000 of"),
        _tip(base, chain_depth=SNAPSHOT_CHECKPOINT_INTERVAL),
    )
    assert encoded.kind == "full"
    assert encoded.base_snapshot_rowid is None
    assert encoded.chain_depth == 0


def test_a_wholesale_rewrite_checkpoints_instead_of_storing_a_useless_delta() -> None:
    """A delta that stops paying for itself is replaced by a checkpoint."""
    base = _workspace()
    unrelated = b"".join(b"a completely different line %d\n" % i for i in range(40000))
    encoded = _encode_for_chain(unrelated, _tip(base, chain_depth=1))
    assert encoded.kind == "full"
    assert encoded.chain_depth == 0
