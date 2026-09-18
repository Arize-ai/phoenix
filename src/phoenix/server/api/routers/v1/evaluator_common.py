"""Shared request models and adapters for evaluator REST endpoints."""

from contextlib import contextmanager
from typing import Annotated, Any, Iterator, Sequence, Union

from fastapi import HTTPException
from pydantic import ConfigDict, Field, field_validator
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
from phoenix.server.api.exceptions import BadRequest, Conflict, NotFound
from phoenix.server.api.helpers import evaluator_service as service
from phoenix.server.api.routers.v1.annotation_config_models import (
    CategoricalAnnotationConfigData,
    ContinuousAnnotationConfigData,
    FreeformAnnotationConfigData,
)
from phoenix.server.api.routers.v1.models import V1RoutesBaseModel
from phoenix.server.api.routers.v1.prompt_models import PromptVersionData
from phoenix.server.api.routers.v1.utils import Responses, add_errors_to_responses
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
    """Declare error responses; 422 carries JSON for request-shape errors and text otherwise."""
    responses = add_errors_to_responses(list(status_codes))
    if 422 in responses:
        responses[422] = {
            "description": (
                "Request bodies that fail schema validation return FastAPI's JSON error "
                "detail; domain validation failures return a plain-text message."
            ),
            "content": {
                "application/json": {
                    "schema": {"$ref": "#/components/schemas/HTTPValidationError"}
                },
                "text/plain": {"schema": {"type": "string"}},
            },
        }
    return responses


class EvaluatorRequest(V1RoutesBaseModel):
    model_config = ConfigDict(extra="forbid")

    @field_validator("prompt_version", mode="before", check_fields=False)
    @classmethod
    def validate_prompt_version(cls, value: Any) -> PromptVersionData:
        if isinstance(value, dict) and (
            extra := value.keys() - PromptVersionData.model_fields.keys()
        ):
            raise ValueError(f"Unexpected prompt version fields: {', '.join(sorted(extra))}")
        prompt_version = PromptVersionData.model_validate(value)
        if prompt_version.template.type != "chat":
            raise ValueError("LLM evaluators require a chat prompt")
        return prompt_version


@contextmanager
def evaluator_api_errors() -> Iterator[None]:
    """Translate evaluator service errors to REST status codes."""
    try:
        yield
    except NotFound as error:
        raise HTTPException(404, str(error)) from error
    except Conflict as error:
        raise HTTPException(409, str(error)) from error
    except (BadRequest, ValueError) as error:
        raise HTTPException(422, str(error)) from error


def evaluator_service_context(request: Request) -> service.EvaluatorServiceContext:
    """Build evaluator service dependencies from the current request."""
    return service.EvaluatorServiceContext(
        db=request.app.state.db,
        sandbox_runtime=request.app.state.sandbox_runtime,
        user_id=int(request.user.identity) if "user" in request.scope else None,
    )


def decode_global_id(value: str, typename: str) -> int:
    """Decode an integer GlobalID and validate its node type."""
    return from_global_id_with_expected_type(GlobalID.from_id(value), typename)


def encode_global_id(typename: str, row_id: int) -> str:
    """Encode a node type and integer row ID as a GlobalID."""
    return str(GlobalID(typename, str(row_id)))
