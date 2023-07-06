from dataclasses import dataclass
from typing import Any, Tuple, cast

import numpy as np

from phoenix.core.data_type import CONTINUOUS
from phoenix.core.dimension import Dimension, Model


@dataclass(frozen=True)
class ScalarDimension(Dimension):
    @property
    def min_max(self) -> Tuple[Any, Any]:
        if self._model is None:
            return np.nan, np.nan
        model = cast(Model, self._model)
        return model.dimension_min_max_from_all_df(self.name)

    @property
    def categories(self) -> Tuple[str, ...]:
        if self._model is None or self.data_type is CONTINUOUS:
            return ()
        model = cast(Model, self._model)
        return model.dimension_categories_from_all_datasets(self.name)
