# Context Pruning Admission Gates

| Gate | Dataset | Result | Pass rate | Criterion |
|---|---|---:|---:|---|
| type_a_zero | `context_pruning_gate_type_a_zero` | pass | 38/40 (95%) | >= 80% |
| type_b_zero | `context_pruning_gate_type_b_zero` | pass | 0/36 (0%) | <= 20% |
| type_b_5k | `context_pruning_gate_type_b_5k` | pass | 35/36 (97%) | >= 80% |

## Rationale

- `type_a_zero`: History-independent Type A tasks should pass without context.
- `type_b_zero`: History-dependent Type B tasks should fail without the recalled needle.
- `type_b_5k`: History-dependent Type B tasks should pass when the 5K prefix is present.
