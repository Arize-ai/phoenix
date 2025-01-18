from enum import Enum
from typing import Annotated, Any, Mapping, Optional, Union

import strawberry
from strawberry import UNSET
from strawberry.scalars import JSON


@strawberry.enum
class CanonicalParameterName(str, Enum):
    TEMPERATURE = "temperature"
    MAX_COMPLETION_TOKENS = "max_completion_tokens"
    STOP_SEQUENCES = "stop_sequences"
    TOP_P = "top_p"
    RANDOM_SEED = "random_seed"
    TOOL_CHOICE = "tool_choice"
    RESPONSE_FORMAT = "response_format"
    REASONING_EFFORT = "reasoning_effort"


@strawberry.enum
class InvocationInputField(str, Enum):
    value_int = "value_int"
    value_float = "value_float"
    value_bool = "value_bool"
    value_string = "value_string"
    value_json = "value_json"
    value_string_list = "value_string_list"
    value_boolean = "value_boolean"


@strawberry.input
class InvocationParameterInput:
    invocation_name: str
    canonical_name: Optional[CanonicalParameterName] = None
    value_int: Optional[int] = UNSET
    value_float: Optional[float] = UNSET
    value_bool: Optional[bool] = UNSET
    value_string: Optional[str] = UNSET
    value_json: Optional[JSON] = UNSET
    value_string_list: Optional[list[str]] = UNSET
    value_boolean: Optional[bool] = UNSET


@strawberry.interface
class InvocationParameterBase:
    invocation_name: str
    canonical_name: Optional[CanonicalParameterName] = None
    label: str
    required: bool = False


@strawberry.type
class IntInvocationParameter(InvocationParameterBase):
    invocation_input_field: InvocationInputField = InvocationInputField.value_int
    default_value: Optional[int] = None


@strawberry.type
class FloatInvocationParameter(InvocationParameterBase):
    invocation_input_field: InvocationInputField = InvocationInputField.value_float
    default_value: Optional[float] = None


@strawberry.type
class BoundedFloatInvocationParameter(InvocationParameterBase):
    invocation_input_field: InvocationInputField = InvocationInputField.value_float
    default_value: Optional[float] = None
    min_value: float
    max_value: float


@strawberry.type
class StringInvocationParameter(InvocationParameterBase):
    invocation_input_field: InvocationInputField = InvocationInputField.value_string
    default_value: Optional[str] = None


@strawberry.type
class JSONInvocationParameter(InvocationParameterBase):
    invocation_input_field: InvocationInputField = InvocationInputField.value_json
    default_value: Optional[JSON] = None


@strawberry.type
class StringListInvocationParameter(InvocationParameterBase):
    invocation_input_field: InvocationInputField = InvocationInputField.value_string_list
    default_value: Optional[list[str]] = None


@strawberry.type
class BooleanInvocationParameter(InvocationParameterBase):
    invocation_input_field: InvocationInputField = InvocationInputField.value_bool
    default_value: Optional[bool] = None


def extract_parameter(
    param_def: InvocationParameterBase, param_input: InvocationParameterInput
) -> Any:
    if isinstance(param_def, IntInvocationParameter):
        return (
            param_input.value_int if param_input.value_int is not UNSET else param_def.default_value
        )
    elif isinstance(param_def, FloatInvocationParameter):
        return (
            param_input.value_float
            if param_input.value_float is not UNSET
            else param_def.default_value
        )
    elif isinstance(param_def, BoundedFloatInvocationParameter):
        return (
            param_input.value_float
            if param_input.value_float is not UNSET
            else param_def.default_value
        )
    elif isinstance(param_def, StringInvocationParameter):
        return (
            param_input.value_string
            if param_input.value_string is not UNSET
            else param_def.default_value
        )
    elif isinstance(param_def, JSONInvocationParameter):
        return (
            param_input.value_json
            if param_input.value_json is not UNSET
            else param_def.default_value
        )
    elif isinstance(param_def, StringListInvocationParameter):
        return (
            param_input.value_string_list
            if param_input.value_string_list is not UNSET
            else param_def.default_value
        )
    elif isinstance(param_def, BooleanInvocationParameter):
        return (
            param_input.value_bool
            if param_input.value_bool is not UNSET
            else param_def.default_value
        )


def validate_invocation_parameters(
    parameters: list["InvocationParameter"],
    input: Mapping[str, Any],
) -> None:
    for param_def in parameters:
        if param_def.required and param_def.invocation_name not in input:
            raise ValueError(f"Required parameter {param_def.invocation_name} not provided")


# Create the union for output types
InvocationParameter = Annotated[
    Union[
        IntInvocationParameter,
        FloatInvocationParameter,
        BoundedFloatInvocationParameter,
        StringInvocationParameter,
        JSONInvocationParameter,
        StringListInvocationParameter,
        BooleanInvocationParameter,
    ],
    strawberry.union("InvocationParameter"),
]
