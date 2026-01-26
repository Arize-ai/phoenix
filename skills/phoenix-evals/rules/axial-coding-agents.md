# Axial Coding: Agent Workflows

Transition failure matrices and step-level analysis for agentic systems.

## Transition Failure Matrix

Shows WHERE failures occur between states:

```
                    FAILURE OCCURRED IN →
                    Parse  Search  Present  Execute
FROM STATE     Parse   0       3        0         0
               Search  0       0       12         0
               Present 0       0        0         7
```

Reading: 12 failures when transitioning from Search → Present.

```python
def build_transition_matrix(conversations, states):
    matrix = defaultdict(lambda: defaultdict(int))
    for conv in conversations:
        if conv["failed"]:
            last_success = find_last_success(conv)
            first_failure = find_first_failure(conv)
            matrix[last_success][first_failure] += 1
    return pd.DataFrame(matrix).fillna(0)
```

## Two-Phase Evaluation

1. **End-to-end**: Did the agent achieve the user's goal?
2. **Step-level** (only for failures): What went wrong at each step?

```python
def evaluate_e2e(conversation):
    return {"goal_achieved": check_goal(conversation), "turns": len(conversation["steps"])}

def evaluate_steps(conversation):
    return {step["name"]: run_step_evaluators(step) for step in conversation["steps"]}
```

## Agent Failure Taxonomy

```yaml
agent_failures:
  planning: [wrong_plan, incomplete_plan]
  tool_selection: [wrong_tool, missed_tool, unnecessary_call]
  tool_execution: [wrong_parameters, type_error]
  state_management: [lost_context, stuck_in_loop]
  error_recovery: [no_fallback, wrong_fallback]
```

## Checkpoints

Define milestones for complex tasks:

```python
checkpoints = {
    "params_extracted": ParameterCheck(),
    "results_retrieved": ResultCheck(),
    "action_completed": ActionCheck(),
}
```

## Key Principles

- **Transition matrices** show where failures occur between states
- **Two-phase eval** - E2E first, step-level for failures only
- **Checkpoints** for complex multi-step tasks
