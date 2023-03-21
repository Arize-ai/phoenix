from dataclasses import dataclass
from typing import Any, Iterable, Mapping, Optional, Protocol, runtime_checkable

import pandas as pd


@runtime_checkable
class Metric(Protocol):
    def __call__(self, df: pd.DataFrame) -> Any:
        ...

    def id(self) -> int:
        ...

    def operands(self) -> Iterable[str]:
        ...

    def get_value(self, result: Mapping[int, Any]) -> Any:
        ...
