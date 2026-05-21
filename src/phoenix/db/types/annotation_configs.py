import json
from enum import Enum
from typing import Annotated, Literal, Optional, Union

from pydantic import AfterValidator, Field, RootModel, model_validator
from typing_extensions import Self, TypeAlias

from .db_helper_types import DBBaseModel

_PYTHON = "PYTHON"
_TYPESCRIPT = "TYPESCRIPT"


def _return_stmt(value: str, language: str) -> str:
    if language == _TYPESCRIPT:
        return f"return {value};"
    return f"return {value}"


def _comment(text: str, language: str) -> str:
    return f"// {text}" if language == _TYPESCRIPT else f"# {text}"


class AnnotationType(Enum):
    CATEGORICAL = "CATEGORICAL"
    CONTINUOUS = "CONTINUOUS"
    FREEFORM = "FREEFORM"


class OptimizationDirection(Enum):
    MINIMIZE = "MINIMIZE"
    MAXIMIZE = "MAXIMIZE"
    NONE = "NONE"


class _BaseAnnotationConfig(DBBaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


def _categorical_value_label_is_non_empty_string(label: str) -> str:
    if not label:
        raise ValueError("Label must be non-empty")
    return label


class CategoricalAnnotationValue(DBBaseModel):
    label: Annotated[str, AfterValidator(_categorical_value_label_is_non_empty_string)]
    score: Optional[float] = None


def _categorical_values_are_non_empty_list(
    values: list[CategoricalAnnotationValue],
) -> list[CategoricalAnnotationValue]:
    if not values:
        raise ValueError("Values must be non-empty")
    return values


def _categorical_values_have_unique_labels(
    values: list[CategoricalAnnotationValue],
) -> list[CategoricalAnnotationValue]:
    labels = set()
    for value in values:
        label = value.label
        if label in labels:
            raise ValueError(
                f'Values for categorical annotation config has duplicate label: "{label}"'
            )
        labels.add(label)
    return values


class CategoricalAnnotationConfig(_BaseAnnotationConfig):
    type: Literal[AnnotationType.CATEGORICAL.value]  # type: ignore[name-defined]
    optimization_direction: OptimizationDirection
    values: Annotated[
        list[CategoricalAnnotationValue],
        AfterValidator(_categorical_values_are_non_empty_list),
        AfterValidator(_categorical_values_have_unique_labels),
    ]


class ContinuousAnnotationConfig(_BaseAnnotationConfig):
    type: Literal[AnnotationType.CONTINUOUS.value]  # type: ignore[name-defined]
    optimization_direction: OptimizationDirection
    lower_bound: Optional[float] = None
    upper_bound: Optional[float] = None

    @model_validator(mode="after")
    def check_bounds(self) -> Self:
        if (
            self.lower_bound is not None
            and self.upper_bound is not None
            and self.lower_bound >= self.upper_bound
        ):
            raise ValueError("Lower bound must be strictly less than upper bound")
        return self


class FreeformAnnotationConfig(_BaseAnnotationConfig):
    type: Literal[AnnotationType.FREEFORM.value]  # type: ignore[name-defined]
    optimization_direction: Optional[OptimizationDirection] = None
    thresholds: Optional[list[float]] = None
    lower_bound: Optional[float] = None
    upper_bound: Optional[float] = None

    @model_validator(mode="after")
    def check_bounds(self) -> Self:
        if (
            self.lower_bound is not None
            and self.upper_bound is not None
            and self.lower_bound >= self.upper_bound
        ):
            raise ValueError("Lower bound must be strictly less than upper bound")
        return self


AnnotationConfigType: TypeAlias = Annotated[
    Union[CategoricalAnnotationConfig, ContinuousAnnotationConfig, FreeformAnnotationConfig],
    Field(..., discriminator="type"),
]


class AnnotationConfig(RootModel[AnnotationConfigType]):
    root: AnnotationConfigType


class CategoricalOutputConfig(CategoricalAnnotationConfig):
    name: str

    def shape_examples(self, language: str = _PYTHON, mode: str = "full") -> list[str]:
        """Return code snippet strings illustrating valid return shapes for this config."""
        example_label = self.values[0].label if self.values else "pass"
        # json.dumps produces a JSON string literal valid as source in both Python and TS.
        label_literal = json.dumps(example_label)
        bare = _return_stmt(label_literal, language)
        dict_form = _return_stmt(f'{{"label": {label_literal}, "explanation": "..."}}', language)
        return [bare, dict_form]


class ContinuousOutputConfig(ContinuousAnnotationConfig):
    name: str

    def shape_examples(self, language: str = _PYTHON, mode: str = "full") -> list[str]:
        """Return code snippet strings illustrating valid return shapes for this config."""
        if self.lower_bound is not None and self.upper_bound is not None:
            example_score = (self.lower_bound + self.upper_bound) / 2
            bounds_hint = f"{self.lower_bound} - {self.upper_bound}"
        elif self.lower_bound is not None:
            example_score = self.lower_bound
            bounds_hint = f">= {self.lower_bound}"
        elif self.upper_bound is not None:
            example_score = self.upper_bound
            bounds_hint = f"<= {self.upper_bound}"
        else:
            example_score = 0.5
            bounds_hint = None

        score_str = f"{example_score}"
        bare = _return_stmt(score_str, language)
        if bounds_hint:
            range_comment = _comment(f"score in range {bounds_hint}", language)
            dict_form = (
                range_comment
                + "\n"
                + _return_stmt(f'{{"score": {score_str}, "explanation": "..."}}', language)
            )
        else:
            dict_form = _return_stmt(f'{{"score": {score_str}, "explanation": "..."}}', language)
        return [bare, dict_form]


class FreeformOutputConfig(FreeformAnnotationConfig):
    name: str


OutputConfigType: TypeAlias = Annotated[
    Union[CategoricalOutputConfig, ContinuousOutputConfig, FreeformOutputConfig],
    Field(..., discriminator="type"),
]


class OutputConfig(RootModel[OutputConfigType]):
    root: OutputConfigType


def bare_shape_examples(language: str = _PYTHON, mode: str = "full") -> list[str]:
    """Return code snippet strings illustrating valid return shapes when no output config exists."""
    bare_str = _return_stmt('"pass"', language)
    bare_num = _return_stmt("0.5", language)
    dict_form = _return_stmt('{"label": "pass", "explanation": "..."}', language)
    dict_score_form = _return_stmt('{"score": 0.5, "explanation": "..."}', language)
    if mode == "curated":
        return [bare_str, dict_form]
    return [bare_str, bare_num, dict_form, dict_score_form]


def _config_bare_value(config: "CategoricalOutputConfig | ContinuousOutputConfig") -> str:
    if isinstance(config, CategoricalOutputConfig):
        label = config.values[0].label if config.values else "pass"
        return json.dumps(label)
    if config.lower_bound is not None and config.upper_bound is not None:
        score = (config.lower_bound + config.upper_bound) / 2
    elif config.lower_bound is not None:
        score = config.lower_bound
    elif config.upper_bound is not None:
        score = config.upper_bound
    else:
        score = 0.5
    return str(score)


def multi_output_shape_examples(
    configs: "list[CategoricalOutputConfig | ContinuousOutputConfig]",
    language: str = _PYTHON,
    mode: str = "curated",
) -> list[str]:
    """Return code snippet strings for multi-output routing dicts."""
    lines: list[str] = []
    for config in configs:
        bare_value = _config_bare_value(config)
        lines.append(f'    "{config.name}": {bare_value},')
    lines.append('    "explanation": "...",')
    inner = "\n".join(lines)
    routing_dict = "{\n" + inner + "\n}"
    return [_return_stmt(routing_dict, language)]
