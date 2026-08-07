"""Spans whose *payloads* are hostile, for shaking out UI rendering bugs.

`mixed --malformed-rate` fuzzes the span kind; this fuzzes what is inside a span. Real traffic
almost never contains a 200KB output, a right-to-left filename, or a message that looks like
markup, so these cases only ever surface in production unless something generates them
deliberately.

Every trace is named for the hazard it carries (`edge-case-unicode`, `edge-case-huge-text`, …)
so a specific failure is easy to find and re-open in the UI. Use `--only` to emit just one.
"""

from __future__ import annotations

import argparse
import json
from datetime import timedelta
from typing import Callable

try:
    from ._shared import (
        SPAN_LIMITS,
        Generator,
        add_common_arguments,
        document_attributes,
        llm_attributes,
        message_attributes,
        non_negative_int,
        ns,
        positive_int,
        utc_now,
    )
except ImportError:  # Support direct execution from this directory.
    from _shared import (
        SPAN_LIMITS,
        Generator,
        add_common_arguments,
        document_attributes,
        llm_attributes,
        message_attributes,
        non_negative_int,
        ns,
        positive_int,
        utc_now,
    )

LOREM = (
    "Phoenix collects OpenTelemetry spans and renders them as traces. "
    "Each span carries attributes describing the operation it represents. "
)

# Text that has broken renderers before: bidirectional overrides, combining marks,
# zero-width joiners, surrogate-pair emoji, and CJK widths in the same string.
UNICODE_SAMPLES = (
    "مرحبا بالعالم — right-to-left text mixed with English",
    "é́́́́ stacked combining accents",
    "​​zero-width​spaces​between​words",
    "👨‍👩‍👧‍👦 family emoji built from zero-width joiners",
    "日本語のテキストと English の混在",
    "‮override‬ bidi control characters",
)

# Content that must be escaped, not interpreted. Nothing here is executable in a correct UI;
# the point is to prove the UI treats span text as data.
MARKUP_SAMPLES = (
    "<script>alert('span content is not markup')</script>",
    "<img src=x onerror=alert(1)>",
    "| markdown | table |\n| --- | --- |\n| a | b |",
    "```python\nprint('fenced code block inside a span')\n```",
    "{{handlebars}} and ${template} and %s placeholders",
    "line one\nline two\ttabbed\r\nwindows newline",
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Generate spans with pathological payloads for UI robustness testing."
    )
    add_common_arguments(parser, default_project="edge-cases")
    parser.add_argument(
        "--repeat",
        type=positive_int,
        default=1,
        help="How many times to emit each hazard (default: 1).",
    )
    parser.add_argument(
        "--text-size",
        type=positive_int,
        default=200_000,
        help="Character count for the oversized-text hazards (default: 200000).",
    )
    parser.add_argument(
        "--depth",
        type=positive_int,
        default=40,
        help="Nesting depth for the deep-JSON hazard (default: 40).",
    )
    parser.add_argument(
        "--width",
        type=non_negative_int,
        default=200,
        help="Item count for the many-attributes and wide-list hazards (default: 200).",
    )
    parser.add_argument(
        "--only",
        help="Emit a single hazard by name (see --list).",
    )
    parser.add_argument(
        "--list",
        action="store_true",
        help="Print the hazard names and exit.",
    )
    return parser


def _filler(size: int) -> str:
    return (LOREM * (size // len(LOREM) + 1))[:size]


def _nested(depth: int) -> dict[str, object]:
    node: dict[str, object] = {"leaf": True, "depth": depth}
    for level in reversed(range(depth)):
        node = {"level": level, "child": node}
    return node


def _huge_text(
    generator: Generator, args: argparse.Namespace, repeat_index: int
) -> dict[str, object]:
    return {
        "input.value": _filler(args.text_size),
        "output.value": _filler(args.text_size),
        **llm_attributes(generator.rng),
    }


def _long_single_line(
    generator: Generator, args: argparse.Namespace, repeat_index: int
) -> dict[str, object]:
    """No whitespace anywhere — breaks naive word wrapping rather than character wrapping."""
    return {
        "input.value": "x" * args.text_size,
        "output.value": "/" + "/".join("very-long-path-segment" for _ in range(2_000)),
    }


def _deep_json(
    generator: Generator, args: argparse.Namespace, repeat_index: int
) -> dict[str, object]:
    payload = json.dumps(_nested(args.depth))
    return {
        "input.value": payload,
        "input.mime_type": "application/json",
        "output.value": payload,
        "output.mime_type": "application/json",
        "metadata": payload,
    }


def _unicode(
    generator: Generator, args: argparse.Namespace, repeat_index: int
) -> dict[str, object]:
    return {
        "input.value": "\n".join(UNICODE_SAMPLES),
        "output.value": generator.rng.choice(UNICODE_SAMPLES),
        **message_attributes(
            ({"role": "user", "content": sample} for sample in UNICODE_SAMPLES),
            "llm.input_messages",
        ),
        **llm_attributes(generator.rng),
    }


def _markup(generator: Generator, args: argparse.Namespace, repeat_index: int) -> dict[str, object]:
    """Span text that resembles markup must render as text, never as markup."""
    return {
        "input.value": "\n".join(MARKUP_SAMPLES),
        "output.value": generator.rng.choice(MARKUP_SAMPLES),
        "tool.name": "<b>not-a-tag</b>",
        **message_attributes(
            ({"role": "assistant", "content": sample} for sample in MARKUP_SAMPLES),
            "llm.output_messages",
        ),
    }


def _empty_values(
    generator: Generator, args: argparse.Namespace, repeat_index: int
) -> dict[str, object]:
    """Empty is not the same as absent, and both must render without collapsing the layout."""
    return {
        "input.value": "",
        "output.value": "   \n\t  ",
        "metadata": "{}",
        "llm.model_name": "",
        **message_attributes(
            [{"role": "user", "content": ""}, {"role": "assistant", "content": " "}],
            "llm.input_messages",
        ),
    }


def _many_attributes(
    generator: Generator, args: argparse.Namespace, repeat_index: int
) -> dict[str, object]:
    attributes: dict[str, object] = {"input.value": "span with a very wide attribute set"}
    # Cycle the value types OpenTelemetry allows. Booleans in particular appear nowhere else
    # in the package — every other bool is buried inside a JSON metadata string — so a UI that
    # renders `False` as blank, or a falsy value as absent, has nothing to fail against.
    for index in range(args.width):
        bucket = index // 4  # so the first of each type is its falsy value: "", 0, 0.0, False
        attributes[f"custom.attribute.{index:04d}"] = (
            "value-" * bucket,
            bucket,
            bucket / 3,
            bucket % 2 == 1,
        )[index % 4]
    return attributes


def _wide_lists(
    generator: Generator, args: argparse.Namespace, repeat_index: int
) -> dict[str, object]:
    return {
        "input.value": "retriever returning far more documents than a UI expects",
        **document_attributes(
            (
                {
                    "id": f"doc-{index:04d}",
                    "content": _filler(400),
                    "score": round(1 - index / max(1, args.width), 6),
                }
                for index in range(args.width)
            )
        ),
    }


# Milliseconds and seconds are well covered by the other scenarios; nothing anywhere reaches
# minutes or hours, so latency formatting and chart axis scaling have no fixture past ~12s.
DURATIONS = (3 * 60 * 60, 45 * 60, 90, 0.0)

# How far ahead a skewed host is. Two hours is enough to fall outside a "last hour" filter.
SKEW_SECONDS = 2 * 60 * 60


def _slow_span(
    generator: Generator, args: argparse.Namespace, repeat_index: int
) -> dict[str, object]:
    """A span whose *duration* is the hazard, cycling boundaries as --repeat increases."""
    seconds = DURATIONS[repeat_index % len(DURATIONS)]
    return {
        "input.value": "a span that ran far longer than any UI expects",
        "output.value": f"finished after {seconds} seconds",
        "synthetic.duration_seconds": seconds,
        **llm_attributes(generator.rng),
    }


def _many_events(
    generator: Generator, args: argparse.Namespace, repeat_index: int
) -> dict[str, object]:
    """A streaming completion that logged one event per chunk.

    Nothing else here emits more than three events on a span, so the event list has never been
    rendered at scale and the raised `max_events` limit was never exercised.
    """
    return {
        "input.value": "stream a long completion, logging every chunk",
        "output.value": _filler(2_000),
        "synthetic.event_count": args.width,
        **llm_attributes(generator.rng),
    }


def _clock_skew(
    generator: Generator, args: argparse.Namespace, repeat_index: int
) -> dict[str, object]:
    """A span from a host whose clock runs fast, so it is timestamped in the future.

    Real deployments produce these constantly, and nothing else here does: every other span
    ends at or before now. A future span breaks "last hour" filters, recency sorting, and any
    code that assumes end_time <= now.
    """
    return {
        "input.value": "emitted by a host whose clock is ahead of the collector",
        "output.value": "the collector received this before it was supposedly sent",
        "synthetic.duration_seconds": 2.5,
        "synthetic.end_offset_seconds": SKEW_SECONDS,
        **llm_attributes(generator.rng),
    }


def _numeric_extremes(
    generator: Generator, args: argparse.Namespace, repeat_index: int
) -> dict[str, object]:
    """Counts and costs at the limits of what a formatter will accept."""
    return {
        "input.value": "token counts at the extremes",
        "llm.provider": "openai",
        "llm.model_name": "gpt-4.1",
        "llm.token_count.prompt": 2_000_000_000,
        "llm.token_count.completion": 0,
        "llm.token_count.total": 2_000_000_000,
        "llm.token_count.prompt_details.cache_read": 1_999_999_999,
    }


HAZARDS: dict[str, Callable[[Generator, argparse.Namespace, int], dict[str, object]]] = {
    "huge-text": _huge_text,
    "long-single-line": _long_single_line,
    "deep-json": _deep_json,
    "unicode": _unicode,
    "markup": _markup,
    "empty-values": _empty_values,
    "many-attributes": _many_attributes,
    "wide-lists": _wide_lists,
    "numeric-extremes": _numeric_extremes,
    "slow-span": _slow_span,
    "clock-skew": _clock_skew,
    "many-events": _many_events,
}


def generate(args: argparse.Namespace) -> tuple[Generator, list[str]]:
    """Return the generator plus the hazard names that were emitted."""
    if args.only and args.only not in HAZARDS:
        raise ValueError(f"unknown hazard {args.only!r}; choose one of: {', '.join(HAZARDS)}")
    names = [args.only] if args.only else list(HAZARDS)
    generator = Generator.from_args(args)
    try:
        for name in names:
            for index in range(args.repeat):
                attributes = {"synthetic.hazard": name, **HAZARDS[name](generator, args, index)}
                # A hazard may ask for a specific wall-clock duration. Both timestamps are
                # required — supplying only a start ends the span at "now" (see the README).
                seconds = attributes.pop("synthetic.duration_seconds", None)
                offset = attributes.pop("synthetic.end_offset_seconds", 0)
                start = end = None
                if seconds is not None:
                    finish = utc_now() + timedelta(seconds=offset)
                    start, end = ns(finish - timedelta(seconds=seconds)), ns(finish)
                events = int(attributes.pop("synthetic.event_count", 0))
                # OpenTelemetry drops events past the limit without erroring. Refuse rather
                # than emit a span that silently lost most of what was asked for.
                if events > SPAN_LIMITS.max_events:
                    raise ValueError(
                        f"--width {events} exceeds SPAN_LIMITS.max_events="
                        f"{SPAN_LIMITS.max_events}; OpenTelemetry would drop the excess "
                        f"silently. Lower --width or raise the limit in _shared.py."
                    )
                with generator.span(
                    f"edge-case-{name}",
                    "LLM"
                    if name in {"huge-text", "unicode", "numeric-extremes", "many-events"}
                    else "CHAIN",
                    attributes=attributes,
                    start_time=start,
                    end_time=end,
                    root=True,
                ) as span:
                    for chunk in range(int(events)):
                        span.add_event(
                            "token.chunk",
                            attributes={"index": chunk, "text": LOREM[: 8 + chunk % 24]},
                        )
    except BaseException:
        generator.close()
        raise
    return generator, names


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if args.list:
        for name in HAZARDS:
            print(name)
        return 0
    generator, names = generate(args)
    generator.close()
    generator.print_summary()
    print(f"hazards={','.join(names)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
