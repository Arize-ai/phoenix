# /// script
# dependencies = [
#   "arize-phoenix-client",
#   "opentelemetry-sdk",
#   "opentelemetry-exporter-otlp",
# ]
# ///
from __future__ import annotations

import argparse
from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Iterator
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from opentelemetry.trace import Span, StatusCode

try:
    from ._shared import (
        Annotations,
        Generator,
        add_common_arguments,
        duration_for,
        llm_attributes,
        ns,
        poisson,
        positive_int,
        probability,
        random_status,
        utc_now,
    )
except ImportError:  # Support direct execution from this directory.
    from _shared import (
        Annotations,
        Generator,
        add_common_arguments,
        duration_for,
        llm_attributes,
        ns,
        poisson,
        positive_int,
        probability,
        random_status,
        utc_now,
    )


# Real instrumentation records why a span failed. An ERROR with no message and no recorded
# exception renders as a red span with no explanation, which is both unrealistic and useless
# for judging how the UI presents failures.
FAILURE_REASONS = (
    "upstream model returned 429 after 3 retries",
    "request exceeded the 30s deadline",
    "connection reset by the model provider",
    "response failed schema validation",
)


def non_negative_float(value: str) -> float:
    parsed = float(value)
    if parsed < 0:
        raise argparse.ArgumentTypeError("must be at least 0")
    return parsed


def timezone_name(value: str) -> str:
    try:
        ZoneInfo(value)
    except ZoneInfoNotFoundError as error:
        raise argparse.ArgumentTypeError(f"unknown IANA timezone: {value}") from error
    return value


def timestamp(value: str) -> datetime:
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise argparse.ArgumentTypeError("must be an ISO 8601 timestamp") from error
    if parsed.tzinfo is None:
        raise argparse.ArgumentTypeError("must include a UTC offset")
    return parsed.astimezone(timezone.utc)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Generate a realistic business-traffic time series with span annotations."
    )
    add_common_arguments(parser, default_project="time-series")
    parser.add_argument(
        "--days",
        type=positive_int,
        default=14,
        help="Days of history to backfill, ending at --end-time (default: 14).",
    )
    parser.add_argument(
        "--end-time",
        type=timestamp,
        help="Exclusive ISO 8601 end timestamp (default: current time).",
    )
    parser.add_argument(
        "--timezone",
        type=timezone_name,
        default="UTC",
        help="IANA timezone used for traffic patterns (default: UTC).",
    )
    parser.add_argument(
        "--business-rate",
        type=non_negative_float,
        default=20.0,
        help="Mean traces per hour on weekday business hours, 09-17 (default: 20).",
    )
    parser.add_argument(
        "--evening-rate",
        type=non_negative_float,
        default=3.0,
        help="Mean traces per hour on weekday evenings, 17-23 (default: 3).",
    )
    parser.add_argument(
        "--night-rate",
        type=non_negative_float,
        default=0.5,
        help="Mean traces per hour overnight, 23-09 (default: 0.5).",
    )
    parser.add_argument(
        "--weekend-rate",
        type=non_negative_float,
        default=2.0,
        help="Mean traces per hour all day at weekends (default: 2).",
    )
    parser.add_argument(
        "--sessions",
        type=positive_int,
        default=10,
        help="Number of distinct session ids traces are spread across (default: 10).",
    )
    parser.add_argument(
        "--error-rate",
        type=probability,
        default=0.12,
        help="Probability that a generated child span has error status (default: 0.12).",
    )
    parser.add_argument(
        "--annotation-rate",
        type=probability,
        default=1.0,
        help="Fraction of root spans receiving evaluation annotations (default: 1.0).",
    )
    parser.add_argument(
        "--max-traces",
        type=positive_int,
        default=100_000,
        help="Safety limit for sampled traffic (default: 100000).",
    )
    return parser


def _traffic_rate(local_time: datetime, args: argparse.Namespace) -> float:
    if local_time.weekday() >= 5:
        return args.weekend_rate
    if 9 <= local_time.hour < 17:
        return args.business_rate
    if 17 <= local_time.hour < 23:
        return args.evening_rate
    return args.night_rate


def generate_timestamps(
    generator: Generator,
    args: argparse.Namespace,
    *,
    end_time: datetime,
) -> Iterator[datetime]:
    local_timezone = ZoneInfo(args.timezone)
    start_time = end_time - timedelta(days=args.days)
    current = start_time.astimezone(timezone.utc).replace(minute=0, second=0, microsecond=0)
    generated = 0
    while current < end_time:
        local_time = current.astimezone(local_timezone)
        count = poisson(generator.rng, _traffic_rate(local_time, args))
        offsets = sorted(generator.rng.uniform(0, 3_600) for _ in range(count))
        for offset in offsets:
            timestamp_utc = current + timedelta(seconds=offset)
            if start_time <= timestamp_utc < end_time:
                generated += 1
                if generated > args.max_traces:
                    raise ValueError(
                        f"sampled traffic exceeds --max-traces={args.max_traces:,}; "
                        "lower the rates or shorten --days"
                    )
                yield timestamp_utc
        current += timedelta(hours=1)


def _add_annotations(annotations: Annotations, span: Span, generator: Generator) -> None:
    helpfulness = generator.rng.betavariate(2.5, 3.5)
    relevance = generator.rng.betavariate(5.0, 2.0)
    annotations.add(
        span,
        "helpfulness",
        score=helpfulness,
        label="helpful" if helpfulness >= 0.5 else "not helpful",
    )
    annotations.add(
        span,
        "relevance",
        score=relevance,
        label="relevant" if relevance >= 0.5 else "not relevant",
    )


def generate(
    args: argparse.Namespace,
) -> tuple[Generator, Annotations, Counter[str], datetime]:
    generator = Generator.from_args(args)
    annotations = Annotations(
        endpoint=args.endpoint,
        dry_run=args.dry_run,
        enabled=args.annotation_rate > 0,
    )
    end_time = args.end_time or utc_now()
    daily_counts: Counter[str] = Counter()
    try:
        for timestamp in generate_timestamps(generator, args, end_time=end_time):
            child_count = generator.rng.randint(1, 3)
            has_tool = generator.rng.random() < 0.7
            # Build the children first so the request's duration follows from how much the
            # model actually generated. Drawing the root duration independently and slicing it
            # into fractions makes latency and token count uncorrelated, and any scatter of
            # the two pure noise.
            children: list[tuple[str, dict[str, object], float]] = []
            for index in range(child_count):
                attributes = llm_attributes(generator.rng)
                completion = int(attributes.get("llm.token_count.completion", 0))
                children.append(
                    (f"llm-call-{index + 1}", attributes, duration_for(generator.rng, completion))
                )
            if has_tool:
                children.append(
                    (
                        "account-lookup",
                        {"tool.name": "account_lookup"},
                        generator.rng.uniform(0.05, 0.4),
                    )
                )
            gaps = [generator.rng.uniform(0.01, 0.08) for _ in children]
            duration_seconds = sum(d for _, _, d in children) + sum(gaps) + 0.05
            root_end = timestamp + timedelta(seconds=duration_seconds)
            root_start_ns = ns(timestamp)
            root_end_ns = ns(root_end)
            with generator.span(
                "assistant-request",
                "CHAIN",
                attributes={"session.id": f"session-{generator.rng.randrange(args.sessions) + 1}"},
                start_time=root_start_ns,
                end_time=root_end_ns,
                root=True,
            ) as root:
                cursor = timestamp
                for (child_name, attributes, child_duration), gap in zip(children, gaps):
                    cursor += timedelta(seconds=gap)
                    status = random_status(generator.rng, error_rate=args.error_rate)
                    reason = (
                        generator.rng.choice(FAILURE_REASONS)
                        if status is StatusCode.ERROR
                        else None
                    )
                    with generator.span(
                        child_name,
                        "TOOL" if child_name == "account-lookup" else "LLM",
                        attributes=attributes,
                        start_time=ns(cursor),
                        end_time=ns(cursor + timedelta(seconds=child_duration)),
                        status=status,
                        status_message=reason,
                    ):
                        pass
                    cursor += timedelta(seconds=child_duration)
            daily_counts[timestamp.astimezone(ZoneInfo(args.timezone)).date().isoformat()] += 1
            if generator.rng.random() < args.annotation_rate:
                _add_annotations(annotations, root, generator)
        annotations.flush()
    except BaseException:
        generator.close()
        raise
    return generator, annotations, daily_counts, end_time - timedelta(days=args.days)


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    generator, annotations, daily_counts, start_time = generate(args)
    generator.close()
    generator.print_summary(started_at=start_time)
    print(f"annotations={annotations.count}")
    print("daily_trace_counts=")
    for day, count in sorted(daily_counts.items()):
        print(f"  {day}: {count}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
