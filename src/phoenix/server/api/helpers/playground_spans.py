from typing import Any, Iterator, Optional

from openinference.semconv.trace import SpanAttributes

from phoenix.db import models
from phoenix.server.api.helpers.dataset_helpers import get_experiment_example_output
from phoenix.server.api.types.Identifier import Identifier
from phoenix.trace.attributes import get_attribute_value

LLM_TOKEN_COUNT_PROMPT = SpanAttributes.LLM_TOKEN_COUNT_PROMPT
LLM_TOKEN_COUNT_COMPLETION = SpanAttributes.LLM_TOKEN_COUNT_COMPLETION
METADATA = SpanAttributes.METADATA


def get_db_experiment_run(
    db_span: models.Span,
    db_trace: models.Trace,
    *,
    experiment_id: int,
    example_id: int,
    repetition_number: int,
) -> models.ExperimentRun:
    return models.ExperimentRun(
        experiment_id=experiment_id,
        dataset_example_id=example_id,
        trace_id=db_trace.trace_id,
        output=models.ExperimentRunOutput(
            task_output=get_experiment_example_output(db_span),
        ),
        repetition_number=repetition_number,
        start_time=db_span.start_time,
        end_time=db_span.end_time,
        error=db_span.status_message or None,
        prompt_token_count=get_attribute_value(db_span.attributes, LLM_TOKEN_COUNT_PROMPT),
        completion_token_count=get_attribute_value(db_span.attributes, LLM_TOKEN_COUNT_COMPLETION),
        trace=db_trace,
    )


def prompt_metadata(prompt_name: Optional[Identifier]) -> Iterator[tuple[str, Any]]:
    if prompt_name:
        yield METADATA, {"phoenix_prompt_id": prompt_name}
