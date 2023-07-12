import asyncio
from collections import defaultdict
from datetime import datetime
from typing import Dict, List, Optional, Tuple

import strawberry
from strawberry import ID, UNSET
from strawberry.types import Info

import phoenix.core.model_schema as ms
from phoenix.server.api.context import Context
from phoenix.server.api.input_types.ClusterInput import ClusterInput
from phoenix.server.api.types.DatasetRole import AncillaryDatasetRole, DatasetRole
from phoenix.server.api.types.Event import parse_event_ids_by_dataset_role, unpack_event_id
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
        row_ids = parse_event_ids_by_dataset_role(event_ids)
        exclude_corpus_row_ids = {}
        for dataset_role in list(row_ids.keys()):
            if isinstance(dataset_role, DatasetRole):
                exclude_corpus_row_ids[dataset_role.value] = row_ids[dataset_role]
        path = info.context.export_path
        with open(path / (file_name + ".parquet"), "wb") as fd:
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(
                None,
                info.context.model.export_rows_as_parquet_file,
                exclude_corpus_row_ids,
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
) -> Tuple[Dict[ms.DatasetRole, List[int]], Dict[ms.DatasetRole, Dict[int, str]]]:
    row_numbers: Dict[ms.DatasetRole, List[int]] = defaultdict(list)
    cluster_ids: Dict[ms.DatasetRole, Dict[int, str]] = defaultdict(dict)
    for i, cluster in enumerate(clusters):
        for row_number, dataset_role in map(unpack_event_id, cluster.event_ids):
            if isinstance(dataset_role, AncillaryDatasetRole):
                continue
            row_numbers[dataset_role.value].append(row_number)
            cluster_ids[dataset_role.value][row_number] = cluster.id or str(i)
    return row_numbers, cluster_ids
