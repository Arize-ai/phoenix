# TRAJECT-Bench Dataset Exploration Summary

## Overview

**TRAJECT-Bench** (arXiv: 2510.04550) is a benchmark for evaluating LLM agentic tool-usage capability at the trajectory level. Unlike benchmarks that only measure final output accuracy, TRAJECT-Bench provides trajectory-level diagnostics including tool selection correctness, argument accuracy, and dependency/order satisfaction.

- **Scale**: ~5,270 examples across 28 configs (27 loadable; `sequential_email` has a missing data file)
- **Split**: Test only
- **License**: MIT
- **HuggingFace**: `bigboss24/TRAJECT-Bench`

## Dataset Configs and Row Counts

### Parallel Configs (18 configs, 3,600 examples)

Each domain has simple and hard variants. All parallel configs have exactly 200 examples.

| Config | Rows |
|--------|------|
| parallel_ecommerce_simple / hard | 200 / 200 |
| parallel_education_simple / hard | 200 / 200 |
| parallel_email_simple / hard | 200 / 200 |
| parallel_finance_simple / hard | 200 / 200 |
| parallel_gaming_simple / hard | 200 / 200 |
| parallel_music_simple / hard | 200 / 200 |
| parallel_news_media_simple / hard | 200 / 200 |
| parallel_travel_simple / hard | 200 / 200 |
| parallel_weather_simple / hard | 200 / 200 |

### Sequential Configs (10 configs, 1,670 examples)

Sequential configs vary in size. `sequential_email` fails to load (missing data file on HuggingFace).

| Config | Rows |
|--------|------|
| sequential_ecommerce | 200 |
| sequential_education | 200 |
| sequential_email | FAILED |
| sequential_finance | 135 |
| sequential_gaming | 185 |
| sequential_mapping | 200 |
| sequential_music | 200 |
| sequential_news_media | 180 |
| sequential_travel | 170 |
| sequential_weather | 200 |

## Schema Comparison: Parallel vs Sequential

### Parallel Schema (7 columns)

| Column | Type | Description |
|--------|------|-------------|
| `query` | string | User's natural language request |
| `tool_list` | string (JSON) | JSON array of tool objects with parameters and outputs |
| `trajectory_type` | string | Always "parallel" |
| `final_answer` | string | Ground truth response to the user |
| `task_name` | string | Short task category name |
| `task_description` | string | Description of the task workflow |
| `tool_count` | int64 | Number of tools in the trajectory |

### Sequential Schema (9 columns)

| Column | Type | Description |
|--------|------|-------------|
| `query` | string | User's natural language request |
| `final_answer` | string | Ground truth response to the user |
| `tool list` | string (JSON) | JSON array of tool objects (note: space in field name, not underscore) |
| `sequence_name` | string | Human-readable pipeline name (e.g., "Zappos Search -> BestBuy Search -> Wayfair Search Suggestions") |
| `sequence_description` | string | Description of the dependency chain |
| `num_tools_used` | int64 | Number of tools in the sequence |
| `num_successful_tools` | int64 | Number of tools that executed successfully |
| `domain` | string | Domain category |
| `executable` | bool | Whether the sequence was actually executable |

### Shared vs Unique Columns

- **Shared**: `query`, `final_answer`
- **Parallel only**: `task_description`, `task_name`, `tool_count`, `tool_list`, `trajectory_type`
- **Sequential only**: `domain`, `executable`, `num_successful_tools`, `num_tools_used`, `sequence_description`, `sequence_name`, `tool list`

**Important**: The tool list field name differs: `tool_list` (underscore) in parallel vs `tool list` (space) in sequential.

## Tool Schema Format

### Shared Fields (both parallel and sequential)

| Field | Type | Example |
|-------|------|---------|
| `tool name` | string | `"Wayfair: reviews/list"` (format: `"ParentTool: APIName"`) |
| `tool description` | string | Capabilities text describing what the API does |
| `required parameters` | list[{name, value}] | `[{"name": "sku", "value": "W004939121"}]` |
| `optional parameters` | list[{name, value}] | `[{"name": "page", "value": "1"}, {"name": "sort_order", "value": "HELPFUL"}]` |
| `parent tool name` | string | `"Wayfair"` |
| `API name` | string | `"reviews/list"` |
| `domain name` | string | `"eCommerce"` |
| `executed_output` | string | Actual API response (JSON dict, list, error, or empty string) |

### Sequential-Only Fields

| Field | Type | Description |
|-------|------|-------------|
| `execution_status` | string | `"success"` or `"failed"` |
| `sequence_step` | dict | Contains `step_number`, `tool_name`, `description`, `param_for_next_tool` |
| `original_description` | string | Original tool description before sequence adaptation |

The `sequence_step.param_for_next_tool` field is key: it identifies which output field from the current tool feeds into the next tool's parameters.

### Unique Parent Tools and APIs per Domain

| Domain | Parent Tools | APIs |
|--------|-------------|------|
| eCommerce | 10 | 28 |
| Education | 25 | 55 |
| Email | 12 | 18 |
| Finance | 16 | 153 |
| Gaming | 18 | 45 |
| Mapping | 13 | 32 |
| Music | 25 | 97 |
| News_Media | 33 | 72 |
| Travel | 19 | 82 |
| Weather | 23 | 81 |

Finance has the most APIs (153) despite having only 16 parent tools, indicating deep API coverage per provider.

## Domain Distribution Table

| Domain | Par. Simple | Par. Hard | Sequential | Total |
|--------|------------|----------|-----------|-------|
| ecommerce | 200 | 200 | 200 | 600 |
| education | 200 | 200 | 200 | 600 |
| email | 200 | 200 | - | 400 |
| finance | 200 | 200 | 135 | 535 |
| gaming | 200 | 200 | 185 | 585 |
| mapping | - | - | 200 | 200 |
| music | 200 | 200 | 200 | 600 |
| news_media | 200 | 200 | 180 | 580 |
| travel | 200 | 200 | 170 | 570 |
| weather | 200 | 200 | 200 | 600 |
| **TOTAL** | | | | **5,270** |

- 8 domains have both parallel and sequential splits
- `email` is parallel only (sequential data file missing)
- `mapping` is sequential only (no parallel configs)

## Parallel vs Sequential Execution Patterns

### Parallel Pattern

Tools are completely independent. No tool's output feeds into another tool's input.

```
Query: "I'm researching a product with SKU W004939121 on Wayfair..."

  Tool 1: Wayfair: reviews/list        (params: sku=W004939121)
  Tool 2: Wayfair: products/get-common-info  (params: sku=W004939121)
  Tool 3: Aliexpress DataHub: Aliexpress - User Basic Parameters  (params: none)

  -> All tools use independently-specified parameters
  -> Order doesn't matter; all can execute concurrently
```

### Sequential Pattern

Tools form a dependency chain where each step's output informs the next step's parameters.

```
Sequence: "Zappos Search -> BestBuy Search -> Wayfair Search Suggestions"

  Step 1: Zappos Realtime Data: Zappos search product
    Params: keyword=running shoes, sort=best_seller
    Output: {currentResultCount: 50, totalResultCount: 102281, ...}
    param_for_next_tool: "product_name"

  Step 2: BestBuy Product Data: BestBuyProductData
    Params: keyword=Shoes (derived from Step 1's product_name)
    Output: {'Error': "BestBuy API returned no data..."}
    param_for_next_tool: "title"

  Step 3: Wayfair: auto-complete
    Params: query=Shoes (derived from Step 2's title)
    Output: {summary: {...}, ...}

  -> Each step depends on the previous step's output
  -> Order is critical; must execute sequentially
```

## Executed Output Format Analysis

Based on sampling 50 tool outputs across all configs:

| Output Type | Count | Percentage |
|------------|-------|-----------|
| Structured JSON (dict with data) | 32 | 64.0% |
| Error response | 9 | 18.0% |
| List/array | 4 | 8.0% |
| Other (HTML, raw text) | 3 | 6.0% |
| Empty string | 2 | 4.0% |

### Execution Status (Sequential configs only)

| Status | Count |
|--------|-------|
| success | 2,669 |
| failed | 396 |

~13% of sequential tool executions fail, providing natural error-handling test cases.

### Output Type Examples

**Structured JSON**: Most common. Real API responses with nested data:
```python
{'data': {'product': {'customer_reviews': {'sku': 'LFMF3204', 'average_rating_value': 4.77, ...}}}}
```

**Error Response**: API errors, rate limits, or invalid inputs:
```python
{'Error': "BestBuy API returned no data, You have entered 'Shoes' as search keyword..."}
# or
"ERROR: Failed after 5 attempts"
```

**Empty String**: Tool returned no data (e.g., search with no results)

**List/Array**: Some APIs return arrays directly:
```python
[{'title': 'article title', 'url': 'https://...', 'source': 'sun'}, ...]
```

**Other**: HTML error pages from suspended services

These executed_outputs become our mock tool implementations -- we return them when the agent calls the matching tool with matching parameters.

## Evaluation Metrics

### Trajectory-Aware Metrics (from TRAJECT-Bench paper)

| Metric | Definition | Our Use |
|--------|-----------|---------|
| **Exact Match (EM)** | Predicted tool names match ground truth precisely (set or ordered) | Core metric for tool selection accuracy. Order-agnostic for parallel, ordered for sequential. |
| **Inclusion** | Proportion of ground-truth tools present in prediction | Softer metric; measures recall when agents pick extra tools. |
| **Tool Usage (Argument Correctness)** | Predicted parameters match ground truth values | Critical for parameter correctness. Each tool call's args must match expected values. |
| **Trajectory Satisfaction** | LLM-judge rates if trajectory solves the query (0-10) | Fallback for open-ended tasks where multiple valid trajectories exist. Tracks EM closely. |
| **Accuracy (Solution)** | LLM-judge compares final answer to ground truth | End-to-end metric comparing agent's response to `final_answer` field. |
| **Retrieval Rate** | Proportion of ground truth tools retrieved from candidates | Relevant if we implement tool retrieval as a preprocessing step. |

### Sequential-Specific Metrics

| Metric | Definition | Our Use |
|--------|-----------|---------|
| **Dependency Satisfaction** | Sequential tool dependencies respected (output of N available to N+1) | Verify agent doesn't call a tool before its dependency completes. |
| **Order Satisfaction** | Tools invoked in correct sequential order | Order of tool calls must match ground truth sequence. |

## Selected Task Subset (9 candidates)

### Parallel Simple (3 tasks)

| # | Config | Index | Tools | Domains | Has Error | Rationale |
|---|--------|-------|-------|---------|----------|-----------|
| 1 | parallel_ecommerce_simple | 0 | 3: Wayfair reviews, Wayfair product info, Aliexpress params | eCommerce | No | Baseline: simple multi-tool product research |
| 2 | parallel_ecommerce_simple | 1 | 3: Wayfair images, Aliexpress store search, Weee grocery | eCommerce | No | Cross-platform product lookup with diverse APIs |
| 3 | parallel_ecommerce_simple | 2 | 3: Asos countries, Wayfair autocomplete, Amazon pricing | eCommerce | Yes | Includes error output (Amazon pricing returns -0.01 prices) |

### Parallel Hard (3 tasks)

| # | Config | Index | Tools | Domains | Has Error | Rationale |
|---|--------|-------|-------|---------|----------|-----------|
| 4 | parallel_ecommerce_hard | 10 | 5: Asos autocomplete, Wayfair autocomplete/reviews/warranty/similar | eCommerce | No | Deep single-platform exploration (5 Wayfair+Asos tools) |
| 5 | parallel_ecommerce_hard | 11 | 5: Zappos categories, Asos categories, Wayfair product, Weee grocery, Aliexpress search | eCommerce | No | Cross-platform category comparison (5 different providers) |
| 6 | parallel_ecommerce_hard | 12 | 5: Wayfair pricing/financing/reviews, IKEA countries, Weee grocery | eCommerce | No | Complex purchase workflow with pricing + financing |

### Sequential (3 tasks)

| # | Config | Index | Tools | Domains | Has Error | Sequence | Rationale |
|---|--------|-------|-------|---------|----------|----------|-----------|
| 7 | sequential_travel | 0 | 3: Priceline cities -> hotel search -> hotel details | Travel | No | Geographic Search -> Hotel Search -> Hotel Details | Clean 3-step chain, all successful |
| 8 | sequential_travel | 1 | 3: Priceline cities -> hotel search -> hotel details | Travel | Yes | Geographic Search -> Hotel Search -> Hotel Details | Same sequence but with error in hotel details step |
| 9 | sequential_travel | 2 | 3: Priceline cities -> hotel search -> hotel details | Travel | Yes | Geographic Search -> Hotel Search -> Hotel Details | Includes error outputs, tests error propagation |

### Coverage Check

- **Domains covered**: eCommerce, Travel
- **Has error output task**: Yes (candidates 3, 8, 9)
- **Required domains present**: eCommerce, Travel (Finance not in initial selection -- could add from `parallel_finance_simple` or `sequential_finance` if needed)
- **Task types**: 3 parallel simple + 3 parallel hard + 3 sequential = 9 total

### Note on Finance Coverage

To add Finance domain coverage, good candidates would be:
- `parallel_finance_simple` index 0-2 (simple stock/crypto lookups)
- `sequential_finance` index 0-2 (multi-step financial analysis chains)

## Key Observations for Trajectory Eval Design

1. **Tool name format is consistent**: Always `"ParentTool: APIName"`. This makes tool matching straightforward.

2. **Parameters are pre-filled**: Both required and optional parameters have their values specified in the ground truth. This lets us build deterministic mock tools that return `executed_output` when called with matching parameters.

3. **Sequential `sequence_step.param_for_next_tool` is the key to dependency tracking**: This field explicitly names which output field connects steps, making it possible to verify dependency satisfaction programmatically.

4. **~13% of sequential tools fail**: The `execution_status` field plus error outputs provide natural test cases for how agents handle tool failures.

5. **Field name inconsistency**: `tool_list` (underscore) in parallel vs `tool list` (space) in sequential requires handling in code.

6. **Executed outputs are real API responses**: They're not synthetic -- they come from actual API calls, so they have realistic structure, errors, and edge cases (empty responses, HTML error pages, rate limits).

7. **Simple difficulty = 2-3 tools, Hard = 5+ tools**: The difficulty split maps cleanly to tool count, making it easy to select tasks by complexity.

8. **All data is in `test` split only**: No train/val splits, consistent with this being an evaluation benchmark.

9. **Sequential configs have variable sizes**: Unlike parallel (all 200), sequential ranges from 135-200, and one config (`sequential_email`) is broken.

10. **Mock tool implementation strategy**: For each tool in a task, we create a mock that checks if the agent's parameters match the ground truth parameters, and if so, returns the `executed_output`. For non-matching parameters, we return an error. This directly tests both tool selection AND argument correctness.
