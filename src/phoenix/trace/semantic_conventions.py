"""
Semantic conventions for the attributes of a span

Inspiration from OpenTelemetry:
https://opentelemetry.io/docs/specs/otel/trace/semantic_conventions/span-general/
"""
from dataclasses import dataclass
from typing import Any, Dict


@dataclass(frozen=True)
class AttributeDescription(Dict[str, Any]):
    id: str
    brief: str
    type: str


class AttributeGroup:
    """
    AttributeGroup is a collection of attributes that are
    semantically related to each other
    """

    id: str
    attributes: Dict[str, AttributeDescription]


class DeploymentAttributes(AttributeGroup):
    id = "deployment"
    prefix = "deployment"
    attributes = {
        "environment": AttributeDescription(
            id="deployment.environment",
            brief="The environment where the service is deployed",
            type="string",
        ),
    }
