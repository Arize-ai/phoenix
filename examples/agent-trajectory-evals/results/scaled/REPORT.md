# Scaled Trajectory Evaluation: Failure Mode Analysis Report

**Date:** 2026-03-24
**Tasks analyzed:** 60 (20 per implementation)
**Annotations written to Phoenix:** 2,320 (8 scores × 291 root spans)

---

## Executive Summary

We ran 60 agent tasks across three implementations and performed deep failure mode analysis on every trajectory. The results reveal that **27% of tasks are catastrophic failures** where the agent completely fails to accomplish the user's goal, **27% are suboptimal** where the agent reaches the goal but via an inefficient or error-prone path, and **47% are clean successes**.

The dominant failure pattern is a **compounding error cascade**: the agent encounters a tool error → misinterprets it as an unsolvable problem → escalates to a human agent → which prevents all downstream mutation tools from being called. This single pattern accounts for 9 of the 16 catastrophic failures.

---

## Overall Results

| Classification | Count | Rate | Description |
|---|---|---|---|
| 🔴 **Catastrophic** | 16/60 | 27% | Agent completely failed the task |
| 🟡 **Suboptimal** | 16/60 | 27% | Agent succeeded but inefficiently |
| 🟢 **Clean success** | 28/60 | 47% | Agent completed task correctly and efficiently |

### By Implementation

| Implementation | 🔴 Catastrophic | 🟡 Suboptimal | 🟢 Clean | Task completion rate |
|---|---|---|---|---|
| tau-bench + OpenAI Agents SDK | **9** (45%) | 5 (25%) | 6 (30%) | 55% |
| tau-bench + LangGraph | **6** (30%) | 5 (25%) | 9 (45%) | 70% |
| TRAJECT-Bench + LangGraph | **1** (5%) | 6 (30%) | 13 (65%) | 95% |

**Key finding:** LangGraph outperforms OpenAI Agents SDK on the same tau-bench tasks (70% vs 55% completion), with 3 fewer catastrophic failures. TRAJECT-Bench tasks are substantially easier with 95% task completion.

---

## Failure Mode Taxonomy

### Observed failure modes (sorted by frequency)

| Failure Mode | Count | Severity | Description |
|---|---|---|---|
| `wrong_params` | 29 | Medium | Tool called with incorrect arguments |
| `null_params_sent` | 22 | Medium | Tool called with null/empty parameters (TRAJECT sequential only) |
| `missing_mutation_tools` | 15 | **High** | Required mutation tools never called |
| `moderately_inefficient` | 11 | Low | 20-60% efficiency (extra lookups/retries) |
| `unnecessary_escalation` | 10 | **High** | Transferred to human when task was solvable |
| `tool_error_mishandled` | 10 | **High** | Agent gave up after a tool error instead of recovering |
| `compounding_errors` | 9 | **Critical** | One error cascaded into complete task failure |
| `oneshot_tool_called_multiple_times` | 4 | Medium | Exchange/modify called multiple times per order (policy violation) |
| `missing_tool` | 4 | Medium | TRAJECT tool not called |
| `highly_inefficient` | 3 | Low | <40% efficiency |
| `wrong_order` | 2 | Medium | Sequential tools called out of order |

---

## Detailed Failure Mode Analysis

### 1. Compounding Error Cascades (9 tasks — the #1 catastrophic pattern)

**This is the most important finding.** Nine tasks across both frameworks follow an identical failure cascade:

```
Tool error (get_order_details fails or returns unexpected data)
  → Agent calls think() to reason about the failure
    → Agent decides it cannot help the user
      → Agent calls transfer_to_human_agents
        → ALL remaining mutation tools are skipped
          → CATASTROPHIC FAILURE
```

**Affected tasks:**

| Task | Implementation | Expected mutations | All skipped? |
|---|---|---|---|
| dev:12 | tau-openai | 6 (payment × 3, items × 3) | Yes |
| train:35 | tau-openai | 4 (address, items, return, exchange) | Yes |
| train:4 | tau-openai | 1 (cancel) | Yes |
| train:139 | tau-openai | 4+1 (items, return, address, items, cancel) | Yes |
| train:431 | tau-openai | 6 (cancel, return, exchange, address, payment, items) | Yes |
| dev:12 | tau-langgraph | 6 (payment × 3, items × 3) | Yes |
| train:351 | tau-langgraph | 7 (most complex task) | Yes |
| train:8 | tau-langgraph | 2 (items, return) | Yes |
| train:130 | tau-langgraph | 4 (address, payment, items, cancel) | Yes |

**Root cause:** The agent is over-cautious. When `get_order_details` returns an error (often because it's calling with the wrong order ID format or the order belongs to a different user context), the agent interprets this as "I cannot access the user's orders" rather than "let me try a different approach." It then escalates preemptively.

**Why this matters for Phoenix eval design:** A simple tool-selection eval would catch the *symptom* (missing tools), but an error-handling eval would catch the *root cause*. The first tool error is where intervention would be most valuable — if the agent recovered there, the entire cascade would be prevented.

### 2. Unnecessary Escalation (10 tasks)

All 10 unnecessary escalations occur in tau-bench tasks (none in TRAJECT-Bench, which has no escalation mechanism). The breakdown:

- **tau-openai:** 6 tasks (dev:1, dev:12, train:35, train:4, train:139, train:431)
- **tau-langgraph:** 4 tasks (dev:12, train:351, train:8, train:130)

**Pattern:** Escalation happens in two scenarios:
1. **After tool error** (9/10 cases): Agent encounters a tool failure, reasons about it via `think()`, and decides to escalate. This is the compounding cascade described above.
2. **After policy confusion** (1/10 cases): dev:1 on tau-openai — the agent called `exchange_delivered_order_items` twice (violating the one-shot rule), failed on the second call, then escalated rather than recognizing the first call already succeeded.

### 3. One-Shot Tool Policy Violation (4 tasks)

tau-bench policy states exchange/modify tools can only be called **once** per order. Four tasks violated this:

| Task | Implementation | Tool | Times called |
|---|---|---|---|
| dev:1 | tau-openai | exchange_delivered_order_items | 2 |
| train:351 | tau-openai | modify_pending_order_items | 3 |
| train:3 | tau-openai | exchange_delivered_order_items | 2 |
| train:35 | tau-langgraph | modify_pending_order_items | 2 |

**Why this happens:** The agent collects *some* items to exchange, calls the tool, then realizes it missed items and calls again. The second call either fails (because the order status changed) or causes incorrect state.

**Implication for evals:** A policy-compliance evaluator needs to count tool invocations per order, not just check tool presence.

### 4. Parameter Accuracy Issues (29 tasks)

The most frequently-detected issue, but varies in severity:

**tau-bench (most are benign):** Parameter mismatches mostly occur because ground truth records exact `kwargs` including computed values (like specific `item_ids` or `payment_method_ids`) that the agent may have determined correctly through a different lookup path. Many "wrong params" are actually semantically equivalent.

**TRAJECT-Bench (structural issue):** 22 instances of `null_params_sent` where the agent passes `null` instead of required parameters. This occurs exclusively in **sequential** tasks where tool B depends on output from tool A:

```
Tool A output → should feed into Tool B parameters
But agent sends: Tool B(parameters=null)
```

This is a **parameter dependency propagation failure** — the agent doesn't correctly extract and forward values from one tool's output to the next tool's input. Most common in:
- `sequential_news_media:0` (10 null param incidents)
- `sequential_weather:0`, `sequential_finance:5`, `sequential_music:0`

### 5. Trajectory Inefficiency

| Efficiency band | Count | Description |
|---|---|---|
| ≥70% (efficient) | 42 | Minimal extra calls |
| 40-70% (moderate) | 11 | 1.5-2.5× expected calls |
| <40% (highly inefficient) | 3 | 2.5×+ expected calls |

**Common inefficiency patterns:**
- **Repeated auth attempts:** dev:6 on both frameworks calls `find_user_id_by_email` 4 times (user has a difficult email case)
- **Exploratory lookups:** Agent calls `get_order_details` on every order in the user's account before narrowing to the relevant one
- **Think-then-retry:** Agent calls `think()` to reason, then repeats the same tool call — adding 2 extra calls per retry

**Surprisingly efficient:** train:2 (simple return) achieves 100% efficiency on both frameworks — exactly the minimum calls needed (auth + user details + order details + return).

---

## Cross-Framework Comparison (tau-bench: OpenAI vs LangGraph)

Running the same 20 tasks on both frameworks reveals systematic differences:

| Metric | OpenAI Agents SDK | LangGraph | Delta |
|---|---|---|---|
| Catastrophic failures | 9 (45%) | 6 (30%) | LangGraph -15% |
| Unnecessary escalations | 6 | 4 | LangGraph -2 |
| Compounding cascades | 5 | 4 | LangGraph -1 |
| Mean efficiency | 76% | 72% | OpenAI +4% |
| Policy violations | 3 | 1 | LangGraph -2 |

**LangGraph is more persistent.** On tasks where OpenAI escalates (train:4, train:139, dev:14), LangGraph either completes the task or gets further before giving up. LangGraph's `should_continue` routing pattern appears to give the agent more chances to recover.

**OpenAI is slightly more efficient when it succeeds.** When both frameworks complete a task, OpenAI tends to use fewer total tool calls. But this comes at the cost of giving up more easily.

**Both fail identically on:** dev:12 (6 mutations across 3 orders — both escalate) and train:431/351 (the most complex tasks).

---

## Cross-Benchmark Comparison (tau-bench vs TRAJECT-Bench)

| Dimension | tau-bench | TRAJECT-Bench |
|---|---|---|
| Catastrophic rate | 37.5% (15/40) | 5% (1/20) |
| Primary failure mode | Compounding cascades | Parameter propagation |
| Escalation failures | 10 | 0 (no mechanism) |
| Parameter issues | Semantically equivalent mismatches | Structural null propagation |
| Multi-turn complexity | High (9-47 turns) | Low (single turn) |

**Why TRAJECT is easier:** Single-turn tasks with pre-specified tool lists eliminate the conversation management, user simulation, and error recovery challenges that cause tau-bench failures. The agent just needs to call the right tools with the right params.

**Where TRAJECT gets hard:** Sequential tasks with long dependency chains (sequential_news_media:0 with 10 tools) struggle with parameter propagation between steps.

---

## Phoenix Trace Annotations Written

Eight evaluation scores were written to every root span across all three projects:

| Annotation Name | Type | Values |
|---|---|---|
| `task_completion` | Score 0-1 | 0.0=catastrophic, 0.5=partial, 1.0=success |
| `tool_selection_correct` | Score 0-1 | Fraction of expected mutation tools called |
| `unnecessary_escalation` | Score 0/1 | 1.0 if agent escalated when it shouldn't have |
| `parameter_accuracy` | Score 0-1 | Fraction of tools called with correct params |
| `trajectory_efficiency` | Score 0-1 | min_calls / actual_calls ratio |
| `tool_error_handling` | Score 0/1 | 0.0 if agent mishandled a tool error |
| `policy_compliance` | Score 0-1 | 0.0 for policy violation, 0.5 for one-shot violation |
| `compounding_errors` | Score 0/1 | 1.0 if error cascade detected |

Each annotation includes a detailed `explanation` field describing the specific finding for that task. View them at http://localhost:6006.

---

## Recommendations for Phoenix Eval Metrics

Based on failure frequency, severity, and detectability:

### Priority 1: Tool Error Recovery Eval
- **Catches:** compounding_errors, tool_error_mishandled, unnecessary_escalation
- **Impact:** Would address 9/16 catastrophic failures (56%)
- **Method:** Detect when agent escalates or terminates within 2 turns of a tool error. Flag as failure if the task was solvable.
- **Feasibility:** Fast path (last LLM span has full conversation including tool errors)

### Priority 2: Tool Selection Eval (mutation-aware)
- **Catches:** missing_mutation_tools, wrong_tool
- **Impact:** Would identify 15 missing-mutation failures
- **Method:** Compare actual mutation tools against expected, treating prerequisite tools (auth, lookups) as always-correct
- **Feasibility:** Fast path, but requires ground truth

### Priority 3: Parameter Dependency Propagation Eval
- **Catches:** null_params_sent, wrong_params in sequential tasks
- **Impact:** Addresses the primary TRAJECT-Bench failure mode
- **Method:** For sequential tool chains, verify that output from tool N appears as input to tool N+1
- **Feasibility:** Fast path (parameters visible in tool_calls)

### Priority 4: Policy Compliance Eval
- **Catches:** oneshot_tool_called_multiple_times, mutation_before_auth
- **Impact:** 4 policy violations detected
- **Method:** Count per-order invocations of one-shot tools; verify auth precedes mutations
- **Feasibility:** Fast path (tool call sequence analysis)

### Priority 5: Trajectory Efficiency Eval
- **Catches:** highly_inefficient, moderately_inefficient
- **Impact:** 14 inefficient trajectories (low severity but common)
- **Method:** Compare actual call count to estimated minimum
- **Feasibility:** Fast path, heuristic-based
