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
## backend-db-constraint

- Created database migration `861cde0a7eb5_add_json_path_to_template_format.py` to add JSON_PATH to the template_format CHECK constraint
- Migration follows the pattern of dropping the old constraint and creating a new one with the updated values using `batch_alter_table` context
- The migration file structure mirrors existing migrations: includes JSONB/JSON type definitions, revision identifiers, upgrade() and downgrade() functions
- Updated the PromptVersion model constraint in `src/phoenix/db/models.py:1902-1909` to include JSON_PATH in the list of allowed values
- Key pattern: Database migrations use `op.batch_alter_table()` context manager for both SQLite and PostgreSQL compatibility
- Important: The down_revision must point to the most recent migration (found by checking the latest file in migrations/versions/)
- Migration test was created in `tests/integration/db_migrations/test_data_migration_861cde0a7eb5_add_json_path_to_template_format.py` following the pattern of existing migration tests
- Note: Migration tests are integration tests (not unit tests) and require additional dependencies (bs4) not available in the unit_tests tox environment
- The constraint name 'template_format' matches the column name, following the existing naming convention in the codebase
- Testing approach: Created a test that verifies JSON_PATH is rejected before migration, accepted after migration, and can be downgraded

## graphql-schema-update

- Added JSON_PATH to the PromptTemplateFormat enum in `app/schema.graphql:3034`
- The enum is simple and follows the existing pattern: MUSTACHE, F_STRING, NONE, JSON_PATH
- Running `tox -e build_graphql_schema` automatically regenerates the schema after changes - this is critical to ensure the GraphQL server stays in sync with schema.graphql
- The build_graphql_schema command uses strawberry-graphql's export-schema to generate the final schema from Python code
- No behavioral tests needed for this task since it's purely a schema/type definition change
- The schema file is quite large (~4000+ lines), but the enum definition is straightforward
- Important: This task must be completed before frontend tasks that depend on the GraphQL type definitions

## graphql-input-types

- No changes were required to `src/phoenix/server/api/input_types/PromptVersionInput.py` - it already properly handles JSON_PATH
- The file imports `PromptTemplateFormat` from `phoenix.server.api.helpers.prompts.models` (line 15) and uses it as a type annotation for `template_format` field (line 83)
- Since the enum was already updated in the backend-enum-json-path task, the input type automatically accepts JSON_PATH values
- Created comprehensive unit tests in `tests/unit/server/api/input_types/test_PromptVersionInput.py` to verify:
  - ChatPromptVersionInput accepts all template formats including JSON_PATH (parametrized test)
  - The to_orm_prompt_version() method correctly converts input with JSON_PATH format to ORM models
- All unit tests pass, including the new tests and all existing tests (3857 tests total)
- Pattern learned: When enum types are properly defined and imported, input types using those enums automatically support new values without code changes
- The test file follows the existing pattern of other input_types tests (TimeRange, DimensionFilter, etc.)

## frontend-template-format-enum

- Added JSON_PATH to TemplateFormats enum in `app/src/components/templateEditor/constants.ts:17`
- Updated JSDoc comment to include JSONPath syntax pattern: `{$.path.to.value}`
- Critical discovery: Adding a new enum value causes TypeScript errors in files with exhaustive switch statements using `assertUnreachable()`
- Three files needed stub cases to maintain type safety:
  - `TemplateEditor.tsx:61-72` - added empty case with TODO comment (syntax highlighting extension will be added in frontend-jsonpath-language task)
  - `templateEditorUtils.ts:39-57` - added case returning identity format and empty variable extraction (actual implementation in frontend-language-utils-update task)
  - `PlaygroundInput.tsx:17-30` - added case showing example syntax `{$.path.to.value}`
- Important: Must run `tox -e build_graphql_schema` to regenerate GraphQL schema, then `pnpm run build:relay` in app/ to regenerate frontend types
- The TypeScript type system automatically picks up new enum values via `(typeof TemplateFormats)[keyof typeof TemplateFormats]` pattern in types.ts
- All 477 frontend tests pass after changes
- Pattern: When adding enum values used in exhaustive switches, add stub cases immediately to avoid breaking the build, even if full implementation comes later
