from dataclasses import dataclass
from typing import TYPE_CHECKING, Dict, Iterator, NamedTuple, Tuple, cast

import numpy as np
import numpy.typing as npt
import pandas as pd
from typing_extensions import TypeAlias

from phoenix.core.model_schema import PRIMARY, Dataset, EventId, Model
from phoenix.metrics.timeseries import row_interval_from_sorted_time_index
from phoenix.server.api.input_types.ClustersFinder import ClustersFinder
from phoenix.server.api.input_types.DataSelector import DataSelector
from phoenix.server.api.input_types.DimensionalityReducer import DimensionalityReducer
from phoenix.server.api.input_types.TimeRange import ensure_time_range
from phoenix.server.api.pipeline import Pipeline, Step

Vector: TypeAlias = npt.NDArray[np.float64]
Matrix: TypeAlias = npt.NDArray[np.float64]
ClusterId: TypeAlias = int


class DataCollectorParameters(NamedTuple):
    data_selector: DataSelector
    vector_dimension_name: str


@dataclass(frozen=True)
class CollectData(
    Step[
        DataCollectorParameters,
        Model,
        Tuple[
            Tuple[EventId],
            Matrix,
        ],
    ]
):
    def __call__(
        self,
        model: Model,
    ) -> Tuple[Tuple[EventId], Matrix]:
        data_selector, vector_dimension_name = self.parameters
        time_range = ensure_time_range(
            data_selector.time_range,
            model[PRIMARY],
        )
        data_sampler = data_selector.data_sampler
        dimension = model[vector_dimension_name]
        data: Dict[EventId, Vector] = {}
        for dataset in model[Dataset]:
            dataset_id = dataset.role
            row_id_start, row_id_stop = 0, len(dataset)
            n_samples = row_id_stop - row_id_start
            seed = 0
            if data_sampler is not None:
                n_samples = data_sampler.n_samples
                seed = data_sampler.seed
            if dataset_id is PRIMARY:
                row_id_start, row_id_stop = row_interval_from_sorted_time_index(
                    time_index=cast(pd.DatetimeIndex, dataset.index),
                    time_start=time_range.start,
                    time_stop=time_range.end,
                )
            vector_column = dimension(dataset)
            samples_collected = 0
            for row_id in _row_indices(
                row_id_start,
                row_id_stop,
                shuffle=0 < n_samples < (row_id_stop - row_id_start),
                seed=seed,  # ignored if no shuffle
            ):
                if samples_collected >= n_samples:
                    break
                embedding_vector = vector_column.iloc[row_id]
                # Exclude scalar values, e.g. None/NaN, by checking the presence
                # of dunder method __len__.
                if not hasattr(embedding_vector, "__len__"):
                    continue
                event_id = EventId(row_id, dataset_id)
                data[event_id] = embedding_vector
                samples_collected += 1
        identifiers, vectors = zip(*data.items())
        return cast(Tuple[EventId], identifiers), np.stack(vectors)


class ReduceDimensionality(
    Step[
        DimensionalityReducer,
        Tuple[
            Tuple[EventId],
            Matrix,
        ],
        Tuple[
            Tuple[EventId],
            Matrix,
        ],
    ]
):
    def __call__(
        self,
        data: Tuple[Tuple[EventId], Matrix],
    ) -> Tuple[Tuple[EventId], Matrix]:
        if not data:
            return (), np.array([], dtype=np.float64)
        dimensionality_reducer = self.parameters()
        identifiers, matrix = data
        projections = dimensionality_reducer.reduce_dimensionality(
            matrix,
        )
        return identifiers, projections


class FindClusters(
    Step[
        ClustersFinder,
        Tuple[
            Tuple[EventId],
            Matrix,
        ],
        Tuple[
            Dict[EventId, Vector],
            Dict[EventId, ClusterId],
        ],
    ]
):
    def __call__(
        self,
        data: Tuple[Tuple[EventId], Matrix],
    ) -> Tuple[Dict[EventId, Vector], Dict[EventId, ClusterId]]:
        if not data:
            return {}, {}
        clusters_finder = self.parameters()
        identifiers, projections = data
        clusters = clusters_finder.find_clusters(projections)
        # the first element in the returned tuple is a pass-through
        # to keep the pipeline linearized and one directional
        return dict(zip(*data)), {
            identifiers[row_index]: cluster_id
            for cluster_id, cluster in enumerate(clusters)
            for row_index in cluster
        }


def _row_indices(
    start: int,
    stop: int,
    /,
    shuffle: bool = False,
    seed: int = 0,
) -> Iterator[int]:
    if not shuffle:
        yield from range(start, stop)
        return
    shuffled_indices = np.arange(start, stop)
    np.random.seed(seed)
    np.random.shuffle(shuffled_indices)
    yield from shuffled_indices


Result: TypeAlias = Tuple[
    Dict[EventId, Vector],
    Dict[EventId, ClusterId],
]

if TYPE_CHECKING:
    _BasePipeline: TypeAlias = Pipeline[
        Model,
        [
            CollectData,
            ReduceDimensionality,
            FindClusters,
        ],
        Result,
    ]
else:
    _BasePipeline: TypeAlias = Pipeline[
        Model,
        Tuple[
            CollectData,
            ReduceDimensionality,
            FindClusters,
        ],
        Result,
    ]


class PointCloudPipeline(_BasePipeline):
    ...
