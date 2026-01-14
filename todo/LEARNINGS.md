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

## frontend-types-update

- The TypeScript type definitions in `app/src/components/templateEditor/types.ts` automatically include JSON_PATH without code changes
- The `TemplateFormat` type is derived from `TemplateFormats` constant using `(typeof TemplateFormats)[keyof typeof TemplateFormats]` pattern
- The `isTemplateFormat()` type guard uses `Object.values(TemplateFormats).includes()` which automatically picks up new enum values
- Created comprehensive unit tests in `app/src/components/templateEditor/__tests__/types.test.ts` to verify:
  - `isTemplateFormat()` returns true for all valid formats including JSON_PATH
  - `isTemplateFormat()` returns false for invalid strings (including lowercase variants)
  - All values from TemplateFormats constant are accepted by the type guard
- Test file follows the pattern of other component tests: uses describe blocks, groups related tests, and tests both positive and negative cases
- All 482 frontend tests pass (including 5 new tests for types)
- Pattern learned: TypeScript's `as const` and `keyof typeof` patterns create self-updating types that automatically include new enum values, reducing maintenance burden

## frontend-jsonpath-grammar

- Created Lezer grammar for JSON_PATH templating in `app/src/components/templateEditor/language/jsonPath/`
- The grammar file `jsonPathTemplating.syntax.grammar` follows the same pattern as fString and mustacheLike grammars
- Key design: Uses single brackets `{$.path}` syntax with escape sequence `\{` for literal braces
- Grammar defines top-level rule `@top JSONPathTemplate` with Template, char, emptyTemplate, lEscape, and sym tokens
- The Token structure is similar to fString (single bracket) but different from mustacheLike (double brackets)
- Created TypeScript declaration file `jsonPathTemplating.syntax.grammar.d.ts` exporting LRParser type
- The Lezer grammar compiler is already configured in `vite.config.mts` via the `lezer()` plugin (line 43)
- Building the app (`pnpm build`) automatically compiles .grammar files using @lezer/generator/rollup plugin
- No manual build step needed - vite automatically processes .grammar files during build
- Typecheck passed after grammar creation, confirming no TypeScript errors
- Pattern learned: Lezer grammars use @tokens for top-level tokens and @local tokens for context-specific tokens (like Variable inside Template scope)
- The @precedence directive ensures lEscape takes priority over LBrace to correctly handle escaped brackets

## frontend-jsonpath-language

- Created `app/src/components/templateEditor/language/jsonPath/jsonPathTemplating.ts` following the exact pattern of fStringTemplating.ts and mustacheLikeTemplating.ts
- Exported three key functions: `formatJSONPath()`, `extractVariablesFromJSONPath()`, and `JSONPathTemplating()` (CodeMirror extension)
- The implementation reuses `extractVariables()` and `format()` utilities from `languageUtils.ts`, passing the JSONPathTemplatingLanguage.parser
- Important escape handling: Only `\{` is supported as escape (converts to `{` in postFormat), unlike fString which also handles `{{` and `}}`
- Added comprehensive tests to `app/src/components/templateEditor/language/__tests__/languageUtils.test.ts` covering:
  - Variable extraction: simple paths (`$.name`), nested paths (`$.nested.path`), array indexing (`$.array[0]`), deep nesting (`$.deep[0].nested`), escaped braces
  - Formatting: substitution, unmatched variables left as-is, escape handling, whitespace trimming
- Test gotcha: JSON objects in templates require careful escaping - any unescaped `{` starts a new template, so literal JSON braces must use `\{` escape
- Pattern learned: The languageUtils format() and extractVariables() functions work on any Lezer grammar that produces Variable nodes, making it easy to add new template formats
- Created `index.ts` export file following the pattern of other language directories
- All 484 frontend tests pass after implementation
- TypeScript typecheck passes with no errors

## frontend-language-utils-update

- Updated `app/src/components/templateEditor/templateEditorUtils.ts` to import and use JSON_PATH format functions
- Added import for `extractVariablesFromJSONPath` and `formatJSONPath` from `./language/jsonPath`
- Replaced the TODO placeholder case for `TemplateFormats.JSONPath` with actual function references
- Pattern: The `getTemplateFormatUtils()` function returns an object with `format` and `extractVariables` functions that have consistent signatures across all template formats
- Created comprehensive unit tests in `app/src/components/templateEditor/__tests__/templateEditorUtils.test.ts` covering:
  - JSON_PATH variable extraction (simple, nested, array indexing, escaped braces)
  - JSON_PATH formatting (variable substitution, unmatched paths, escape handling)
  - All four template formats (JSON_PATH, F_STRING, MUSTACHE, NONE) for completeness
- All 22 templateEditor tests pass (11 new tests in templateEditorUtils.test.ts)
- TypeScript typecheck passes with no errors
- Pattern learned: When testing utility functions that return different behavior based on input (like a factory function), test all possible inputs to ensure exhaustive coverage

## frontend-parser-tests

- Tests for JSON_PATH parsing were already implemented in the previous task (frontend-jsonpath-language) in `app/src/components/templateEditor/language/__tests__/languageUtils.test.ts`
- The existing tests comprehensively cover all requirements from the task:
  - Variable extraction for simple paths (`$.name`), nested paths (`$.nested.path`), array access (`$.array[0]`), deep nested paths (`$.deep[0].nested`)
  - Escape handling with `\{` (lines 211, 221)
  - Format substitution with matched and unmatched paths (lines 228-279)
- Tests follow the established pattern in languageUtils.test.ts: using describe blocks with arrays of test cases and forEach to iterate over them
- All 495 frontend tests pass, including the 12 tests related to JSON_PATH (6 for extraction, 6 for formatting)
- Pattern learned: When a task description requests tests that already exist from previous implementation work, verify test coverage rather than adding duplicate tests
- The test file structure groups all template language tests together (mustache-like, f-string, JSON_PATH) making it easy to compare patterns across different formats

## frontend-template-editor-update

- Updated `app/src/components/templateEditor/TemplateEditor.tsx` to import and use the `JSONPathTemplating()` extension
- Added import statement on line 16: `import { JSONPathTemplating } from "./language/jsonPath";`
- Replaced the TODO comment in the JSON_PATH case (lines 68-70) with `ext.push(JSONPathTemplating());` to add syntax highlighting support
- The implementation follows the exact same pattern as FString and Mustache cases - each calls their respective templating extension function
- Important: Had to fix a pre-existing linting issue in `languageUtils.test.ts` where `JSONPathTemplatingLanguage` was imported but not used (from previous task)
- All 495 frontend tests pass after changes
- TypeScript typecheck passes with no errors
- Pattern learned: When adding language support to TemplateEditor, the pattern is consistent: import the templating extension function, then call it in the appropriate switch case
- The TemplateEditor uses useMemo to cache the extensions array, only recalculating when templateFormat changes, which is good for performance

## frontend-playground-radio-group

- Updated `app/src/pages/playground/TemplateFormatRadioGroup.tsx` to add JSON_PATH as a selectable radio button option
- Added new ToggleButton between F-String and None options with `aria-label="JSONPath"` and `id={TemplateFormats.JSONPath}`
- The component uses ToggleButtonGroup from @phoenix/components which handles selection state automatically
- No changes needed to the selection handler - it already uses `isTemplateFormat()` type guard which automatically accepts JSON_PATH (updated in frontend-types-update task)
- No existing tests for this component, so verified changes with TypeScript typecheck and full frontend test suite (495 tests pass)
- Pattern learned: UI components that use enum values with proper type guards automatically support new enum values without handler changes
- The component imports TemplateFormats from constants.ts, ensuring consistency with the enum definition
- Simple UI change that follows existing patterns - minimal risk, straightforward implementation

## frontend-playground-utils

- The `extractVariablesFromInstance()` and `extractVariablesFromInstances()` functions in `app/src/pages/playground/playgroundUtils.ts` already support JSON_PATH format without code changes
- These functions use `getTemplateFormatUtils(templateFormat)` which returns the appropriate extractVariables function based on the format
- Since `getTemplateFormatUtils()` was updated in the frontend-language-utils-update task to handle JSON_PATH, the playground utils automatically inherited that support
- Added comprehensive tests to `app/src/pages/playground/__tests__/playgroundUtils.test.ts` to verify JSON_PATH variable extraction works correctly:
  - Tests for extracting from chat messages with JSONPath format (paths like `$.user.name`, `$.user.age`)
  - Tests for extracting from text completion prompts with JSONPath format
  - Tests for handling multiple instances with JSONPath format
  - Tests for `getVariablesMapFromInstances()` to verify variable mapping works correctly with JSONPath variables
- All 93 playground utils tests pass, including the 6 new JSON_PATH tests
- TypeScript typecheck and linting both pass
- Pattern learned: When lower-level utilities are properly abstracted (like `getTemplateFormatUtils()`), higher-level functions automatically gain new functionality without modification
- Important: JSONPath variables include the full path including `$.` prefix (e.g., `$.user.name`), unlike simple variable names in other formats

## frontend-playground-utils-tests

- Tests for JSON_PATH variable extraction in playground utils were already implemented in the previous task (frontend-playground-utils)
- The previous agent correctly followed the PROMPT.md instructions to write tests alongside the implementation (step 4: "Write tests")
- All required test coverage was present in `app/src/pages/playground/__tests__/playgroundUtils.test.ts`:
  - `extractVariablesFromInstances()` tests for chat messages, text completion prompts, and multiple instances with JSONPath format
  - `getVariablesMapFromInstances()` tests to verify variable mapping works correctly with JSONPath path syntax
- All 93 tests in playgroundUtils.test.ts pass, including the 6 JSON_PATH tests added in the previous task
- Pattern learned: Tasks that request only tests may already be complete if the previous implementation task followed best practices of writing tests during implementation
- When encountering a "tests-only" task, check git history and existing test files before writing duplicate tests
- The test coverage is comprehensive: simple paths, nested paths, duplicate variable deduplication, and integration with the variables cache

## frontend-json-input-component

- Created `JSONInputEditor` component in `app/src/pages/playground/JSONInputEditor.tsx` as a wrapper around the existing `JSONEditor` component
- The component provides a labeled JSON editor for playground input when using JSON_PATH template format
- Key design decisions:
  - Used existing `JSONEditor` component from `@phoenix/components/code/JSONEditor` which already has CodeMirror with JSON language support (`@codemirror/lang-json`)
  - Enabled `optionalLint: true` to allow empty JSON values without validation errors
  - Enabled line numbers, active line highlighting, and fold gutter for better UX (unlike the simple `VariableEditor`)
  - Component accepts `value` (string) and `onChange` props to integrate with playground state
- Added unit tests in `app/src/pages/playground/__tests__/JSONInputEditor.test.ts`
  - Had to mock all component dependencies (JSONEditor, Label, CodeWrap, fieldBaseCSS) due to CodeMirror module resolution issues in test environment
  - Tests verify the component accepts expected props and doesn't throw errors
  - Pattern: Mock external dependencies with complex imports (like CodeMirror) to avoid test environment issues
- All 143 playground tests pass (including 2 new JSONInputEditor tests)
- TypeScript typecheck and ESLint both pass with no errors
- Pattern learned: For simple wrapper components with no behavioral logic, minimal tests that verify prop acceptance are sufficient
- Next agent: This component is ready to be integrated into `PlaygroundInput` component (task: frontend-playground-input-integration)

## frontend-playground-input-integration

- Updated `PlaygroundInput.tsx` to conditionally render `JSONInputEditor` when `templateFormat === TemplateFormats.JSONPath`
- Key design decisions:
  - Store the entire JSON object under a special key `__json_data__` in `variablesValueCache` instead of individual path variables
  - Early return for JSONPath format (lines 21-29) before the empty variable check to keep logic clean
  - Removed the JSONPath case from the switch statement since it's handled by early return (prevents TypeScript exhaustiveness errors)
- The JSON editor provides the default value `"{}"` if no data exists in the cache
- The `setVariableValue` callback stores changes to the JSON editor under the `__json_data__` key
- Important: The implementation strategy differs from how other template formats work (which extract individual variables) - JSONPath uses a single JSON object that paths query against
- All 503 frontend tests pass without modification (no existing tests broke)
- TypeScript typecheck and ESLint both pass
- Pattern learned: When adding conditional rendering based on enum values, check if the enum case needs to be removed from exhaustive switch statements to avoid TypeScript errors after early returns
- Testing challenge: Creating comprehensive unit tests for React components with complex context dependencies is difficult with vi.mock() - opted to rely on integration testing and manual verification instead
## frontend-path-autocomplete

- Implemented autocomplete for JSON_PATH template format by extending the JSONPathTemplating CodeMirror extension with autocomplete support
- Key changes:
  1. Updated `jsonPathTemplating.ts` to accept optional `pathOptions` parameter and use `@codemirror/autocomplete` to provide suggestions
  2. Created `useJSONPathAutocomplete` hook to generate autocomplete options by flattening JSON input data using `flattenObject()` utility
  3. Updated `TemplateEditor.tsx` to accept and pass `pathAutocompleteOptions` prop to `JSONPathTemplating` extension
  4. Integrated autocomplete into `PlaygroundChatTemplate` using the new hook
- Autocomplete implementation:
  - Detects when cursor is inside template braces `{...}` by checking position of last `{` and `}` before cursor
  - Only shows suggestions when inside braces and after the `{` character
  - Uses `formatIndices: true` in `flattenObject()` to generate bracket notation for arrays (e.g., `$.items[0].name`)
  - Includes non-terminal values with `keepNonTerminalValues: true` to allow autocomplete for parent paths (e.g., `$.address` as well as `$.address.city`)
- Pattern learned: CodeMirror's `LanguageSupport` second parameter accepts an array of Extensions (not LRLanguage instances) for adding features like autocomplete
- Testing approach: Simplified tests to avoid CodeMirror EditorState instance issues in test environment - focused on testing the autocomplete logic (flattenObject + JSON parsing) separately
- TypeScript gotcha: Fixed error by ensuring extensions array only contains Extension types, not mixing Language and Extension types
- All 510 frontend tests pass, TypeScript typecheck passes

## backend-subscription-update

- The subscriptions.py file already had JSON_PATH format support implemented - imports were present and `_template_formatter()` function already included the JSON_PATH case (lines 94-96, 994-995)
- The implementation was complete from the beginning: `JSONPathTemplateFormatter` is imported and returned for `PromptTemplateFormat.JSON_PATH` in the `_template_formatter()` function
- Created comprehensive unit test `test_json_path_template_format` in `tests/unit/server/api/test_subscriptions.py` to verify:
  - JSON_PATH template format works correctly in chat completion subscriptions
  - Template variables are properly formatted with JSONPath expressions (e.g., `{$.location.city}` → `Paris`)
  - Template variables are recorded in span attributes under `PROMPT_TEMPLATE_VARIABLES`
  - Messages are correctly formatted with JSONPath substitution (paths replaced with actual values)
- Test pattern: Created VCR cassette file `TestChatCompletionSubscription.test_json_path_template_format.yaml` to mock OpenAI API responses for reproducible tests
- VCR cassettes use YAML format with request/response pairs - critical for testing external API integrations without making real API calls
- All unit tests pass (3014 passed, 845 skipped in subscription tests)
- Pattern learned: When a task description says to "update" a file but the changes are already present, verify by examining the code first - the task may already be complete from previous work
- Important: The `_formatted_messages()` function uses the formatter returned by `_template_formatter()`, so no changes were needed there either - it automatically works with JSON_PATH via the formatter pattern
