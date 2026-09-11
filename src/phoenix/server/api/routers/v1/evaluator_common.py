"""Shared request models and adapters for evaluator REST endpoints."""

from contextlib import contextmanager
from enum import Enum
from typing import Annotated, Any, Iterator, Literal, Optional, Sequence, Union

from fastapi import HTTPException
from pydantic import ConfigDict, Field, field_validator
from starlette.requests import Request
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.types.annotation_configs import (
    AnnotationConfigType,
    CategoricalOutputConfig,
    ContinuousOutputConfig,
    FreeformOutputConfig,
    OutputConfig,
    OutputConfigType,
    as_output_configs,
)
from phoenix.db.types.evaluators import InputMapping
from phoenix.server.api.exceptions import BadRequest, Conflict, NotFound
from phoenix.server.api.helpers import evaluator_service as service
from phoenix.server.api.routers.v1.annotation_config_models import CategoricalAnnotationConfigData
from phoenix.server.api.routers.v1.models import V1RoutesBaseModel
from phoenix.server.api.routers.v1.prompt_models import PromptVersionData
from phoenix.server.api.types.node import from_global_id_with_expected_type


class Language(Enum):
    PYTHON = "PYTHON"
    TYPESCRIPT = "TYPESCRIPT"

    def to_orm(self) -> models.LanguageName:
        return self.value


EvaluatorOutputConfig = Annotated[
    Union[CategoricalAnnotationConfigData, ContinuousOutputConfig, FreeformOutputConfig],
    Field(discriminator="type"),
]


def output_configs_to_db(configs: Sequence[EvaluatorOutputConfig]) -> list[OutputConfigType]:
    """Convert REST output configurations to their database representation."""
    return [OutputConfig.model_validate(config.model_dump()).root for config in configs]


def output_configs_from_db(configs: list[AnnotationConfigType]) -> list[EvaluatorOutputConfig]:
    """Convert stored output configurations to their REST representation."""
    return [
        CategoricalAnnotationConfigData.model_validate(config.model_dump())
        if isinstance(config, CategoricalOutputConfig)
        else config
        for config in as_output_configs(configs)
    ]


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
    description: Optional[str] = None
    prompt_version: PromptVersionData
    prompt_version_id: Optional[str] = None
    output_configs: list[CategoricalAnnotationConfigData] = Field(min_length=1)


class NewCodeEvaluator(EvaluatorRequest):
    type: Literal["code"]
    description: Optional[str] = None
    source_code: str
    language: Language
    sandbox_config_id: str
    input_mapping: InputMapping
    output_configs: list[EvaluatorOutputConfig] = Field(default_factory=list)


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
