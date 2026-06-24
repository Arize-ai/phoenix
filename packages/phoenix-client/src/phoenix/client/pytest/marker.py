from __future__ import annotations

import re
from typing import TYPE_CHECKING, Any, Iterable, Iterator, Optional

if TYPE_CHECKING:
    from _pytest.nodes import Item

MARKER_NAME = "phoenix"


def get_marker(item: "Item") -> Optional[Any]:
    return item.get_closest_marker(MARKER_NAME)


def iter_phoenix_items(items: "Iterable[Item]") -> "Iterator[Item]":
    for item in items:
        if get_marker(item) is not None:
            yield item


def resolve_dataset_name(item: "Item", *, override: Optional[str] = None) -> str:
    """Resolve the dataset (= suite) name for an item.

    Precedence: ``override`` (``PHOENIX_TEST_DATASET`` env var, else the ``phoenix_dataset``
    ini option) > marker ``dataset=`` kwarg > the test file's path relative to rootdir,
    sans ``.py`` (the zero-ceremony default), e.g. ``tests/evals/test_sql``.

    The path default mirrors pytest's nodeid, which is unique within a session, so
    same-basename files in different directories never collapse into one dataset (the bare
    module-name default did).
    """
    if override:
        return override
    marker = get_marker(item)
    if marker is not None:
        dataset = marker.kwargs.get("dataset")
        if dataset:
            return str(dataset)
    return re.sub(r"\.py$", "", item.nodeid.split("::", 1)[0])


REPETITION_PARAM = "__phoenix_repetition__"


def resolve_repetitions(marker: Optional[Any], *, env_default: int) -> int:
    """Resolve the repetition count for a marked test.

    Precedence: per-test marker ``repetitions=`` > suite/session ``PHOENIX_TEST_REPETITIONS``
    (the ``env_default``) > 1. Must be >= 1.
    """
    if marker is not None:
        reps = marker.kwargs.get("repetitions")
        if reps is not None:
            n = int(reps)
            if n < 1:
                raise ValueError(f"@pytest.mark.phoenix(repetitions={reps!r}) must be >= 1")
            return n
    return max(1, env_default)


def resolve_evaluators(item: "Item") -> list[Any]:
    """Return the hoisted ``evaluators=[...]`` declared on the marker, if any."""
    marker = get_marker(item)
    if marker is None:
        return []
    evaluators: Any = marker.kwargs.get("evaluators")
    if evaluators is None:
        return []
    if isinstance(evaluators, (list, tuple)):
        seq: Any = evaluators
        return list(seq)
    return [evaluators]


# Repetition param id set in plugin.pytest_generate_tests ("phxrepN").
_REP_ID_RE = re.compile(r"phxrep\d+")
_PARAM_GROUP_RE = re.compile(r"\[(?P<pid>.*)\]$")


def stable_external_id(item: "Item") -> str:
    """Derive a stable per-example ``external_id`` from the nodeid (including its parametrize id).

    The injected repetition token (``phxrepN``) is stripped so all N repetitions of one case
    share a single example, differing only by the server's ``repetition_number``.
    """
    nodeid = str(item.nodeid)
    match = _PARAM_GROUP_RE.search(nodeid)
    if match is None:
        return nodeid
    tokens = [t for t in match.group("pid").split("-") if not _REP_ID_RE.fullmatch(t)]
    base = nodeid[: match.start()]
    if not tokens:
        return base
    return f"{base}[{'-'.join(tokens)}]"


def repetition_index(item: "Item") -> int:
    """Return the 0-based repetition index for an expanded item (0 when not expanded)."""
    callspec = getattr(item, "callspec", None)
    if callspec is None:
        return 0
    value = callspec.params.get(REPETITION_PARAM)
    return int(value) if value is not None else 0
