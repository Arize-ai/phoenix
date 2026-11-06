"""Evidence that the two backends' percentile functions agree.

The backends spell continuous percentiles differently. Postgres uses an
ordered-set aggregate, ``percentile_cont(f) WITHIN GROUP (ORDER BY x)``. SQLite
has no such grammar and reaches the same statistic through a plain call,
``percentile(x, p)``, from the bundled stats extension. Allowing both means a
caller can ask the same question of either deployment and must get the same
number back, so the agreement is asserted here rather than assumed.

Different spellings are cheap to teach. Different *answers* under one concept
are not: nothing downstream would flag a p95 that quietly means something else
on one backend, and a caller comparing two deployments would be misled with no
error anywhere. That is why this file exists and why a new percentile function
should not be allowlisted without extending it.

The comparison runs across the input shapes where percentile implementations
usually diverge -- how nulls are treated, what an empty input returns, whether a
single row or an all-equal input degenerates, and behaviour at the extremes of
the percentile range.
"""

from __future__ import annotations

from typing import Optional, Sequence

import pytest
import sqlean
from sqlalchemy import text

# Importing the engine module applies Phoenix's extension configuration. Calling
# sqlean.extensions.enable() here would *replace* that set rather than add to it,
# silently disabling extensions other code depends on for the rest of the session.
import phoenix.db.engines  # noqa: F401  (imported for its extension setup)
from phoenix.server.types import DbSessionFactory

pytestmark = pytest.mark.postgres_only

# Both engines return double precision, so exact equality would fail on
# representation noise alone -- the same value can render as 9.55 or
# 9.549999999999999 depending on the arithmetic order each took to reach it.
# Observed disagreement across this fixture is around 3e-15; the bound below is
# far looser than that while still being tight enough that a genuine change of
# method could not hide under it.
TOLERANCE = 1e-9

DATASETS: dict[str, Sequence[Optional[float]]] = {
    "dense integers": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    "nulls interspersed": [1, 2, None, 4, 5, None, 7, 8, 9, 10],
    "all values equal": [5, 5, 5, 5, 5],
    "single row": [42],
    "empty input": [],
    "fractional values": [0.5, 1.25, 2.75, 3.0, 9.125],
    "heavy duplicates": [1, 1, 1, 2, 2, 3],
    "spans zero": [-10, -3, 0, 3, 10],
}

# Includes both endpoints: p0 and p100 are where an off-by-one in rank
# calculation shows up most clearly.
PERCENTILES = [0, 25, 50, 90, 95, 99, 100]


def _sqlite_percentile(values: Sequence[Optional[float]], percentile: int) -> Optional[float]:
    conn = sqlean.connect(":memory:")
    try:
        conn.execute("CREATE TABLE t(x REAL)")
        conn.executemany("INSERT INTO t VALUES(?)", [(v,) for v in values])
        row = conn.execute(f"SELECT percentile(x, {percentile}) FROM t").fetchone()
        if row is None or row[0] is None:
            return None
        return float(row[0])
    finally:
        conn.close()


async def _postgres_percentile(
    db: DbSessionFactory, values: Sequence[Optional[float]], percentile: int
) -> Optional[float]:
    if values:
        rows = ",".join("(NULL::float)" if v is None else f"({v}::float)" for v in values)
        source = f"(VALUES {rows}) AS v(x)"
    else:
        source = "(SELECT NULL::float AS x WHERE false) AS v"
    sql = f"SELECT percentile_cont({percentile / 100}) WITHIN GROUP (ORDER BY x) FROM {source}"
    async with db.read() as session:
        await session.execute(text("SET TRANSACTION READ ONLY"))
        return (await session.execute(text(sql))).scalar()


@pytest.mark.parametrize("percentile", PERCENTILES)
@pytest.mark.parametrize("dataset", list(DATASETS), ids=lambda name: name.replace(" ", "-"))
async def test_percentile_agrees_across_backends(
    db: DbSessionFactory, dataset: str, percentile: int
) -> None:
    values = DATASETS[dataset]
    postgres = await _postgres_percentile(db, values, percentile)
    sqlite = _sqlite_percentile(values, percentile)

    if postgres is None or sqlite is None:
        assert postgres is None and sqlite is None, (
            f"one backend returned a value and the other did not: "
            f"postgres={postgres!r} sqlite={sqlite!r}"
        )
        return

    assert abs(float(postgres) - float(sqlite)) < TOLERANCE, (
        f"p{percentile} of {dataset} differs beyond representation noise: "
        f"postgres={postgres!r} sqlite={sqlite!r}"
    )


async def test_empty_input_yields_null_on_both(db: DbSessionFactory) -> None:
    """Called out separately because returning zero here would be defensible and wrong.

    An aggregate over no rows has no percentile. A backend that returned 0
    instead of null would silently turn "no data" into "the value is zero" in
    every dashboard built on it.
    """
    assert await _postgres_percentile(db, [], 50) is None
    assert _sqlite_percentile([], 50) is None
