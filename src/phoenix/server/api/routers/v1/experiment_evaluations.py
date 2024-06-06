from starlette.requests import Request
from starlette.responses import JSONResponse, Response

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
        experiment_evaluation = models.ExperimentEvaluation(
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
        session.add(experiment_evaluation)
        await session.commit()
        eval_payload = {
            "id": experiment_evaluation.id,
            "experiment_run_id": experiment_evaluation.experiment_run_id,
            "name": experiment_evaluation.name,
            "label": experiment_evaluation.label,
            "score": experiment_evaluation.score,
            "explanation": experiment_evaluation.explanation,
            "error": experiment_evaluation.error,
            "metadata": experiment_evaluation.metadata_,
            "start_time": experiment_evaluation.start_time,
            "end_time": experiment_evaluation.end_time,
        }
        return JSONResponse(content=eval_payload, status_code=200)
