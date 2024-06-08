from datetime import datetime

from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.status import HTTP_404_NOT_FOUND
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server.api.types.node import from_global_id_with_expected_type


async def create_experiment_evaluation(request: Request) -> Response:
    experiment_run_globalid = GlobalID.from_id(request.path_params["run_id"])
    try:
        experiment_run_id = from_global_id_with_expected_type(
            experiment_run_globalid, "ExperimentRun"
        )
    except ValueError:
        return Response(
            content=f"ExperimentRun with ID {experiment_run_globalid} does not exist",
            status_code=HTTP_404_NOT_FOUND,
        )

    payload = await request.json()
    name = payload.get("name")
    label = payload.get("label")
    score = payload.get("score")
    explanation = payload.get("explanation")
    error = payload.get("error")
    metadata = payload.get("metadata", {})
    start_time = payload.get("start_time")
    end_time = payload.get("end_time")
    async with request.app.state.db() as session:
        experiment_evaluation = models.ExperimentEvaluation(
            experiment_run_id=experiment_run_id,
            name=name,
            label=label,
            score=score,
            explanation=explanation,
            error=error,
            metadata_=metadata,
            start_time=datetime.fromisoformat(start_time),
            end_time=datetime.fromisoformat(end_time),
        )
        session.add(experiment_evaluation)
        await session.flush()
        evaluation_globalid = GlobalID("ExperimentEvaluation", str(experiment_evaluation.id))
        eval_payload = {
            "id": str(evaluation_globalid),
            "experiment_run_id": str(experiment_run_globalid),
            "name": experiment_evaluation.name,
            "label": experiment_evaluation.label,
            "score": experiment_evaluation.score,
            "explanation": experiment_evaluation.explanation,
            "error": experiment_evaluation.error,
            "metadata": experiment_evaluation.metadata_,
            "start_time": experiment_evaluation.start_time.isoformat(),
            "end_time": experiment_evaluation.end_time.isoformat(),
        }
        return JSONResponse(content=eval_payload, status_code=200)
