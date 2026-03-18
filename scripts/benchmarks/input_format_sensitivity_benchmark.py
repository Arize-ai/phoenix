# ruff: noqa: E501
"""
Input Format Sensitivity Benchmark
===================================

Measures how input formatting affects LLM-as-a-judge alignment with
human labels when evaluating agent tool calls.

Uses the BFCL v3 live_multiple dataset — real-world API schemas from
the Berkeley Function-Calling Leaderboard (ICML 2025) with community-
contributed tool definitions averaging 3.8 params/tool and up to 21
params, with enum constraints in 62% of tools.

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
# 1. LOAD BFCL v3 live_multiple DATASET
# ---------------------------------------------------------------------------

HF_BASE = (
    "https://huggingface.co/datasets/gorilla-llm/Berkeley-Function-Calling-Leaderboard/resolve/main"
)
DATA_URL = f"{HF_BASE}/BFCL_v3_live_multiple.json"
GT_URL = f"{HF_BASE}/possible_answer/BFCL_v3_live_multiple.json"


def download_bfcl_live_multiple() -> tuple[list[dict[str, Any]], dict[str, list[Any]]]:
    """Download BFCL v3 live_multiple + ground truth."""
    print("Downloading BFCL v3 live_multiple...")
    data_r = requests.get(DATA_URL, timeout=60)
    data_r.raise_for_status()
    data = [json.loads(line) for line in data_r.text.strip().splitlines()]

    print("Downloading ground truth labels...")
    gt_r = requests.get(GT_URL, timeout=60)
    gt_r.raise_for_status()
    gt_raw = [json.loads(line) for line in gt_r.text.strip().splitlines()]
    gt_by_id = {g["id"]: g["ground_truth"] for g in gt_raw}

    print(f"  {len(data)} examples, {len(gt_by_id)} with GT")
    return data, gt_by_id


def gt_to_invocation(gt_entry: list[dict[str, Any]]) -> dict[str, Any]:
    """Convert BFCL ground truth format to invocation dict.

    BFCL GT format: [{"func_name": {"param": [possible_values]}}]
    We take the first possible value for each param.
    """
    if not gt_entry:
        return {"name": "", "arguments": {}}

    first_call = gt_entry[0]
    func_name = list(first_call.keys())[0]
    raw_args = first_call[func_name]

    # Each arg value is a list of possible correct values;
    # take the first one
    args = {}
    for k, v in raw_args.items():
        if isinstance(v, list) and len(v) > 0:
            args[k] = v[0]
        else:
            args[k] = v

    return {"name": func_name, "arguments": args}


# ---------------------------------------------------------------------------
# 2. GENERATE INCORRECT INVOCATIONS
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
        other_tools = [t for t in all_tools if t["name"] != name]
        if other_tools:
            wrong = random.choice(other_tools)
            return {"name": wrong["name"], "arguments": args}
        return {"name": name + "_v2", "arguments": args}

    elif perturbation_type == "hallucinated_param":
        fake_params = [
            ("verbose", True),
            ("timeout_seconds", 30),
            ("cache_result", True),
            ("api_version", "v2"),
            ("retry_count", 3),
            ("output_format", "json"),
            ("debug_mode", False),
            ("max_retries", 5),
        ]
        fake_key, fake_val = random.choice(fake_params)
        args[fake_key] = fake_val
        return {"name": name, "arguments": args}

    elif perturbation_type == "missing_required":
        tool_def = next((t for t in all_tools if t["name"] == name), None)
        if tool_def and args:
            required = set(tool_def.get("parameters", {}).get("required", []))
            removable = [k for k in args if k in required]
            if removable:
                del args[random.choice(removable)]
                return {"name": name, "arguments": args}
        if args:
            del args[random.choice(list(args.keys()))]
        return {"name": name, "arguments": args}

    elif perturbation_type == "wrong_value":
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
            elif isinstance(val, dict):
                args[key] = {"invalid": "data"}
        return {"name": name, "arguments": args}

    else:
        return generate_incorrect_invocation(
            correct,
            all_tools,
            "wrong_tool",
        )


# ---------------------------------------------------------------------------
# 3. BUILD BENCHMARK DATASET
# ---------------------------------------------------------------------------


@dataclass
class BenchmarkExample:
    id: str
    query: str
    tools: list[dict[str, Any]]
    invocation: dict[str, Any]
    ground_truth: str
    error_type: str | None = None
    source: str = "bfcl_v3_live_multiple"
    schema_complexity: int = 0  # total params across tools


def build_dataset(
    bfcl_data: list[dict[str, Any]],
    gt_by_id: dict[str, list[Any]],
    n_examples: int = 200,
    min_params: int = 3,
) -> list[BenchmarkExample]:
    """Build balanced benchmark from BFCL live_multiple.

    Filters to examples with sufficient schema complexity,
    then samples n_examples and creates correct + incorrect
    pairs.
    """
    # Filter to examples with GT and sufficient complexity
    candidates = []
    for entry in bfcl_data:
        eid = entry.get("id", "")
        if eid not in gt_by_id:
            continue
        tools = entry.get("function", [])
        if not tools:
            continue

        # Compute total params across all tools
        total_params = sum(len(t.get("parameters", {}).get("properties", {})) for t in tools)
        if total_params < min_params:
            continue

        gt = gt_by_id[eid]
        invocation = gt_to_invocation(gt)
        if not invocation["name"]:
            continue

        # Verify the GT tool actually exists in the tool list
        tool_names = {t["name"] for t in tools}
        if invocation["name"] not in tool_names:
            continue

        candidates.append((entry, invocation, total_params))

    print(f"  {len(candidates)} candidates after filtering (min_params={min_params})")

    # Sample up to n_examples, favoring complex schemas
    if len(candidates) > n_examples:
        # Sort by complexity and sample with bias toward complex
        candidates.sort(key=lambda x: x[2], reverse=True)
        # Take top half by complexity + random sample from rest
        top_half = candidates[: n_examples // 2]
        rest = candidates[n_examples // 2 :]
        random.shuffle(rest)
        sampled = top_half + rest[: n_examples - len(top_half)]
    else:
        sampled = candidates

    random.shuffle(sampled)

    perturbation_types = [
        "wrong_tool",
        "hallucinated_param",
        "missing_required",
        "wrong_value",
    ]

    examples: list[BenchmarkExample] = []
    for i, (entry, correct_inv, complexity) in enumerate(sampled):
        eid = entry.get("id", f"live_{i}")
        query = entry["question"][0][0]["content"]
        tools = entry["function"]

        # CORRECT example
        examples.append(
            BenchmarkExample(
                id=f"{eid}_correct",
                query=query,
                tools=tools,
                invocation=correct_inv,
                ground_truth="correct",
                source=eid,
                schema_complexity=complexity,
            )
        )

        # INCORRECT example
        ptype = perturbation_types[i % len(perturbation_types)]
        incorrect_inv = generate_incorrect_invocation(
            correct_inv,
            tools,
            ptype,
        )
        examples.append(
            BenchmarkExample(
                id=f"{eid}_incorrect",
                query=query,
                tools=tools,
                invocation=incorrect_inv,
                ground_truth="incorrect",
                error_type=ptype,
                source=eid,
                schema_complexity=complexity,
            )
        )

    n_correct = sum(1 for e in examples if e.ground_truth == "correct")
    n_incorrect = sum(1 for e in examples if e.ground_truth == "incorrect")
    complexities = [e.schema_complexity for e in examples[::2]]
    print(f"  Built {len(examples)} examples ({n_correct} correct, {n_incorrect} incorrect)")
    print(
        f"  Schema complexity: min={min(complexities)}, "
        f"max={max(complexities)}, "
        f"avg={sum(complexities) / len(complexities):.1f}"
    )
    return examples


# ---------------------------------------------------------------------------
# 4. FORMATTING FUNCTIONS — the experimental variable
# ---------------------------------------------------------------------------


def format_tools_raw_json(tools: list[dict[str, Any]]) -> str:
    """Condition A: Raw JSON dump."""
    return json.dumps(tools)


def format_invocation_raw_json(
    invocation: dict[str, Any],
) -> str:
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
            # Truncate very long descriptions
            if len(desc) > 200:
                desc = desc[:197] + "..."
            lines.append(f"  Description: {desc}")
        params = tool.get("parameters", {}).get("properties", {})
        required = set(tool.get("parameters", {}).get("required", []))
        if params:
            lines.append("  Parameters:")
            for pname, pdef in params.items():
                req = "required" if pname in required else "optional"
                ptype = pdef.get("type", "any")
                pdesc = pdef.get("description", "")
                if len(pdesc) > 120:
                    pdesc = pdesc[:117] + "..."
                line = f"    - {pname} ({req}, {ptype}): {pdesc}"
                if enum := pdef.get("enum"):
                    enum_str = ", ".join(str(e) for e in enum)
                    if len(enum_str) > 80:
                        enum_str = enum_str[:77] + "..."
                    line += f" [allowed: {enum_str}]"
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
        elif isinstance(v, dict):
            arg_parts.append(f"{k}={json.dumps(v)}")
        else:
            arg_parts.append(f"{k}={v}")
    return f"{name}({', '.join(arg_parts)})"


# ---------------------------------------------------------------------------
# 5. JUDGE PROMPT
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
    schema_complexity: int = 0


async def judge_example_openai(
    client: openai.AsyncOpenAI,
    model: str,
    example: BenchmarkExample,
    condition: str,
    semaphore: asyncio.Semaphore,
) -> JudgeResult:
    """Run judge using OpenAI API."""
    if condition == "raw_json":
        tools_str = format_tools_raw_json(example.tools)
        inv_str = format_invocation_raw_json(example.invocation)
    else:
        tools_str = format_tools_human_readable(example.tools)
        inv_str = format_invocation_human_readable(example.invocation)

    user_msg = JUDGE_USER_TEMPLATE.format(
        query=example.query,
        tools=tools_str,
        invocation=inv_str,
    )

    async with semaphore:
        t0 = time.monotonic()
        try:
            resp = await client.chat.completions.create(
                model=model,
                messages=[
                    {
                        "role": "system",
                        "content": JUDGE_SYSTEM_PROMPT,
                    },
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
        schema_complexity=example.schema_complexity,
    )


async def judge_example_anthropic(
    client: anthropic.AsyncAnthropic,
    model: str,
    example: BenchmarkExample,
    condition: str,
    semaphore: asyncio.Semaphore,
) -> JudgeResult:
    """Run judge using Anthropic API."""
    if condition == "raw_json":
        tools_str = format_tools_raw_json(example.tools)
        inv_str = format_invocation_raw_json(example.invocation)
    else:
        tools_str = format_tools_human_readable(example.tools)
        inv_str = format_invocation_human_readable(example.invocation)

    user_msg = JUDGE_USER_TEMPLATE.format(
        query=example.query,
        tools=tools_str,
        invocation=inv_str,
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
        schema_complexity=example.schema_complexity,
    )


# ---------------------------------------------------------------------------
# 7. METRICS
# ---------------------------------------------------------------------------


def compute_metrics(
    results: list[JudgeResult],
) -> dict[str, Any]:
    """Compute classification metrics."""
    valid = [r for r in results if r.prediction != "unknown"]
    if not valid:
        return {"error": "No valid predictions"}

    y_true = [1 if r.ground_truth == "correct" else 0 for r in valid]
    y_pred = [1 if r.prediction == "correct" else 0 for r in valid]
    n_right = sum(1 for a, b in zip(y_true, y_pred) if a == b)

    return {
        "n": len(valid),
        "n_unknown": len(results) - len(valid),
        "accuracy": n_right / len(valid),
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
    """Accuracy broken down by error type."""
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


def compute_metrics_by_complexity(
    results: list[JudgeResult],
) -> dict[str, dict[str, Any]]:
    """Accuracy by schema complexity bucket."""
    buckets: dict[str, list[JudgeResult]] = {}
    for r in results:
        if r.schema_complexity <= 6:
            bucket = "simple (1-6 params)"
        elif r.schema_complexity <= 15:
            bucket = "medium (7-15 params)"
        else:
            bucket = "complex (16+ params)"
        buckets.setdefault(bucket, []).append(r)

    out = {}
    for bucket, bucket_results in sorted(buckets.items()):
        valid = [r for r in bucket_results if r.prediction != "unknown"]
        if not valid:
            continue
        n_right = sum(1 for r in valid if r.prediction == r.ground_truth)
        out[bucket] = {
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
    """Run both formatting conditions for a single model."""
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
    complexity_breakdown: dict[str, Any] = {}
    for condition, results in all_results.items():
        metrics[condition] = compute_metrics(results)
        error_breakdown[condition] = compute_metrics_by_error_type(results)
        complexity_breakdown[condition] = compute_metrics_by_complexity(results)

    return {
        "model": model_name,
        "provider": provider,
        "results": {k: [vars(r) for r in v] for k, v in all_results.items()},
        "metrics": metrics,
        "error_breakdown": error_breakdown,
        "complexity_breakdown": complexity_breakdown,
    }


def print_comparison_table(
    experiment_results: list[dict[str, Any]],
) -> None:
    """Print formatted comparison table."""
    print("\n" + "=" * 80)
    print("  INPUT FORMAT SENSITIVITY BENCHMARK — RESULTS")
    print("  Dataset: BFCL v3 live_multiple (Berkeley Function-Calling Leaderboard)")
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
                    "P(corr)": (f"{m['precision_correct']:.3f}"),
                    "R(corr)": f"{m['recall_correct']:.3f}",
                    "P(incorr)": (f"{m['precision_incorrect']:.3f}"),
                    "R(incorr)": (f"{m['recall_incorrect']:.3f}"),
                    "kappa": f"{m['cohens_kappa']:.3f}",
                    "Lat(ms)": (f"{m['mean_latency_ms']:.0f}"),
                }
            )

    df = pd.DataFrame(rows)
    print(df.to_string(index=False))

    # Deltas
    print("\n" + "-" * 80)
    print("  FORMAT EFFECT (Human-Readable minus Raw JSON)")
    print("-" * 80)
    for exp in experiment_results:
        raw = exp["metrics"]["raw_json"]
        hr = exp["metrics"]["human_readable"]
        print(f"  {exp['model']}:")
        print(f"    Accuracy:      {hr['accuracy'] - raw['accuracy']:+.1%}")
        print(f"    Macro F1:      {hr['macro_f1'] - raw['macro_f1']:+.3f}")
        print(f"    Cohen's kappa: {hr['cohens_kappa'] - raw['cohens_kappa']:+.3f}")

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
                f"    {etype:25s} (n={n:3d}): "
                f"raw={raw_acc:.0%}  hr={hr_acc:.0%}  "
                f"delta={delta:+.0%}"
            )

    # Complexity breakdown
    print("\n" + "-" * 80)
    print("  ACCURACY BY SCHEMA COMPLEXITY")
    print("-" * 80)
    for exp in experiment_results:
        print(f"\n  {exp['model']}:")
        all_buckets = set()
        for cond in ["raw_json", "human_readable"]:
            all_buckets.update(exp["complexity_breakdown"][cond].keys())
        for bucket in sorted(all_buckets):
            raw_info = exp["complexity_breakdown"]["raw_json"].get(bucket, {})
            hr_info = exp["complexity_breakdown"]["human_readable"].get(bucket, {})
            raw_acc = raw_info.get("accuracy", 0)
            hr_acc = hr_info.get("accuracy", 0)
            n = raw_info.get("n", hr_info.get("n", 0))
            delta = hr_acc - raw_acc
            print(
                f"    {bucket:25s} (n={n:3d}): "
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
                        "schema_complexity": r.get("schema_complexity", 0),
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
    """Run the full experiment."""
    bfcl_data, gt_by_id = download_bfcl_live_multiple()
    examples = build_dataset(
        bfcl_data,
        gt_by_id,
        n_examples=200,
        min_params=3,
    )

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


if __name__ == "__main__":
    asyncio.run(main())
