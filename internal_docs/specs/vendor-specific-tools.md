# Vendor-Specific Tools

## Summary

Phoenix prompt versions and playground instances need to represent the tool definitions used by LLM providers. Some tools are portable function tools with a common semantic shape. Other tools are vendor-specific JSON objects, such as web search, code execution, file search, computer use, or provider-specific connector definitions.

This spec defines a tool model with two variants in a single ordered list:

- Function tools: normalized, provider-portable tool definitions.
- Raw tools: JSON tool definitions preserved as provider-specific passthrough values.

The model keeps function tools structured while allowing Phoenix to preserve and replay vendor-specific tool definitions without lossy normalization.

## Goals

- Preserve tool definitions from prompt versions, playground edits, and traced spans.
- Keep function tools portable across providers.
- Support vendor-specific tools without requiring Phoenix to understand every vendor schema.
- Make raw vendor-specific tools visible and editable as JSON.
- Avoid dropping non-function tools when opening traces in the playground.
- Prevent raw provider-specific tools from being carried across incompatible provider or API changes.

## Non-Goals

- Phoenix does not define a universal schema for every vendor-specific tool.
- Phoenix does not semantically validate raw vendor-specific tools.
- Phoenix does not translate arbitrary vendor-specific tools between providers.
- Phoenix does not infer credentials, authentication, or runtime configuration for external tool connectors.
- Phoenix does not guarantee that a raw tool accepted by one provider is valid for another provider.

## Terminology

Function tool:
A tool with a normalized function definition. It has a name, optional description, JSON schema parameters, and optional strictness.

Raw tool:
A JSON object that Phoenix stores and sends as-is. Raw tools are used for vendor-specific tool definitions that do not fit the normalized function-tool model.

Tool list:
An ordered list containing function tools and raw tools. Order is preserved.

Canonical representation:
The provider-independent representation Phoenix uses for function tools.

Display representation:
The provider-specific JSON shape shown in the playground editor for a function tool.

OpenAI API type:
For OpenAI and Azure OpenAI providers, the selected API surface: Chat Completions or Responses.

## Design Principles

### Preserve What Phoenix Cannot Interpret

Tool definitions are part of a prompt's executable context. If Phoenix cannot normalize a tool definition without losing fields, it should preserve the original JSON object instead of dropping it or partially converting it.

### Normalize Only Shared Semantics

Function tools have a common cross-provider semantic shape. Phoenix can normalize them safely because the core fields are portable:

- `name`
- `description`
- `parameters`
- `strict`

Vendor-specific tools do not share this property. Similar names, such as "web search" or "code execution", do not imply compatible configuration schemas.

### Make Provider-Specific State Explicit

Raw tools are provider-specific JSON. They are editable, copyable, and deletable, but Phoenix does not present them as portable abstractions.

### Avoid Unsafe Carryover

Function tools can survive provider changes because Phoenix can render them into the selected provider's expected function-tool shape. Raw tools are not portable, so Phoenix drops them when the provider or provider API type changes.

## Data Model

### Python Prompt Types

Prompt tools are represented as a list of discriminated tool objects.

```python
class PromptToolFunctionDefinition(DBBaseModel):
    name: str
    description: str = UNDEFINED
    parameters: dict[str, Any] = UNDEFINED
    strict: bool = UNDEFINED


class PromptToolFunction(DBBaseModel):
    type: Literal["function"]
    function: PromptToolFunctionDefinition


class PromptToolRaw(DBBaseModel):
    type: Literal["raw"]
    raw: dict[str, Any]


PromptTool: TypeAlias = Annotated[
    Union[PromptToolFunction, PromptToolRaw],
    Field(..., discriminator="type"),
]


class PromptTools(DBBaseModel):
    type: Literal["tools"]
    tools: Annotated[list[PromptTool], Field(..., min_length=1)]
    tool_choice: PromptToolChoice = UNDEFINED
    disable_parallel_tool_calls: bool = UNDEFINED
```

### GraphQL Shape

The GraphQL API exposes the same two variants.

```graphql
union PromptToolFunctionPromptToolRaw = PromptToolFunction | PromptToolRaw

type PromptTools {
  tools: [PromptToolFunctionPromptToolRaw!]!
  toolChoice: PromptToolChoice
  disableParallelToolCalls: Boolean
}

input PromptToolInput @oneOf {
  function: PromptToolFunctionDefinitionInput
  raw: JSON
}

input PromptToolsInput {
  tools: [PromptToolInput!]!
  toolChoice: PromptToolChoiceInput = null
  disableParallelToolCalls: Boolean = null
}
```

### TypeScript Playground Types

The frontend keeps the same distinction in store state.

```typescript
type FunctionTool = {
  kind: "function";
  id: number;
  editorType: PhoenixToolEditorType;
  definition: CanonicalToolDefinition;
};

type RawTool = {
  kind: "raw";
  id: number;
  editorType: PhoenixToolEditorType;
  raw: Record<string, unknown>;
};

type Tool = FunctionTool | RawTool;

type PlaygroundInstance = {
  tools: Tool[];
  toolChoice?: CanonicalToolChoice | null;
};
```

## Storage Format

Function tools are stored as structured objects.

```json
{
  "type": "tools",
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "get_weather",
        "description": "Get the current weather.",
        "parameters": {
          "type": "object",
          "properties": {
            "city": {
              "type": "string"
            }
          },
          "required": ["city"]
        },
        "strict": true
      }
    }
  ],
  "tool_choice": {
    "type": "zero_or_more"
  }
}
```

Raw tools are stored as JSON objects inside the same ordered tool list.

```json
{
  "type": "tools",
  "tools": [
    {
      "type": "raw",
      "raw": {
        "type": "web_search",
        "search_context_size": "medium"
      }
    }
  ],
  "tool_choice": {
    "type": "zero_or_more"
  }
}
```

A prompt may contain both function tools and raw tools in the same ordered list.

## Conversion Rules

### Function Tool to Provider Display JSON

Function tools are stored canonically. The playground renders them into provider-specific display JSON using the selected model provider.

The display JSON can be edited by the user. Phoenix then attempts to classify the edited JSON object again:

- If it can be interpreted as a function tool, Phoenix converts it into the canonical function-tool representation.
- If it is a JSON object but cannot be interpreted as a function tool, Phoenix preserves it as a raw tool.

"Can be interpreted as a function tool" means Phoenix can convert the provider display object without dropping any provider wrapper fields. JSON Schema fields nested under the function parameters are preserved as part of the canonical `parameters` object, including keywords Phoenix does not explicitly understand. If the provider wrapper contains fields that do not map to `name`, `description`, `parameters`, or `strict`, Phoenix stores the entire object as a raw tool instead of partially normalizing it.

### Provider Display JSON to Function Tool

If a JSON tool object can be interpreted as a function tool, Phoenix converts it into the canonical function-tool representation.

If the object cannot be interpreted as a function tool, Phoenix should preserve it as a raw tool rather than reject it solely because it is vendor-specific.

This classification is symmetric. A tool that was previously stored as a function tool can become a raw tool after editing, and a tool that was previously stored as a raw tool can become a function tool after editing.

OpenAI Responses function tools use a flat shape and should normalize to function tools:

```json
{
  "type": "function",
  "name": "get_weather",
  "description": "Get the current weather for a location.",
  "parameters": {
    "type": "object",
    "properties": {
      "city": {
        "type": "string"
      }
    },
    "required": ["city"]
  },
  "strict": true
}
```

### Raw Tool Passthrough

Raw tools do not use provider display conversion. The editor value is the stored value, and the stored value is the value sent to the provider.

Phoenix may format the JSON for readability, but it must not rename fields, remove fields, or rewrite the structure.

## Playground Behavior

### Adding Tools

When a playground instance has no tools, the UI may offer separate entry points for:

- Function tool: creates a canonical function tool.
- Raw JSON tool: creates a raw tool with a small starter object.

When a playground instance already has tools, adding another function tool should preserve existing tools and append the new function tool. Adding raw JSON tools may be exposed as a separate action where the UI supports it.

### Editing Tools

All tools use the JSON editor. On each valid JSON object edit, Phoenix reclassifies the edited object:

1. If the object is a supported function-tool shape, store a function tool.
2. Otherwise, store a raw tool.

Function tools are rendered into the selected provider's display representation before editing. Raw tools are rendered as their stored JSON object.

Validation requirements:

- The value must be syntactically valid JSON.
- The value must be a JSON object to update the tool state.
- Provider-specific semantic validation is left to the provider API.

Invalid or non-object JSON does not overwrite the last valid tool state. The editor should surface JSON syntax errors locally; save or execution uses the latest valid stored value.

### Provider Changes

When the selected provider changes:

- Function tools are retained.
- Raw tools are dropped.
- Tool choice is recalculated from the remaining function tools.
- Message tool calls are converted to the new provider format where supported.

Raw tools are dropped because their JSON shape is provider-specific.

### Provider API Type Changes

When a provider has multiple API types and the API type changes, raw tools are dropped. Function tools are retained.

For example, a raw OpenAI Responses API tool object should not be assumed valid for Chat Completions.

When opening spans or prompt versions for OpenAI or Azure OpenAI, Phoenix should infer the OpenAI API type from tool shapes when explicit connection configuration is unavailable. Responses-only tool objects such as `tool_search` or `namespace` imply the Responses API.

## Trace Ingestion

Traced spans may include tool definitions as serialized JSON attributes. Phoenix should parse each tool definition independently.

For each traced tool:

1. Parse the serialized JSON.
2. If it can be normalized to a function tool, create a function tool.
3. If it is a JSON object but not a function tool, create a raw tool.
4. If it is not parseable or not an object, report a parsing error for that tool.

This behavior allows "Open in Playground" to preserve vendor-specific tools captured by instrumentation.

OpenAI Responses function tools with flat `type: "function"` shapes are normalized to canonical function tools. Responses-only non-function tools are preserved as raw tools.

## Prompt Version Behavior

Prompt versions should round-trip tool lists without losing raw tools.

Required round trips:

- GraphQL input to database storage.
- Database storage to GraphQL output.
- GraphQL output to playground instance.
- Playground instance to GraphQL input.
- Prompt version to SDK code snippets where supported.

Function tools should remain normalized across these boundaries. Raw tools should remain equivalent at the JSON data model level, ignoring formatting and key ordering.

## Evaluator Behavior

LLM evaluators use prompt tools to define structured evaluator outputs. That contract depends on canonical function-tool parameters, especially the `label` and optional `explanation` properties.

Evaluator prompts are therefore function-tool-only:

- Evaluator validation should reject raw tools.
- Evaluator validation should reject mixed tool lists that include raw tools.
- Evaluator UI code may read prompt tool unions, but it should infer evaluator output shape only from function tools.

Raw tools remain supported for prompt storage, playground execution, trace ingestion, and SDK export. They are not valid evaluator output definitions.

## SDK Code Snippets

When generating SDK snippets:

- Function tools should be serialized into the target SDK's expected function-tool format.
- Raw tools should be emitted as raw tool objects.
- Tool choice should be emitted only when the target SDK and selected provider support the represented choice.

If a target SDK accepts a generic `tools` array, Phoenix may render raw tools directly. Phoenix should not claim provider validation has occurred.

TypeScript SDK helper functions should model the API tool union. They should convert function tools through the normal provider conversion path and pass raw tools through to the target SDK payload where the target SDK accepts raw tool objects.

## Validation

Phoenix performs structural validation:

- A tool list must contain at least one tool when present.
- Function tools must satisfy the canonical function-tool schema.
- Raw tools must be JSON objects.
- Tool choice must be structurally valid.

Phoenix does not perform vendor semantic validation for raw tools.

Examples of validation delegated to providers:

- Whether `type: "web_search"` is available for the selected model.
- Whether a field such as `search_context_size` accepts a particular value.
- Whether a connector definition has valid authorization.
- Whether a tool is compatible with streaming.

## Security and Secrets

Raw tools may contain vendor-specific configuration. They should not be used as a credential store.

Guidelines:

- Credentials should use Phoenix credential configuration where possible.
- UI copy should not encourage embedding API keys or bearer tokens in raw tools.
- If a provider requires credentials inside a tool definition, the value is user-provided prompt or runtime configuration and should be treated as sensitive user input.
- Logs and errors should avoid printing full raw tool definitions when they may contain secrets.

## Error Handling

Parsing errors should be explicit and localized.

Recommended behavior:

- Invalid JSON in the editor is surfaced locally and does not update stored tool state.
- A non-object JSON value in the editor is ignored and does not update stored tool state.
- A traced tool that cannot be parsed is omitted and a parsing error is surfaced.
- Provider API errors are displayed as provider execution errors, not Phoenix schema errors.

Phoenix should not silently drop valid JSON object tools only because they are not function tools.

## Testing Requirements

Unit tests should cover:

- Function tool parsing and serialization.
- Raw tool parsing and serialization.
- Symmetric editor reclassification between function and raw tools.
- Mixed ordered tool lists.
- Provider changes dropping raw tools and keeping function tools.
- Provider API type changes dropping raw tools.
- OpenAI Responses API type inference from Responses-only tool shapes.
- OpenAI Responses flat function tools normalizing to function tools.
- Trace ingestion preserving non-function JSON tools as raw tools.
- GraphQL mutation inputs accepting function and raw tool variants.
- Prompt version queries returning both variants.
- SDK snippets emitting raw tools as raw objects.
- Evaluator validation rejecting raw tools and mixed function/raw tool lists.

Integration tests should cover:

- Creating a prompt version with raw tools.
- Reading the same prompt version through GraphQL and client APIs.
- Opening a trace with raw vendor tools in the playground.
- Running playground execution with a raw tool for a provider that accepts it.

## Open Questions

- Should the UI offer provider-specific starter templates for common raw tools such as web search or code execution?
- Should Phoenix warn before dropping raw tools on provider changes?
- Should raw tools support per-tool labels or descriptions for UI display without changing the provider payload?
- Should SDK snippet generation include comments when raw tools are emitted?

## Acceptance Criteria

- Phoenix can store prompt versions containing function tools, raw tools, or both.
- Raw tools round-trip through GraphQL without structural changes.
- Opening a span with vendor-specific JSON tools preserves those tools in the playground.
- Changing provider or provider API type removes raw tools and retains function tools.
- Function-tool behavior remains compatible with existing prompts.
- Raw tools are shown and edited as JSON objects.
- Tests cover storage, GraphQL, playground, trace ingestion, and code snippet behavior.
