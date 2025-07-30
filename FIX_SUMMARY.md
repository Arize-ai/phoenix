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
dynamic_project_name = generate_experiment_project_name(f"Playground-{dataset_name}")
experiment = models.Experiment(
    # ... other fields ...
    project_name=dynamic_project_name,  # Dynamic project per experiment with dataset name
)
```

## Solution

### 1. Added Helper Function

Created a reusable helper function `generate_experiment_project_name()` in `src/phoenix/server/experiments/utils.py`:

```python
def generate_experiment_project_name(prefix: str = "Experiment") -> str:
    """
    Generate a dynamic project name with a given prefix.
    This ensures each experiment gets its own project to avoid conflicts.
    
    Args:
        prefix: The prefix for the project name. Defaults to "Experiment".
        
    Returns:
        A unique project name in the format "{prefix}-{random_hex}".
    """
    from random import getrandbits
    return f"{prefix}-{getrandbits(96).to_bytes(12, 'big').hex()}"
```

### 2. Updated Playground Dataset Experiments

Modified the playground code to support stable project names across invocations:

#### `src/phoenix/server/api/input_types/ChatCompletionInput.py`
- Added `project_name: Optional[str] = None` parameter to `ChatCompletionOverDatasetInput`
- This allows clients to specify a stable project name for consistent behavior

#### `src/phoenix/server/api/subscriptions.py`
- Updated `chat_completion_over_dataset` subscription
- Now uses provided project name or generates one if not provided
- Implements "get or create" logic to prevent duplicate projects
- Uses the helper function with "Playground-{dataset_name}" prefix when generating names

#### `src/phoenix/server/api/mutations/chat_mutations.py`
- Updated `chat_completion_over_dataset` mutation
- Now uses provided project name or generates one if not provided
- Implements "get or create" logic to prevent duplicate projects
- Uses the helper function with "Playground-{dataset_name}" prefix when generating names

### 3. Preserved Regular Playground Behavior

The regular playground chat completion (not dataset-based) still uses the playground project as intended:

```python
# Regular playground chat completion still uses playground project
project_name=PLAYGROUND_PROJECT_NAME,
```

## Files Modified

1. `src/phoenix/server/experiments/utils.py` (new file)
   - Created new utils.py file in server experiments directory
   - Added `generate_experiment_project_name()` helper function

2. `src/phoenix/server/api/routers/v1/experiments.py`
   - Removed old `_generate_dynamic_project_name()` function
   - Added import for the new helper function
   - Updated existing experiment creation to use the helper

3. `src/phoenix/server/api/input_types/ChatCompletionInput.py`
   - Added `project_name: Optional[str] = None` parameter to `ChatCompletionOverDatasetInput`
   - This enables stable project names across invocations

4. `src/phoenix/server/api/subscriptions.py`
   - Added import for the helper function
   - Updated dataset experiment creation to use provided project name or generate one
   - Implemented "get or create" logic for projects to prevent duplicates
   - Updated project creation logic

5. `src/phoenix/server/api/mutations/chat_mutations.py`
   - Added import for the helper function
   - Updated dataset experiment creation to use provided project name or generate one
   - Implemented "get or create" logic for projects to prevent duplicates
   - Updated project creation logic

## Benefits

1. **Consistency**: Playground dataset experiments now behave the same as client API experiments
2. **Isolation**: Each experiment gets its own project, preventing conflicts
3. **Safety**: Deleting an experiment no longer affects the playground project
4. **Maintainability**: Reusable helper function ensures consistent project naming
5. **Identifiability**: Project names include both "Playground" and dataset name for easy identification
6. **Stability**: Project names can be provided as parameters to ensure consistency across invocations
7. **Flexibility**: Supports both provided project names and auto-generated names

## Project Naming Pattern

The project naming supports two modes:

### 1. Provided Project Name
When `project_name` is provided in the input, that exact name is used:
```
{provided_project_name}
```

### 2. Auto-Generated Project Name
When `project_name` is not provided, a unique name is generated:
```
Playground-{DatasetName}-{random_hex}
```

Examples:
- Provided: `MyStableProject` → `MyStableProject`
- Auto-generated: `Playground-MyDataset-69d8405c3db3bacfe5f8b049`
- Auto-generated: `Playground-TestDataset-5de5357e452e314e420141cc`
- Auto-generated: `Playground-ProductionDataset-6f0d033583338c1710f54c2d`

## Project Stability

The implementation uses a "get or create" pattern:
1. **Lookup**: First tries to find an existing project with the given name
2. **Create**: If not found, creates a new project with that name
3. **Reuse**: Subsequent invocations with the same project name will reuse the existing project

This ensures that:
- Multiple invocations with the same project name use the same project
- No duplicate projects are created for the same experiment
- Project names remain stable across subscription invocations

## Testing

The fix has been tested to ensure:
- ✅ All modified files have correct syntax
- ✅ Dynamic project name generation works correctly
- ✅ Project names follow the expected pattern
- ✅ Each experiment gets a unique project name
- ✅ Dataset names are properly included in project names
- ✅ Regular playground behavior is preserved
- ✅ Project name parameter functionality works correctly
- ✅ Project names are stable across invocations when provided
- ✅ "Get or create" logic prevents duplicate projects

## Impact

This fix resolves the regression by ensuring that:
- Dataset-based playground experiments create dynamic projects (like the client API)
- Project names can be provided as parameters for stability across invocations
- Project names include both "Playground" and dataset name for easy identification when auto-generated
- Regular playground chat completion continues to use the playground project
- Each experiment is isolated in its own project
- The playground project is no longer at risk of being deleted when experiments are deleted
- Multiple invocations of the same experiment use the same project when a project name is provided