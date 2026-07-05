# Context Pruning Main Grid Summary

Cells summarized: `4`

| Task | Depth | Policy | Examples | Pass rate |
|---|---:|---|---:|---:|
| type_b | 50k | p0 | 95/108 | 88% |
| type_b | 50k | p1 | 78/108 | 72% |
| type_b | 50k | p3 | 12/108 | 11% |
| type_b | 50k | p5 | 88/108 | 81% |

## Evaluators

### context_pruning_type_b_50k / p0

| Evaluator | Passed | Total | Pass rate |
|---|---:|---:|---:|
| correct_tools_called | 108 | 108 | 100% |
| tool_call_args_match | 102 | 108 | 94% |
| tool_call_count_within_limit | 101 | 108 | 94% |

### context_pruning_type_b_50k / p1

| Evaluator | Passed | Total | Pass rate |
|---|---:|---:|---:|
| correct_tools_called | 84 | 108 | 78% |
| tool_call_args_match | 83 | 108 | 77% |
| tool_call_count_within_limit | 100 | 108 | 93% |

### context_pruning_type_b_50k / p3

| Evaluator | Passed | Total | Pass rate |
|---|---:|---:|---:|
| correct_tools_called | 12 | 108 | 11% |
| tool_call_args_match | 12 | 108 | 11% |
| tool_call_count_within_limit | 85 | 108 | 79% |

### context_pruning_type_b_50k / p5

| Evaluator | Passed | Total | Pass rate |
|---|---:|---:|---:|
| correct_tools_called | 108 | 108 | 100% |
| tool_call_args_match | 97 | 108 | 90% |
| tool_call_count_within_limit | 99 | 108 | 92% |
