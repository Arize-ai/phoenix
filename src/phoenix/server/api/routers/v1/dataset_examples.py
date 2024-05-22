from sqlalchemy import func, select
from starlette.responses import JSONResponse, Response
from starlette.status import HTTP_404_NOT_FOUND
from strawberry.relay import GlobalID

from phoenix.db.models import Dataset, DatasetExample, DatasetExampleRevision


async def list_dataset_examples(request):
    dataset_id = GlobalID.from_id(request.path_params["id"])
    raw_version_id = request.query_params.get("version")
    version_id = GlobalID.from_id(raw_version_id) if raw_version_id else None

    if (type_name := dataset_id.type_name) != "Dataset":
        return Response(
            content=f"ID {dataset_id} refers to a f{type_name}", status_code=HTTP_404_NOT_FOUND
        )

    async with request.app.state.db() as session:
        # Subquery to find the maximum created_at for each dataset_example_id
        # timestamp tiebreaks are resolved by the largest id
        subquery = select(
            DatasetExampleRevision.dataset_example_id,
            func.max(DatasetExampleRevision.created_at).label("most_recent"),
            func.max(DatasetExampleRevision.id).label("max_id"),
        ).group_by(DatasetExampleRevision.dataset_example_id)

        # if a version_id is provided, filter the subquery to only include revisions from that
        # version or earlier
        if version_id is not None:
            subquery = subquery.filter(
                (DatasetExampleRevision.dataset_version_id <= int(version_id.node_id))
            )

        subquery = subquery.subquery()

        # Query for the most recent example revisions that are not deleted
        query = (
            select(DatasetExample, DatasetExampleRevision)
            .join(
                DatasetExampleRevision,
                DatasetExample.id == DatasetExampleRevision.dataset_example_id,
            )
            .join(
                subquery,
                (subquery.c.dataset_example_id == DatasetExampleRevision.dataset_example_id)
                & (subquery.c.most_recent == DatasetExampleRevision.created_at)
                & (subquery.c.max_id == DatasetExampleRevision.id),
            )
            .filter(DatasetExample.dataset_id == int(dataset_id.node_id))
            .filter(DatasetExampleRevision.revision_kind != "DELETE")
            .order_by(DatasetExample.id.asc())
        )

        result = (await session.execute(query)).all()
        data = []
        for example, revision in result:
            data.append(
                {
                    "id": str(GlobalID("DatasetExample", str(example.id))),
                    "input": revision.input,
                    "output": revision.output,
                    "metadata": revision.metadata_,
                    "updated_at": revision.created_at.isoformat(),
                }
            )
        if not data:
            # make a second query to determine if the dataset exists
            dataset = (
                await session.execute(select(Dataset).where(Dataset.id == int(dataset_id.node_id)))
            ).all()
            if not dataset:
                return Response(
                    content=f"No dataset with id {dataset_id} can be found.",
                    status_code=HTTP_404_NOT_FOUND,
                )
        return JSONResponse(data)
