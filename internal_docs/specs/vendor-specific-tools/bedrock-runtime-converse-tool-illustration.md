# Amazon Bedrock Runtime — `Converse` tool configuration (`types-aiobotocore-bedrock-runtime`)

Illustrative JSON for **`toolConfig`** on **`converse`** / **`converse_stream`**, derived from the TypedDefs in **`types_aiobotocore_bedrock_runtime`**. Field names match the [Converse API](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_Converse.html): **PascalCase** keys in JSON; boto3 / aiobotocore accept the same keys in Python `dict` form.

**Reading order:** **`toolConfig.tools`** lists what the model may call (**`toolSpec`**, **`systemTool`**, or **`cachePoint`** per entry). **`toolConfig.toolChoice`** (covered [in detail below](#tool-choice-configuration-toolchoice)) steers *whether* the model must call a tool. Appendix A sketches **`toolUse`** / **`toolResult`** message blocks for the request/response loop.

**Source (verified):** **`types_aiobotocore_bedrock_runtime/type_defs.pyi`** in package **types-aiobotocore-bedrock-runtime 3.1.1** (line ranges are approximate—open the file in your environment after upgrades). Primary types: `ToolConfigurationTypeDef`, `ToolTypeDef`, `ToolSpecificationTypeDef`, `ToolInputSchemaTypeDef`, `SystemToolTypeDef`, `ToolChoiceTypeDef`, `SpecificToolChoiceTypeDef`, `ConverseRequestTypeDef`.

**Client:** `types_aiobotocore_bedrock_runtime.client.BedrockRuntimeClient` — `async def converse(self, **kwargs: Unpack[ConverseRequestTypeDef])`.

---

## `toolConfig` — `ToolConfigurationTypeDef`

```json
{
  "toolConfig": {
    "tools": [],
    "toolChoice": {}
  }
}
```

- **`tools`**: required in practice when using tools; sequence of **`ToolTypeDef`** (see below).
- **`toolChoice`**: optional; **`ToolChoiceTypeDef`**.

**Insight:** `toolConfig` is **per `converse` request**—there is no server-side registry; keep tool definitions stable for the whole session or you risk cache misses and inconsistent `toolUseId` routing.

---

## `tools[]` — `ToolTypeDef` (one variant per element)

Each tool entry is an object with **at most one** of the following (by API contract; the stub marks all branches `NotRequired`):

| Branch | Type (stub) | Role |
|--------|-------------|------|
| `toolSpec` | `ToolSpecificationTypeDef` | User-defined function / JSON-schema tool |
| `systemTool` | `SystemToolTypeDef` | Built-in **system** tool (name only in stub) |
| `cachePoint` | `CachePointBlockTypeDef` | Prompt cache checkpoint |

**Insight:** Only one branch should be semantically “active” per list element—sending conflicting keys may be rejected or undefined depending on the serializer. Order tools with **cache points** where the AWS prompt-cache docs recommend to maximize reuse.

### 1. `toolSpec` — `ToolSpecificationTypeDef`

- **`name`** (required): tool name.
- **`inputSchema`** (required): **`ToolInputSchemaTypeDef`** — JSON Schema lives under **`json`** (optional in stub but required for real calls).
- **`description`**: optional.

**Insight:** Tool names must match **`[a-zA-Z0-9_-]+`** and length limits in the AWS API—avoid dots or spaces. When **`strict`** is supported for your model, treat it like JSON-schema enforcement on `input` before your handler runs side effects.

```json
{
  "toolSpec": {
    "name": "get_weather",
    "description": "Get the current weather for a location.",
    "inputSchema": {
      "json": {
        "type": "object",
        "properties": {
          "city": {
            "type": "string",
            "description": "City name"
          },
          "unit": {
            "type": "string",
            "enum": ["celsius", "fahrenheit"]
          }
        },
        "required": ["city"]
      }
    }
  }
}
```

### 2. `systemTool` — `SystemToolTypeDef`

Stub is only:

```python
class SystemToolTypeDef(TypedDict):
    name: str
```

Illustrative shape:

```json
{
  "systemTool": {
    "name": "system_tool_name_per_bedrock_docs"
  }
}
```

Allowed **`name`** values are **not** enumerated in these stubs; use the current [Amazon Bedrock Converse API](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_Tool.html) / model documentation for system tools (e.g. web search, grounding) and model support.

**Insight:** System tools are **model-specific**—a name that works on Claude 3.5 may not exist on Nova or Titan. Treat `systemTool` as an allowlist you configure per **`modelId`**, not a global constant in your app.

### 3. `cachePoint` — `CachePointBlockTypeDef`

```json
{
  "cachePoint": {
    "type": "default"
  }
}
```

(`type` is `Literal["default"]` in the stub, ~320–325.)

**Insight:** Cache points split the prompt into a **prefix that can be reused**—place them after large static system prompts and tool JSON; moving them changes cache hit rates and billing.

---

## `toolChoice` — `ToolChoiceTypeDef`

Exactly one of the following keys is typically set (stub allows `auto`, `any`, `tool` as optional):

### `auto`

```json
{
  "toolChoice": {
    "auto": {}
  }
}
```

`auto` is typed as `Mapping[str, Any]` in the stub—empty object is the common case.

**Insight:** `auto` lets the model **skip** tools when unnecessary; use `any` when you want to **force** some tool interaction (still subject to model capability).

### `any`

```json
{
  "toolChoice": {
    "any": {}
  }
}
```

**Insight:** `any` means “call **some** tool,” not “call **every** tool”—pair with your schema design so at least one tool can satisfy the user query without harmful side effects.

### `tool` — force a specific tool

Uses **`SpecificToolChoiceTypeDef`**: `name` must match a declared tool’s name.

**Insight:** The `name` here must match a **`toolSpec.name`** (or the system tool name) exactly—typos fail at runtime with hard-to-debug 400s. Prefer `auto` in production unless you are pinning behavior in tests.

```json
{
  "toolChoice": {
    "tool": {
      "name": "get_weather"
    }
  }
}
```

---

## Full minimal `converse` excerpt

```json
{
  "modelId": "us.anthropic.claude-3-5-sonnet-20241022-v2:0",
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "text": "What is the weather in Seattle?"
        }
      ]
    }
  ],
  "toolConfig": {
    "tools": [
      {
        "toolSpec": {
          "name": "get_weather",
          "description": "Get weather by city.",
          "inputSchema": {
            "json": {
              "type": "object",
              "properties": {
                "city": { "type": "string" }
              },
              "required": ["city"]
            }
          }
        }
      }
    ],
    "toolChoice": {
      "auto": {}
    }
  }
}
```

**Insight:** This is the smallest valid shape—real apps usually add **`system`**, **`inferenceConfig`**, and **guardrails**; keep `toolConfig` adjacent to the same `modelId` you tested, because tool schemas are not portable across all Bedrock models.

---

## Appendix A: `ToolUse` / `ToolResult` message content (related types)

When the model returns a tool call or you send results back, **`Message`** / **`ContentBlock`** use separate TypedDefs (same `type_defs.pyi`):

**`ToolUseBlockTypeDef`** (~625–633): `toolUseId`, `name`, `input`, optional `type` (`ToolUseTypeType`: `"tool_use"` | `"server_tool_use"`).

**`ToolResultBlockTypeDef`** (~1250–1257): `toolUseId`, `content` (sequence of text/json/image/… blocks), optional `status` (`ToolResultStatusType`: `"success"` | `"error"`).

**Insight:** **`tool_use`** is the usual path: **your application** executes the named tool and returns a **`toolResult`** whose **`toolUseId`** matches the call. **`server_tool_use`** signals a **model- or service-side** tool path; whether you must still send a `toolResult` depends on the **model** and tool (see AWS tool-use docs for your `modelId`). For every `tool_use` you execute locally, echo **`toolUseId`** exactly or the model cannot attach your result to its call.

Illustrative assistant message:

```json
{
  "role": "assistant",
  "content": [
    {
      "toolUse": {
        "toolUseId": "tooluse_01ABC...",
        "name": "get_weather",
        "input": { "city": "Seattle" },
        "type": "tool_use"
      }
    }
  ]
}
```

Illustrative user message with result:

```json
{
  "role": "user",
  "content": [
    {
      "toolResult": {
        "toolUseId": "tooluse_01ABC...",
        "content": [
          {
            "text": "{\"temp_f\": 52, \"condition\": \"cloudy\"}"
          }
        ],
        "status": "success"
      }
    }
  ]
}
```

---

## Appendix B: `ToolUseTypeType` / `ToolResultStatusType`

From `literals.pyi`:

- **`ToolUseTypeType`**: `"server_tool_use"` | `"tool_use"`
- **`ToolResultStatusType`**: `"error"` | `"success"`

**Insight:** Map `status: "error"` when your handler throws—Claude models handle error strings more safely than fake “success” payloads with stack traces.

---

## Tool choice configuration (`toolChoice`)

This section matches the AWS API reference to the JSON shapes shown **[earlier](#toolchoice--toolchoicetypedef)** (`auto`, `any`, `tool`). On **`converse`** / **`converse_stream`**, **`toolConfig.toolChoice`** steers whether the model may skip tools, must call at least one, or must call a **specific** tool by name. It complements **`toolConfig.tools`**: definitions vs selection policy.

**Official docs (API reference)**

- [`ToolChoice`](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_ToolChoice.html) — union of `auto`, `any`, and `tool` (only one member set). Documents behavior: `auto` = model decides (default); `any` = at least one tool call required; `tool` = force the named tool (Claude 3 + Amazon Nova per page).
- [`ToolConfiguration`](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_ToolConfiguration.html) — parent of `tools` and `toolChoice`.
- [`Converse`](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_Converse.html) — top-level request shape including `toolConfig`.

**User guide**

- [Call a tool with the Converse API](https://docs.aws.amazon.com/bedrock/latest/userguide/tool-use-inference-call.html) — end-to-end tool use (linked from the `ToolChoice` API page).

**Types in this doc’s stubs**

- **`ToolChoiceTypeDef`** / **`SpecificToolChoiceTypeDef`**: see the section **`toolChoice` — `ToolChoiceTypeDef`** earlier in this file (`types-aiobotocore-bedrock-runtime` **3.1.1** snapshot).

**Insight:** Forcing `tool` is **model-gated** on Bedrock—if the API reference says only certain families support `tool`, do not rely on it for other `modelId`s. `any` produces no assistant text until a tool call is emitted; design UX accordingly.

---

## Summary

**Insight:** When types-aiobotocore lags AWS, the **API reference** wins—generate a minimal `converse` call from the console or CLI, diff the JSON, then update stubs.

| Concept | Stub name | Key JSON fields |
|---------|-----------|-----------------|
| Whole config | `ToolConfigurationTypeDef` | `tools`, `toolChoice?` |
| One tool entry | `ToolTypeDef` | `toolSpec` \| `systemTool` \| `cachePoint` |
| Custom tool | `ToolSpecificationTypeDef` | `name`, `inputSchema.json` (JSON Schema), `description?` |
| Built-in tool | `SystemToolTypeDef` | `name` |
| Cache marker | `CachePointBlockTypeDef` | `type: "default"` |
| Choice | `ToolChoiceTypeDef` | `auto` \| `any` \| `tool: { name }` |

Stubs follow the **Bedrock Runtime** service model version bundled with **types-aiobotocore-bedrock-runtime 3.1.1**; AWS may add fields or tool names over time—compare with the official **Converse** API reference and your botocore/aiobotocore version.

---

## See also (vendor docs)

Model IDs, Regions, and preview/beta flags change over time; confirm in the links below.

- [Tool use in inference calls](https://docs.aws.amazon.com/bedrock/latest/userguide/tool-use-inference-call.html) — `Converse` / `ConverseStream` tool patterns.
- [Converse API reference](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_Converse.html) — `toolConfig`, messages, and response shape.
- [Tool (API type)](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_Tool.html) — `toolSpec`, `systemTool`, `cachePoint`.
- [ToolSpecification](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_ToolSpecification.html) — `name`, `inputSchema`, optional `strict`.
- [Supported models and features](https://docs.aws.amazon.com/bedrock/latest/userguide/conversation-inference-supported-models-features.html) — tool use and streaming per model.
- [Computer use](https://docs.aws.amazon.com/bedrock/latest/userguide/computer-use.html) — Claude computer / editor / bash tools, beta headers, and `additionalModelRequestFields`.
- [`ToolChoice` (API)](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_ToolChoice.html) — `auto` / `any` / `tool` for `converse`.
