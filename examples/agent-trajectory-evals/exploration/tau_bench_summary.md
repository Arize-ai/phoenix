# τ-bench Exploration Summary

## Overview

[τ-bench](https://github.com/sierra-research/tau-bench) is a benchmark for evaluating LLM agents on realistic customer service tasks. It focuses on tool-augmented agent conversations where an agent interacts with a simulated user, calls tools to look up and modify data, and must follow domain-specific policies.

This exploration focuses on the **retail domain** — a mock online retail store with 500 users, 1000 orders, and 50 product types.

## Task Format

Each task is a `Task` pydantic model with:


| Field         | Type           | Description                                                                               |
| ------------- | -------------- | ----------------------------------------------------------------------------------------- |
| `user_id`     | `str`          | The user the simulated customer represents                                                |
| `instruction` | `str`          | Natural language instruction for the simulated user (includes persona, context, and goal) |
| `actions`     | `list[Action]` | Ground-truth sequence of tool calls the agent should make                                 |
| `outputs`     | `list[str]`    | Expected strings that must appear in agent responses (can be empty)                       |


Each `Action` has:

- `name: str` — tool function name
- `kwargs: dict` — expected arguments

### Task Splits


| Split | Count |
| ----- | ----- |
| test  | 115   |
| train | 500   |
| dev   | 20    |


### Task Categories (test split)

Tasks span a range of complexity:

- **Simple lookups** (read-only, 0-6 actions): order status, product info
- **Single mutations** (1-2 actions): cancel order, return items, exchange items
- **Multi-step mutations** (5-14 actions): exchange + product lookup + modify, cancel + return combos
- **Policy-sensitive** (escalation to human): requests that are out of scope
- **Output-requiring**: tasks where the agent must provide specific information (e.g., product count, order total)

## Tool Catalog (16 tools + respond)

### User Lookup


| Tool                       | R/W   | Description                                                |
| -------------------------- | ----- | ---------------------------------------------------------- |
| `find_user_id_by_email`    | READ  | Find user ID by email address                              |
| `find_user_id_by_name_zip` | READ  | Find user ID by first name, last name, and zip code        |
| `get_user_details`         | READ  | Get user profile (email, address, payment methods, orders) |
| `modify_user_address`      | WRITE | Update user's default address                              |


### Order Management


| Tool                           | R/W   | Description                                          |
| ------------------------------ | ----- | ---------------------------------------------------- |
| `get_order_details`            | READ  | Get order status, items, address, payment            |
| `cancel_pending_order`         | WRITE | Cancel a pending order (reason required)             |
| `modify_pending_order_address` | WRITE | Change shipping address of pending order             |
| `modify_pending_order_items`   | WRITE | Swap items in pending order (same product type only) |
| `modify_pending_order_payment` | WRITE | Change payment method of pending order               |


### Delivered Order


| Tool                             | R/W   | Description                                              |
| -------------------------------- | ----- | -------------------------------------------------------- |
| `return_delivered_order_items`   | WRITE | Return items from delivered order                        |
| `exchange_delivered_order_items` | WRITE | Exchange items in delivered order for different variants |


### Product


| Tool                     | R/W  | Description                                  |
| ------------------------ | ---- | -------------------------------------------- |
| `get_product_details`    | READ | Get product info including all variant items |
| `list_all_product_types` | READ | List all 50 product types                    |


### Support / Utility


| Tool                       | R/W  | Description                                     |
| -------------------------- | ---- | ----------------------------------------------- |
| `transfer_to_human_agents` | —    | Escalate to human (terminates conversation)     |
| `calculate`                | READ | Evaluate a mathematical expression              |
| `think`                    | READ | Internal reasoning scratchpad (no side effects) |


## Policy Summary (wiki.md)

Key rules the agent must follow:

1. **Authentication required**: Must verify user identity via email OR name+zip before any action
2. **One user per conversation**: Cannot help multiple users in same session
3. **Single tool call per turn**: No parallel tool calls; no tool call + user response in same turn
4. **Explicit confirmation before mutations**: Must list action details and get explicit "yes" before any DB change
5. **Modification constraints**: Exchange/modify tools can only be called ONCE — must collect all items first
6. **No hallucination**: Must not invent information not provided by user or tools
7. **Escalation protocol**: Transfer to human only when request is genuinely out of scope

Additional domain rules:

- Times are EST, 24-hour format
- Refunds: gift card = immediate, other methods = 5-7 business days
- Order statuses: pending → processed → delivered → (cancelled / return requested / exchange requested)
- Items can only be exchanged/modified to different variants of the SAME product type

## Database Schema

### Users (500 entries, keyed by user_id)


| Field             | Type                                                                      |
| ----------------- | ------------------------------------------------------------------------- |
| `name`            | `dict` with `first_name`, `last_name`                                     |
| `address`         | `dict` with `address1`, `address2`, `city`, `state`, `country`, `zip`     |
| `email`           | `str`                                                                     |
| `payment_methods` | `dict` mapping payment_id → `{source, brand?, last_four?, id?, balance?}` |
| `orders`          | `list[str]` — order IDs                                                   |


### Orders (1000 entries, keyed by order_id like `#W2611340`)


| Field             | Type                                                                         |
| ----------------- | ---------------------------------------------------------------------------- |
| `order_id`        | `str`                                                                        |
| `user_id`         | `str`                                                                        |
| `address`         | `dict` (same as user address)                                                |
| `items`           | `list[dict]` — each with `name`, `product_id`, `item_id`, `price`, `options` |
| `fulfillments`    | `list[dict]` — tracking info                                                 |
| `status`          | `str` — pending / processed / delivered / cancelled                          |
| `payment_history` | `list[dict]` — payment method and amount                                     |


### Products (50 entries, keyed by product_id)


| Field        | Type                                                            |
| ------------ | --------------------------------------------------------------- |
| `name`       | `str`                                                           |
| `product_id` | `str`                                                           |
| `variants`   | `dict` mapping item_id → `{item_id, options, available, price}` |


## Historical Trajectory Format & Stats

Historical trajectories are stored as JSON arrays in `historical_trajectories/`.

### Entry Schema


| Field     | Type         | Description                                                      |
| --------- | ------------ | ---------------------------------------------------------------- |
| `task_id` | `int`        | Index into task list                                             |
| `reward`  | `float`      | 0.0 or 1.0                                                       |
| `info`    | `dict`       | Contains `task`, reward details                                  |
| `traj`    | `list[dict]` | Conversation messages (`role`, `content`, optional `tool_calls`) |
| `trial`   | `int`        | Trial number                                                     |


### GPT-4o Retail Stats


| Metric                    | Value            |
| ------------------------- | ---------------- |
| Total trajectories        | 460              |
| Success rate (reward=1.0) | 60.4% (278)      |
| Failure rate (reward=0.0) | 39.6% (182)      |
| Mean trajectory length    | 30.5 messages    |
| Min / Max length          | 10 / 62 messages |
| Median length             | 28 messages      |


### Role Distribution


| Role      | Count |
| --------- | ----- |
| assistant | 6,564 |
| user      | 3,750 |
| tool      | 3,274 |
| system    | 460   |


## Evaluation Approach

### Binary Reward (0.0 or 1.0)

Two checks, both must pass for reward=1.0:

1. **DB State Comparison (r_actions)**:
  - After agent finishes, hash the database state
  - Replay ground-truth actions on a fresh database copy
  - Compare hashes — any mismatch → reward=0.0
  - Catches: wrong mutations, missing mutations, extra mutations
2. **Output Matching (r_outputs)** — only if `task.outputs` is non-empty:
  - Each expected output string must appear (case-insensitive, commas removed) in at least one agent response
  - Any missing output → reward=0.0

### Pass^k Metric

- Run each task k times across multiple trials
- `pass^k = avg over tasks of C(c,k)/C(n,k)` where c=successes, n=total trials
- Estimates probability of getting at least k successes in k independent tries

### Termination

- Agent calls `transfer_to_human_agents` → done
- Simulated user sends `###STOP###` → done (goal satisfied)

## Ground Truth Across Splits

**All splits have full ground truth for trajectory evaluation.** Every task in dev, train, and test has:
- `actions`: ordered list of `Action(name, kwargs)` — the exact tool calls with exact arguments
- `instruction`: the simulated user's goal
- `user_id`: which user the task operates on

The DB-state evaluation (replay ground truth actions, compare hash) works identically across all splits.

| Feature | test (115) | dev (20) | train (500) |
|---------|-----------|----------|-------------|
| Ground truth tool sequences (`actions`) | 113/115 | 19/20 | 500/500 |
| `outputs` (expected agent response strings) | 37/115 | 0/20 | 0/500 |
| `transfer_to_human_agents` tasks | Yes | None | None |
| Zero-action policy tasks | Yes | 1 | None |
| Max action count | 14 | 6 | 7 |

The `outputs` field and escalation tasks are test-only. These affect two narrow evaluation dimensions (output matching and escalation detection) but do not affect core trajectory evaluation: tool selection, parameter accuracy, sequencing, and DB state correctness.

## Key Observations for Trajectory Eval Design

1. **Evaluation is outcome-based, not trajectory-based**: τ-bench checks final DB state + outputs, not the exact sequence of tool calls. This means there can be multiple valid trajectories for the same task.
2. **Tool call order flexibility**: Ground-truth actions are the canonical sequence, but an agent could look up products in different order and still succeed.
3. **Policy compliance is implicit**: Policy violations (e.g., not confirming before mutation) aren't directly penalized — they only matter if they lead to wrong DB state or missing outputs.
4. **Simulated user variability**: The LLM-based user simulator introduces non-determinism. Different user phrasings can lead to different agent behaviors.
5. **Binary reward is coarse**: A trajectory that gets 90% of the task right but misses one item in an exchange gets reward=0.0, same as a completely wrong trajectory.
6. **Tasks vary dramatically in complexity**: From 0-action policy questions to 14-action multi-order operations.
7. **Output verification is substring-based**: Case-insensitive, comma-stripped substring matching — relatively lenient but requires the agent to actually state specific values.
8. **WRITE tools are one-shot**: Exchange and modify tools can only be called once, so the agent must collect ALL items before calling. This is a common failure mode.

