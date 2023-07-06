import asyncio
from collections import defaultdict
from datetime import datetime
from typing import Dict, List, Optional, Tuple

import strawberry
from strawberry import ID, UNSET
from strawberry.types import Info

from phoenix.core.dataset_role import DatasetRole
from phoenix.server.api.context import Context
from phoenix.server.api.input_types.ClusterInput import ClusterInput
from phoenix.server.api.types.Event import parse_event_ids, unpack_event_id
from phoenix.server.api.types.ExportedFile import ExportedFile


@strawberry.type
class ExportEventsMutation:
    @strawberry.mutation(
        description=(
            "Given a list of event ids, export the corresponding data subset in Parquet format."
            " File name is optional, but if specified, should be without file extension. By default"
            " the exported file name is current timestamp."
        ),
    )  # type: ignore  # https://github.com/strawberry-graphql/strawberry/issues/1929
    async def export_events(
        self,
        info: Info[Context, None],
        event_ids: List[ID],
        file_name: Optional[str] = UNSET,
    ) -> ExportedFile:
        if not isinstance(file_name, str):
            file_name = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        row_ids = parse_event_ids(event_ids)
        path = info.context.export_path
        with open(path / (file_name + ".parquet"), "wb") as fd:
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(
                None,
                info.context.model.export_rows_as_parquet_file,
                row_ids,
                fd,
            )
        return ExportedFile(file_name=file_name)

    @strawberry.mutation(
        description=(
            "Given a list of clusters, export the corresponding data subset in Parquet format."
            " File name is optional, but if specified, should be without file extension. By default"
            " the exported file name is current timestamp."
        ),
    )  # type: ignore
    async def export_clusters(
        self,
        info: Info[Context, None],
        clusters: List[ClusterInput],
        file_name: Optional[str] = UNSET,
    ) -> ExportedFile:
        if not isinstance(file_name, str):
            file_name = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        row_numbers, cluster_ids = _unpack_clusters(clusters)
        path = info.context.export_path
        with open(path / (file_name + ".parquet"), "wb") as fd:
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(
                None,
                info.context.model.export_rows_as_parquet_file,
                row_numbers,
                fd,
                cluster_ids,
            )
        return ExportedFile(file_name=file_name)


def _unpack_clusters(
    clusters: List[ClusterInput],
) -> Tuple[Dict[DatasetRole, List[int]], Dict[DatasetRole, Dict[int, str]]]:
    row_numbers: Dict[DatasetRole, List[int]] = defaultdict(list)
    cluster_ids: Dict[DatasetRole, Dict[int, str]] = defaultdict(dict)
    for i, cluster in enumerate(clusters):
        for row_number, dataset_role in map(unpack_event_id, cluster.event_ids):
            row_numbers[dataset_role].append(row_number)
            cluster_ids[dataset_role][row_number] = cluster.id or str(i)
    return row_numbers, cluster_ids
