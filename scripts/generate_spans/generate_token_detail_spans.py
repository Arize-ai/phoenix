# /// script
# dependencies = [
#   "openinference-semantic-conventions",
#   "opentelemetry-exporter-otlp",
#   "opentelemetry-sdk",
# ]
# ///
from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Mapping

from openinference.semconv.resource import ResourceAttributes
from openinference.semconv.trace import (
    ImageAttributes,
    MessageAttributes,
    MessageContentAttributes,
    OpenInferenceLLMProviderValues,
    OpenInferenceMimeTypeValues,
    OpenInferenceSpanKindValues,
    SpanAttributes,
)
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.trace import Status, StatusCode

PROMPT_DETAILS_IMAGE = f"{SpanAttributes.LLM_TOKEN_COUNT_PROMPT_DETAILS}.image"
COMPLETION_DETAILS = "llm.token_count.completion_details"
COMPLETION_DETAILS_IMAGE = f"{COMPLETION_DETAILS}.image"
IMAGE_DATA_URL = (
    "data:image/png;base64,"
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII="
)
AUDIO_DATA_URL = (
    "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA="
)


@dataclass(frozen=True)
class TokenBudget:
    prompt_text: int
    completion_text: int
    cache_read: int = 0
    cache_write: int = 0
    prompt_image: int = 0
    prompt_audio: int = 0
    completion_image: int = 0
    completion_audio: int = 0
    reasoning: int = 0

    @property
    def prompt_total(self) -> int:
        return (
            self.prompt_text
            + self.cache_read
            + self.cache_write
            + self.prompt_image
            + self.prompt_audio
        )

    @property
    def completion_total(self) -> int:
        return self.completion_text + self.completion_image + self.completion_audio + self.reasoning

    @property
    def total(self) -> int:
        return self.prompt_total + self.completion_total


@dataclass(frozen=True)
class Scenario:
    name: str
    provider: str
    model_name: str
    system_message: str
    user_message: str
    assistant_message: str
    budget: TokenBudget
    has_input_image: bool = False
    has_input_audio: bool = False
    has_output_image: bool = False
    has_output_audio: bool = False


def _scaled(value: int, day_index: int, scenario_index: int) -> int:
    multiplier = 1.0 + (day_index * 0.06) + (scenario_index * 0.025)
    return round(value * multiplier)


def _scale_budget(budget: TokenBudget, day_index: int, scenario_index: int) -> TokenBudget:
    return TokenBudget(
        prompt_text=_scaled(budget.prompt_text, day_index, scenario_index),
        completion_text=_scaled(budget.completion_text, day_index, scenario_index),
        cache_read=_scaled(budget.cache_read, day_index, scenario_index),
        cache_write=_scaled(budget.cache_write, day_index, scenario_index),
        prompt_image=_scaled(budget.prompt_image, day_index, scenario_index),
        prompt_audio=_scaled(budget.prompt_audio, day_index, scenario_index),
        completion_image=_scaled(budget.completion_image, day_index, scenario_index),
        completion_audio=_scaled(budget.completion_audio, day_index, scenario_index),
        reasoning=_scaled(budget.reasoning, day_index, scenario_index),
    )


def _daily_scenarios(day_index: int) -> list[Scenario]:
    base: list[Scenario] = [
        Scenario(
            name="cache-write-primer",
            provider=OpenInferenceLLMProviderValues.ANTHROPIC.value,
            model_name="claude-sonnet-4-20250514",
            system_message="Use the cached policy and product catalog context.",
            user_message="Prime the support cache with the latest enterprise account context.",
            assistant_message="The cache is warm and ready for follow-up support questions.",
            budget=TokenBudget(
                prompt_text=940,
                cache_read=80,
                cache_write=3400,
                completion_text=510,
                reasoning=130,
            ),
        ),
        Scenario(
            name="cache-read-hit",
            provider=OpenInferenceLLMProviderValues.ANTHROPIC.value,
            model_name="claude-sonnet-4-20250514",
            system_message="Reuse cached product and account context when possible.",
            user_message="Answer a support question that should mostly hit the prompt cache.",
            assistant_message="The cached context was used to answer the question directly.",
            budget=TokenBudget(
                prompt_text=620,
                cache_read=3900,
                cache_write=120,
                completion_text=420,
                reasoning=95,
            ),
        ),
        Scenario(
            name="vision-cache-analysis",
            provider=OpenInferenceLLMProviderValues.OPENAI.value,
            model_name="gpt-4o-2024-08-06",
            system_message="Inspect the screenshot and compare it with cached UI guidelines.",
            user_message="Review this dashboard screenshot and call out layout regressions.",
            assistant_message="The chart alignment is correct, but the legend density changed.",
            budget=TokenBudget(
                prompt_text=520,
                cache_read=1150,
                cache_write=260,
                prompt_image=1480,
                completion_text=710,
                reasoning=210,
            ),
            has_input_image=True,
        ),
        Scenario(
            name="audio-summary",
            provider=OpenInferenceLLMProviderValues.OPENAI.value,
            model_name="gpt-4o-audio-preview",
            system_message="Summarize support calls with text and audio context.",
            user_message="Summarize this audio clip and preserve the account action items.",
            assistant_message="The call summary and audio response were generated.",
            budget=TokenBudget(
                prompt_text=360,
                cache_read=420,
                prompt_audio=940,
                completion_text=300,
                completion_audio=780,
            ),
            has_input_audio=True,
            has_output_audio=True,
        ),
        Scenario(
            name="multimodal-output",
            provider=OpenInferenceLLMProviderValues.OPENAI.value,
            model_name="gpt-image-1.5",
            system_message="Generate a concise visual follow-up using cached campaign context.",
            user_message="Use the screenshot and audio notes to generate a visual campaign brief.",
            assistant_message="A visual brief and text rationale were generated.",
            budget=TokenBudget(
                prompt_text=700,
                cache_read=1280,
                cache_write=540,
                prompt_image=980,
                prompt_audio=460,
                completion_text=560,
                completion_image=1240,
                completion_audio=220,
                reasoning=360,
            ),
            has_input_image=True,
            has_input_audio=True,
            has_output_image=True,
            has_output_audio=True,
        ),
    ]
    return [
        Scenario(
            name=scenario.name,
            provider=scenario.provider,
            model_name=scenario.model_name,
            system_message=scenario.system_message,
            user_message=scenario.user_message,
            assistant_message=scenario.assistant_message,
            budget=_scale_budget(scenario.budget, day_index, scenario_index),
            has_input_image=scenario.has_input_image,
            has_input_audio=scenario.has_input_audio,
            has_output_image=scenario.has_output_image,
            has_output_audio=scenario.has_output_audio,
        )
        for scenario_index, scenario in enumerate(base)
    ]


def _trace_endpoint(endpoint: str) -> str:
    endpoint = endpoint.rstrip("/")
    if endpoint.endswith("/v1/traces"):
        return endpoint
    return f"{endpoint}/v1/traces"


def _set_content_blocks(
    attributes: dict[str, str | int],
    message_prefix: str,
    text: str,
    *,
    include_image: bool,
    include_audio: bool,
) -> None:
    if not include_image and not include_audio:
        attributes[f"{message_prefix}.{MessageAttributes.MESSAGE_CONTENT}"] = text
        return

    contents = MessageAttributes.MESSAGE_CONTENTS
    content_type = MessageContentAttributes.MESSAGE_CONTENT_TYPE
    attributes[f"{message_prefix}.{contents}.0.{content_type}"] = "text"
    attributes[f"{message_prefix}.{contents}.0.{MessageContentAttributes.MESSAGE_CONTENT_TEXT}"] = (
        text
    )
    index = 1
    if include_image:
        image = MessageContentAttributes.MESSAGE_CONTENT_IMAGE
        attributes[f"{message_prefix}.{contents}.{index}.{content_type}"] = "image"
        attributes[f"{message_prefix}.{contents}.{index}.{image}.{ImageAttributes.IMAGE_URL}"] = (
            IMAGE_DATA_URL
        )
        index += 1
    if include_audio:
        attributes[f"{message_prefix}.{contents}.{index}.{content_type}"] = "audio"
        attributes[
            f"{message_prefix}.{contents}.{index}.{MessageContentAttributes.MESSAGE_CONTENT_DATA}"
        ] = AUDIO_DATA_URL


def _scenario_attributes(scenario: Scenario, run_id: str) -> Mapping[str, str | int]:
    budget = scenario.budget
    prompt_detail_sum = (
        budget.cache_read + budget.cache_write + budget.prompt_image + budget.prompt_audio
    )
    completion_detail_sum = budget.completion_image + budget.completion_audio + budget.reasoning
    if budget.prompt_text + prompt_detail_sum != budget.prompt_total:
        raise ValueError(f"{scenario.name} prompt tokens do not sum to the aggregate total")
    if budget.completion_text + completion_detail_sum != budget.completion_total:
        raise ValueError(f"{scenario.name} completion tokens do not sum to the aggregate total")

    attributes: dict[str, str | int] = {
        SpanAttributes.OPENINFERENCE_SPAN_KIND: OpenInferenceSpanKindValues.LLM.value,
        SpanAttributes.INPUT_MIME_TYPE: OpenInferenceMimeTypeValues.TEXT.value,
        SpanAttributes.INPUT_VALUE: scenario.user_message,
        SpanAttributes.OUTPUT_MIME_TYPE: OpenInferenceMimeTypeValues.TEXT.value,
        SpanAttributes.OUTPUT_VALUE: scenario.assistant_message,
        SpanAttributes.METADATA: json.dumps({"fixture": "token_details", "run_id": run_id}),
        SpanAttributes.LLM_PROVIDER: scenario.provider,
        SpanAttributes.LLM_MODEL_NAME: scenario.model_name,
        SpanAttributes.LLM_INVOCATION_PARAMETERS: json.dumps(
            {
                "cache": {"read": budget.cache_read, "write": budget.cache_write},
                "modalities": [
                    modality
                    for modality, count in (
                        ("text", budget.prompt_text + budget.completion_text),
                        ("image", budget.prompt_image + budget.completion_image),
                        ("audio", budget.prompt_audio + budget.completion_audio),
                    )
                    if count
                ],
                "temperature": 0.2,
            },
            sort_keys=True,
        ),
        SpanAttributes.LLM_TOKEN_COUNT_PROMPT: budget.prompt_total,
        SpanAttributes.LLM_TOKEN_COUNT_COMPLETION: budget.completion_total,
        SpanAttributes.LLM_TOKEN_COUNT_TOTAL: budget.total,
        SpanAttributes.LLM_TOKEN_COUNT_PROMPT_DETAILS_CACHE_READ: budget.cache_read,
        SpanAttributes.LLM_TOKEN_COUNT_PROMPT_DETAILS_CACHE_WRITE: budget.cache_write,
        SpanAttributes.LLM_TOKEN_COUNT_PROMPT_DETAILS_AUDIO: budget.prompt_audio,
        PROMPT_DETAILS_IMAGE: budget.prompt_image,
        SpanAttributes.LLM_TOKEN_COUNT_COMPLETION_DETAILS_AUDIO: budget.completion_audio,
        SpanAttributes.LLM_TOKEN_COUNT_COMPLETION_DETAILS_REASONING: budget.reasoning,
        COMPLETION_DETAILS_IMAGE: budget.completion_image,
    }
    attributes = {key: value for key, value in attributes.items() if value != 0}

    input_message = f"{SpanAttributes.LLM_INPUT_MESSAGES}.0"
    attributes[f"{input_message}.{MessageAttributes.MESSAGE_ROLE}"] = "system"
    attributes[f"{input_message}.{MessageAttributes.MESSAGE_CONTENT}"] = scenario.system_message
    input_message = f"{SpanAttributes.LLM_INPUT_MESSAGES}.1"
    attributes[f"{input_message}.{MessageAttributes.MESSAGE_ROLE}"] = "user"
    _set_content_blocks(
        attributes,
        input_message,
        scenario.user_message,
        include_image=scenario.has_input_image,
        include_audio=scenario.has_input_audio,
    )

    output_message = f"{SpanAttributes.LLM_OUTPUT_MESSAGES}.0"
    attributes[f"{output_message}.{MessageAttributes.MESSAGE_ROLE}"] = "assistant"
    _set_content_blocks(
        attributes,
        output_message,
        scenario.assistant_message,
        include_image=scenario.has_output_image,
        include_audio=scenario.has_output_audio,
    )
    return attributes


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate Phoenix token detail fixture spans for cache, image, and audio data."
    )
    parser.add_argument(
        "--endpoint",
        default="http://localhost:6006",
        help="Phoenix base URL or OTLP trace endpoint. Defaults to http://localhost:6006.",
    )
    parser.add_argument(
        "--project-name",
        default="token-detail-fixtures",
        help="Phoenix project name to write fixture spans into.",
    )
    parser.add_argument(
        "--days",
        type=int,
        default=7,
        help="Number of daily fixture slices to generate.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate and summarize spans without exporting them.",
    )
    return parser.parse_args()


def main() -> int:
    args = _parse_args()
    if args.days < 1:
        raise ValueError("--days must be at least 1")

    run_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    tracer_provider = TracerProvider(
        resource=Resource.create({ResourceAttributes.PROJECT_NAME: args.project_name})
    )
    if not args.dry_run:
        tracer_provider.add_span_processor(
            SimpleSpanProcessor(OTLPSpanExporter(endpoint=_trace_endpoint(args.endpoint)))
        )
    tracer = tracer_provider.get_tracer(__name__)

    now = datetime.now(timezone.utc)
    start_day = now.replace(hour=9, minute=0, second=0, microsecond=0) - timedelta(
        days=args.days - 1
    )
    span_count = 0
    totals: dict[str, int] = {
        "prompt": 0,
        "completion": 0,
        "prompt_input": 0,
        "completion_output": 0,
    }
    detail_totals: dict[str, int] = {}

    for day_index in range(args.days):
        day_start = start_day + timedelta(days=day_index)
        for scenario_index, scenario in enumerate(_daily_scenarios(day_index)):
            start_time = day_start + timedelta(
                hours=2 * scenario_index,
                minutes=(day_index * 7 + scenario_index * 11) % 50,
            )
            start_time_ns = int(start_time.timestamp() * 1_000_000_000)
            end_time_ns = start_time_ns + (scenario_index + 1) * 250_000_000
            attributes = _scenario_attributes(scenario, run_id)

            budget = scenario.budget
            totals["prompt"] += budget.prompt_total
            totals["completion"] += budget.completion_total
            totals["prompt_input"] += budget.prompt_text
            totals["completion_output"] += budget.completion_text
            for key, value in (
                ("prompt.cache_read", budget.cache_read),
                ("prompt.cache_write", budget.cache_write),
                ("prompt.image", budget.prompt_image),
                ("prompt.audio", budget.prompt_audio),
                ("completion.image", budget.completion_image),
                ("completion.audio", budget.completion_audio),
                ("completion.reasoning", budget.reasoning),
            ):
                detail_totals[key] = detail_totals.get(key, 0) + value

            if not args.dry_run:
                span = tracer.start_span(
                    scenario.name,
                    start_time=start_time_ns,
                    attributes=attributes,
                )
                span.set_status(Status(StatusCode.OK))
                span.end(end_time=end_time_ns)
            span_count += 1

    if not args.dry_run:
        tracer_provider.force_flush()
        tracer_provider.shutdown()

    print(f"project={args.project_name}")
    print(f"run_id={run_id}")
    print(f"spans={span_count}")
    print(f"prompt_total={totals['prompt']}")
    print(f"completion_total={totals['completion']}")
    print(f"prompt_input_remainder={totals['prompt_input']}")
    print(f"completion_output_remainder={totals['completion_output']}")
    for key in sorted(detail_totals):
        print(f"{key}={detail_totals[key]}")
    if args.dry_run:
        print("dry_run=true")
    else:
        print(f"exported_to={_trace_endpoint(args.endpoint)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
