# Project Learnings Log

This file is appended by each agent after completing a task.
Key insights, gotchas, and patterns discovered during implementation.

Use this knowledge to avoid repeating mistakes and build on what works.

---

<!-- Agents: Append your learnings below this line -->
<!-- Format:
## <task-id>

- Key insight or decision made
- Gotcha or pitfall discovered
- Pattern that worked well
- Anything the next agent should know
-->

## backend-enum-json-path

- Added `JSON_PATH = "JSON_PATH"` to the `PromptTemplateFormat` enum in `src/phoenix/server/api/helpers/prompts/models.py:33`
- The enum follows the existing pattern where the enum value matches the enum name
- Running `tox -e type_check` shows expected errors in files that have `assert_never()` calls - these files will be updated in subsequent tasks (backend-template-formatter, backend-subscription-update, etc.)
- Added a simple unit test in `tests/unit/server/api/helpers/prompts/test_models.py` to verify the enum value exists and has the correct value
- The test pattern used is straightforward: `assert hasattr(PromptTemplateFormat, "JSON_PATH")` and `assert PromptTemplateFormat.JSON_PATH.value == "JSON_PATH"`

## backend-template-formatter

- Implemented `JSONPathTemplateFormatter` in `src/phoenix/utilities/template_formatters.py` using the `jsonpath-ng` library (already in dependencies)
- Key design decision: Override the `format()` method to skip validation for missing variables, allowing unmatched paths to remain in the template (different from other formatters)
- Pattern used: `{$.path.to.value}` with regex `r"(?<!\\)\{\$\.[^}]+\}"` to match non-escaped JSONPath expressions
- The formatter queries the entire data object passed in kwargs rather than expecting individual variables
- Added comprehensive tests including: simple paths, nested paths, array indexing, escaped brackets, unmatched paths, and unicode handling
- Fixed type errors in three locations: added `# type: ignore[import-untyped]` for jsonpath_ng, and updated two `assert_never()` calls in `template_helpers.py` and `subscriptions.py`
- Important: Must update ALL factory functions that instantiate template formatters, not just the main one in `template_formatters.py`
