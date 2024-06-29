from sqlalchemy import and_, func, select
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.status import HTTP_404_NOT_FOUND
from strawberry.relay import GlobalID

from phoenix.db.models import Dataset, DatasetExample, DatasetExampleRevision, DatasetVersion


async def list_dataset_examples(request: Request) -> Response:
    """
    summary: Get dataset examples by dataset ID
    operationId: getDatasetExamples
    tags:
      - datasets
    parameters:
      - in: path
        name: id
        required: true
        schema:
          type: string
        description: Dataset ID
      - in: query
        name: version_id
        schema:
          type: string
        description: Dataset version ID. If omitted, returns the latest version.
    responses:
      200:
        description: Success
        content:
          application/json:
            schema:
              type: object
              properties:
                data:
                  type: object
                  properties:
                    dataset_id:
                      type: string
                      description: ID of the dataset
                    version_id:
                      type: string
                      description: ID of the version
                    examples:
                      type: array
                      items:
                        type: object
                        properties:
                          id:
                            type: string
                            description: ID of the dataset example
                          input:
                            type: object
                            description: Input data of the example
                          output:
                            type: object
                            description: Output data of the example
                          metadata:
                            type: object
                            description: Metadata of the example
                          updated_at:
                            type: string
                            format: date-time
                            description: ISO formatted timestamp of when the example was updated
                        required:
                          - id
                          - input
                          - output
                          - metadata
                          - updated_at
                  required:
                    - dataset_id
                    - version_id
                    - examples
      403:
        description: Forbidden
      404:
        description: Dataset does not exist.
    """
    dataset_id = GlobalID.from_id(request.path_params["id"])
    raw_version_id = request.query_params.get("version_id")
    version_id = GlobalID.from_id(raw_version_id) if raw_version_id else None

    if (dataset_type := dataset_id.type_name) != "Dataset":
        return Response(
            content=f"ID {dataset_id} refers to a {dataset_type}", status_code=HTTP_404_NOT_FOUND
        )

    if version_id and (version_type := version_id.type_name) != "DatasetVersion":
        return Response(
            content=f"ID {version_id} refers to a {version_type}", status_code=HTTP_404_NOT_FOUND
        )

    async with request.app.state.db() as session:
        if (
            resolved_dataset_id := await session.scalar(
                select(Dataset.id).where(Dataset.id == int(dataset_id.node_id))
            )
        ) is None:
            return Response(
                content=f"No dataset with id {dataset_id} can be found.",
                status_code=HTTP_404_NOT_FOUND,
            )

        # Subquery to find the maximum created_at for each dataset_example_id
        # timestamp tiebreaks are resolved by the largest id
        partial_subquery = select(
            func.max(DatasetExampleRevision.id).label("max_id"),
        ).group_by(DatasetExampleRevision.dataset_example_id)

        if version_id:
            if (
                resolved_version_id := await session.scalar(
                    select(DatasetVersion.id).where(
                        and_(
                            DatasetVersion.dataset_id == resolved_dataset_id,
                            DatasetVersion.id == int(version_id.node_id),
                        )
                    )
                )
            ) is None:
                return Response(
                    content=f"No dataset version with id {version_id} can be found.",
                    status_code=HTTP_404_NOT_FOUND,
                )
            # if a version_id is provided, filter the subquery to only include revisions from that
            partial_subquery = partial_subquery.filter(
                DatasetExampleRevision.dataset_version_id <= resolved_version_id
            )
        else:
            if (
                resolved_version_id := await session.scalar(
                    select(func.max(DatasetVersion.id)).where(
                        DatasetVersion.dataset_id == resolved_dataset_id
                    )
                )
            ) is None:
                return Response(
                    content="Dataset has no versions.",
                    status_code=HTTP_404_NOT_FOUND,
                )

        subquery = partial_subquery.subquery()
        # Query for the most recent example revisions that are not deleted
        query = (
            select(DatasetExample, DatasetExampleRevision)
            .join(
                DatasetExampleRevision,
                DatasetExample.id == DatasetExampleRevision.dataset_example_id,
            )
            .join(
                subquery,
                (subquery.c.max_id == DatasetExampleRevision.id),
            )
            .filter(DatasetExample.dataset_id == resolved_dataset_id)
            .filter(DatasetExampleRevision.revision_kind != "DELETE")
            .order_by(DatasetExample.id.asc())
        )
        examples = [
            {
                "id": str(GlobalID("DatasetExample", str(example.id))),
                "input": revision.input,
                "output": revision.output,
                "metadata": revision.metadata_,
                "updated_at": revision.created_at.isoformat(),
            }
            async for example, revision in await session.stream(query)
        ]
    return JSONResponse(
        {
            "data": {
                "dataset_id": str(GlobalID("Dataset", str(resolved_dataset_id))),
                "version_id": str(GlobalID("DatasetVersion", str(resolved_version_id))),
                "examples": examples,
            }
        }
    )
