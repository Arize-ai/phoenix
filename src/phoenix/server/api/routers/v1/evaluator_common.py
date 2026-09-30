"""Shared request models and adapters for evaluator REST endpoints."""

from contextlib import contextmanager
from typing import Annotated, Iterator, Literal, Optional, Sequence, Union

from pydantic import ConfigDict, Field
from starlette.requests import Request
from strawberry.relay import GlobalID

from phoenix.db.types.annotation_configs import (
    AnnotationConfigType,
    ContinuousOutputConfig,
    FreeformOutputConfig,
    OutputConfig,
    OutputConfigType,
    as_output_configs,
)
from phoenix.server.api.exceptions import AlreadyExists, BadRequest, Conflict, NotFound
from phoenix.server.api.helpers import evaluator_service as service
from phoenix.server.api.routers.v1.annotation_config_models import (
    CategoricalAnnotationConfigData,
    ContinuousAnnotationConfigData,
    FreeformAnnotationConfigData,
)
from phoenix.server.api.routers.v1.models import V1RoutesBaseModel
from phoenix.server.api.routers.v1.problem_details import ProblemException, problem_responses
from phoenix.server.api.routers.v1.utils import Responses
from phoenix.server.api.types.node import from_global_id_with_expected_type

EvaluatorOutputConfig = Annotated[
    Union[
        CategoricalAnnotationConfigData,
        ContinuousAnnotationConfigData,
        FreeformAnnotationConfigData,
    ],
    Field(discriminator="type"),
]
"""Output configurations use the same REST shapes as annotation configs for every kind."""


def output_configs_to_db(configs: Sequence[EvaluatorOutputConfig]) -> list[OutputConfigType]:
    """Convert REST output configurations to their database representation."""
    stored: list[OutputConfigType] = []
    for config in configs:
        data = config.model_dump()
        if isinstance(config, FreeformAnnotationConfigData):
            threshold = data.pop("threshold")
            data["thresholds"] = [threshold] if threshold is not None else None
        stored.append(OutputConfig.model_validate(data).root)
    return stored


def output_configs_from_db(configs: list[AnnotationConfigType]) -> list[EvaluatorOutputConfig]:
    """Convert stored output configurations to their REST representation."""
    result: list[EvaluatorOutputConfig] = []
    for config in as_output_configs(configs):
        data = config.model_dump()
        if isinstance(config, FreeformOutputConfig):
            thresholds = data.pop("thresholds")
            data["threshold"] = thresholds[0] if thresholds else None
            result.append(FreeformAnnotationConfigData.model_validate(data))
        elif isinstance(config, ContinuousOutputConfig):
            result.append(ContinuousAnnotationConfigData.model_validate(data))
        else:
            result.append(CategoricalAnnotationConfigData.model_validate(data))
    return result


def evaluator_error_responses(status_codes: list[int]) -> Responses:
    """Declare error responses; every error body is problem details.

    403 is included unconditionally: the outer /v1 router's auth and role dependencies raise
    it for every route mounted under it, documented there as plain text, but a route on one
    of these opted-in routers renders it as problem details like any other error. Declaring
    it here overrides that plain-text default for this specific route.
    """
    return problem_responses([*status_codes, 403])


class PromptVersionSelector(V1RoutesBaseModel):
    type: Literal["version"]
    prompt_version_id: str = Field(
        description=(
            "GlobalID of the prompt version the evaluator runs. Prompt content is created "
            "through the prompts API; a version of another prompt moves the evaluator to it."
        )
    )


class LatestPromptVersionSelector(V1RoutesBaseModel):
    type: Literal["latest"]


class LLMEvaluatorPromptInput(V1RoutesBaseModel):
    model_config = ConfigDict(extra="forbid")

    selector: PromptVersionSelector = Field(description="Which prompt version to run.")


class LLMEvaluatorPrompt(V1RoutesBaseModel):
    prompt_id: str = Field(description="GlobalID of the prompt whose version the evaluator runs.")
    selector: Annotated[
        Union[PromptVersionSelector, LatestPromptVersionSelector], Field(discriminator="type")
    ] = Field(
        description=(
            "How the version is chosen. version: pinned to one version. latest: the prompt's "
            "newest version, for evaluators whose pin was removed; writes accept version only. "
            "Treat an unrecognized type as not pinned."
        )
    )
    resolved_prompt_version_id: Optional[str] = Field(
        description="GlobalID of the version the evaluator runs now; null if the prompt has none."
    )


class EvaluatorRequest(V1RoutesBaseModel):
    model_config = ConfigDict(extra="forbid")


@contextmanager
def evaluator_api_errors() -> Iterator[None]:
    """Translate evaluator service errors to problem details.

    Only `BadRequest` and our own domain errors map here; a bare `ValueError` propagates and
    renders as a 500, since it signals a bug rather than a caller's mistake. Where a value
    actually comes from the request, the service layer converts it to `BadRequest` itself.
    """
    try:
        yield
    except NotFound as error:
        raise ProblemException(404, "not_found", str(error)) from error
    except AlreadyExists as error:
        raise ProblemException(
            409, "already_exists", str(error), existing_id=error.existing_id
        ) from error
    except Conflict as error:
        raise ProblemException(
            409, "conflict", str(error), reason=error.reason, **error.extra
        ) from error
    except BadRequest as error:
        raise ProblemException(422, "invalid_argument", str(error)) from error


def evaluator_service_context(request: Request) -> service.EvaluatorServiceContext:
    """Build evaluator service dependencies from the current request."""
    return service.EvaluatorServiceContext(
        db=request.app.state.db,
        sandbox_runtime=request.app.state.sandbox_runtime,
        user_id=int(request.user.identity) if "user" in request.scope else None,
    )


def parse_global_id(value: str) -> GlobalID:
    """Parse a GlobalID from request input, refusing a malformed value as `BadRequest`."""
    try:
        return GlobalID.from_id(value)
    except ValueError as error:
        raise BadRequest(f"Invalid id: {value}") from error


def decode_global_id(value: str, typename: str) -> int:
    """Decode an integer GlobalID and validate its node type, as `BadRequest` on a mismatch."""
    try:
        return from_global_id_with_expected_type(parse_global_id(value), typename)
    except ValueError as error:
        raise BadRequest(str(error)) from error


def encode_global_id(typename: str, row_id: int) -> str:
    """Encode a node type and integer row ID as a GlobalID."""
    return str(GlobalID(typename, str(row_id)))
