from starlette.requests import Request
from starlette.responses import Response

from phoenix.db import models


async def create_experiment_evaluation(request: Request) -> Response:
    experiment_run_id = request.path_params.get("run_id")
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
        experiment_run = models.ExperimentEvaluation(
            experiment_run_id=experiment_run_id,
            name=name,
            label=label,
            score=score,
            explanation=explanation,
            error=error,
            metadata_=metadata,
            start_time=start_time,
            end_time=end_time,
        )
        session.add(experiment_run)
        await session.commit()
        return Response(status_code=200)
