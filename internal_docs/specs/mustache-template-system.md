# Mustache Template System for Server Evaluators

## What We Built

This feature introduces full Mustache template support for Phoenix's server-side evaluators, enabling built-in classification evaluator templates to work seamlessly with structured data while maintaining compatibility with the Python/TypeScript evals libraries.

### Key Capabilities

1. **Native Mustache Rendering**: Replaced regex-based placeholder substitution with proper Mustache parsing and rendering using `pystache` (Python) and `mustache` (TypeScript)

2. **Formatter Overlay System**: A mechanism to inject server-specific Mustache snippets into base templates without modifying the original templates used by the evals libraries

3. **Type-Aware Variable Extraction**: Templates now distinguish between string variables (`{{name}}`) and section variables (`{{#list}}...{{/list}}`), enabling proper input schema generation

4. **Frontend Validation**: Real-time validation of Mustache syntax in the playground with descriptive error messages for section mismatches

5. **Frontend/Backend Parity**: Python and TypeScript implementations use identical algorithms for variable extraction

---

## How We Built It

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Template Definition Layer                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  prompts/classification_evaluator_configs/                                  │
│  ├── FAITHFULNESS_CLASSIFICATION_EVALUATOR_CONFIG.yaml  (base templates)   │
│  ├── TOOL_INVOCATION_CLASSIFICATION_EVALUATOR_CONFIG.yaml                  │
│  └── ...                                                                    │
│                                                                             │
│  prompts/formatters/server.yaml                                             │
│  └── Named Mustache snippets for structured data transformations            │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Substitution Expansion Layer                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  src/phoenix/server/api/helpers/substitutions.py                           │
│                                                                             │
│  At config load time:                                                       │
│  1. Load substitution definitions from server.yaml                          │
│  2. For each message, expand {{placeholder}} → full Mustache block         │
│  3. Return expanded template ready for rendering                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Variable Extraction Layer                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  Python: src/phoenix/utilities/template_formatters.py                       │
│  TypeScript: app/src/components/templateEditor/.../mustacheLikeTemplating.ts│
│                                                                             │
│  parse_with_types() / extractVariablesFromMustacheLike():                  │
│  1. Parse template with native Mustache parser                              │
│  2. Walk parse tree, track depth (0 = top-level)                           │
│  3. Extract only top-level variables (not nested inside sections)          │
│  4. Tag variables as "string" or "section" type                            │
│  5. For dotted paths (output.tools), extract only root (output)            │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Input Schema Generation                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  src/phoenix/server/api/evaluators.py :: LLMEvaluator.input_schema         │
│                                                                             │
│  For each extracted variable:                                               │
│  ├── Section variables → {} (empty schema, accepts any JSON type)          │
│  └── String variables → {"type": "string"}                                 │
│                                                                             │
│  All variables marked as required                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Input Mapping Layer                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  Frontend: app/src/components/evaluators/EvaluatorInputMapping.tsx         │
│  Backend:  src/phoenix/server/api/evaluators.py :: apply_input_mapping()   │
│                                                                             │
│  UI Flow:                                                                   │
│  1. Display one row per template variable from input_schema                │
│  2. User configures: path mapping (JSONPath) OR literal value              │
│  3. Mappings stored as { pathMapping: {...}, literalMapping: {...} }       │
│                                                                             │
│  Resolution Priority:                                                       │
│  1. Literal mappings (override everything)                                  │
│  2. Path mappings (JSONPath expressions against context)                   │
│  3. Direct context keys (fallback if key exists in schema but not mapped)  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Template Rendering Layer                            │
├─────────────────────────────────────────────────────────────────────────────┤
│  src/phoenix/server/api/evaluators.py :: LLMEvaluator.evaluate()           │
│                                                                             │
│  Pipeline:                                                                  │
│  1. apply_input_mapping() → resolve context to template variables          │
│  2. cast_template_variable_types() → convert non-strings for string vars   │
│  3. validate_template_variables() → JSON Schema validation                 │
│  4. template_formatter.format() → pystache.render() with variables         │
│  5. Send formatted messages to LLM                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Roles

| Component                                                              | Role                                                                                                 |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Base Templates** (`prompts/classification_evaluator_configs/*.yaml`) | Define evaluator prompt templates with simple placeholders. Used by both evals libraries and server. |
| **Formatters** (`prompts/formatters/server.yaml`)                      | Named Mustache snippets that handle structured data (tool calls, available tools). Server-specific.  |
| **Substitution Expander** (`substitutions.py`)                         | Expands simple `{{placeholder}}` into full Mustache sections at config load time.                    |
| **Template Formatter** (`template_formatters.py`)                      | Parses templates, extracts variables with types, renders with pystache.                              |
| **Input Schema** (`LLMEvaluator.input_schema`)                         | JSON Schema derived from template variables. Section vars → any type, string vars → string.          |
| **Input Mapping** (`EvaluatorInputMapping.tsx`)                        | UI component for mapping context fields to template variables.                                       |
| **Validation** (`validateMustacheSections()`)                          | Frontend validation with descriptive error messages for template authors.                            |

---

## Key Decisions and Rationale

### 1. Formatter Overlay vs. Modifying Base Templates

**Decision:** Create a separate substitution system that injects Mustache snippets at load time rather than modifying the base templates.

**Rationale:**

- Base templates remain simple string placeholders (`{{input}}`, `{{output}}`), usable by evals libraries without assumptions about data shape
- Server can inject complex Mustache sections (loops, conditionals) for structured OpenAI-style data
- Templates stay readable and maintainable
- Clear separation between library templates and server-specific formatting

**Example:**

```yaml
# Base template (simple, library-compatible)
{{available_tools}}

# After substitution expansion (server-specific)
{{#output.available_tools}}
Tool: {{function.name}}
Description: {{function.description}}
{{/output.available_tools}}
{{^output.available_tools}}
No tools available.
{{/output.available_tools}}
```

### 2. Top-Level Variable Extraction Only

**Decision:** Only extract variables at depth 0 (not nested inside sections).

**Rationale:**

- Variables inside `{{#section}}...{{/section}}` are resolved from the section context, not the root context
- Asking users to provide `function.name` when they already provide `output.available_tools` would be confusing
- Consistent with Mustache semantics: sections change the context for their children

**Example:**

```mustache
{{#output.available_tools}}
  {{function.name}}   ← NOT extracted (depth 1, resolved from each tool)
{{/output.available_tools}}
{{query}}             ← EXTRACTED (depth 0)
```

### 3. Root Variable Extraction for Dotted Paths

**Decision:** For `{{output.available_tools}}`, extract only `output` as the required variable.

**Rationale:**

- Mustache traverses nested properties automatically: `context["output"]["available_tools"]`
- User only needs to provide the root object; Mustache handles the rest
- Simplifies input mapping: map `output` → entire output object, not individual nested fields

### 4. Type-Aware Schema Generation

**Decision:** Section variables (`{{#var}}`) get empty schemas (accept any type); string variables (`{{var}}`) get `{"type": "string"}`.

**Rationale:**

- Sections iterate over arrays or conditionally render based on truthiness → need to accept any JSON type
- Simple interpolation expects string values → enforce type constraint
- Enables automatic type casting in the pipeline (non-strings → string for string vars)

### 5. Native Parser First, Regex Fallback for Errors

**Decision:** Use native Mustache parsers for validation and extraction, with regex fallback only for generating descriptive error messages.

**Rationale:**

- Native parsers (`pystache.parse()`, `Mustache.parse()`) are spec-compliant and handle edge cases correctly
- When parsing fails, regex-based stack analysis can identify _which_ section is unclosed
- Best of both worlds: correct validation + helpful error messages

### 6. Frontend/Backend Parity for Variable Extraction

**Decision:** Python and TypeScript use identical depth-tracking algorithms.

**Rationale:**

- Frontend needs to know which variables to display in input mapping UI
- Backend generates the canonical input_schema
- If algorithms differed, UI could show wrong variables or miss some
- Single algorithm, two implementations, same results

---

## Variable Identification and Input Mapping Flow

### How the UI Identifies Required Variables

```
┌──────────────────────────────────────────────────────────────────┐
│  User edits template in Playground                               │
│  "You are evaluating {{input}}\n{{#output.tools}}..."           │
└───────────────────────────────┬──────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│  extractVariablesFromMustacheLike() in frontend                  │
│                                                                  │
│  1. Mustache.parse() → token tree                                │
│  2. walkTokens(tokens, depth=0)                                  │
│  3. For each token:                                              │
│     - "#" or "^" at depth 0 → add root name, recurse depth+1   │
│     - "name"/"&"/"{" at depth 0 → add root name                 │
│  4. Return: ["input", "output"]                                  │
└───────────────────────────────┬──────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│  EvaluatorInputMapping component renders                         │
│                                                                  │
│  For each variable:                                              │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  input    [Path ▼] [$.attributes.input.value          ▼]  │ │
│  │  output   [Literal] [__________________________]          │ │
│  └────────────────────────────────────────────────────────────┘ │
└───────────────────────────────┬──────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│  Mapping stored in evaluator state                               │
│                                                                  │
│  {                                                               │
│    pathMapping: { "input": "$.attributes.input.value" },        │
│    literalMapping: { "output": "custom value" }                 │
│  }                                                               │
└──────────────────────────────────────────────────────────────────┘
```

### How Input Mapping + Mustache Are Combined at Evaluation Time

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Context (from dataset example or span)                                     │
│  {                                                                          │
│    "attributes": {                                                          │
│      "input": { "value": "What is 2+2?" },                                 │
│      "output": { "value": "4", "tools": [...] }                            │
│    }                                                                        │
│  }                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  apply_input_mapping()                                                      │
│                                                                             │
│  Input:                                                                     │
│    - input_schema: { properties: { input: {type: string}, output: {} } }   │
│    - pathMapping: { "input": "$.attributes.input.value" }                  │
│    - literalMapping: { "output": "override" }                              │
│    - context: (above)                                                       │
│                                                                             │
│  Process:                                                                   │
│    1. Apply path mappings: input = jsonpath(context, "$.attributes...")    │
│    2. Apply literal mappings: output = "override"                          │
│    3. Fallback: any schema key not mapped but present in context           │
│                                                                             │
│  Output:                                                                    │
│    { "input": "What is 2+2?", "output": "override" }                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  cast_template_variable_types()                                             │
│                                                                             │
│  For each variable with type: "string" in schema:                          │
│    If value is not a string → convert to string                            │
│                                                                             │
│  Section variables (empty schema) pass through unchanged                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  validate_template_variables()                                              │
│                                                                             │
│  jsonschema.validate(variables, input_schema)                              │
│  - Ensures all required variables present                                   │
│  - Validates types match schema                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  template_formatter.format()                                                │
│                                                                             │
│  pystache.render(template, variables)                                       │
│                                                                             │
│  Template: "Evaluate: {{input}}"                                            │
│  Variables: { "input": "What is 2+2?" }                                    │
│  Result: "Evaluate: What is 2+2?"                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Error Handling and UI Feedback

### Template Validation Errors (Surfaced in Playground UI)

| Error Type                  | Example                           | UI Display                                                              |
| --------------------------- | --------------------------------- | ----------------------------------------------------------------------- |
| **Unclosed Section**        | `{{#items}}...` (no `{{/items}}`) | Yellow warning banner: "Unclosed mustache sections: {{#items}}"         |
| **Mismatched Closing Tag**  | `{{#items}}...{{/item}}`          | Red error banner: "Missing closing tag for {{#items}} before {{/item}}" |
| **Unmatched Closing Tag**   | `{{/items}}` without opener       | Red error banner: "Unmatched closing tag: {{/items}}"                   |
| **Invalid Mustache Syntax** | Parser throws generic error       | Red error banner: "Invalid mustache template: [error message]"          |

### Runtime Errors (During Evaluation)

| Error                     | Cause                                      | Handling                                                                                 |
| ------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Missing required variable | Input mapping didn't provide all variables | `validate_template_variables` raises `ValueError`, evaluation fails with error in result |
| Type mismatch             | Variable doesn't match schema type         | `validate_template_variables` raises `ValueError`                                        |
| Mustache rendering error  | Template has runtime issues                | `TemplateFormatterError` raised, evaluation fails                                        |

---

## Edge Cases

### Handled

1. **Dotted paths in sections**: `{{#output.available_tools}}` correctly extracts `output` as the required variable

2. **Nested sections**: Variables inside sections are not extracted as top-level requirements

3. **Inverted sections**: `{{^items}}No items{{/items}}` handled correctly, `items` extracted

4. **Unescaped variables**: `{{{html}}}` and `{{& html}}` both work, extract `html`

5. **Whitespace in tags**: `{{ name }}` works the same as `{{name}}`

6. **Comments**: `{{! comment }}` ignored during extraction

7. **Dotted keys in input mapping**: Keys like `output.value` properly escaped for react-hook-form

8. **HTML escaping disabled**: Mustache normally escapes HTML; we disable this for prompt templates

### Unhandled / Known Limitations

1. **Playground execution with structured inputs**: Templates can be written with Mustache syntax but running them with structured inputs (objects/arrays) in the playground is not yet supported. Only string variable values work for execution. This should be addressed in a follow-up PR.

2. **Section variable type inference on frontend**: The frontend extracts variable names but doesn't distinguish section vs. string types. It relies on the backend's input_schema for type information.

3. **Dynamic delimiter changes**: Mustache supports changing delimiters (`{{=<% %>=}}`), but this is not used or tested.

4. **Partials**: Mustache partials (`{{> partial}}`) are not used in our templates.

5. **Dot-delimited keys in data**: If your data has keys that literally contain dots (e.g., `{"input.query": "hello world"}`), the template `{{input.query}}` will **not** work. Mustache interprets dots as path separators for nested object traversal, so it looks for `context["input"]["query"]` rather than `context["input.query"]`.

   This is a standard Mustache specification limitation—there is no escape syntax (`{{input\.query}}`) or bracket notation (`{{input["query"]}}`) to access literal dot-containing keys. The Mustache.js maintainers have explicitly declined to add this feature as it would conflict with the existing nested property access syntax.

   **Workaround**: Restructure data to use nested objects (`{"input": {"query": "hello world"}}`) or avoid dots in key names (use underscores: `{"input_query": "hello world"}`).

   Note: This was not supported before this change either—it's inherent to Mustache parsing behavior.

---

## Handling Optional Nested Fields

A common question: what happens when data has optional nested fields like `tool_calls` that may or may not exist?

### Input Mapping vs. Mustache Responsibilities

| Level                                                          | Responsibility                   | Validation                                      |
| -------------------------------------------------------------- | -------------------------------- | ----------------------------------------------- |
| **Top-level variables** (`output`, `input`)                    | Input mapping must provide these | Validated as **required** by JSON Schema        |
| **Nested fields** (`output.messages`, `messages[].tool_calls`) | Mustache handles at render time  | **No validation** - Mustache handles gracefully |

### Example: Optional `tool_calls`

Given data that sometimes has `tool_calls`:

```json
{"output": {"messages": [
  {"role": "assistant", "content": "Hello", "tool_calls": [...]},
  {"role": "assistant", "content": "World"}  // no tool_calls
]}}
```

The `server.yaml` formatter handles this with sections and inverted sections:

```mustache
{{#output.messages}}
Message: {{role}}: {{content}}
{{#tool_calls}}
- {{function.name}}({{function.arguments}})
{{/tool_calls}}
{{^tool_calls}}
No tools called.
{{/tool_calls}}
{{/output.messages}}
```

- `{{#tool_calls}}...{{/tool_calls}}` - Renders only if `tool_calls` exists and is truthy
- `{{^tool_calls}}...{{/tool_calls}}` - Renders when `tool_calls` is missing, `null`, `false`, or empty array

### Key Points

1. **You do NOT need to set `None` defaults for optional nested fields** - Mustache sections handle missing/null/empty values gracefully

2. **Top-level variables MUST be provided** - If your template uses `{{output}}` or `{{#output.messages}}`, then `output` must be mapped via input mapping

3. **Use sections for optional data** - Always wrap potentially-missing nested fields in `{{#field}}...{{/field}}` sections, not bare `{{field}}` references

4. **Inverted sections for fallbacks** - Use `{{^field}}...{{/field}}` to render fallback content when a field is missing

---

## Open Questions

1. **Should the UI show different indicators for section vs. string variables?**
   - Currently both show the same input mapping UI
   - Section variables accept any JSON type, which might confuse users expecting string inputs

2. **Should we validate substitution expansions at config load time?**
   - Currently we log warnings for missing substitutions but don't fail
   - Could be more strict to catch config errors early

3. **Should frontend extraction also return type information?**
   - Would enable richer UI (e.g., showing that a variable expects an array)
   - Currently relies on server's GraphQL response for input_schema

---

## Files Changed (Key Components)

### Python

- `src/phoenix/utilities/template_formatters.py` - Core Mustache parsing/rendering with pystache
- `src/phoenix/server/api/helpers/substitutions.py` - Substitution expansion logic
- `src/phoenix/server/api/evaluators.py` - Input schema generation, input mapping, evaluation pipeline
- `prompts/formatters/server.yaml` - Named Mustache snippet definitions
- `prompts/classification_evaluator_configs/*.yaml` - Evaluator templates with optional substitutions

### TypeScript

- `app/src/components/templateEditor/language/mustacheLike/mustacheLikeTemplating.ts` - Frontend Mustache parsing, variable extraction, validation
- `app/src/components/evaluators/EvaluatorInputMapping.tsx` - Input mapping UI
- `app/src/pages/playground/PlaygroundChatTemplate.tsx` - Template editor with validation banners

### Dependencies Added

- `pystache` (Python) - Native Mustache rendering
- `mustache` (TypeScript) - Already present, version 4.2.0
