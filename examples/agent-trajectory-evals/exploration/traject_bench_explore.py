#!/usr/bin/env python3
# mypy: ignore-errors
"""
TRAJECT-Bench Dataset Exploration Script

Explores the bigboss24/TRAJECT-Bench dataset from HuggingFace, analyzing:
A. Dataset configuration survey
B. Schema analysis
C. Tool schema deep dive
D. Parallel vs sequential comparison
E. Domain distribution
F. Executed output analysis
G. Evaluation metrics documentation
"""

from __future__ import annotations

import json
import random
from collections import Counter, defaultdict
from typing import Any

from datasets import get_dataset_config_names, load_dataset  # type: ignore[import-untyped]

DATASET = "bigboss24/TRAJECT-Bench"
SPLIT = "test"  # TRAJECT-Bench only has a test split

# Cache loaded datasets to avoid re-downloading
_cache: dict[str, Any] = {}


def load_config(config_name: str) -> Any:
    """Load a dataset config with caching. Returns None if the config cannot be loaded."""
    if config_name not in _cache:
        try:
            _cache[config_name] = load_dataset(DATASET, config_name, split=SPLIT)
        except Exception as e:
            print(f"  WARNING: Failed to load {config_name}: {e!s:.120s}")
            _cache[config_name] = None
    return _cache[config_name]


def truncate(s: object, max_len: int = 500) -> str:
    text = str(s)
    return text[:max_len] + "..." if len(text) > max_len else text


def parse_tools(example: dict[str, Any]) -> list[dict[str, Any]]:
    """Parse tool list from an example. Handles both 'tool_list' and 'tool list' field names."""
    raw = example.get("tool_list") or example.get("tool list")
    if raw is None:
        return []
    if isinstance(raw, str):
        return json.loads(raw)  # type: ignore[no-any-return]
    return raw  # type: ignore[no-any-return]


def section_header(title: str) -> None:
    print(f"\n{'=' * 80}")
    print(f"  {title}")
    print(f"{'=' * 80}\n")


# ============================================================================
#  A. Dataset Configuration Survey
# ============================================================================
def section_a() -> list[str]:
    section_header("A. Dataset Configuration Survey")

    configs: list[str] = sorted(get_dataset_config_names(DATASET))
    print(f"Total configs: {len(configs)}\n")

    parallel_configs = [c for c in configs if c.startswith("parallel_")]
    sequential_configs = [c for c in configs if c.startswith("sequential_")]

    print(f"Parallel configs: {len(parallel_configs)}")
    for c in parallel_configs:
        print(f"  - {c}")

    print(f"\nSequential configs: {len(sequential_configs)}")
    for c in sequential_configs:
        print(f"  - {c}")

    # Load each config and get row counts
    print("\n--- Row counts per config ---\n")
    parallel_total = 0
    sequential_total = 0

    for c in configs:
        ds = load_config(c)
        if ds is None:
            print(f"  {c:45s}  FAILED TO LOAD")
            continue
        count = len(ds)
        split_names = list(ds.info.splits.keys()) if ds.info.splits else [SPLIT]
        print(f"  {c:45s}  split={','.join(split_names):6s}  rows={count}")
        if c.startswith("parallel_"):
            parallel_total += count
        else:
            sequential_total += count

    print(f"\n  Parallel total:   {parallel_total}")
    print(f"  Sequential total: {sequential_total}")
    print(f"  Grand total:      {parallel_total + sequential_total}")

    return configs


# ============================================================================
#  B. Schema Analysis
# ============================================================================
def section_b() -> None:
    section_header("B. Schema Analysis")

    # Parallel
    par_ds = load_config("parallel_ecommerce_simple")
    print("--- Parallel config: parallel_ecommerce_simple ---")
    print(f"Columns: {par_ds.column_names}")
    print("Features:")
    for name, feat in par_ds.features.items():
        print(f"  {name}: {feat}")

    print("\n--- Example (parallel) ---")
    ex = par_ds[0]
    for k, v in ex.items():
        print(f"  [{k}]: {truncate(v)}")

    # Sequential
    seq_ds = load_config("sequential_ecommerce")
    print("\n--- Sequential config: sequential_ecommerce ---")
    print(f"Columns: {seq_ds.column_names}")
    print("Features:")
    for name, feat in seq_ds.features.items():
        print(f"  {name}: {feat}")

    print("\n--- Example (sequential) ---")
    ex = seq_ds[0]
    for k, v in ex.items():
        print(f"  [{k}]: {truncate(v)}")

    # Column comparison
    par_cols = set(par_ds.column_names)
    seq_cols = set(seq_ds.column_names)
    print("\n--- Column comparison ---")
    print(f"  Shared:          {sorted(par_cols & seq_cols)}")
    print(f"  Parallel only:   {sorted(par_cols - seq_cols)}")
    print(f"  Sequential only: {sorted(seq_cols - par_cols)}")


# ============================================================================
#  C. Tool Schema Deep Dive
# ============================================================================
def section_c() -> None:
    section_header("C. Tool Schema Deep Dive")

    par_ds = load_config("parallel_ecommerce_simple")
    tools = parse_tools(par_ds[0])

    # Print schema of one tool
    tool = tools[0]
    print("--- Tool object schema (parallel) ---")
    for k, v in tool.items():
        print(f"  {k}: {type(v).__name__} = {truncate(str(v), 200)}")

    # Sequential tool schema
    seq_ds = load_config("sequential_ecommerce")
    seq_tools = parse_tools(seq_ds[0])
    seq_tool = seq_tools[0]
    print("\n--- Tool object schema (sequential) ---")
    for k, v in seq_tool.items():
        print(f"  {k}: {type(v).__name__} = {truncate(str(v), 200)}")

    # Additional fields in sequential tools
    par_keys = set(tool.keys())
    seq_keys = set(seq_tool.keys())
    print("\n--- Tool field comparison ---")
    print(f"  Shared:          {sorted(par_keys & seq_keys)}")
    print(f"  Parallel only:   {sorted(par_keys - seq_keys)}")
    print(f"  Sequential only: {sorted(seq_keys - par_keys)}")

    # Count unique parent tools and APIs per domain
    print("\n--- Unique parent tools and APIs per domain ---")
    configs: list[str] = sorted(get_dataset_config_names(DATASET))
    domain_parents: dict[str, set[str]] = defaultdict(set)
    domain_apis: dict[str, set[str]] = defaultdict(set)

    for config_name in configs:
        ds = load_config(config_name)
        if ds is None:
            continue
        for i in range(min(50, len(ds))):  # Sample up to 50 per config
            tools_list = parse_tools(ds[i])
            for t in tools_list:
                domain: str = t.get("domain name", "unknown")
                domain_parents[domain].add(t.get("parent tool name", "unknown"))
                domain_apis[domain].add(t.get("API name", "unknown"))

    for domain in sorted(domain_parents.keys()):
        print(
            f"  {domain:20s}  parent_tools={len(domain_parents[domain]):3d}  APIs={len(domain_apis[domain]):3d}"
        )
        # Show a few parent tool names
        parents_sample = sorted(domain_parents[domain])[:5]
        print(f"    {'sample parents':20s}: {parents_sample}")

    # Print 3 diverse tool examples
    print("\n--- Diverse executed_output examples ---")

    # Find one structured, one error, one empty
    examples_found: dict[str, tuple[str, str, Any] | None] = {
        "structured": None,
        "error": None,
        "empty": None,
    }

    for config_name in configs:
        if all(v is not None for v in examples_found.values()):
            break
        ds = load_config(config_name)
        if ds is None:
            continue
        for i in range(min(100, len(ds))):
            tools_list = parse_tools(ds[i])
            for t in tools_list:
                output = t.get("executed_output", "")
                output_str = str(output)
                if examples_found["empty"] is None and (
                    output_str.strip() in ("", "{}", "[]", "None")
                ):
                    examples_found["empty"] = (config_name, t["tool name"], output)
                elif examples_found["error"] is None and (
                    "error" in output_str.lower() or "Error" in output_str
                ):
                    examples_found["error"] = (config_name, t["tool name"], output)
                elif examples_found["structured"] is None and len(output_str) > 100:
                    examples_found["structured"] = (config_name, t["tool name"], output)

    for label, data in examples_found.items():
        print(f"\n  [{label.upper()}]")
        if data is not None:
            found_config, tool_name, output = data
            print(f"    Config: {found_config}")
            print(f"    Tool:   {tool_name}")
            print(f"    Output: {truncate(str(output), 500)}")
        else:
            print("    (not found)")


# ============================================================================
#  D. Parallel vs Sequential Comparison
# ============================================================================
def section_d() -> None:
    section_header("D. Parallel vs Sequential Comparison")

    # Parallel examples
    print("--- PARALLEL: tools are independent (no data dependency) ---\n")
    par_ds = load_config("parallel_ecommerce_simple")

    for idx in [0, 1]:
        ex = par_ds[idx]
        tools = parse_tools(ex)
        print(f"  Example {idx}: query={truncate(ex['query'], 150)}")
        print(f"  Tool count: {ex['tool_count']}")
        for i, t in enumerate(tools):
            req_params: list[dict[str, Any]] = t.get("required parameters", [])
            param_summary = ", ".join(f"{p['name']}={p['value']}" for p in req_params)
            print(f"    Tool {i + 1}: {t['tool name']}")
            print(f"      Params: {param_summary}")
        print("  -> Tools use independent parameters (no output-to-input flow)\n")

    # Sequential examples
    print("--- SEQUENTIAL: tools form a dependency chain ---\n")
    seq_ds = load_config("sequential_ecommerce")

    for idx in [0, 1]:
        ex = seq_ds[idx]
        tools = parse_tools(ex)
        print(f"  Example {idx}: query={truncate(ex['query'], 150)}")
        print(f"  Sequence: {ex.get('sequence_name', 'N/A')}")
        print(f"  Num tools: {ex.get('num_tools_used', len(tools))}")
        for i, t in enumerate(tools):
            req_params = t.get("required parameters", [])
            opt_params: list[dict[str, Any]] = t.get("optional parameters", [])
            all_params = req_params + opt_params
            param_summary = ", ".join(
                f"{p['name']}={truncate(str(p['value']), 60)}" for p in all_params
            )
            step = t.get("sequence_step", i + 1)
            status = t.get("execution_status", "N/A")
            print(f"    Step {step}: {t['tool name']}  [status={status}]")
            print(f"      Params: {param_summary}")
            # Show brief output that feeds into next step
            output = str(t.get("executed_output", ""))
            print(f"      Output preview: {truncate(output, 150)}")
        print("  -> Each step's output may inform the next step's parameters\n")


# ============================================================================
#  E. Domain Distribution
# ============================================================================
def section_e() -> None:
    section_header("E. Domain Distribution")

    configs: list[str] = sorted(get_dataset_config_names(DATASET))

    # Build domain -> config type -> count mapping
    domain_counts: dict[str, dict[str, int]] = defaultdict(
        lambda: {"parallel_simple": 0, "parallel_hard": 0, "sequential": 0}
    )

    # Extract domain from config name
    for config_name in configs:
        ds = load_config(config_name)
        if ds is None:
            continue
        count: int = len(ds)

        if config_name.startswith("parallel_"):
            # e.g. parallel_ecommerce_simple -> domain=ecommerce, difficulty=simple
            parts = config_name.replace("parallel_", "").rsplit("_", 1)
            domain = parts[0]
            difficulty = parts[1] if len(parts) > 1 else "unknown"
            domain_counts[domain][f"parallel_{difficulty}"] += count
        else:
            # e.g. sequential_ecommerce -> domain=ecommerce
            domain = config_name.replace("sequential_", "")
            domain_counts[domain]["sequential"] += count

    # Print table
    print(
        f"  {'Domain':<20s} | {'Par. Simple':>11s} | {'Par. Hard':>11s} | {'Sequential':>11s} | {'Total':>7s}"
    )
    print(f"  {'-' * 20}-+-{'-' * 11}-+-{'-' * 11}-+-{'-' * 11}-+-{'-' * 7}")

    grand_total = 0
    for domain in sorted(domain_counts.keys()):
        d = domain_counts[domain]
        total = d["parallel_simple"] + d["parallel_hard"] + d["sequential"]
        grand_total += total
        par_s = str(d["parallel_simple"]) if d["parallel_simple"] else "-"
        par_h = str(d["parallel_hard"]) if d["parallel_hard"] else "-"
        seq = str(d["sequential"]) if d["sequential"] else "-"
        print(f"  {domain:<20s} | {par_s:>11s} | {par_h:>11s} | {seq:>11s} | {total:>7d}")

    print(f"  {'-' * 20}-+-{'-' * 11}-+-{'-' * 11}-+-{'-' * 11}-+-{'-' * 7}")
    print(f"  {'TOTAL':<20s} | {'':<11s} | {'':<11s} | {'':<11s} | {grand_total:>7d}")

    # Identify which domains have both parallel and sequential
    print("\n--- Domains with both parallel and sequential ---")
    for domain in sorted(domain_counts.keys()):
        d = domain_counts[domain]
        has_parallel = d["parallel_simple"] > 0 or d["parallel_hard"] > 0
        has_sequential = d["sequential"] > 0
        if has_parallel and has_sequential:
            print(f"  + {domain}")
        elif has_parallel:
            print(f"  - {domain} (parallel only)")
        else:
            print(f"  - {domain} (sequential only)")


# ============================================================================
#  F. Executed Output Analysis
# ============================================================================
def section_f() -> None:
    section_header("F. Executed Output Analysis")

    configs: list[str] = sorted(get_dataset_config_names(DATASET))
    random.seed(42)

    # Sample 50 examples across configs
    all_samples: list[dict[str, Any]] = []
    for config_name in configs:
        ds = load_config(config_name)
        if ds is None:
            continue
        indices = random.sample(range(len(ds)), min(2, len(ds)))
        for idx in indices:
            tools = parse_tools(ds[idx])
            for t in tools:
                all_samples.append(
                    {
                        "config": config_name,
                        "tool_name": t.get("tool name", "unknown"),
                        "output": t.get("executed_output", ""),
                        "status": t.get("execution_status", "N/A"),
                    }
                )

    # Take 50 samples
    if len(all_samples) > 50:
        all_samples = random.sample(all_samples, 50)

    print(f"Sampled {len(all_samples)} tool outputs across configs\n")

    # Categorize
    categories: Counter[str] = Counter()
    category_examples: dict[str, dict[str, Any]] = {}

    for s in all_samples:
        output = str(s["output"])
        output_stripped = output.strip()

        if output_stripped in ("", "{}", "[]", "None", "''"):
            cat = "empty"
        elif output_stripped.startswith("{") or output_stripped.startswith("{'"):
            # Check if error
            if any(
                err_key in output.lower()
                for err_key in ['"error"', "'error'", '"message":', "error"]
            ):
                # Heuristic: if it has data fields too, it's structured with error info
                if len(output) > 200 and ("data" in output.lower() or "results" in output.lower()):
                    cat = "structured_json"
                else:
                    cat = "error_response"
            else:
                cat = "structured_json"
        elif output_stripped.startswith("["):
            cat = "list_array"
        elif "error" in output.lower() or "Error" in output:
            cat = "error_response"
        else:
            cat = "other"

        categories[cat] += 1
        if cat not in category_examples:
            category_examples[cat] = s

    print("--- Output type distribution ---")
    for cat, count in categories.most_common():
        pct = count / len(all_samples) * 100
        print(f"  {cat:<20s}: {count:3d} ({pct:.1f}%)")

    print("\n--- Examples of each type ---")
    for cat in ["structured_json", "error_response", "empty", "list_array", "other"]:
        if cat in category_examples:
            s = category_examples[cat]
            print(f"\n  [{cat.upper()}]")
            print(f"    Config: {s['config']}")
            print(f"    Tool:   {s['tool_name']}")
            print(f"    Status: {s['status']}")
            print(f"    Output: {truncate(str(s['output']), 400)}")

    # Execution status distribution (sequential only)
    print("\n--- Execution status distribution (sequential configs) ---")
    status_counts: Counter[str] = Counter()
    for config_name in configs:
        if not config_name.startswith("sequential_"):
            continue
        ds = load_config(config_name)
        if ds is None:
            continue
        for i in range(min(50, len(ds))):
            tools = parse_tools(ds[i])
            for t in tools:
                status_counts[t.get("execution_status", "N/A")] += 1

    for status, count in status_counts.most_common():
        print(f"  {status}: {count}")


# ============================================================================
#  G. Evaluation Metrics Documentation
# ============================================================================
def section_g() -> None:
    section_header("G. Evaluation Metrics Documentation")

    metrics: list[dict[str, str]] = [
        {
            "name": "Exact Match (EM)",
            "description": (
                "Compares predicted tool-use trajectories against ground truth. "
                "Checks whether the selected tool names align precisely -- the "
                "complete set (and optionally order) must match."
            ),
            "our_mapping": (
                "Core metric for tool selection accuracy. For parallel tasks, "
                "order-agnostic set comparison. For sequential tasks, order matters."
            ),
        },
        {
            "name": "Inclusion",
            "description": (
                "Measures the proportion of ground-truth tools present in the "
                "predicted trajectory, even if ordering or extra tools differ. "
                "Reveals partial task completion."
            ),
            "our_mapping": (
                "Useful as a softer metric when agents pick extra tools. "
                "Maps to recall of ground-truth tool set."
            ),
        },
        {
            "name": "Tool Usage (Argument Correctness)",
            "description": (
                "Checks if the predicted tool parameters match the ground truth. "
                "Validates schema constraints, formats, and value accuracy for "
                "tool inputs."
            ),
            "our_mapping": (
                "Critical for parameter correctness evaluation. Each tool call's "
                "arguments must match expected values. Maps directly to our "
                "argument accuracy metric."
            ),
        },
        {
            "name": "Trajectory Satisfaction (Traj-Satisfy)",
            "description": (
                "LLM-judge metric determining to what extent a predicted trajectory "
                "can solve the user query (0-10 scale). Used when gold traces are "
                "unavailable. Reportedly tracks EM closely."
            ),
            "our_mapping": (
                "Useful as LLM-as-judge fallback for open-ended tasks. "
                "We can use this approach for tasks where multiple valid "
                "trajectories exist."
            ),
        },
        {
            "name": "Accuracy (Solution Accuracy)",
            "description": (
                "Measures if the predicted final answer matches the ground truth "
                "answer by prompting an LLM judge. Assesses end-to-end task "
                "completion beyond just tool selection."
            ),
            "our_mapping": (
                "End-to-end metric. We compare the agent's final response "
                "against the ground truth final_answer field."
            ),
        },
        {
            "name": "Retrieval Rate",
            "description": (
                "For retrieval-based methods, measures what proportion of ground "
                "truth tools are retrieved from candidate tool sets."
            ),
            "our_mapping": (
                "Relevant if we implement tool retrieval/filtering as a "
                "preprocessing step before tool selection."
            ),
        },
    ]

    for m in metrics:
        print(f"  {m['name']}")
        print(f"    Definition: {m['description']}")
        print(f"    Our use:    {m['our_mapping']}")
        print()

    print("--- Additional sequential-specific metrics ---")
    print("  Dependency Satisfaction:")
    print("    Definition: Checks whether sequential tool dependencies are respected.")
    print("                Output of tool N must be available/referenced by tool N+1.")
    print("    Our use:    For sequential tasks, verify the agent respects the")
    print("                dependency chain. A tool that needs prior output should")
    print("                not be called before its dependency completes.")
    print()
    print("  Order Satisfaction:")
    print("    Definition: Checks if tools are invoked in the correct order for")
    print("                sequential tasks.")
    print("    Our use:    For sequential tasks, the order of tool calls must match")
    print("                the ground truth sequence.")


# ============================================================================
#  H. Candidate Task Subset Selection
# ============================================================================
def section_h() -> None:
    section_header("H. Candidate Task Subset Selection")

    candidates: list[dict[str, Any]] = []

    # --- Parallel simple: 2-3 tools, ecommerce or finance ---
    print("--- Selecting parallel simple candidates (2-3 tools) ---\n")
    for config_name in ["parallel_ecommerce_simple", "parallel_finance_simple"]:
        ds = load_config(config_name)
        if ds is None:
            continue
        for i in range(len(ds)):
            ex = ds[i]
            tools = parse_tools(ex)
            tc: int = ex.get("tool_count", len(tools))
            if 2 <= tc <= 3:
                domains = set(t.get("domain name", "") for t in tools)
                has_error = any("error" in str(t.get("executed_output", "")).lower() for t in tools)
                candidates.append(
                    {
                        "config": config_name,
                        "index": i,
                        "query": ex["query"],
                        "tool_count": tc,
                        "tools": [t["tool name"] for t in tools],
                        "domains": domains,
                        "has_error": has_error,
                        "type": "parallel_simple",
                    }
                )
                if len([c for c in candidates if c["type"] == "parallel_simple"]) >= 3:
                    break
        if len([c for c in candidates if c["type"] == "parallel_simple"]) >= 3:
            break

    # --- Parallel hard: 5+ tools ---
    print("--- Selecting parallel hard candidates (5+ tools) ---\n")
    for config_name in ["parallel_ecommerce_hard", "parallel_finance_hard", "parallel_travel_hard"]:
        ds = load_config(config_name)
        if ds is None:
            continue
        for i in range(len(ds)):
            ex = ds[i]
            tools = parse_tools(ex)
            tc = ex.get("tool_count", len(tools))
            if tc >= 5:
                domains = set(t.get("domain name", "") for t in tools)
                has_error = any("error" in str(t.get("executed_output", "")).lower() for t in tools)
                candidates.append(
                    {
                        "config": config_name,
                        "index": i,
                        "query": ex["query"],
                        "tool_count": tc,
                        "tools": [t["tool name"] for t in tools],
                        "domains": domains,
                        "has_error": has_error,
                        "type": "parallel_hard",
                    }
                )
                if len([c for c in candidates if c["type"] == "parallel_hard"]) >= 3:
                    break
        if len([c for c in candidates if c["type"] == "parallel_hard"]) >= 3:
            break

    # --- Sequential: 3-5 step chains, travel or finance ---
    print("--- Selecting sequential candidates (3-5 steps) ---\n")
    for config_name in ["sequential_travel", "sequential_finance", "sequential_ecommerce"]:
        ds = load_config(config_name)
        if ds is None:
            continue
        for i in range(len(ds)):
            ex = ds[i]
            tools = parse_tools(ex)
            tc = ex.get("num_tools_used", len(tools))
            if 3 <= tc <= 5:
                domains = set(t.get("domain name", "") for t in tools)
                has_error = any("error" in str(t.get("executed_output", "")).lower() for t in tools)
                candidates.append(
                    {
                        "config": config_name,
                        "index": i,
                        "query": ex["query"],
                        "tool_count": tc,
                        "tools": [t["tool name"] for t in tools],
                        "domains": domains,
                        "has_error": has_error,
                        "type": "sequential",
                        "sequence_name": ex.get("sequence_name", "N/A"),
                        "executable": ex.get("executable", None),
                    }
                )
                if len([c for c in candidates if c["type"] == "sequential"]) >= 3:
                    break
        if len([c for c in candidates if c["type"] == "sequential"]) >= 3:
            break

    # Print selected candidates
    print(f"\n--- Selected {len(candidates)} candidate tasks ---\n")
    for i, c in enumerate(candidates):
        print(f"  Candidate {i + 1}: [{c['type']}]")
        print(f"    Config: {c['config']}, Index: {c['index']}")
        print(f"    Query:  {truncate(c['query'], 200)}")
        print(f"    Tools ({c['tool_count']}): {c['tools']}")
        print(f"    Domains: {c['domains']}")
        print(f"    Has error output: {c['has_error']}")
        if "sequence_name" in c:
            print(f"    Sequence: {c['sequence_name']}")
            print(f"    Executable: {c.get('executable')}")
        print("    Rationale: ", end="")
        if c["type"] == "parallel_simple":
            print("Simple parallel task with few tools -- baseline for tool selection accuracy.")
        elif c["type"] == "parallel_hard":
            print(
                "Complex parallel task with many tools -- tests scaling and multi-domain handling."
            )
        else:
            print("Sequential chain -- tests dependency tracking and ordered execution.")
        print()

    # Check coverage
    all_domains: set[str] = set()
    has_error_task = False
    for c in candidates:
        all_domains.update(c["domains"])
        if c["has_error"]:
            has_error_task = True

    print("  Coverage check:")
    print(f"    Domains covered: {sorted(all_domains)}")
    print(f"    Has error output task: {has_error_task}")
    required_domains = {"eCommerce", "Finance", "Travel"}
    covered = {d for d in all_domains if any(r.lower() in d.lower() for r in required_domains)}
    print(f"    Required domains present: {covered}")


# ============================================================================
#  Main
# ============================================================================
def main() -> None:
    print("TRAJECT-Bench Dataset Exploration")
    print(f"Dataset: {DATASET}")
    print(f"Split: {SPLIT}")

    section_a()
    section_b()
    section_c()
    section_d()
    section_e()
    section_f()
    section_g()
    section_h()

    print(f"\n{'=' * 80}")
    print("  Exploration complete!")
    print(f"{'=' * 80}")


if __name__ == "__main__":
    main()
