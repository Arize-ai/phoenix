# ruff: noqa: E501
"""
Input Format Sensitivity Benchmark
===================================

Measures how input formatting affects LLM-as-a-judge alignment with
human labels when evaluating agent tool calls.

Uses the Berkeley Function-Calling Leaderboard (BFCL v3) dataset —
a peer-reviewed benchmark (ICML 2025) with real tool schemas and
ground-truth invocations.

Two conditions:
  1. Raw JSON: Tool schemas and invocations as raw JSON dumps
  2. Human-Readable: Same data in structured, natural-language format

Same judge prompt, same model, same examples — only formatting differs.

Usage:
    source ~/Projects/phoenix/.env
    python scripts/benchmarks/input_format_sensitivity_benchmark.py
"""

from __future__ import annotations

import asyncio
import json
import os
import random
import re
import time
from dataclasses import dataclass
from typing import Any

import anthropic
import openai
import pandas as pd
import requests
from sklearn.metrics import (
    cohen_kappa_score,
    f1_score,
    precision_score,
    recall_score,
)

# Reproducibility
random.seed(42)

# ---------------------------------------------------------------------------
# 1. LOAD BFCL DATASET
# ---------------------------------------------------------------------------

BFCL_MULTIPLE_URL = (
    "https://huggingface.co/datasets/"
    "gorilla-llm/Berkeley-Function-Calling-Leaderboard/"
    "resolve/main/BFCL_v3_exec_multiple.json"
)


def download_bfcl() -> list[dict[str, Any]]:
    """Download BFCL v3 exec_multiple dataset (50 examples)."""
    print("Downloading BFCL v3 exec_multiple dataset...")
    resp = requests.get(BFCL_MULTIPLE_URL, timeout=30)
    resp.raise_for_status()
    data = [json.loads(line) for line in resp.text.strip().splitlines()]
    print(f"  Downloaded {len(data)} examples")
    return data


def parse_ground_truth_call(gt_str: str) -> dict[str, Any]:
    """Parse a BFCL ground truth string like 'func(a=1, b="x")'
    into {"name": "func", "arguments": {"a": 1, "b": "x"}}."""
    # Extract function name and args string
    match = re.match(r"(\w+)\((.*)\)$", gt_str, re.DOTALL)
    if not match:
        return {"name": gt_str, "arguments": {}}

    name = match.group(1)
    args_str = match.group(2).strip()

    if not args_str:
        return {"name": name, "arguments": {}}

    # Parse keyword arguments — use Python's ast for safety
    import ast

    # Build a dict expression from kwargs
    # Handle nested structures by wrapping in dict()
    try:
        # Try direct eval with ast.literal_eval on a dict
        dict_str = "dict(" + args_str + ")"
        args = eval(dict_str)  # noqa: S307
    except Exception:
        # Fallback: try to parse as JSON-like
        args = {}
        for part in _split_kwargs(args_str):
            if "=" in part:
                key, val = part.split("=", 1)
                key = key.strip()
                val = val.strip()
                try:
                    args[key] = ast.literal_eval(val)
                except Exception:
                    args[key] = val

    return {"name": name, "arguments": args}


def _split_kwargs(s: str) -> list[str]:
    """Split comma-separated kwargs respecting brackets/parens."""
    parts: list[str] = []
    depth = 0
    current: list[str] = []
    for ch in s:
        if ch in "([{":
            depth += 1
        elif ch in ")]}":
            depth -= 1
        elif ch == "," and depth == 0:
            parts.append("".join(current).strip())
            current = []
            continue
        current.append(ch)
    if current:
        parts.append("".join(current).strip())
    return parts


# ---------------------------------------------------------------------------
# 2. GENERATE INCORRECT INVOCATIONS (perturbations)
# ---------------------------------------------------------------------------


def generate_incorrect_invocation(
    correct: dict[str, Any],
    all_tools: list[dict[str, Any]],
    perturbation_type: str,
) -> dict[str, Any]:
    """Generate an incorrect invocation from a correct one."""
    name = correct["name"]
    args = dict(correct.get("arguments", {}))

    if perturbation_type == "wrong_tool":
        # Pick a different tool from available tools
        other_tools = [t for t in all_tools if t["name"] != name]
        if other_tools:
            wrong = random.choice(other_tools)
            return {"name": wrong["name"], "arguments": args}
        # Fallback: hallucinate a tool name
        return {"name": name + "_v2", "arguments": args}

    elif perturbation_type == "hallucinated_param":
        # Add a parameter that doesn't exist in the schema
        fake_params = [
            ("verbose", True),
            ("timeout", 30),
            ("cache_result", True),
            ("api_version", "v2"),
            ("retry_count", 3),
            ("format", "json"),
        ]
        fake_key, fake_val = random.choice(fake_params)
        args[fake_key] = fake_val
        return {"name": name, "arguments": args}

    elif perturbation_type == "missing_required":
        # Remove a required parameter
        tool_def = next((t for t in all_tools if t["name"] == name), None)
        if tool_def and args:
            required = set(tool_def.get("parameters", {}).get("required", []))
            removable = [k for k in args if k in required]
            if removable:
                del args[random.choice(removable)]
                return {"name": name, "arguments": args}
        # Fallback: remove any param
        if args:
            del args[random.choice(list(args.keys()))]
        return {"name": name, "arguments": args}

    elif perturbation_type == "wrong_value":
        # Swap or corrupt an argument value
        if args:
            key = random.choice(list(args.keys()))
            val = args[key]
            if isinstance(val, (int, float)):
                args[key] = val * -1 if val != 0 else 999
            elif isinstance(val, str):
                args[key] = val[::-1] if len(val) > 1 else "WRONG"
            elif isinstance(val, list):
                args[key] = list(reversed(val)) if len(val) > 1 else [0]
            elif isinstance(val, bool):
                args[key] = not val
        return {"name": name, "arguments": args}

    else:
        # Default: wrong tool
        return generate_incorrect_invocation(
            correct,
            all_tools,
            "wrong_tool",
        )


# ---------------------------------------------------------------------------
# 3. BUILD BENCHMARK DATASET FROM BFCL
# ---------------------------------------------------------------------------


@dataclass
class BenchmarkExample:
    id: str
    query: str
    tools: list[dict[str, Any]]
    invocation: dict[str, Any]
    ground_truth: str  # "correct" or "incorrect"
    error_type: str | None = None
    source: str = "bfcl_v3"


def build_dataset_from_bfcl(
    bfcl_data: list[dict[str, Any]],
) -> list[BenchmarkExample]:
    """Build balanced benchmark from BFCL data.

    For each BFCL example:
    - Create one "correct" example using the ground-truth invocation
    - Create one "incorrect" example using a perturbation

    This gives us N correct + N incorrect = 2N total examples.
    """
    examples: list[BenchmarkExample] = []

    perturbation_types = [
        "wrong_tool",
        "hallucinated_param",
        "missing_required",
        "wrong_value",
    ]

    for i, entry in enumerate(bfcl_data):
        query = entry["question"][0][0]["content"]
        tools = entry.get("function", [])
        gt_calls = entry.get("ground_truth", [])

        if not gt_calls or not tools:
            continue

        # Parse ground truth
        gt_str = gt_calls[0]  # Take first GT call
        correct_invocation = parse_ground_truth_call(gt_str)

        if not correct_invocation["name"]:
            continue

        # CORRECT example
        examples.append(
            BenchmarkExample(
                id=f"bfcl_{i}_correct",
                query=query,
                tools=tools,
                invocation=correct_invocation,
                ground_truth="correct",
                source=entry.get("id", f"exec_multiple_{i}"),
            )
        )

        # INCORRECT example — cycle through perturbation types
        ptype = perturbation_types[i % len(perturbation_types)]
        incorrect_invocation = generate_incorrect_invocation(
            correct_invocation,
            tools,
            ptype,
        )

        examples.append(
            BenchmarkExample(
                id=f"bfcl_{i}_incorrect",
                query=query,
                tools=tools,
                invocation=incorrect_invocation,
                ground_truth="incorrect",
                error_type=ptype,
                source=entry.get("id", f"exec_multiple_{i}"),
            )
        )

    print(
        f"Built {len(examples)} examples "
        f"({sum(1 for e in examples if e.ground_truth == 'correct')} correct, "
        f"{sum(1 for e in examples if e.ground_truth == 'incorrect')} incorrect)"
    )
    return examples


# ---------------------------------------------------------------------------
# 4. FORMATTING FUNCTIONS — the experimental variable
# ---------------------------------------------------------------------------


def format_tools_raw_json(tools: list[dict[str, Any]]) -> str:
    """Condition A: Raw JSON dump."""
    return json.dumps(tools)


def format_invocation_raw_json(invocation: dict[str, Any]) -> str:
    """Condition A: Raw JSON dump."""
    return json.dumps(invocation)


def format_tools_human_readable(
    tools: list[dict[str, Any]],
) -> str:
    """Condition B: Structured, readable text."""
    parts = []
    for tool in tools:
        lines = [f"{tool['name']}:"]
        desc = tool.get("description", "")
        if desc:
            lines.append(f"  Description: {desc}")
        params = tool.get("parameters", {}).get("properties", {})
        required = set(tool.get("parameters", {}).get("required", []))
        if params:
            lines.append("  Parameters:")
            for pname, pdef in params.items():
                req = "required" if pname in required else "optional"
                ptype = pdef.get("type", "any")
                pdesc = pdef.get("description", "")
                line = f"    - {pname} ({req}, {ptype}): {pdesc}"
                if enum := pdef.get("enum"):
                    allowed = ", ".join(str(e) for e in enum)
                    line += f" [allowed: {allowed}]"
                lines.append(line)
        parts.append("\n".join(lines))
    return "\n\n".join(parts)


def format_invocation_human_readable(
    invocation: dict[str, Any],
) -> str:
    """Condition B: Function-call notation."""
    name = invocation["name"]
    args = invocation.get("arguments", {})
    arg_parts = []
    for k, v in args.items():
        if isinstance(v, str):
            arg_parts.append(f'{k}="{v}"')
        elif isinstance(v, list):
            items = ", ".join(f'"{i}"' if isinstance(i, str) else str(i) for i in v)
            arg_parts.append(f"{k}=[{items}]")
        else:
            arg_parts.append(f"{k}={v}")
    return f"{name}({', '.join(arg_parts)})"


# ---------------------------------------------------------------------------
# 5. JUDGE PROMPT — identical across conditions
# ---------------------------------------------------------------------------

JUDGE_SYSTEM_PROMPT = (
    "You are an impartial judge evaluating an LLM's tool-calling "
    "behavior, specifically whether the LLM invoked a tool correctly "
    "with valid arguments and proper formatting.\n\n"
    "Your task: Determine whether the LLM's tool invocation was "
    "correct or incorrect based on:\n"
    "- The conversation context (the user's query)\n"
    "- The available tool schemas\n"
    "- The LLM's tool invocation with arguments\n\n"
    'Criteria — return "correct" only when ALL are true:\n'
    "- The correct tool was selected for the task.\n"
    "- All required fields/parameters are present.\n"
    "- No hallucinated or nonexistent fields "
    "(all fields exist in the tool schema).\n"
    "- Argument values match the user's intent "
    "(correct types, realistic values).\n"
    "- No extra parameters beyond what the schema defines.\n\n"
    'Return "incorrect" if ANY of the following are true:\n'
    "- The wrong tool was selected.\n"
    "- Required fields/parameters are missing.\n"
    "- The invocation contains hallucinated fields not in schema.\n"
    "- Argument values are incorrect or don't match user intent.\n"
    "- Extra parameters are passed that the tool doesn't accept.\n\n"
    'Respond with ONLY "correct" or "incorrect" — no explanation.'
)

JUDGE_USER_TEMPLATE = """<input>
{query}
</input>

<available_tools>
{tools}
</available_tools>

<tool_invocation>
{invocation}
</tool_invocation>

Is this tool invocation correct or incorrect?"""


# ---------------------------------------------------------------------------
# 6. ASYNC JUDGE EXECUTION
# ---------------------------------------------------------------------------


@dataclass
class JudgeResult:
    example_id: str
    condition: str
    prediction: str
    ground_truth: str
    latency_ms: float
    raw_response: str
    error_type: str | None = None


async def judge_example_openai(
    client: openai.AsyncOpenAI,
    model: str,
    example: BenchmarkExample,
    condition: str,
    semaphore: asyncio.Semaphore,
) -> JudgeResult:
    """Run judge on a single example using OpenAI API."""
    if condition == "raw_json":
        tools_str = format_tools_raw_json(example.tools)
        invocation_str = format_invocation_raw_json(example.invocation)
    else:
        tools_str = format_tools_human_readable(example.tools)
        invocation_str = format_invocation_human_readable(example.invocation)

    user_msg = JUDGE_USER_TEMPLATE.format(
        query=example.query,
        tools=tools_str,
        invocation=invocation_str,
    )

    async with semaphore:
        t0 = time.monotonic()
        try:
            resp = await client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": JUDGE_SYSTEM_PROMPT},
                    {"role": "user", "content": user_msg},
                ],
                temperature=0.0,
                max_tokens=10,
            )
            content = resp.choices[0].message.content
            raw = content.strip().lower() if content else "ERROR"
        except Exception as e:
            raw = f"ERROR: {e}"
        latency = (time.monotonic() - t0) * 1000

    if "incorrect" in raw:
        prediction = "incorrect"
    elif "correct" in raw:
        prediction = "correct"
    else:
        prediction = "unknown"

    return JudgeResult(
        example_id=example.id,
        condition=condition,
        prediction=prediction,
        ground_truth=example.ground_truth,
        latency_ms=latency,
        raw_response=raw,
        error_type=example.error_type,
    )


async def judge_example_anthropic(
    client: anthropic.AsyncAnthropic,
    model: str,
    example: BenchmarkExample,
    condition: str,
    semaphore: asyncio.Semaphore,
) -> JudgeResult:
    """Run judge on a single example using Anthropic API."""
    if condition == "raw_json":
        tools_str = format_tools_raw_json(example.tools)
        invocation_str = format_invocation_raw_json(example.invocation)
    else:
        tools_str = format_tools_human_readable(example.tools)
        invocation_str = format_invocation_human_readable(example.invocation)

    user_msg = JUDGE_USER_TEMPLATE.format(
        query=example.query,
        tools=tools_str,
        invocation=invocation_str,
    )

    async with semaphore:
        t0 = time.monotonic()
        try:
            resp = await client.messages.create(
                model=model,
                system=JUDGE_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": user_msg}],
                temperature=0.0,
                max_tokens=10,
            )
            block = resp.content[0]
            raw = getattr(block, "text", "ERROR").strip().lower()
        except Exception as e:
            raw = f"ERROR: {e}"
        latency = (time.monotonic() - t0) * 1000

    if "incorrect" in raw:
        prediction = "incorrect"
    elif "correct" in raw:
        prediction = "correct"
    else:
        prediction = "unknown"

    return JudgeResult(
        example_id=example.id,
        condition=condition,
        prediction=prediction,
        ground_truth=example.ground_truth,
        latency_ms=latency,
        raw_response=raw,
        error_type=example.error_type,
    )


# ---------------------------------------------------------------------------
# 7. METRICS COMPUTATION
# ---------------------------------------------------------------------------


def compute_metrics(
    results: list[JudgeResult],
) -> dict[str, Any]:
    """Compute precision, recall, F1, accuracy, and Cohen's kappa."""
    valid = [r for r in results if r.prediction != "unknown"]
    if not valid:
        return {"error": "No valid predictions"}

    y_true = [1 if r.ground_truth == "correct" else 0 for r in valid]
    y_pred = [1 if r.prediction == "correct" else 0 for r in valid]

    n_correct = sum(1 for a, b in zip(y_true, y_pred) if a == b)

    return {
        "n": len(valid),
        "n_unknown": len(results) - len(valid),
        "accuracy": n_correct / len(valid),
        "precision_correct": precision_score(y_true, y_pred, zero_division=0),
        "recall_correct": recall_score(y_true, y_pred, zero_division=0),
        "f1_correct": f1_score(y_true, y_pred, zero_division=0),
        "precision_incorrect": precision_score(y_true, y_pred, pos_label=0, zero_division=0),
        "recall_incorrect": recall_score(y_true, y_pred, pos_label=0, zero_division=0),
        "f1_incorrect": f1_score(y_true, y_pred, pos_label=0, zero_division=0),
        "macro_f1": f1_score(y_true, y_pred, average="macro", zero_division=0),
        "cohens_kappa": cohen_kappa_score(y_true, y_pred),
        "mean_latency_ms": (sum(r.latency_ms for r in valid) / len(valid)),
    }


def compute_metrics_by_error_type(
    results: list[JudgeResult],
) -> dict[str, dict[str, Any]]:
    """Compute accuracy broken down by error type."""
    by_type: dict[str, list[JudgeResult]] = {}
    for r in results:
        key = r.error_type or "correct_invocation"
        by_type.setdefault(key, []).append(r)

    out = {}
    for etype, etype_results in sorted(by_type.items()):
        valid = [r for r in etype_results if r.prediction != "unknown"]
        if not valid:
            continue
        n_right = sum(1 for r in valid if r.prediction == r.ground_truth)
        out[etype] = {
            "n": len(valid),
            "accuracy": n_right / len(valid),
        }
    return out


# ---------------------------------------------------------------------------
# 8. EXPERIMENT RUNNER
# ---------------------------------------------------------------------------


async def run_experiment_for_model(
    model_name: str,
    examples: list[BenchmarkExample],
    provider: str = "openai",
) -> dict[str, Any]:
    """Run both formatting conditions for a single judge model."""
    concurrency = 10
    semaphore = asyncio.Semaphore(concurrency)

    if provider == "openai":
        oai_client = openai.AsyncOpenAI()

        async def run_judge(
            ex: BenchmarkExample,
            cond: str,
        ) -> JudgeResult:
            return await judge_example_openai(
                oai_client,
                model_name,
                ex,
                cond,
                semaphore,
            )
    else:
        ant_client = anthropic.AsyncAnthropic()

        async def run_judge(
            ex: BenchmarkExample,
            cond: str,
        ) -> JudgeResult:
            return await judge_example_anthropic(
                ant_client,
                model_name,
                ex,
                cond,
                semaphore,
            )

    print(f"\n{'=' * 60}")
    print(f"  Model: {model_name} ({provider})")
    print(f"  Examples: {len(examples)} | Concurrency: {concurrency}")
    print(f"{'=' * 60}")

    all_results: dict[str, list[JudgeResult]] = {}
    for condition in ["raw_json", "human_readable"]:
        print(f"\n  Running condition: {condition}...")
        tasks = [run_judge(ex, condition) for ex in examples]
        results = await asyncio.gather(*tasks)
        all_results[condition] = list(results)

        correct_preds = sum(1 for r in results if r.prediction == r.ground_truth)
        print(f"  -> {correct_preds}/{len(results)} aligned with GT")

    metrics: dict[str, Any] = {}
    error_breakdown: dict[str, Any] = {}
    for condition, results in all_results.items():
        metrics[condition] = compute_metrics(results)
        error_breakdown[condition] = compute_metrics_by_error_type(
            results,
        )

    return {
        "model": model_name,
        "provider": provider,
        "results": {k: [vars(r) for r in v] for k, v in all_results.items()},
        "metrics": metrics,
        "error_breakdown": error_breakdown,
    }


def print_comparison_table(
    experiment_results: list[dict[str, Any]],
) -> None:
    """Print formatted comparison table."""
    print("\n" + "=" * 80)
    print("  INPUT FORMAT SENSITIVITY BENCHMARK — RESULTS")
    print("  Dataset: BFCL v3 exec_multiple (Berkeley Function-Calling Leaderboard)")
    print("=" * 80)

    rows = []
    for exp in experiment_results:
        model = exp["model"]
        for condition in ["raw_json", "human_readable"]:
            m = exp["metrics"][condition]
            rows.append(
                {
                    "Model": model,
                    "Format": condition,
                    "Accuracy": f"{m['accuracy']:.1%}",
                    "Macro F1": f"{m['macro_f1']:.3f}",
                    "P(correct)": f"{m['precision_correct']:.3f}",
                    "R(correct)": f"{m['recall_correct']:.3f}",
                    "P(incorrect)": (f"{m['precision_incorrect']:.3f}"),
                    "R(incorrect)": (f"{m['recall_incorrect']:.3f}"),
                    "kappa": f"{m['cohens_kappa']:.3f}",
                    "Latency(ms)": (f"{m['mean_latency_ms']:.0f}"),
                }
            )

    df = pd.DataFrame(rows)
    print(df.to_string(index=False))

    print("\n" + "-" * 80)
    print("  FORMAT EFFECT (Human-Readable minus Raw JSON)")
    print("-" * 80)
    for exp in experiment_results:
        raw = exp["metrics"]["raw_json"]
        hr = exp["metrics"]["human_readable"]
        delta_acc = hr["accuracy"] - raw["accuracy"]
        delta_f1 = hr["macro_f1"] - raw["macro_f1"]
        delta_kappa = hr["cohens_kappa"] - raw["cohens_kappa"]
        print(f"  {exp['model']}:")
        print(f"    Accuracy:      {delta_acc:+.1%}")
        print(f"    Macro F1:      {delta_f1:+.3f}")
        print(f"    Cohen's kappa: {delta_kappa:+.3f}")

    # Error type breakdown
    print("\n" + "-" * 80)
    print("  ACCURACY BY ERROR TYPE")
    print("-" * 80)
    for exp in experiment_results:
        print(f"\n  {exp['model']}:")
        all_types = set()
        for cond in ["raw_json", "human_readable"]:
            all_types.update(exp["error_breakdown"][cond].keys())
        for etype in sorted(all_types):
            raw_info = exp["error_breakdown"]["raw_json"].get(etype, {})
            hr_info = exp["error_breakdown"]["human_readable"].get(etype, {})
            raw_acc = raw_info.get("accuracy", 0)
            hr_acc = hr_info.get("accuracy", 0)
            n = raw_info.get("n", hr_info.get("n", 0))
            delta = hr_acc - raw_acc
            print(
                f"    {etype:25s} (n={n:2d}): "
                f"raw={raw_acc:.0%}  hr={hr_acc:.0%}  "
                f"delta={delta:+.0%}"
            )


def save_results(
    experiment_results: list[dict[str, Any]],
    output_dir: str,
) -> None:
    """Save detailed results to files."""
    os.makedirs(output_dir, exist_ok=True)

    with open(os.path.join(output_dir, "results.json"), "w") as f:
        json.dump(experiment_results, f, indent=2, default=str)

    all_rows = []
    for exp in experiment_results:
        for condition, results in exp["results"].items():
            for r in results:
                all_rows.append(
                    {
                        "model": exp["model"],
                        "condition": condition,
                        "example_id": r["example_id"],
                        "prediction": r["prediction"],
                        "ground_truth": r["ground_truth"],
                        "aligned": (r["prediction"] == r["ground_truth"]),
                        "error_type": r.get("error_type", ""),
                        "latency_ms": r["latency_ms"],
                    }
                )
    df = pd.DataFrame(all_rows)
    df.to_csv(
        os.path.join(output_dir, "per_example_results.csv"),
        index=False,
    )

    summary_rows = []
    for exp in experiment_results:
        for condition, m in exp["metrics"].items():
            summary_rows.append(
                {
                    "model": exp["model"],
                    "condition": condition,
                    **m,
                }
            )
    summary_df = pd.DataFrame(summary_rows)
    summary_df.to_csv(
        os.path.join(output_dir, "summary_metrics.csv"),
        index=False,
    )

    print(f"\n  Results saved to {output_dir}/")


# ---------------------------------------------------------------------------
# 9. MAIN
# ---------------------------------------------------------------------------


async def main() -> None:
    """Run the full input format sensitivity experiment."""
    bfcl_data = download_bfcl()
    examples = build_dataset_from_bfcl(bfcl_data)

    models = [
        ("gpt-4o", "openai"),
        ("gpt-4o-mini", "openai"),
        ("claude-sonnet-4-20250514", "anthropic"),
    ]

    experiment_results = []
    for model_name, provider in models:
        try:
            result = await run_experiment_for_model(
                model_name,
                examples,
                provider,
            )
            experiment_results.append(result)
        except Exception as e:
            print(f"\n  ERROR with {model_name}: {e}")
            import traceback

            traceback.print_exc()

    if experiment_results:
        print_comparison_table(experiment_results)

        output_dir = os.path.join(
            os.path.dirname(__file__),
            "input_format_sensitivity_results",
        )
        save_results(experiment_results, output_dir)

    # Print format examples for documentation
    if examples:
        print("\n" + "=" * 80)
        print("  FORMAT EXAMPLES (for documentation)")
        print("=" * 80)
        ex = examples[0]
        print("\n--- RAW JSON ---")
        raw_tools = format_tools_raw_json(ex.tools)
        print(f"Tools: {raw_tools[:400]}...")
        raw_inv = format_invocation_raw_json(ex.invocation)
        print(f"Invocation: {raw_inv}")
        print("\n--- HUMAN READABLE ---")
        hr_tools = format_tools_human_readable(ex.tools)
        print(f"Tools:\n{hr_tools}")
        hr_inv = format_invocation_human_readable(ex.invocation)
        print(f"Invocation: {hr_inv}")


if __name__ == "__main__":
    asyncio.run(main())
