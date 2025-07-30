# Fix for Playground Project Regression (Issue #8843)

## Problem Description

The issue described in [GitHub Issue #8843](https://github.com/Arize-ai/phoenix/issues/8843) was that when the playground runs on a dataset, traces were being captured in the "playground" project instead of creating a dynamic project per experiment. This caused problems because when an experiment gets deleted, it would delete the whole playground project.

## Root Cause

The regression occurred because the playground code was hardcoded to use `PLAYGROUND_PROJECT_NAME` for all experiments, while the client API correctly creates dynamic projects per experiment. This created an inconsistency in behavior.

### Before the Fix

```python
# In playground code (subscriptions.py and chat_mutations.py)
experiment = models.Experiment(
    # ... other fields ...
    project_name=PLAYGROUND_PROJECT_NAME,  # Always "playground"
)
```

### After the Fix

```python
# In playground code (subscriptions.py and chat_mutations.py)
dynamic_project_name = _generate_dynamic_project_name("Playground")
experiment = models.Experiment(
    # ... other fields ...
    project_name=dynamic_project_name,  # Dynamic project per experiment
)
```

## Solution

### 1. Added Helper Function

Created a reusable helper function `_generate_dynamic_project_name()` in `src/phoenix/server/api/routers/v1/experiments.py`:

```python
def _generate_dynamic_project_name(prefix: str = "Experiment") -> str:
    """
    Generate a dynamic project name with a given prefix.
    This ensures each experiment gets its own project to avoid conflicts.
    """
    return f"{prefix}-{getrandbits(96).to_bytes(12, 'big').hex()}"
```

### 2. Updated Playground Dataset Experiments

Modified the playground code in two files to use dynamic project names for dataset-based experiments:

#### `src/phoenix/server/api/subscriptions.py`
- Updated `chat_completion_over_dataset` subscription
- Now creates a dynamic project for each dataset experiment
- Uses the helper function with "Playground" prefix

#### `src/phoenix/server/api/mutations/chat_mutations.py`
- Updated `chat_completion_over_dataset` mutation
- Now creates a dynamic project for each dataset experiment
- Uses the helper function with "Playground" prefix

### 3. Preserved Regular Playground Behavior

The regular playground chat completion (not dataset-based) still uses the playground project as intended:

```python
# Regular playground chat completion still uses playground project
project_name=PLAYGROUND_PROJECT_NAME,
```

## Files Modified

1. `src/phoenix/server/api/routers/v1/experiments.py`
   - Added `_generate_dynamic_project_name()` helper function
   - Updated existing experiment creation to use the helper

2. `src/phoenix/server/api/subscriptions.py`
   - Added import for the helper function
   - Updated dataset experiment creation to use dynamic project names
   - Updated project creation logic

3. `src/phoenix/server/api/mutations/chat_mutations.py`
   - Added import for the helper function
   - Updated dataset experiment creation to use dynamic project names
   - Updated project creation logic

## Benefits

1. **Consistency**: Playground dataset experiments now behave the same as client API experiments
2. **Isolation**: Each experiment gets its own project, preventing conflicts
3. **Safety**: Deleting an experiment no longer affects the playground project
4. **Maintainability**: Reusable helper function ensures consistent project naming

## Testing

The fix has been tested to ensure:
- ✅ All modified files have correct syntax
- ✅ Dynamic project name generation works correctly
- ✅ Project names follow the expected pattern
- ✅ Each experiment gets a unique project name
- ✅ Regular playground behavior is preserved

## Impact

This fix resolves the regression by ensuring that:
- Dataset-based playground experiments create dynamic projects (like the client API)
- Regular playground chat completion continues to use the playground project
- Each experiment is isolated in its own project
- The playground project is no longer at risk of being deleted when experiments are deleted