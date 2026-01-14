# Project Tasks

Task tracker for multi-agent development.
Each agent picks the next pending task, implements it, and marks it complete.

## How to Use

1. Find the first task with `status: pending` where ALL dependencies have `status: complete`
2. Change that task's status to `in_progress`
3. Implement the task
4. Write and run tests
5. Change the task's status to `complete`
6. Append learnings to LEARNINGS.md
7. Commit with message: `feat: <task-id> - <description>`
8. EXIT

## Task Statuses

- `pending` - Not started
- `in_progress` - Currently being worked on
- `complete` - Done and committed

---

## Phase 1: Backend Foundation

### backend-enum-json-path

- content: Add JSON_PATH to PromptTemplateFormat enum in Python backend. Update `src/phoenix/server/api/helpers/prompts/models.py` to add JSON_PATH to the PromptTemplateFormat enum. Also update any related type definitions.
- status: complete
- dependencies: none

### backend-template-formatter

- content: Create JSONPathTemplateFormatter class in `src/phoenix/utilities/template_formatters.py`. Follow the pattern of MustacheTemplateFormatter and FStringTemplateFormatter. Use single brackets `{$.path.to.value}` syntax. Use existing `jsonpath-ng` library. The `parse()` method should extract JSON path expressions, and `format()` should substitute values (leaving unmatched paths as-is). Update `get_template_formatter()` factory to return this formatter for JSON_PATH format.
- status: complete
- dependencies: backend-enum-json-path

### backend-formatter-tests

- content: Add unit tests for JSONPathTemplateFormatter in `tests/unit/utilities/test_template_formatters.py`. Test variable extraction, substitution with valid paths, handling of unmatched paths (should remain unsubstituted), and edge cases like nested arrays, escaped brackets, and unicode.
- status: complete
- dependencies: backend-template-formatter

### backend-db-constraint

- content: Create database migration to update the template_format CHECK constraint to allow 'JSON_PATH' value. Update `src/phoenix/db/models.py` PromptVersion model's template_format column constraint to include JSON_PATH.
- status: complete
- dependencies: backend-enum-json-path

---

## Phase 2: GraphQL Schema

### graphql-schema-update

- content: Add JSON_PATH to PromptTemplateFormat enum in `app/schema.graphql`. The enum currently has MUSTACHE, F_STRING, NONE - add JSON_PATH. Run `tox -e build_graphql_schema` to regenerate if needed.
- status: complete
- dependencies: backend-enum-json-path

### graphql-input-types

- content: Ensure GraphQL input types in `src/phoenix/server/api/input_types/PromptVersionInput.py` properly handle JSON_PATH format. Verify the template_format field accepts the new enum value.
- status: complete
- dependencies: graphql-schema-update

---

## Phase 3: Frontend Type Definitions

### frontend-template-format-enum

- content: Add JSON_PATH to TemplateFormats enum in `app/src/components/templateEditor/constants.ts`. Add appropriate regex pattern comment like the existing formats. JSON_PATH uses single brackets with JSONPath syntax: `{$.path.to.value}`.
- status: complete
- dependencies: graphql-schema-update

### frontend-types-update

- content: Update TypeScript types in `app/src/components/templateEditor/types.ts` to include JSON_PATH. Ensure `isTemplateFormat()` type guard handles the new format.
- status: complete
- dependencies: frontend-template-format-enum

---

## Phase 4: Frontend Parser & Language Support

### frontend-jsonpath-grammar

- content: Create Lezer grammar for JSON_PATH templating in `app/src/components/templateEditor/language/jsonPath/`. Follow the pattern of fString and mustacheLike directories. Grammar should parse `{$.path}` syntax with escape sequence `\{`. Create the .grammar file defining TemplateContent, Variable, Text, and Escape nodes.
- status: complete
- dependencies: frontend-types-update

### frontend-jsonpath-language

- content: Create the JSON_PATH language support module in `app/src/components/templateEditor/language/jsonPath/jsonPathTemplating.ts`. Export `formatJSONPath()`, `extractVariablesFromJSONPath()`, and `JSONPathTemplating()` CodeMirror extension. Follow the pattern of fStringTemplating.ts and mustacheLikeTemplating.ts.
- status: complete
- dependencies: frontend-jsonpath-grammar

### frontend-language-utils-update

- content: Update `app/src/components/templateEditor/templateEditorUtils.ts` to handle JSON_PATH format. Add JSON_PATH case to `getTemplateFormatUtils()` function to return the appropriate format and extractVariables functions.
- status: complete
- dependencies: frontend-jsonpath-language

### frontend-parser-tests

- content: Add tests for JSON_PATH parsing in `app/src/components/templateEditor/language/__tests__/`. Test variable extraction for various JSONPath expressions ($.simple, $.nested.path, $.array[0], $.deep[0].nested), escape handling, and format substitution.
- status: complete
- dependencies: frontend-language-utils-update

---

## Phase 5: Template Editor Integration

### frontend-template-editor-update

- content: Update `app/src/components/templateEditor/TemplateEditor.tsx` to support JSON_PATH format. Add case for JSON_PATH in the syntax highlighting extension selection, importing and using JSONPathTemplating extension.
- status: complete
- dependencies: frontend-jsonpath-language

---

## Phase 6: Playground UI Integration

### frontend-playground-radio-group

- content: Update `app/src/pages/playground/TemplateFormatRadioGroup.tsx` to include JSON_PATH as a selectable option. Add appropriate label and description for the new format.
- status: complete
- dependencies: frontend-template-editor-update

### frontend-playground-utils

- content: Update `app/src/pages/playground/playgroundUtils.ts` to handle JSON_PATH format in `extractVariablesFromInstance()` and `extractVariablesFromInstances()`. Ensure variable extraction works with the new format.
- status: complete
- dependencies: frontend-language-utils-update

### frontend-playground-utils-tests

- content: Add tests for JSON_PATH variable extraction in `app/src/pages/playground/__tests__/playgroundUtils.test.ts`. Test extraction from chat messages and text completion prompts using JSON_PATH format.
- status: complete
- dependencies: frontend-playground-utils

---

## Phase 7: JSON Input Editor

### frontend-json-input-component

- content: Create a JSON editor input component for playground variables when using JSON_PATH format. This replaces the per-variable text fields with a single JSON editor. Reference the pattern used in EvaluatorInputMapping for JSON input handling. Consider using CodeMirror with JSON language support.
- status: complete
- dependencies: frontend-playground-radio-group

### frontend-playground-input-integration

- content: Update PlaygroundInput component to conditionally render the JSON editor (instead of individual variable fields) when JSON_PATH format is selected. The JSON editor should provide the data object that JSON paths query against.
- status: complete
- dependencies: frontend-json-input-component

### frontend-path-autocomplete

- content: Add path autocomplete suggestions for JSON_PATH variables in the template editor. Use `flattenObject()` utility (from `app/src/utils/jsonUtils.ts`) to generate path suggestions from the input JSON data. Reference EvaluatorInputMapping's `useFlattenedEvaluatorInputKeys` pattern.
- status: pending
- dependencies: frontend-playground-input-integration

---

## Phase 8: Backend Integration & Subscriptions

### backend-subscription-update

- content: Update `src/phoenix/server/api/subscriptions.py` to handle JSON_PATH format in `_format_messages()` and `_template_formatter()`. Ensure chat completion subscriptions properly format messages with JSON_PATH templates.
- status: pending
- dependencies: backend-template-formatter, graphql-input-types

### backend-mutations-update

- content: Update `src/phoenix/server/api/mutations/chat_mutations.py` to handle JSON_PATH format when processing prompt templates. Ensure mutations that format templates work with the new format.
- status: pending
- dependencies: backend-subscription-update

---

## Phase 9: End-to-End Testing

### integration-test-backend

- content: Add integration tests for JSON_PATH template formatting in the backend. Test the full flow of creating a prompt version with JSON_PATH format and formatting messages with JSON path variables.
- status: pending
- dependencies: backend-mutations-update

### e2e-test-playground

- content: Add E2E test for JSON_PATH template format in the playground. Use Playwright to test: selecting JSON_PATH format, entering a template with JSON path expressions, providing JSON input data, and running the prompt. Verify the template is correctly formatted.
- status: pending
- dependencies: frontend-path-autocomplete, integration-test-backend

### visual-test-playground

- content: Perform visual testing of the JSON_PATH feature using agent-browser CLI. Verify: template format selector shows JSON_PATH option, JSON editor appears for input, syntax highlighting works for JSON path expressions, autocomplete suggestions appear, and prompt execution works correctly.
- status: pending
- dependencies: e2e-test-playground
