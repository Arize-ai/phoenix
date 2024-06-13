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
        name: version-id
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
                  type: array
                  items:
                    type: object
                    properties:
                      example_id:
                        type: string
                      input:
                        type: object
                      output:
                        type: object
                      metadata:
                        type: object
      403:
        description: Forbidden
      404:
        description: Dataset does not exist.
    """
    dataset_id = GlobalID.from_id(request.path_params["id"])
    raw_version_id = request.query_params.get("version-id")
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

        revision_ids = (
            select(func.max(DatasetExampleRevision.id))
            .join(DatasetExample, DatasetExample.id == DatasetExampleRevision.dataset_example_id)
            .where(
                and_(
                    DatasetExample.dataset_id == resolved_dataset_id,
                    DatasetExampleRevision.dataset_version_id <= resolved_version_id,
                )
            )
            .group_by(DatasetExampleRevision.dataset_example_id)
        )
        query = (
            select(DatasetExample, DatasetExampleRevision)
            .select_from(DatasetExample)
            .join(
                DatasetExampleRevision,
                DatasetExampleRevision.dataset_example_id == DatasetExample.id,
            )
            .where(
                and_(
                    DatasetExampleRevision.id.in_(revision_ids),
                    DatasetExampleRevision.revision_kind != "DELETE",
                )
            )
            .order_by(DatasetExample.id.asc())
        )
        examples = []
        for example, revision in await session.execute(query):
            examples.append(
                {
                    "id": str(GlobalID("DatasetExample", str(example.id))),
                    "input": revision.input,
                    "output": revision.output,
                    "metadata": revision.metadata_,
                    "updated_at": revision.created_at.isoformat(),
                }
            )
        return JSONResponse(examples)
