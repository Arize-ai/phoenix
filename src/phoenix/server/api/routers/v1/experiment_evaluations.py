from datetime import datetime

from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.status import HTTP_404_NOT_FOUND
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.db.insertion.helpers import OnConflict, insert_on_conflict
from phoenix.server.api.types.node import from_global_id_with_expected_type


async def upsert_experiment_evaluation(request: Request) -> Response:
    payload = await request.json()
    experiment_run_gid = GlobalID.from_id(payload["experiment_run_id"])
    try:
        experiment_run_id = from_global_id_with_expected_type(experiment_run_gid, "ExperimentRun")
    except ValueError:
        return Response(
            content=f"ExperimentRun with ID {experiment_run_gid} does not exist",
            status_code=HTTP_404_NOT_FOUND,
        )
    name = payload["name"]
    annotator_kind = payload["annotator_kind"]
    result = payload.get("result")
    label = result.get("label") if result else None
    score = result.get("score") if result else None
    explanation = result.get("explanation") if result else None
    error = payload.get("error")
    metadata = payload.get("metadata") or {}
    start_time = payload["start_time"]
    end_time = payload["end_time"]
    async with request.app.state.db() as session:
        values = dict(
            experiment_run_id=experiment_run_id,
            name=name,
            annotator_kind=annotator_kind,
            label=label,
            score=score,
            explanation=explanation,
            error=error,
            metadata_=metadata,  # `metadata_` must match database
            start_time=datetime.fromisoformat(start_time),
            end_time=datetime.fromisoformat(end_time),
            trace_id=payload.get("trace_id"),
        )
        set_ = {
            **{k: v for k, v in values.items() if k != "metadata_"},
            "metadata": values["metadata_"],  # `metadata` must match database
        }
        dialect = SupportedSQLDialect(session.bind.dialect.name)
        exp_eval_run = await session.scalar(
            insert_on_conflict(
                dialect=dialect,
                table=models.ExperimentRunAnnotation,
                values=values,
                constraint="uq_experiment_run_annotations_experiment_run_id_name",
                column_names=("experiment_run_id", "name"),
                on_conflict=OnConflict.DO_UPDATE,
                set_=set_,
            ).returning(models.ExperimentRunAnnotation)
        )
    evaluation_gid = GlobalID("ExperimentEvaluation", str(exp_eval_run.id))
    return JSONResponse(content={"data": {"id": str(evaluation_gid)}})
