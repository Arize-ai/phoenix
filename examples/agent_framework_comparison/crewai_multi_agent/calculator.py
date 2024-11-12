from typing import Literal, Type

from crewai_tools import BaseTool
from openinference.semconv.trace import SpanAttributes
from opentelemetry import trace
from pydantic import BaseModel, Field

Operator = Literal["+", "-", "*", "/"]


class CalculatorInput(BaseModel):
    """Input for CalculatorTool."""

    a: int = Field(description="The first number.")
    b: int = Field(description="The second number.")
    operator: Operator = Field(description="The operator.")


class CalculatorTool(BaseTool):
    name: str = "Calculator Tool"
    description: str = "A tool that can be used to perform basic arithmetic operations (+, -, *, /) on two integers."
    args_schema: Type[BaseModel] = CalculatorInput

    def _run(self, a: int, b: int, operator: Operator) -> int:
        tracer = trace.get_tracer(__name__)
        with tracer.start_as_current_span("calculator_tool") as span:
            span.set_attribute(SpanAttributes.OPENINFERENCE_SPAN_KIND, "CHAIN")
            span.set_attribute(SpanAttributes.INPUT_VALUE, f"a={a}, b={b}, operator={operator}")

            if operator == "+":
                result = a + b
            elif operator == "-":
                result = a - b
            elif operator == "*":
                result = a * b
            elif operator == "/":
                if b == 0:
                    return "Error: Division by zero."
                result = a / b
            else:
                raise ValueError("Invalid operator.")

            span.set_attribute(SpanAttributes.OUTPUT_VALUE, str(result))
            return result
