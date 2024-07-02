from typing import Iterable

from openinference.semconv.resource import ResourceAttributes
from opentelemetry.proto.common.v1.common_pb2 import KeyValue

from phoenix.config import DEFAULT_PROJECT_NAME


def get_project_name(attributes: Iterable[KeyValue]) -> str:
    for kv in attributes:
        if kv.key == ResourceAttributes.PROJECT_NAME and (v := kv.value.string_value):
            return v
    return DEFAULT_PROJECT_NAME
