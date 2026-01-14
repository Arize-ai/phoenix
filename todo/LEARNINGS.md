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
