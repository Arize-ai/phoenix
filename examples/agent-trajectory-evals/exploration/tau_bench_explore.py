#!/usr/bin/env python3
# mypy: ignore-errors
"""τ-bench exploration script.

Loads and analyzes the τ-bench retail environment data structures,
tools, policies, trajectories, and evaluation approach.
Run from: examples/agent-trajectory-evals/
"""

import importlib.util
import json
import sys
from collections import Counter
from pathlib import Path
from typing import Any, Dict, List, Tuple

# ---------------------------------------------------------------------------
# Path setup – we do NOT install tau-bench; instead we manipulate sys.path
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent
BASE_DIR = SCRIPT_DIR.parent  # examples/agent-trajectory-evals
VENDOR_DIR = BASE_DIR / "vendor" / "tau-bench"
TAU_BENCH_DIR = VENDOR_DIR / "tau_bench"
RETAIL_DIR = TAU_BENCH_DIR / "envs" / "retail"
DATA_DIR = RETAIL_DIR / "data"
TOOLS_DIR = RETAIL_DIR / "tools"
HIST_DIR = VENDOR_DIR / "historical_trajectories"

# Add vendor dir to sys.path so we can import tau_bench modules
sys.path.insert(0, str(VENDOR_DIR))

# We need pydantic available for tau_bench.types
try:
    import pydantic  # noqa: F401
except ImportError:
    print("WARNING: pydantic not installed. Install with: pip install pydantic")
    sys.exit(1)


def banner(title: str) -> None:
    print("\n" + "=" * 80)
    print(f"  {title}")
    print("=" * 80 + "\n")


def sub_banner(title: str) -> None:
    print(f"\n--- {title} ---\n")


# ============================================================================
# A. TASK FORMAT ANALYSIS
# ============================================================================
def section_a() -> None:
    banner("A. TASK FORMAT ANALYSIS")

    from tau_bench.types import Action, Task  # noqa: F401

    print("Task schema:")
    print(f"  Task fields: {list(Task.model_fields.keys())}")
    print(f"  Action fields: {list(Action.model_fields.keys())}")
    print()

    # Count tasks per split
    for split in ["test", "train", "dev"]:
        mod_name = f"tau_bench.envs.retail.tasks_{split}"
        mod = importlib.import_module(mod_name)
        var_name = f"TASKS_{split.upper()}"
        tasks: Any = getattr(mod, var_name)
        print(f"  {split}: {len(tasks)} tasks")

    # Load test tasks for detailed analysis
    from tau_bench.envs.retail.tasks_test import TASKS_TEST

    # Pick 3 representative tasks
    # Task 0: multi-step exchange (complex)
    # Find a simple lookup
    simple_idx: int | None = None
    policy_idx: int | None = None
    for i, t in enumerate(TASKS_TEST):
        action_names: List[str] = [a.name for a in t.actions]
        if (
            simple_idx is None
            and len(t.actions) <= 4
            and all(
                n.startswith("find_") or n.startswith("get_") or n == "list_all_product_types"
                for n in action_names
            )
        ):
            simple_idx = i
        if policy_idx is None and "transfer_to_human_agents" in action_names:
            policy_idx = i
        if simple_idx is not None and policy_idx is not None:
            break

    # Fallback
    if simple_idx is None:
        simple_idx = 5
    if policy_idx is None:
        policy_idx = 10

    representatives: List[Tuple[int, str]] = [
        (0, "Multi-step exchange"),
        (simple_idx, "Simple lookup"),
        (policy_idx, "Policy-sensitive / escalation"),
    ]

    for idx, label in representatives:
        task = TASKS_TEST[idx]
        sub_banner(f"Task {idx} ({label})")
        print(f"  user_id: {task.user_id}")
        print(f"  instruction: {task.instruction}")
        print(f"  outputs: {task.outputs}")
        print(f"  actions ({len(task.actions)}):")
        for j, a in enumerate(task.actions):
            print(f"    [{j}] {a.name}({a.kwargs})")


# ============================================================================
# B. TOOL SCHEMA ENUMERATION
# ============================================================================
TOOL_CATEGORIES: Dict[str, List[str]] = {
    "User Lookup": [
        "find_user_id_by_email",
        "find_user_id_by_name_zip",
        "get_user_details",
        "modify_user_address",
    ],
    "Order Management": [
        "get_order_details",
        "cancel_pending_order",
        "modify_pending_order_address",
        "modify_pending_order_items",
        "modify_pending_order_payment",
    ],
    "Delivered Order": [
        "return_delivered_order_items",
        "exchange_delivered_order_items",
    ],
    "Product": [
        "get_product_details",
        "list_all_product_types",
    ],
    "Support / Utility": [
        "transfer_to_human_agents",
        "calculate",
        "think",
    ],
}

WRITE_TOOLS = {
    "cancel_pending_order",
    "modify_pending_order_address",
    "modify_pending_order_items",
    "modify_pending_order_payment",
    "modify_user_address",
    "return_delivered_order_items",
    "exchange_delivered_order_items",
}


def section_b() -> None:
    banner("B. TOOL SCHEMA ENUMERATION")

    from tau_bench.envs.retail.tools import ALL_TOOLS

    print(f"Total tools: {len(ALL_TOOLS)}\n")

    # Build name->info map
    tool_infos: Dict[str, Any] = {}
    for tool_cls in ALL_TOOLS:
        info = tool_cls.get_info()
        name = info["function"]["name"]
        tool_infos[name] = info

    # Print by category
    for category, names in TOOL_CATEGORIES.items():
        sub_banner(category)
        for name in names:
            if name in tool_infos:
                info = tool_infos[name]
                fn = info["function"]
                rw = "WRITE" if name in WRITE_TOOLS else "READ"
                print(f"  [{rw}] {fn['name']}")
                print(f"    description: {fn['description']}")
                params = fn.get("parameters", {})
                props = params.get("properties", {})
                required = params.get("required", [])
                if props:
                    print("    parameters:")
                    for pname, pinfo in props.items():
                        req = " (required)" if pname in required else ""
                        print(
                            f"      - {pname}: {pinfo.get('type', '?')}{req}"
                            f" -- {pinfo.get('description', '')}"
                        )
                print()

    # Print any uncategorized
    all_categorized: set[str] = set()
    for names in TOOL_CATEGORIES.values():
        all_categorized.update(names)
    uncategorized = set(tool_infos.keys()) - all_categorized
    if uncategorized:
        sub_banner("Uncategorized")
        for name in uncategorized:
            print(f"  {name}")


# ============================================================================
# C. POLICY SUMMARY
# ============================================================================
def section_c() -> None:
    banner("C. POLICY (wiki.md)")

    wiki_path = RETAIL_DIR / "wiki.md"
    with open(wiki_path) as f:
        wiki = f.read()
    print(wiki)

    print("\n--- KEY RULES SUMMARY ---\n")
    key_rules = [
        "Authentication: Must locate user by email OR name+zip before any action",
        "One user per conversation: Cannot help multiple users",
        "Single tool call per interaction: No parallel tool calls; no tool+response in same turn",
        "Explicit confirmation: Must list action details and get 'yes' before DB changes",
        "Modification constraints: Exchange/modify tools can only be called ONCE per order",
        "Escalation: Transfer to human only when request is out of scope",
        "No hallucination: Agent must not make up information",
    ]
    for rule in key_rules:
        print(f"  * {rule}")


# ============================================================================
# D. DATABASE SCHEMA
# ============================================================================
def section_d() -> None:
    banner("D. DATABASE SCHEMA")

    for fname in ["users.json", "orders.json", "products.json"]:
        sub_banner(fname)
        with open(DATA_DIR / fname) as f:
            data: Any = json.load(f)

        if isinstance(data, dict):
            print("  Type: dict (keyed by ID)")
            print(f"  Count: {len(data)}")
            first_key = list(data.keys())[0]
            first_val = data[first_key]
            print(f"  Fields: {list(first_val.keys())}")

            # Show types
            print("  Field types:")
            for k, v in first_val.items():
                if isinstance(v, list) and len(v) > 0:
                    print(f"    {k}: list of {type(v[0]).__name__} (len={len(v)})")
                elif isinstance(v, dict):
                    print(f"    {k}: dict with keys {list(v.keys())[:5]}")
                else:
                    print(f"    {k}: {type(v).__name__}")

            print(f"\n  Example ({first_key}):")
            print(json.dumps(first_val, indent=4)[:2000])
        elif isinstance(data, list):
            print("  Type: list")
            print(f"  Count: {len(data)}")
            if data:
                print(f"  Fields: {list(data[0].keys())}")
                print("\n  Example:")
                print(json.dumps(data[0], indent=4)[:2000])
        print()

    print("\n--- READ vs WRITE TOOLS ---\n")
    print("  Read-only tools: find_user_id_by_email, find_user_id_by_name_zip,")
    print("    get_user_details, get_order_details, get_product_details,")
    print("    list_all_product_types, calculate, think, transfer_to_human_agents")
    print()
    print("  State-mutating tools: cancel_pending_order, modify_pending_order_address,")
    print("    modify_pending_order_items, modify_pending_order_payment,")
    print("    modify_user_address, return_delivered_order_items,")
    print("    exchange_delivered_order_items")


# ============================================================================
# E. HISTORICAL TRAJECTORY ANALYSIS
# ============================================================================
def section_e() -> None:
    banner("E. HISTORICAL TRAJECTORY ANALYSIS")

    traj_path = HIST_DIR / "gpt-4o-retail.json"
    with open(traj_path) as f:
        trajectories: List[Dict[str, Any]] = json.load(f)

    print(f"Total trajectories: {len(trajectories)}")

    # Schema
    sub_banner("Trajectory entry schema")
    entry = trajectories[0]
    for k, v in entry.items():
        if isinstance(v, list):
            print(f"  {k}: list[{len(v)}]")
        elif isinstance(v, dict):
            print(f"  {k}: dict with keys {list(v.keys())[:5]}")
        else:
            print(f"  {k}: {type(v).__name__} = {repr(v)[:80]}")

    # Reward distribution
    rewards = [t["reward"] for t in trajectories]
    reward_counts = Counter(rewards)
    sub_banner("Reward distribution")
    for r, count in sorted(reward_counts.items()):
        print(f"  reward={r}: {count} ({count / len(rewards) * 100:.1f}%)")

    # Trajectory lengths
    traj_lengths = [len(t["traj"]) for t in trajectories]
    sub_banner("Trajectory length stats")
    print(f"  Mean: {sum(traj_lengths) / len(traj_lengths):.1f}")
    print(f"  Min: {min(traj_lengths)}")
    print(f"  Max: {max(traj_lengths)}")
    print(f"  Median: {sorted(traj_lengths)[len(traj_lengths) // 2]}")

    # Role distribution
    role_counts: Counter[str] = Counter()
    for t in trajectories:
        for msg in t["traj"]:
            role_counts[msg.get("role", "unknown")] += 1
    sub_banner("Role distribution across all trajectories")
    for role, count in role_counts.most_common():
        print(f"  {role}: {count}")

    # Print one successful and one failed trajectory (short ones)
    successes = [t for t in trajectories if t["reward"] == 1.0]
    failures = [t for t in trajectories if t["reward"] == 0.0]

    # Pick shortest
    successes.sort(key=lambda t: len(t["traj"]))
    failures.sort(key=lambda t: len(t["traj"]))

    for label, traj_list in [
        ("SUCCESSFUL (reward=1.0)", successes),
        ("FAILED (reward=0.0)", failures),
    ]:
        if not traj_list:
            continue
        # Pick shortest under 15 messages, else just shortest
        candidates = [t for t in traj_list if len(t["traj"]) < 15]
        if not candidates:
            candidates = traj_list[:1]
        t = candidates[0]
        sub_banner(
            f"Example {label} trajectory (task_id={t['task_id']}, {len(t['traj'])} messages)"
        )
        for i, msg in enumerate(t["traj"]):
            role = msg.get("role", "?")
            content = msg.get("content", "")
            # Truncate long messages
            if content and len(str(content)) > 500:
                content = str(content)[:500] + "..."
            tool_calls = msg.get("tool_calls", None)
            if tool_calls:
                print(f"  [{i}] {role}: [tool_calls]")
                for tc in tool_calls:
                    fn = tc.get("function", {})
                    print(f"       -> {fn.get('name', '?')}({fn.get('arguments', '')[:200]})")
            else:
                print(f"  [{i}] {role}: {content}")


# ============================================================================
# F. SIMULATED USER DOCUMENTATION
# ============================================================================
def section_f() -> None:
    banner("F. SIMULATED USER DOCUMENTATION")

    print("User simulation is in: tau_bench/envs/user.py\n")

    print("UserStrategy enum values:")
    print("  - HUMAN: Manual input (for debugging)")
    print("  - LLM: Basic LLM-based simulation")
    print("  - REACT: LLM with Thought + User Response format")
    print("  - VERIFY: LLM with self-verification (up to 3 attempts)")
    print("  - REFLECTION: LLM with verify + reflect loop (up to 2 attempts)")

    print("\nLLMUserSimulationEnv:")
    print("  - Uses litellm.completion() for generation")
    print("  - System prompt includes the task instruction")
    print("  - Rules enforced in system prompt:")
    print("    * Generate one line at a time")
    print("    * Don't give away all instruction at once")
    print("    * Don't hallucinate info not in instruction")
    print("    * Generate '###STOP###' when goal is satisfied")
    print("    * Don't repeat exact instruction; use own words")
    print("    * Stick to personalities in instruction")

    print("\nReactUserSimulationEnv:")
    print("  - Extends LLM strategy with chain-of-thought")
    print("  - Generates Thought + User Response per turn")
    print("  - Parses out only the User Response to send to agent")

    print("\nVerifyUserSimulationEnv:")
    print("  - After generating, calls verify() to check response quality")
    print("  - Retries up to max_attempts=3 if verification fails")
    print("  - Verification uses separate LLM call as 'supervisor'")

    print("\nReflectionUserSimulationEnv:")
    print("  - Combines verify + reflect pattern")
    print("  - If verification fails, calls reflect() to generate improved response")
    print("  - Up to max_attempts=2 reflection rounds")

    print("\nConversation flow:")
    print("  1. reset(instruction) -> system prompt + 'Hi! How can I help you today?'")
    print("  2. generate_next_message() -> first user message")
    print("  3. step(agent_response) -> next user message")
    print("  4. Loop until '###STOP###' in response (goal satisfied)")


# ============================================================================
# G. EVALUATION APPROACH
# ============================================================================
def section_g() -> None:
    banner("G. EVALUATION APPROACH")

    print("Evaluation is in: tau_bench/envs/base.py (Env.calculate_reward)\n")

    print("Binary reward calculation (0.0 or 1.0):")
    print()
    print("1. DB State Comparison (r_actions):")
    print("   - Hash the current database state after agent's actions")
    print("   - Replay ground-truth actions on a fresh DB copy")
    print("   - Hash the ground-truth database state")
    print("   - If hashes don't match -> reward = 0.0")
    print("   - This catches: wrong mutations, missing mutations, extra mutations")
    print()
    print("2. Output Matching (r_outputs, only if task.outputs is non-empty):")
    print("   - For each expected output string in task.outputs:")
    print("     Check if it appears (case-insensitive, commas removed) in any")
    print("     'respond' action the agent sent to the user")
    print("   - If any expected output is missing -> reward = 0.0")
    print()
    print("3. Final reward = 1.0 only if BOTH checks pass")
    print()

    print("Pass^k calculation (from run.py):")
    print("  - Run each task k times (num_trials)")
    print("  - For each task, count c = number of successful trials")
    print("  - pass^k = avg over tasks of C(c,k)/C(num_trials,k)")
    print("  - This estimates P(at least k successes in k tries)")
    print("  - Reports pass^1, pass^2, ..., pass^num_trials")
    print()

    print("Termination conditions:")
    print("  - Agent calls transfer_to_human_agents -> done")
    print("  - User sends '###STOP###' -> done (goal satisfied or conversation ended)")
    print("  - Reward only computed when done=True")


# ============================================================================
# MAIN
# ============================================================================
if __name__ == "__main__":
    section_a()
    section_b()
    section_c()
    section_d()
    section_e()
    section_f()
    section_g()
    print("\n" + "=" * 80)
    print("  EXPLORATION COMPLETE")
    print("=" * 80)
