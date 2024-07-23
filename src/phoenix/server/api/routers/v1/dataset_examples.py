from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Path, Query
from sqlalchemy import and_, func, select
from starlette.requests import Request
from starlette.status import HTTP_404_NOT_FOUND
from strawberry.relay import GlobalID

from phoenix.db.models import (
    Dataset as ORMDataset,
)
from phoenix.db.models import (
    DatasetExample as ORMDatasetExample,
)
from phoenix.db.models import (
    DatasetExampleRevision as ORMDatasetExampleRevision,
)
from phoenix.db.models import (
    DatasetVersion as ORMDatasetVersion,
)

from .pydantic_compat import V1RoutesBaseModel
from .utils import ResponseBody, add_errors_to_responses

router = APIRouter(tags=["datasets"])


class DatasetExample(V1RoutesBaseModel):
    id: str
    input: Dict[str, Any]
    output: Dict[str, Any]
    metadata: Dict[str, Any]
    updated_at: datetime


class ListDatasetExamplesData(V1RoutesBaseModel):
    dataset_id: str
    version_id: str
    examples: List[DatasetExample]


class ListDatasetExamplesResponseBody(ResponseBody[ListDatasetExamplesData]):
    pass


@router.get(
    "/datasets/{id}/examples",
    operation_id="getDatasetExamples",
    summary="Get examples from a dataset",
    responses=add_errors_to_responses([HTTP_404_NOT_FOUND]),
)
async def get_dataset_examples(
    request: Request,
    id: str = Path(description="The ID of the dataset"),
    version_id: Optional[str] = Query(
        default=None,
        description=(
            "The ID of the dataset version " "(if omitted, returns data from the latest version)"
        ),
    ),
) -> ListDatasetExamplesResponseBody:
    dataset_gid = GlobalID.from_id(id)
    version_gid = GlobalID.from_id(version_id) if version_id else None

    if (dataset_type := dataset_gid.type_name) != "Dataset":
        raise HTTPException(
            detail=f"ID {dataset_gid} refers to a {dataset_type}", status_code=HTTP_404_NOT_FOUND
        )

    if version_gid and (version_type := version_gid.type_name) != "DatasetVersion":
        raise HTTPException(
            detail=f"ID {version_gid} refers to a {version_type}", status_code=HTTP_404_NOT_FOUND
        )

    async with request.app.state.db() as session:
        if (
            resolved_dataset_id := await session.scalar(
                select(ORMDataset.id).where(ORMDataset.id == int(dataset_gid.node_id))
            )
        ) is None:
            raise HTTPException(
                detail=f"No dataset with id {dataset_gid} can be found.",
                status_code=HTTP_404_NOT_FOUND,
            )

        # Subquery to find the maximum created_at for each dataset_example_id
        # timestamp tiebreaks are resolved by the largest id
        partial_subquery = select(
            func.max(ORMDatasetExampleRevision.id).label("max_id"),
        ).group_by(ORMDatasetExampleRevision.dataset_example_id)

        if version_gid:
            if (
                resolved_version_id := await session.scalar(
                    select(ORMDatasetVersion.id).where(
                        and_(
                            ORMDatasetVersion.dataset_id == resolved_dataset_id,
                            ORMDatasetVersion.id == int(version_gid.node_id),
                        )
                    )
                )
            ) is None:
                raise HTTPException(
                    detail=f"No dataset version with id {version_id} can be found.",
                    status_code=HTTP_404_NOT_FOUND,
                )
            # if a version_id is provided, filter the subquery to only include revisions from that
            partial_subquery = partial_subquery.filter(
                ORMDatasetExampleRevision.dataset_version_id <= resolved_version_id
            )
        else:
            if (
                resolved_version_id := await session.scalar(
                    select(func.max(ORMDatasetVersion.id)).where(
                        ORMDatasetVersion.dataset_id == resolved_dataset_id
                    )
                )
            ) is None:
                raise HTTPException(
                    detail="Dataset has no versions.",
                    status_code=HTTP_404_NOT_FOUND,
                )

        subquery = partial_subquery.subquery()
        # Query for the most recent example revisions that are not deleted
        query = (
            select(ORMDatasetExample, ORMDatasetExampleRevision)
            .join(
                ORMDatasetExampleRevision,
                ORMDatasetExample.id == ORMDatasetExampleRevision.dataset_example_id,
            )
            .join(
                subquery,
                (subquery.c.max_id == ORMDatasetExampleRevision.id),
            )
            .filter(ORMDatasetExample.dataset_id == resolved_dataset_id)
            .filter(ORMDatasetExampleRevision.revision_kind != "DELETE")
            .order_by(ORMDatasetExample.id.asc())
        )
        examples = [
            DatasetExample(
                id=str(GlobalID("DatasetExample", str(example.id))),
                input=revision.input,
                output=revision.output,
                metadata=revision.metadata_,
                updated_at=revision.created_at,
            )
            async for example, revision in await session.stream(query)
        ]
    return ListDatasetExamplesResponseBody(
        data=ListDatasetExamplesData(
            dataset_id=str(GlobalID("Dataset", str(resolved_dataset_id))),
            version_id=str(GlobalID("DatasetVersion", str(resolved_version_id))),
            examples=examples,
        )
    )
