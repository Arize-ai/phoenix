from typing import Optional

import pytest

from phoenix.server.api.dataloaders.types import CostBreakdown


@pytest.mark.parametrize(
    "tokens, cost, expected",
    [
        pytest.param(100, 0.5, 0.005, id="priced"),
        pytest.param(100, 0.0, 0.0, id="zero-cost"),
        pytest.param(100, None, None, id="no-price"),
        pytest.param(0, 0.5, None, id="no-tokens"),
        pytest.param(None, 0.5, None, id="unknown-tokens"),
    ],
)
def test_cost_per_token(
    tokens: Optional[float], cost: Optional[float], expected: Optional[float]
) -> None:
    assert CostBreakdown(tokens=tokens, cost=cost).cost_per_token == pytest.approx(expected)
