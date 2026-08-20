"""
REST routes for experiment tags.

The dataset-scoped "movable pointer" semantics these routes expose live in
`phoenix.server.api.experiment_tags`, which the GraphQL `setExperimentBaseline`
mutation shares.
"""

from typing import Optional, cast

from fastapi import APIRouter, Depends, HTTPException, Path
from pydantic import Field, ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request
from starlette.responses import Response
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.types.identifier import Identifier
from phoenix.server.api.experiment_tags import (
    BASELINE_EXPERIMENT_TAG_NAME,
    remove_experiment_tag,
    upsert_experiment_tag,
)
from phoenix.server.api.routers.v1.models import V1RoutesBaseModel
from phoenix.server.api.routers.v1.utils import ResponseBody, add_errors_to_responses
from phoenix.server.api.types.ExperimentTag import ExperimentTag as ExperimentTagNodeType
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.authorization import is_not_locked
from phoenix.server.bearer_auth import PhoenixUser

router = APIRouter(tags=["experiments"])


class ExperimentTag(V1RoutesBaseModel):
    id: str = Field(description="The node ID of the tag")
    name: str = Field(description="The name of the tag")
    description: Optional[str] = Field(description="The description of the tag")


class SetExperimentTagRequestBody(V1RoutesBaseModel):
    name: Identifier = Field(
        description=(
            "The name of the tag to assign, e.g. 'baseline'. If another experiment on the "
            "same dataset already owns this tag, the tag is moved to this experiment."
        )
    )
    description: Optional[str] = Field(
        default=None,
        description="An optional description of the tag (replaces any existing description)",
    )


class ListExperimentTagsResponseBody(ResponseBody[list[ExperimentTag]]):
    pass


class SetExperimentTagResponseBody(ResponseBody[ExperimentTag]):
    pass


async def _get_experiment(session: AsyncSession, experiment_id: str) -> models.Experiment:
    """
    Resolve an experiment GlobalID to its database row.

    Raises `HTTPException` with 422 for a malformed identifier and 404 when no
    such experiment exists.
    """
    try:
        rowid = from_global_id_with_expected_type(GlobalID.from_id(experiment_id), "Experiment")
    except ValueError:
        raise HTTPException(status_code=422, detail=f"Invalid experiment ID: {experiment_id}")
    experiment = await session.get(models.Experiment, rowid)
    if experiment is None:
        raise HTTPException(status_code=404, detail="Experiment not found")
    return experiment


def _to_experiment_tag(tag: models.ExperimentTag) -> ExperimentTag:
    return ExperimentTag(
        id=str(GlobalID(ExperimentTagNodeType.__name__, str(tag.id))),
        name=tag.name,
        description=tag.description,
    )


async def _resolve_experiment_tag_name(
    session: AsyncSession,
    *,
    experiment: models.Experiment,
    tag_identifier: str,
) -> Optional[str]:
    try:
        tag_id = from_global_id_with_expected_type(
            GlobalID.from_id(tag_identifier), ExperimentTagNodeType.__name__
        )
    except ValueError:
        try:
            return str(Identifier.model_validate(tag_identifier))
        except ValidationError:
            raise HTTPException(status_code=422, detail=f"Invalid tag identifier: {tag_identifier}")
    return cast(
        Optional[str],
        await session.scalar(
            select(models.ExperimentTag.name)
            .where(models.ExperimentTag.id == tag_id)
            .where(models.ExperimentTag.dataset_id == experiment.dataset_id)
        ),
    )


@router.get(
    "/experiments/{experiment_id}/tags",
    operation_id="listExperimentTags",
    summary="List the tags applied to an experiment",
    description=(
        "List the tags currently pointing at this experiment. Tags are scoped to the "
        "experiment's dataset, so a tag appears here only while this experiment owns it."
    ),
    responses=add_errors_to_responses(
        [
            {"status_code": 404, "description": "Experiment not found"},
            {"status_code": 422, "description": "Invalid experiment ID"},
        ]
    ),
    response_description="The tags currently applied to the experiment",
    response_model_by_alias=True,
    response_model_exclude_unset=True,
    response_model_exclude_defaults=True,
)
async def list_experiment_tags(
    request: Request,
    experiment_id: str = Path(description="The ID of the experiment"),
) -> ListExperimentTagsResponseBody:
    async with request.app.state.db() as session:
        experiment = await _get_experiment(session, experiment_id)
        tags = (
            await session.scalars(
                select(models.ExperimentTag)
                .where(models.ExperimentTag.experiment_id == experiment.id)
                .order_by(models.ExperimentTag.name)
            )
        ).all()
    return ListExperimentTagsResponseBody(data=[_to_experiment_tag(tag) for tag in tags])


@router.post(
    "/experiments/{experiment_id}/tags",
    dependencies=[Depends(is_not_locked)],
    operation_id="setExperimentTag",
    summary="Assign a tag to an experiment",
    description=(
        "Assign a tag to an experiment. Tags are scoped to the experiment's dataset and each "
        "tag name points at a single experiment, so assigning a tag that another experiment "
        "on the same dataset owns atomically moves the tag to this experiment. Re-assigning a "
        "tag the experiment already owns is idempotent and replaces the description. Assigning "
        "the reserved 'baseline' tag makes this experiment the dataset's baseline; ephemeral "
        "experiments cannot become the baseline."
    ),
    responses=add_errors_to_responses(
        [
            {"status_code": 404, "description": "Experiment not found"},
            {
                "status_code": 422,
                "description": (
                    "Invalid experiment ID or request body, or the experiment is ephemeral "
                    "and cannot be tagged as the baseline"
                ),
            },
        ]
    ),
    response_description="The tag as it now applies to the experiment",
    response_model_by_alias=True,
    response_model_exclude_unset=True,
    response_model_exclude_defaults=True,
)
async def set_experiment_tag(
    request: Request,
    request_body: SetExperimentTagRequestBody,
    experiment_id: str = Path(description="The ID of the experiment"),
) -> SetExperimentTagResponseBody:
    name = str(request_body.name)
    user_id: Optional[int] = None
    if request.app.state.authentication_enabled and isinstance(request.user, PhoenixUser):
        user_id = int(request.user.identity)
    async with request.app.state.db() as session:
        experiment = await _get_experiment(session, experiment_id)
        if name == BASELINE_EXPERIMENT_TAG_NAME and experiment.is_ephemeral:
            raise HTTPException(
                status_code=422,
                detail=(
                    "Ephemeral experiments cannot be marked as baseline. Reinstate the "
                    "experiment before tagging it as the baseline."
                ),
            )
        await upsert_experiment_tag(
            session,
            experiment=experiment,
            name=name,
            description=request_body.description,
            user_id=user_id,
            dialect=request.app.state.db.dialect,
        )
        tag = await session.scalar(
            select(models.ExperimentTag)
            .where(models.ExperimentTag.dataset_id == experiment.dataset_id)
            .where(models.ExperimentTag.name == name)
        )
        assert tag is not None
        response_tag = _to_experiment_tag(tag)
    return SetExperimentTagResponseBody(data=response_tag)


@router.delete(
    "/experiments/{experiment_id}/tags/{tag_identifier}",
    operation_id="deleteExperimentTag",
    summary="Remove a tag from an experiment",
    description=(
        "Remove a tag, identified by its node ID or name, from the experiment that owns it. "
        "This operation is idempotent and never steals a tag from another experiment: if "
        "the experiment does not currently own the tag, the request is a no-op."
    ),
    status_code=204,
    responses=add_errors_to_responses(
        [
            {"status_code": 404, "description": "Experiment not found"},
            {"status_code": 422, "description": "Invalid experiment ID or tag identifier"},
        ]
    ),
    response_description="No content returned on successful tag removal",
)
async def delete_experiment_tag(
    request: Request,
    experiment_id: str = Path(description="The ID of the experiment"),
    tag_identifier: str = Path(description="The node ID or name of the tag to remove"),
) -> Response:
    async with request.app.state.db() as session:
        experiment = await _get_experiment(session, experiment_id)
        name = await _resolve_experiment_tag_name(
            session,
            experiment=experiment,
            tag_identifier=tag_identifier,
        )
        if name is not None:
            await remove_experiment_tag(session, experiment=experiment, name=name)
    return Response(status_code=204)
