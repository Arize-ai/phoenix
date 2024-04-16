from typing import Optional

from phoenix.config import get_env_span_storage_type, get_storage_dir
from phoenix.core.traces import Traces
from phoenix.storage.span_store import SPAN_STORE_FACTORIES, SpanStore
from phoenix.trace.otel import decode_otlp_span
from phoenix.utilities.project import get_project_name


def get_span_store() -> Optional[SpanStore]:
    if span_store_type := get_env_span_storage_type():
        span_store_factory = SPAN_STORE_FACTORIES[span_store_type]
        return span_store_factory(get_storage_dir())
    return None


def load_traces_data_from_store(traces: Traces, span_store: SpanStore) -> None:
    for traces_data in span_store.load():
        for resource_spans in traces_data.resource_spans:
            project_name = get_project_name(resource_spans.resource.attributes)
            for scope_span in resource_spans.scope_spans:
                for span in scope_span.spans:
                    traces.put(decode_otlp_span(span), project_name=project_name)
