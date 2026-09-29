"""Shared request models and adapters for evaluator REST endpoints."""

from contextlib import contextmanager
from typing import Annotated, Any, Iterator, Literal, Optional, Sequence, Union

from pydantic import ConfigDict, Field, field_validator, model_validator
from starlette.requests import Request
from strawberry.relay import GlobalID
from typing_extensions import Self

from phoenix.db import models
from phoenix.db.types.annotation_configs import (
    AnnotationConfigType,
    ContinuousOutputConfig,
    FreeformOutputConfig,
    OutputConfig,
    OutputConfigType,
    as_output_configs,
)
from phoenix.db.types.evaluators import InputMapping
from phoenix.server.api.exceptions import AlreadyExists, BadRequest, Conflict, NotFound
from phoenix.server.api.helpers import evaluator_service as service
from phoenix.server.api.helpers.evaluator_prompt_source import (
    CreatePromptSource,
    FromPromptVersion,
    NewPrompt,
)
from phoenix.server.api.routers.v1.annotation_config_models import (
    CategoricalAnnotationConfigData,
    ContinuousAnnotationConfigData,
    FreeformAnnotationConfigData,
)
from phoenix.server.api.routers.v1.models import V1RoutesBaseModel
from phoenix.server.api.routers.v1.problem_details import ProblemException, problem_responses
from phoenix.server.api.routers.v1.prompt_models import PromptVersionData
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


class NewLLMEvaluator(EvaluatorRequest):
    type: Literal["llm"]
    description: Optional[str] = Field(
        default=None,
        description="Must equal the description of the prompt's tool function.",
    )
    prompt_version: Optional[PromptVersionData] = Field(
        default=None,
        description=(
            "Chat prompt content for a new prompt created for this evaluator. Content only: a "
            "version id inside this object is rejected. Exactly one of prompt_version and "
            "prompt_version_id is required."
        ),
    )
    prompt_version_id: Optional[str] = Field(
        default=None,
        description=(
            "GlobalID of an existing prompt version for the evaluator to run; the evaluator "
            "attaches to that version's prompt. New content for an existing prompt is created "
            "through the prompts API first. Exactly one of prompt_version and prompt_version_id "
            "is required."
        ),
    )
    output_configs: list[CategoricalAnnotationConfigData] = Field(min_length=1)

    @model_validator(mode="after")
    def require_one_prompt_source(self) -> Self:
        if (self.prompt_version is None) == (self.prompt_version_id is None):
            raise ValueError("Exactly one of prompt_version and prompt_version_id is required")
        return self


def new_llm_prompt_source(definition: NewLLMEvaluator) -> CreatePromptSource:
    """Inline content becomes a new prompt; a selected version is reused as it is."""
    if definition.prompt_version is not None:
        return NewPrompt(content=definition.prompt_version.to_orm())
    assert definition.prompt_version_id is not None
    return FromPromptVersion(prompt_version_id=GlobalID.from_id(definition.prompt_version_id))


class NewCodeEvaluator(EvaluatorRequest):
    type: Literal["code"]
    description: Optional[str] = None
    source_code: str
    language: models.LanguageName
    sandbox_config_id: str
    input_mapping: InputMapping
    output_configs: list[EvaluatorOutputConfig] = Field(
        min_length=1, description="Outputs the code produces."
    )


class ExistingEvaluator(EvaluatorRequest):
    """Attach an evaluator definition that already exists instead of creating one."""

    type: Literal["reference"]
    evaluator_id: str = Field(
        description=(
            "GlobalID of an existing evaluator definition. Datasets accept code and built-in "
            "evaluators; projects accept code evaluators. LLM definitions belong to the binding "
            "that created them and cannot be referenced."
        )
    )


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
