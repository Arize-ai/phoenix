from typing import Optional

import numpy as np
import strawberry
from phoenix.server.api.interceptor import GqlValueMediator


@strawberry.type
class T:
    x: Optional[float] = strawberry.field(default=GqlValueMediator())


def test_gql_value_mediator():
    assert T(x=np.nan).x is None
    assert T(x=np.array([np.nan], dtype=np.half)[0]).x is None
    assert isinstance(T(x=1).x, int)
    assert isinstance(T(x=int(1)).x, int)
    assert isinstance(T(x=1.1).x, float)
    assert isinstance(T(x=float(1.1)).x, float)
    assert isinstance(T(x=np.array([1], dtype=np.int16)[0]).x, int)
    assert isinstance(T(x=np.array([1.1], dtype=np.half)[0]).x, float)
    assert isinstance(T(x=np.array([1], dtype=np.bool_)[0]).x, bool)
