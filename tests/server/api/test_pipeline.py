from dataclasses import dataclass, field
from typing import Tuple

import numpy as np
import pytest
from numpy.testing import assert_almost_equal
from phoenix.server.api.pipeline import Pipeline, Step


@dataclass(frozen=True)
class Val:
    value: float = field(default=0)


class Add(Step[Val, Tuple[int], float]):
    def __call__(self, x: Tuple[int]) -> float:
        return x[0] + self.parameters.value


class Mul(Step[Val, float, Tuple[int]]):
    def __call__(self, x: float) -> Tuple[int]:
        return (int(x * self.parameters.value),)


class Calc(Pipeline[Tuple[int], Tuple[Add, Mul, Add, Mul, Add], float]):
    """Tuple[int] => Add -> Mul -> Add -> Mul -> Add => float"""


@pytest.mark.parametrize("seed", [12345, 23456])
def test_pipeline(seed: int) -> None:
    np.random.seed(seed)
    x = np.random.rand(6) * 10
    pipeline = Calc(
        Add(Val(x[1])),
        Mul(Val(x[2])),
        Add(Val(x[3])),
        Mul(Val(x[4])),
        Add(Val(x[5])),
    )
    progression = (
        (int(x[0]),),
        int(x[0]) + x[1],
        (int((int(x[0]) + x[1]) * x[2]),),
        int((int(x[0]) + x[1]) * x[2]) + x[3],
        (int((int((int(x[0]) + x[1]) * x[2]) + x[3]) * x[4]),),
        int((int((int(x[0]) + x[1]) * x[2]) + x[3]) * x[4]) + x[5],
    )
    for start in range(len(progression) - 1):
        for stop in range(start + 1, len(progression)):
            for actual, desired in zip(
                pipeline(progression[start], start, stop),
                progression[start + 1 : stop + 1],
            ):
                assert_almost_equal(
                    actual,
                    desired,
                    err_msg=f"start={start}, stop={stop}",
                )
