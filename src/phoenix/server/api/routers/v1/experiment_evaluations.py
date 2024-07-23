from datetime import datetime
from typing import Any, Dict, Literal, Optional

from fastapi import APIRouter, HTTPException
from pydantic import Field
from starlette.requests import Request
from starlette.status import HTTP_404_NOT_FOUND
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.db.insertion.helpers import insert_on_conflict
from phoenix.server.api.types.node import from_global_id_with_expected_type

from .pydantic_compat import V1RoutesBaseModel
from .utils import ResponseBody, add_errors_to_responses

router = APIRouter(tags=["experiments"], include_in_schema=False)


class ExperimentEvaluationResult(V1RoutesBaseModel):
    label: Optional[str] = Field(default=None, description="The label assigned by the evaluation")
    score: Optional[float] = Field(default=None, description="The score assigned by the evaluation")
    explanation: Optional[str] = Field(
        default=None, description="Explanation of the evaluation result"
    )


class UpsertExperimentEvaluationRequestBody(V1RoutesBaseModel):
    experiment_run_id: str = Field(description="The ID of the experiment run being evaluated")
    name: str = Field(description="The name of the evaluation")
    annotator_kind: Literal["LLM", "CODE", "HUMAN"] = Field(
        description="The kind of annotator used for the evaluation"
    )
    start_time: datetime = Field(description="The start time of the evaluation in ISO format")
    end_time: datetime = Field(description="The end time of the evaluation in ISO format")
    result: ExperimentEvaluationResult = Field(description="The result of the evaluation")
    error: Optional[str] = Field(
        None, description="Optional error message if the evaluation encountered an error"
    )
    metadata: Optional[Dict[str, Any]] = Field(
        default=None, description="Metadata for the evaluation"
    )
    trace_id: Optional[str] = Field(default=None, description="Optional trace ID for tracking")


class UpsertExperimentEvaluationResponseBodyData(V1RoutesBaseModel):
    id: str = Field(description="The ID of the upserted experiment evaluation")


class UpsertExperimentEvaluationResponseBody(
    ResponseBody[UpsertExperimentEvaluationResponseBodyData]
):
    pass


@router.post(
    "/experiment_evaluations",
    operation_id="upsertExperimentEvaluation",
    summary="Create or update evaluation for an experiment run",
    responses=add_errors_to_responses(
        [{"status_code": HTTP_404_NOT_FOUND, "description": "Experiment run not found"}]
    ),
)
async def upsert_experiment_evaluation(
    request: Request, request_body: UpsertExperimentEvaluationRequestBody
) -> UpsertExperimentEvaluationResponseBody:
    payload = await request.json()
    experiment_run_gid = GlobalID.from_id(payload["experiment_run_id"])
    try:
        experiment_run_id = from_global_id_with_expected_type(experiment_run_gid, "ExperimentRun")
    except ValueError:
        raise HTTPException(
            detail=f"ExperimentRun with ID {experiment_run_gid} does not exist",
            status_code=HTTP_404_NOT_FOUND,
        )
    name = request_body.name
    annotator_kind = request_body.annotator_kind
    result = request_body.result
    label = result.label if result else None
    score = result.score if result else None
    explanation = result.explanation if result else None
    error = request_body.error
    metadata = request_body.metadata or {}
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
        dialect = SupportedSQLDialect(session.bind.dialect.name)
        exp_eval_run = await session.scalar(
            insert_on_conflict(
                values,
                dialect=dialect,
                table=models.ExperimentRunAnnotation,
                unique_by=("experiment_run_id", "name"),
            ).returning(models.ExperimentRunAnnotation)
        )
    evaluation_gid = GlobalID("ExperimentEvaluation", str(exp_eval_run.id))
    return UpsertExperimentEvaluationResponseBody(
        data=UpsertExperimentEvaluationResponseBodyData(id=str(evaluation_gid))
    )
