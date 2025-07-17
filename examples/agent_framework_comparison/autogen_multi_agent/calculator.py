from typing import Annotated, Literal

from openinference.semconv.trace import SpanAttributes
from opentelemetry import trace
from pydantic import BaseModel, Field

Operator = Literal["+", "-", "*", "/"]


class CalculatorInput(BaseModel):
    a: Annotated[int, Field(description="The first number.")]
    b: Annotated[int, Field(description="The second number.")]
    operator: Annotated[Operator, Field(description="The operator.")]


def calculator(input: Annotated[CalculatorInput, "Input to the calculator."]) -> int:
    if not isinstance(input, CalculatorInput):
        return "Invalid input: expected CalculatorInput model."

    tracer = trace.get_tracer(__name__)
    with tracer.start_as_current_span("calculator_tool") as span:
        span.set_attribute(SpanAttributes.OPENINFERENCE_SPAN_KIND, "CHAIN")
        span.set_attribute(SpanAttributes.INPUT_VALUE, str(input))

        if input.operator == "+":
            result = input.a + input.b
        elif input.operator == "-":
            result = input.a - input.b
        elif input.operator == "*":
            result = input.a * input.b
        elif input.operator == "/":
            result = int(input.a / input.b)
        else:
            raise ValueError("Invalid operator")

        span.set_attribute(SpanAttributes.OUTPUT_VALUE, str(result))
        return result
