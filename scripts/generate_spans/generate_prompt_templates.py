"""Traces carrying prompt templates, their variables, and a version that actually matters.

Phoenix renders `llm.prompt_template.*` in the span detail view and uses it to replay a span
in the playground, but nothing else in this package emits those attributes. Each trace here
records the template it rendered, the variables it rendered with, and which version produced
it — and the newer version scores better, so a version-over-version comparison shows a real
difference rather than noise.
"""

from __future__ import annotations

import argparse
import json
from collections import Counter
from datetime import timedelta

try:
    from ._shared import (
        Annotations,
        Generator,
        add_common_arguments,
        duration_for,
        llm_attributes,
        message_attributes,
        ns,
        positive_int,
        probability,
        utc_now,
    )
except ImportError:  # Support direct execution from this directory.
    from _shared import (
        Annotations,
        Generator,
        add_common_arguments,
        duration_for,
        llm_attributes,
        message_attributes,
        ns,
        positive_int,
        probability,
        utc_now,
    )

SYSTEM = "openai"

# Each template has two versions. v2 is the improved wording, and the scores below reflect it,
# so the fixture supports the question people actually ask: did the new prompt help?
TEMPLATES = {
    "support-reply": {
        "id": "prompt-support-reply",
        "versions": {
            1: "Answer the customer question: {question}",
            2: (
                "You are a support agent for {product}. Answer the customer's question using "
                "only the account context provided.\n\nQuestion: {question}\nAccount: {account}"
            ),
        },
        "variables": [
            {"question": "Why was I charged twice?", "product": "Phoenix", "account": "4471"},
            {"question": "How do I rotate my API key?", "product": "Phoenix", "account": "8812"},
            {"question": "Can I export my traces?", "product": "Phoenix", "account": "2093"},
        ],
        "outputs": (
            "You were charged twice; a refund is on the way.",
            "Rotate the key from Settings, then update your collector environment.",
            "Yes — traces export as a dataframe or over the REST API.",
        ),
    },
    "trace-summary": {
        "id": "prompt-trace-summary",
        "versions": {
            1: "Summarize this trace: {trace}",
            2: (
                "Summarize the following trace in two sentences. Name the slowest span and "
                "any errors.\n\nTrace: {trace}\nDuration: {duration_ms}ms"
            ),
        },
        "variables": [
            {"trace": "retriever -> reranker -> llm", "duration_ms": "1840"},
            {"trace": "agent -> tool -> llm", "duration_ms": "920"},
        ],
        "outputs": (
            "The retriever dominated at 1.2s; no errors were recorded.",
            "The tool call was slowest at 610ms and returned a 503.",
        ),
    },
    "eval-judge": {
        "id": "prompt-eval-judge",
        "versions": {
            1: "Is this answer correct? {answer}",
            2: (
                "Given the reference, decide whether the answer is correct. Reply with exactly "
                "'correct' or 'incorrect'.\n\nReference: {reference}\nAnswer: {answer}"
            ),
        },
        "variables": [
            {"reference": "Refunds take 5 business days.", "answer": "About a week."},
            {"reference": "Keys rotate in Settings.", "answer": "Contact support to rotate."},
        ],
        "outputs": ("correct", "incorrect"),
    },
}

# Beta parameters per version — v2 is meaningfully better, but the ranges overlap so the
# comparison still requires more than one sample to see.
VERSION_QUALITY = {1: (2.0, 3.0), 2: (6.0, 2.0)}

# v2 spells out the task instead of gesturing at it, so it spends more of the context window
# before the conversation even starts. Modelling that is what lets the fixture answer the
# question a version comparison is really for: the better prompt costs more, is it worth it?
VERSION_PROMPT_SCALE = {1: 1.0, 2: 1.18}


def _template_list(value: str) -> list[str]:
    names = [name.strip() for name in value.split(",") if name.strip()]
    unknown = [name for name in names if name not in TEMPLATES]
    if unknown:
        raise argparse.ArgumentTypeError(
            f"unknown template(s): {', '.join(unknown)}; choose from: {', '.join(TEMPLATES)}"
        )
    return names


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Generate spans carrying prompt templates, variables, and versions."
    )
    add_common_arguments(parser, default_project="prompt-templates")
    parser.add_argument(
        "--traces",
        type=positive_int,
        default=90,
        help="Number of rendered prompts to generate (default: 90).",
    )
    parser.add_argument(
        "--templates",
        type=_template_list,
        help="Comma-separated subset of templates to use (default: all).",
    )
    parser.add_argument(
        "--v2-share",
        type=probability,
        default=0.5,
        help="Fraction of traces rendered with version 2 (default: 0.5).",
    )
    parser.add_argument(
        "--annotation-rate",
        type=probability,
        default=1.0,
        help="Fraction of traces receiving a quality annotation (default: 1.0).",
    )
    return parser


def _render(template: str, variables: dict[str, str]) -> str:
    """Fill a template the way an SDK would, leaving unknown placeholders untouched."""
    rendered = template
    for key, value in variables.items():
        rendered = rendered.replace("{" + key + "}", value)
    return rendered


def generate(args: argparse.Namespace) -> tuple[Generator, Annotations, Counter[str]]:
    """Return the generator, the annotation buffer, and a template/version tally."""
    generator = Generator.from_args(args)
    annotations = Annotations(
        endpoint=args.endpoint,
        dry_run=args.dry_run,
        enabled=args.annotation_rate > 0,
    )
    names = args.templates or list(TEMPLATES)
    tally: Counter[str] = Counter()
    try:
        for index in range(args.traces):
            name = names[index % len(names)]
            spec = TEMPLATES[name]
            version = 2 if generator.rng.random() < args.v2_share else 1
            template = spec["versions"][version]
            variable_index = generator.rng.randrange(len(spec["variables"]))
            variables = spec["variables"][variable_index]
            rendered = _render(template, variables)
            output = spec["outputs"][variable_index % len(spec["outputs"])]
            tally[f"{name}@v{version}"] += 1

            llm = llm_attributes(generator.rng, output_value=output)
            # The template is part of every prompt, so a wordier version costs context on
            # every single call. Scale the prompt side only: the instructions grew, not the
            # answer. Total has to move with it or the breakdown stops adding up.
            prompt_tokens = round(llm["llm.token_count.prompt"] * VERSION_PROMPT_SCALE[version])
            llm["llm.token_count.prompt"] = prompt_tokens
            llm["llm.token_count.total"] = prompt_tokens + llm["llm.token_count.completion"]
            seconds = duration_for(generator.rng, int(llm["llm.token_count.completion"]))
            cursor = utc_now() - timedelta(seconds=seconds + 0.002)

            with generator.span(
                f"{name}-v{version}",
                "CHAIN",
                attributes={
                    "input.value": rendered,
                    "output.value": output,
                    "metadata": json.dumps({"fixture": "prompt-templates", "template": name}),
                },
                start_time=ns(cursor),
                end_time=ns(cursor + timedelta(seconds=seconds + 0.002)),
                root=True,
            ) as root:
                with generator.span(
                    "chat-completion",
                    "LLM",
                    attributes={
                        **llm,
                        "llm.system": SYSTEM,
                        # The template is the unrendered source; variables are what filled it.
                        "llm.prompt_template.template": template,
                        "llm.prompt_template.variables": json.dumps(variables),
                        "llm.prompt_template.version": f"v{version}",
                        "prompt.id": spec["id"],
                        "prompt.vendor": "phoenix",
                        "prompt.url": f"/prompts/{spec['id']}/v{version}",
                        **message_attributes(
                            [
                                {"role": "system", "content": rendered},
                                {"role": "user", "content": variables.get("question", rendered)},
                            ],
                            "llm.input_messages",
                        ),
                        **message_attributes(
                            [{"role": "assistant", "content": output}], "llm.output_messages"
                        ),
                    },
                    start_time=ns(cursor + timedelta(seconds=0.001)),
                    end_time=ns(cursor + timedelta(seconds=seconds + 0.001)),
                ):
                    pass

            if generator.rng.random() < args.annotation_rate:
                alpha, beta = VERSION_QUALITY[version]
                score = generator.rng.betavariate(alpha, beta)
                annotations.add(
                    root,
                    "answer_quality",
                    score=score,
                    label="good" if score >= 0.5 else "poor",
                    metadata={"prompt_version": f"v{version}", "template": name},
                )
        annotations.flush()
    except BaseException:
        generator.close()
        raise
    return generator, annotations, tally


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    generator, annotations, tally = generate(args)
    generator.close()
    generator.print_summary()
    print(f"annotations={annotations.count}")
    print("renders=")
    for key, count in sorted(tally.items()):
        print(f"  {key}: {count}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
