from enum import Enum
from typing import Any, List, Mapping, Optional, Union

import strawberry
from strawberry import UNSET
from strawberry.scalars import JSON


@strawberry.enum
class InvocationParameterValueType(Enum):
    INT = "INT"
    FLOAT = "FLOAT"
    STRING = "STRING"
    JSON = "JSON"
    BOUNDED_FLOAT = "BOUNDED_FLOAT"
    STRING_LIST = "STRING_LIST"
    BOOLEAN = "BOOLEAN"


@strawberry.input
class InvocationParameterInput:
    invocation_name: str
    value_int: Optional[int] = UNSET
    value_float: Optional[float] = UNSET
    value_bool: Optional[bool] = UNSET
    value_string: Optional[str] = UNSET
    value_json: Optional[JSON] = UNSET
    value_string_list: Optional[List[str]] = UNSET


@strawberry.type
class InvocationParameterBase:
    invocation_name: str
    label: str
    required: bool = False


@strawberry.type
class IntInvocationParameter(InvocationParameterBase):
    default_value: Optional[int] = UNSET


@strawberry.type
class FloatInvocationParameter(InvocationParameterBase):
    default_value: Optional[float] = UNSET


@strawberry.type
class BoundedFloatInvocationParameter(InvocationParameterBase):
    default_value: Optional[float] = UNSET
    min_value: float
    max_value: float


@strawberry.type
class StringInvocationParameter(InvocationParameterBase):
    default_value: Optional[str] = UNSET


@strawberry.type
class JSONInvocationParameter(InvocationParameterBase):
    default_value: Optional[JSON] = UNSET


@strawberry.type
class StringListInvocationParameter(InvocationParameterBase):
    default_value: Optional[List[str]] = UNSET


@strawberry.type
class BooleanInvocationParameter(InvocationParameterBase):
    default_value: Optional[bool] = UNSET


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
    parameters: List[InvocationParameterBase],
    input: Mapping[str, Any],
) -> None:
    for param_def in parameters:
        if param_def.required and param_def.invocation_name not in input:
            raise ValueError(f"Required parameter {param_def.invocation_name} not provided")


# Create the union for output types
InvocationParameter = strawberry.union(
    "InvocationParameter",
    (
        IntInvocationParameter,
        FloatInvocationParameter,
        BoundedFloatInvocationParameter,
        StringInvocationParameter,
        JSONInvocationParameter,
        StringListInvocationParameter,
        BooleanInvocationParameter,
    ),
)

InvocationParameterType = Union[
    IntInvocationParameter,
    FloatInvocationParameter,
    BoundedFloatInvocationParameter,
    StringInvocationParameter,
    JSONInvocationParameter,
    StringListInvocationParameter,
    BooleanInvocationParameter,
]
