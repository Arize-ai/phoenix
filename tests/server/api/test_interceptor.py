from typing import Optional

import numpy as np
import strawberry
from phoenix.server.api.interceptor import NoneIfNan


@strawberry.type
class T:
    x: Optional[float] = strawberry.field(default=NoneIfNan())


def test_none_if_nan():
    assert T(x=np.nan).x is None
    assert T(x=np.array([np.nan], dtype=np.half)[0]).x is None
