# Scaled Error Analysis Report

Generated: 2026-03-24 22:36
Tasks analyzed: 60

## Outcomes

- **failure**: 16
- **partial_success**: 16
- **success**: 28

## Failure Mode Frequency

| Failure Mode | Count |
|---|---|
| missing_tool | 19 |
| redundant_call | 15 |
| tool_error_mishandled | 15 |
| early_termination | 13 |
| unnecessary_escalation | 11 |
| wrong_params | 10 |
| wrong_tool | 3 |
| policy_violation | 2 |
| wrong_order | 1 |

## Cross-Framework Findings

LangGraph implementations show more successful task completion with fewer catastrophic failures compared to OpenAI SDK implementations. OpenAI SDK agents more frequently exhibit unnecessary escalation to human agents and mishandle tool errors, while LangGraph agents tend to persist longer and complete more tasks despite making redundant calls. However, both frameworks struggle equally with parameter accuracy and following sequential workflows in complex multi-step tasks.

## Cross-Benchmark Findings

TRAJECT-Bench single-turn tasks primarily fail due to parameter accuracy issues and wrong tool selection, while tau-bench multi-turn tasks fail more often due to early termination and unnecessary escalation. Tau-bench agents frequently make redundant authentication calls that TRAJECT doesn't require, but TRAJECT agents struggle more with complex parameter passing between sequential API calls. Multi-turn conversations in tau-bench create more opportunities for error recovery, while TRAJECT's single-turn nature makes parameter mistakes immediately fatal.

## Prioritized Recommendations

### #1: tool_selection
- **Catches**: missing_tool, wrong_tool, redundant_call, partial_success
- **Feasibility**: fast_path
- **Rationale**: Tool selection issues represent the highest frequency failure mode and can be detected by comparing expected vs actual tool calls from the final agent span.

### #2: error_handling
- **Catches**: tool_error_mishandled, early_termination, unnecessary_escalation
- **Feasibility**: full_path
- **Rationale**: Error handling failures are predominantly high-severity and require analyzing the full conversation flow to detect improper responses to tool failures.

### #3: parameter_accuracy
- **Catches**: wrong_params
- **Feasibility**: fast_path
- **Rationale**: Parameter accuracy can be efficiently evaluated by comparing tool call arguments in the final span against expected parameters.

### #4: policy_compliance
- **Catches**: policy_violation, wrong_tool, unnecessary_escalation, missing_tool
- **Feasibility**: full_path
- **Rationale**: Policy violations are high-severity but require understanding conversation context and business rules that go beyond simple tool call analysis.

### #5: tool_sequencing
- **Catches**: wrong_order
- **Feasibility**: fast_path
- **Rationale**: Tool sequencing has low frequency but can be efficiently detected by comparing the order of tool calls in the agent trace.

## Failure Mode → Evaluator Mapping

| Failure Mode | Evaluators |
|---|---|
| redundant_call | redundancy, tool_selection |
| missing_tool | tool_selection, policy_compliance |
| early_termination | response_quality, error_handling |
| unnecessary_escalation | policy_compliance, error_handling |
| tool_error_mishandled | error_handling, response_quality |
| wrong_params | parameter_accuracy |
| wrong_tool | tool_selection, policy_compliance |
| policy_violation | policy_compliance |
| wrong_order | tool_sequencing |
| partial_success | tool_selection, response_quality |

## Surprising Findings

Many agents that ultimately succeeded still exhibited significant inefficiencies through redundant authentication calls, suggesting a gap between task completion and optimal execution. Agents frequently misinterpreted successful tool responses as failures, leading to unnecessary escalation even when they had all required information to proceed. The high frequency of redundant calls in successful tasks indicates that current agent implementations may be over-cautious in information gathering rather than confidently proceeding with available data.

## Per-Task Analysis Details

### tau-langgraph

| Task | Outcome | Failure Modes | Severity | Root Cause |
|---|---|---|---|---|
| dev:0 | success | - | medium | - |
| dev:1 | failure | missing_tool, early_termination | high | The agent failed to execute the required exchange_delivered_order_items tool cal |
| dev:6 | success | redundant_call | medium | Agent made unnecessary tool calls for user authentication and order verification |
| dev:9 | success | - | medium | - |
| dev:12 | failure | missing_tool, unnecessary_escalation, tool_error_mishandled | high | The agent incorrectly handled tool errors when retrieving order details and esca |
| dev:14 | success | - | low | - |
| dev:15 | success | redundant_call | medium | Agent made unnecessary tool calls to find user information and get order details |
| dev:17 | failure | wrong_tool, policy_violation | medium | Agent made unnecessary tool calls when the ground truth expected no tools to be  |
| train:35 | partial_success | redundant_call, wrong_params | medium | The agent made redundant calls to modify_pending_order_items and used incorrect  |
| train:351 | failure | missing_tool, early_termination, unnecessary_escalation | high | The agent failed to recognize that the user mentioned having multiple orders to  |
| train:2 | success | redundant_call | low | Agent made unnecessary extra tool calls to authenticate user and retrieve order  |
| train:4 | success | - | medium | - |
| train:3 | success | - | medium | - |
| train:8 | failure | missing_tool, early_termination, unnecessary_escalation, tool_error_mishandled | high | The agent failed to handle tool errors properly when retrieving order details an |
| train:13 | success | redundant_call | low | Agent made unnecessary tool calls for user authentication and order details retr |
| train:43 | success | redundant_call | low | Agent made unnecessary information-gathering calls before performing the require |
| train:130 | failure | missing_tool, early_termination, unnecessary_escalation, tool_error_mishandled | high | Agent failed to properly handle the order lookup process and prematurely escalat |
| train:139 | success | - | medium | - |
| train:431 | failure | missing_tool, early_termination, tool_error_mishandled | high | The agent failed to handle tool errors properly when accessing order details and |
| dev:13 | success | redundant_call | medium | Agent made unnecessary authentication and information gathering tool calls befor |

### tau-openai

| Task | Outcome | Failure Modes | Severity | Root Cause |
|---|---|---|---|---|
| dev:0 | success | redundant_call | low | Agent made unnecessary extra tool calls for user authentication and order detail |
| dev:1 | partial_success | wrong_tool, policy_violation, unnecessary_escalation | medium | Agent made two separate exchange calls instead of one combined call with all ite |
| dev:6 | success | redundant_call | medium | Agent made multiple unnecessary authentication attempts and order lookups before |
| dev:9 | success | redundant_call | low | Agent made unnecessary extra tool calls during information gathering and incorre |
| dev:12 | failure | missing_tool, early_termination, unnecessary_escalation, tool_error_mishandled | high | Agent incorrectly interpreted successful order detail retrievals as failures and |
| dev:14 | failure | missing_tool, early_termination, tool_error_mishandled | high | The agent failed to successfully retrieve order details despite multiple attempt |
| dev:15 | success | redundant_call | low | Agent made an unnecessary second cancel_pending_order call with different reason |
| dev:17 | failure | redundant_call, wrong_tool | medium | Agent made unnecessary tool calls to authenticate user and retrieve order detail |
| train:35 | failure | missing_tool, early_termination, unnecessary_escalation, tool_error_mishandled | high | Agent failed to properly handle the get_order_details tool error and unnecessari |
| train:351 | success | - | none | - |
| train:2 | success | - | medium | - |
| train:4 | failure | missing_tool, unnecessary_escalation, tool_error_mishandled | high | Agent failed to attempt the cancel_pending_order tool call and unnecessarily esc |
| train:3 | success | - | medium | - |
| train:8 | partial_success | missing_tool | high | The agent only completed one of the two required order modifications, handling t |
| train:13 | failure | missing_tool, tool_error_mishandled, early_termination | high | The agent failed to call the expected cancel_pending_order tool and instead inco |
| train:43 | failure | missing_tool, early_termination, tool_error_mishandled, unnecessary_escalation | high | The agent failed to handle tool errors properly when get_order_details calls fai |
| train:130 | success | - | none | - |
| train:139 | failure | missing_tool, unnecessary_escalation, tool_error_mishandled | high | The agent incorrectly assumed order lookup failures meant the orders didn't exis |
| train:431 | failure | missing_tool, unnecessary_escalation, early_termination | high | The agent failed to recognize that the ground truth expects multiple specific or |
| dev:13 | success | redundant_call | low | Agent made unnecessary authentication and information gathering calls before per |

### traject-langgraph

| Task | Outcome | Failure Modes | Severity | Root Cause |
|---|---|---|---|---|
| parallel_ecommerce_simple:0 | success | - | none | - |
| parallel_ecommerce_simple:1 | success | - | none | - |
| parallel_ecommerce_simple:2 | partial_success | early_termination | medium | The agent terminated early and provided incomplete information, cutting off mid- |
| parallel_ecommerce_hard:10 | partial_success | missing_tool | medium | The agent failed to call the auto-complete tools for Asos and Wayfair that were  |
| parallel_ecommerce_hard:11 | success | - | none | - |
| parallel_ecommerce_hard:12 | success | - | none | - |
| sequential_travel:0 | success | - | none | - |
| sequential_travel:1 | partial_success | tool_error_mishandled | medium | The agent failed to handle the tool error properly when the hotel details API ca |
| sequential_travel:2 | partial_success | wrong_params | low | The agent called the first tool with 'parameters': null instead of providing the |
| parallel_finance_simple:0 | success | - | none | - |
| parallel_travel_simple:0 | success | - | none | - |
| parallel_education_hard:0 | partial_success | wrong_params, tool_error_mishandled | medium | The agent failed to include required optional parameters for filtering recent vi |
| parallel_music_hard:0 | partial_success | wrong_params, tool_error_mishandled | medium | The agent used incorrect parameter format for some API calls and didn't properly |
| sequential_ecommerce:0 | partial_success | wrong_params, redundant_call | medium | The agent used incorrect parameters by searching with 'running shoes' instead of |
| sequential_gaming:0 | partial_success | wrong_params, wrong_order | medium | The agent made parameter formatting errors and skipped some required search step |
| sequential_finance:0 | partial_success | tool_error_mishandled | medium | The agent correctly executed the sequence but failed to properly handle the tech |
| sequential_news_media:0 | partial_success | missing_tool, wrong_params, redundant_call | medium | Agent failed to provide required parameters for multiple tool calls and missed e |
| sequential_weather:0 | partial_success | wrong_params | medium | The agent passed incorrect parameters to the Koppen Climate Classification tool, |
| sequential_finance:5 | partial_success | missing_tool, wrong_params, early_termination | high | The agent terminated early after only 2 of 3 required tool calls and failed to p |
| sequential_music:0 | partial_success | missing_tool, wrong_params | medium | The agent failed to provide the required date parameter for the Billboard API ca |
