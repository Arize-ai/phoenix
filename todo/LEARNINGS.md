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

## backend-formatter-tests

- Tests for JSONPathTemplateFormatter were already implemented in the backend-template-formatter task
- All required test cases were present in `tests/unit/utilities/test_template_formatters.py`:
  - Variable extraction via `test_jsonpath_template_formatter_parse_extracts_variables()` - tests simple paths, nested paths, array indexes, escaped brackets, and mixed content
  - Substitution with valid paths via parametrized test cases: jsonpath-simple-path, jsonpath-nested-path, jsonpath-array-index, jsonpath-nested-array-path, jsonpath-multiple-paths
  - Unmatched paths remain as-is via `jsonpath-unmatched-path-left-as-is` test case
  - Edge cases: nested arrays (jsonpath-nested-array-path), escaped brackets (jsonpath-escaped-bracket), unicode values (jsonpath-unicode-value)
- The test suite uses pytest parametrization to share the same test function across all template formatters (Mustache, F-String, and JSONPath)
- All tests pass when run with `tox -e unit_tests -- -n auto -k "jsonpath"`
- Pattern learned: When implementing a new formatter, add tests alongside the implementation rather than in a separate task - this ensures the implementation is correct from the start
