# OpenAI Responses API: `ToolParam` variants

Practical JSON examples for each shape you can pass in the Responses API `tools` array. They follow the TypedDict names in the Python SDK (`openai/types/responses/`), which mirror the HTTP schema. Use a section's example as a starting point and delete fields you do not need.

**Reading order:** Each numbered section is one **kind of tool** the model may call. **`tool_choice`** (documented [below](#tool-choice-configuration-tool_choice)) is a separate request field: it controls *whether* the model must use tools or *which* tool family to prefer—not the tool definitions themselves.

**Full union** (same order as the SDK):

[source](https://github.com/openai/openai-python/blob/58184ad545ee2abd98e171ee09766f259d7f38cd/src/openai/types/responses/tool_param.py#L311-L327)

```python
ToolParam: TypeAlias = Union[
    FunctionToolParam,
    FileSearchToolParam,
    ComputerToolParam,
    ComputerUsePreviewToolParam,
    WebSearchToolParam,
    Mcp,
    CodeInterpreter,
    ImageGeneration,
    LocalShell,
    FunctionShellToolParam,
    CustomToolParam,
    NamespaceToolParam,
    ToolSearchToolParam,
    WebSearchPreviewToolParam,
    ApplyPatchToolParam,
]
```

---

## 1. `FunctionToolParam`

[source](https://github.com/openai/openai-python/blob/58184ad545ee2abd98e171ee09766f259d7f38cd/src/openai/types/responses/function_tool_param.py#L11)

Defines a function the model can call. Core fields: `type`, `name`, `parameters`, `strict`, `description`. You can set `defer_loading` so the tool is loaded later via tool search (see **`ToolSearchToolParam`** below).

**Insight:** With `strict: true`, OpenAI applies **tighter JSON Schema checks** on function arguments so you get more predictable, parse-friendly `tool_calls`. Design `parameters` so required fields and enums are explicit. Keep each tool's `name` **stable across turns** so follow-up messages can match earlier calls.

```json
{
  "type": "function",
  "name": "get_weather",
  "description": "Get the current weather for a location.",
  "parameters": {
    "type": "object",
    "properties": {
      "city": { "type": "string", "description": "City name" },
      "unit": { "type": "string", "enum": ["celsius", "fahrenheit"], "default": "celsius" }
    },
    "required": ["city"]
  },
  "strict": true
}
```

---

## 2. `FileSearchToolParam`

[source](https://github.com/openai/openai-python/blob/58184ad545ee2abd98e171ee09766f259d7f38cd/src/openai/types/responses/file_search_tool_param.py#L49)

Searches uploaded files (vector stores). Requires `type` and `vector_store_ids`.

**Insight:** `hybrid_search` weights trade off dense (embedding) vs lexical matches; raising `score_threshold` reduces noise but can return fewer chunks. Use metadata filters when multiple corpora share one vector store so the model does not pull the wrong tenant’s files.

```json
{
  "type": "file_search",
  "vector_store_ids": ["vs_abc123", "vs_def456"],
  "max_num_results": 20,
  "ranking_options": {
    "ranker": "default-2024-11-15",
    "score_threshold": 0.7,
    "hybrid_search": {
      "embedding_weight": 0.7,
      "text_weight": 0.3
    }
  }
}
```

Minimal:

```json
{
  "type": "file_search",
  "vector_store_ids": ["vs_abc123"]
}
```

---

## 3. Computer use tools

The SDK exposes **two** computer-related tools with different `type` discriminators. Pick the one that matches your integration.

### `ComputerToolParam` (`type`: `"computer"`)

[source](https://github.com/openai/openai-python/blob/58184ad545ee2abd98e171ee09766f259d7f38cd/src/openai/types/responses/computer_tool_param.py#L10)

Minimal computer tool marker (no display or environment fields on the type itself).

**Insight:** Use this when your integration only needs the **generic computer-use capability** flag; pair with whatever environment setup your product handles outside this JSON (or prefer `computer_use_preview` when you want display size explicit in the tool definition).

```json
{
  "type": "computer"
}
```

### `ComputerUsePreviewToolParam` (`type`: `"computer_use_preview"`)

[source](https://github.com/openai/openai-python/blob/58184ad545ee2abd98e171ee09766f259d7f38cd/src/openai/types/responses/computer_use_preview_tool_param.py#L10)

Preview flow with explicit display and environment.

**Insight:** `"computer"` is a minimal capability flag in the SDK; `"computer_use_preview"` is the shape that pins **display geometry and OS/browser environment**, which matters for screenshot coordinate systems and action safety.

```json
{
  "type": "computer_use_preview",
  "display_width": 1920,
  "display_height": 1080,
  "environment": "mac"
}
```

`environment`: one of `"windows"`, `"mac"`, `"linux"`, `"ubuntu"`, `"browser"`.

---

## 4. `WebSearchToolParam`

[source](https://github.com/openai/openai-python/blob/58184ad545ee2abd98e171ee09766f259d7f38cd/src/openai/types/responses/web_search_tool_param.py#L51)

Web search. Type is `web_search` or `web_search_2025_08_26`.

**Insight:** The versioned `type` string (`web_search` vs `web_search_2025_08_26`) tracks **API behavior over time**—stick to the variant you validated with your model. `filters.allowed_domains` limits which domains may appear in results (cost, latency, relevance); add `user_location` when answers should be locale- or region-aware.

```json
{
  "type": "web_search",
  "search_context_size": "medium",
  "filters": {
    "allowed_domains": ["pubmed.ncbi.nlm.nih.gov", "arxiv.org"]
  },
  "user_location": {
    "type": "approximate",
    "country": "US",
    "region": "California",
    "city": "San Francisco",
    "timezone": "America/Los_Angeles"
  }
}
```

Minimal:

```json
{
  "type": "web_search"
}
```

---

## 5. `Mcp`

[source](https://github.com/openai/openai-python/blob/58184ad545ee2abd98e171ee09766f259d7f38cd/src/openai/types/responses/tool_param.py#L114)

Model Context Protocol: connect to a remote MCP server. Requires `type: "mcp"`, `server_label`, and one of `server_url` or `connector_id`.

```json
{
  "type": "mcp",
  "server_label": "my-mcp-server",
  "server_url": "https://mcp.example.com",
  "server_description": "Optional description of the MCP server.",
  "allowed_tools": ["tool_a", "tool_b"],
  "require_approval": "always",
  "authorization": "Bearer <token>",
  "headers": {
    "X-Custom-Header": "value"
  }
}
```

With service connector (one of the fixed `connector_id` values):

```json
{
  "type": "mcp",
  "server_label": "gmail",
  "connector_id": "connector_gmail",
  "require_approval": "never"
}
```

`connector_id` examples: `connector_dropbox`, `connector_gmail`, `connector_googlecalendar`, `connector_googledrive`, `connector_microsoftteams`, `connector_outlookcalendar`, `connector_outlookemail`, `connector_sharepoint`.

`allowed_tools`: array of tool names, or a filter object `{ "read_only": true }` / `{ "tool_names": ["a", "b"] }`.

`require_approval`: `"always"`, `"never"`, or a filter object.

**Insight:** Your app owns **OAuth tokens** and refresh for `authorization`; the API does not complete the auth UI for you. `require_approval` plus `allowed_tools` filters are the main levers for **least privilege** when MCP exposes many server tools.

---

## 6. `CodeInterpreter`

[source](https://github.com/openai/openai-python/blob/58184ad545ee2abd98e171ee09766f259d7f38cd/src/openai/types/responses/tool_param.py#L213)

Runs Python code. Requires `type: "code_interpreter"` and `container` (container ID string or config object).

```json
{
  "type": "code_interpreter",
  "container": "container_abc123"
}
```

With container config (file IDs, memory, network policy):

```json
{
  "type": "code_interpreter",
  "container": {
    "type": "auto",
    "file_ids": ["file-abc", "file-def"],
    "memory_limit": "4g",
    "network_policy": { "type": "disabled" }
  }
}
```

`network_policy` can be `{ "type": "disabled" }` or `{ "type": "allowlist", "allowed_domains": ["https://api.example.com"] }`.

**Insight:** Passing a **container id** string reuses state (files, installs) across turns; `type: "auto"` with `file_ids` is better for one-off runs with uploaded inputs. Treat `network_policy` as your egress boundary—`disabled` is the default-safe choice for untrusted prompts.

---

## 7. `ImageGeneration`

[source](https://github.com/openai/openai-python/blob/58184ad545ee2abd98e171ee09766f259d7f38cd/src/openai/types/responses/tool_param.py#L241)

Generates or edits images. Type is `image_generation`.

```json
{
  "type": "image_generation",
  "model": "gpt-image-1",
  "action": "auto",
  "size": "1024x1024",
  "quality": "high",
  "output_format": "png",
  "background": "auto",
  "moderation": "auto",
  "input_fidelity": "low",
  "output_compression": 100,
  "partial_images": 0
}
```

Minimal:

```json
{
  "type": "image_generation"
}
```

Edit with mask:

```json
{
  "type": "image_generation",
  "action": "edit",
  "input_image_mask": {
    "file_id": "file-xyz",
    "image_url": "data:image/png;base64,..."
  }
}
```

**Insight:** `partial_images` is for **streaming** partial previews; `input_fidelity` and some `model` values are documented as mutually constrained in the SDK—validate the combo for your image model. Edits with `input_image_mask` need a coherent mask + base image pairing or you get wasted generations.

---

## 8. `LocalShell`

[source](https://github.com/openai/openai-python/blob/58184ad545ee2abd98e171ee09766f259d7f38cd/src/openai/types/responses/tool_param.py#L304)

Executes shell commands in a local environment. Only `type` is required.

**Insight:** This implies **commands run in your trust boundary** (developer machine or your runner)—treat it like `eval` on user-influenced strings: sandbox, allowlists, and audit logs matter more than for hosted code interpreter.

```json
{
  "type": "local_shell"
}
```

---

## 9. `FunctionShellToolParam`

[source](https://github.com/openai/openai-python/blob/58184ad545ee2abd98e171ee09766f259d7f38cd/src/openai/types/responses/function_shell_tool_param.py#L17)

Shell tool (remote container or local). Type is `shell`. Optional `environment`.

```json
{
  "type": "shell"
}
```

With auto container:

```json
{
  "type": "shell",
  "environment": {
    "type": "container_auto",
    "memory_limit": "4g",
    "network_policy": { "type": "disabled" }
  }
}
```

With local environment:

```json
{
  "type": "shell",
  "environment": {
    "type": "local"
  }
}
```

With container reference:

```json
{
  "type": "shell",
  "environment": {
    "type": "container_reference",
    "container_id": "container_abc123"
  }
}
```

**Insight:** `container_auto` spins up an isolated environment per session pattern; `container_reference` attaches to an existing container (faster warm reuse); `local` runs on the host—use when latency matters and you accept the risk tradeoff.

---

## 10. `CustomToolParam`

[source](https://github.com/openai/openai-python/blob/58184ad545ee2abd98e171ee09766f259d7f38cd/src/openai/types/responses/custom_tool_param.py#L12)

Custom tool with optional input format. Requires `type: "custom"` and `name`.

```json
{
  "type": "custom",
  "name": "my_custom_tool",
  "description": "Optional description.",
  "format": { "type": "text" }
}
```

With grammar format:

```json
{
  "type": "custom",
  "name": "structured_tool",
  "description": "Accepts input matching a grammar.",
  "format": {
    "type": "grammar",
    "syntax": "lark",
    "definition": "root: WORD+\n%import common.WORD"
  }
}
```

`format.syntax`: `"lark"` or `"regex"`.

**Insight:** Custom tools are how you get **non-JSON or grammar-constrained** tool inputs (e.g. DSLs); the model still returns a structured payload matching `format`, so your executor should validate before side effects.

---

## 11. `WebSearchPreviewToolParam`

[source](https://github.com/openai/openai-python/blob/58184ad545ee2abd98e171ee09766f259d7f38cd/src/openai/types/responses/web_search_preview_tool_param.py#L36)

Preview web search. Type is `web_search_preview` or `web_search_preview_2025_03_11`. Optional `search_content_types` controls which result kinds to return (for example text and/or images). If you include `user_location`, the SDK marks `type: "approximate"` as **required** on that nested object.

```json
{
  "type": "web_search_preview",
  "search_context_size": "medium",
  "search_content_types": ["text", "image"],
  "user_location": {
    "type": "approximate",
    "country": "US",
    "region": "California",
    "city": "San Francisco",
    "timezone": "America/Los_Angeles"
  }
}
```

Minimal:

```json
{
  "type": "web_search_preview"
}
```

**Insight:** Preview variants are useful when experimenting or when your integration targets a **specific dated tool behavior**; `search_content_types` avoids paying for image search when you only need text snippets.

---

## 12. `ApplyPatchToolParam`

[source](https://github.com/openai/openai-python/blob/58184ad545ee2abd98e171ee09766f259d7f38cd/src/openai/types/responses/apply_patch_tool_param.py#L10)

Allows the model to apply unified diffs (create/update/delete files). Only `type` is required.

**Insight:** Treat patches like automated PRs: apply in a **clean git worktree** or copy, run tests, and reject on conflict—models can produce malformed or overlapping hunks. Ideal for coding agents with human or CI review, not blind production writes.

```json
{
  "type": "apply_patch"
}
```

---

## 13. `NamespaceToolParam`

[source](https://github.com/openai/openai-python/blob/58184ad545ee2abd98e171ee09766f259d7f38cd/src/openai/types/responses/namespace_tool_param.py#L31)

Groups `function` and `custom` tools under one namespace so tool calls can be scoped (for example `crm.lookup_contact`). Requires `type`, `name`, `description`, and `tools`.

**Insight:** Namespacing reduces **tool-name collisions** when merging tools from multiple products or teams; your router must accept qualified names end-to-end (logs, metrics, and your dispatcher).

```json
{
  "type": "namespace",
  "name": "crm",
  "description": "Customer records: search contacts and update deals.",
  "tools": [
    {
      "type": "function",
      "name": "lookup_contact",
      "description": "Find a contact by email.",
      "parameters": {
        "type": "object",
        "properties": {
          "email": { "type": "string" }
        },
        "required": ["email"]
      },
      "strict": true
    },
    {
      "type": "custom",
      "name": "import_note",
      "format": { "type": "text" }
    }
  ]
}
```

---

## 14. `ToolSearchToolParam`

[source](https://github.com/openai/openai-python/blob/58184ad545ee2abd98e171ee09766f259d7f38cd/src/openai/types/responses/tool_search_tool_param.py#L11)

Configuration for **deferred** tools: the model can discover functions later via hosted or client-executed tool search. Pair with `defer_loading` on individual tools when applicable.

Minimal:

```json
{
  "type": "tool_search"
}
```

Client-executed search with a small parameter schema:

```json
{
  "type": "tool_search",
  "execution": "client",
  "description": "Search tools registered by this client.",
  "parameters": {
    "type": "object",
    "properties": {
      "query": { "type": "string", "description": "What to search for" }
    },
    "required": ["query"]
  }
}
```

`execution`: `"server"` or `"client"`.

**Insight:** With `execution: "client"`, **your code** implements search over the deferred tool catalog and returns only the subset to load—plan for latency and auth on that path. `execution: "server"` shifts discovery to the hosted side (check model and account support).

---

## Tool choice configuration (`tool_choice`)

`tools` defines **what** the model may call; **`tool_choice`** (on the same Responses request) defines **how** it may choose among them—e.g. free choice, required tool use, force a specific function, force a built-in tool type, or restrict to an allowlist.

**Official docs**

- [Create a response](https://platform.openai.com/docs/api-reference/responses/create) — request body includes `tool_choice` next to `tools`.
- [Function calling](https://platform.openai.com/docs/guides/function-calling) — patterns for tools and tool selection with the Responses API.
- [Using tools](https://platform.openai.com/docs/guides/tools?api-mode=responses) — built-in tools plus how they interact with function tools.

**Python SDK (permalinks)**

- Request field **`tool_choice`** on create-params: [source](https://github.com/openai/openai-python/blob/58184ad545ee2abd98e171ee09766f259d7f38cd/src/openai/types/responses/response_create_params.py#L222-L227)
- **`ToolChoice` union** (options string, `allowed_tools`, hosted `type`, `function`, MCP, custom, shell, apply_patch, …): [source](https://github.com/openai/openai-python/blob/58184ad545ee2abd98e171ee09766f259d7f38cd/src/openai/types/responses/response_create_params.py#L313-L322)
- Shorthand literals **`"none"` / `"auto"` / `"required"`**: [source](https://github.com/openai/openai-python/blob/58184ad545ee2abd98e171ee09766f259d7f38cd/src/openai/types/responses/tool_choice_options.py#L7)
- **Allowlist** object `type: "allowed_tools"` with `mode` + `tools`: [source](https://github.com/openai/openai-python/blob/58184ad545ee2abd98e171ee09766f259d7f38cd/src/openai/types/responses/tool_choice_allowed_param.py#L11-L38)
- **Force a function** `type: "function"` + `name`: [source](https://github.com/openai/openai-python/blob/58184ad545ee2abd98e171ee09766f259d7f38cd/src/openai/types/responses/tool_choice_function_param.py#L10-L17)
- **Force a built-in tool** by `type` (e.g. `file_search`, `web_search_preview`, `code_interpreter`, …): [source](https://github.com/openai/openai-python/blob/58184ad545ee2abd98e171ee09766f259d7f38cd/src/openai/types/responses/tool_choice_types_param.py#L10-L43)

**Insight:** **`tool_choice`** controls *which tools the model is allowed or required to invoke*; **`strict`** on a function (or related types) controls *how tightly arguments are validated*. Those are separate knobs. The **response** may include **`parallel_tool_calls`**—if true, one assistant turn can contain multiple tool calls; your client should handle zero, one, or many per response.

---

## Summary: `type` discriminator

[source](https://github.com/openai/openai-python/blob/58184ad545ee2abd98e171ee09766f259d7f38cd/src/openai/types/responses/tool_param.py#L311-L327)

**Insight:** Built-in tools are identified by the `type` string in the table. User-defined **function** tools use `type: "function"`; **custom** tools use `type: "custom"`. Log the tool `type` and `name` in telemetry so you can correlate behavior, billing, and latency with the right tool definition.

| `type` value | Python type (SDK) |
|--------------|---------------------|
| `function` | `FunctionToolParam` |
| `file_search` | `FileSearchToolParam` |
| `computer` | `ComputerToolParam` |
| `computer_use_preview` | `ComputerUsePreviewToolParam` |
| `web_search` / `web_search_2025_08_26` | `WebSearchToolParam` |
| `mcp` | `Mcp` |
| `code_interpreter` | `CodeInterpreter` |
| `image_generation` | `ImageGeneration` |
| `local_shell` | `LocalShell` |
| `shell` | `FunctionShellToolParam` |
| `custom` | `CustomToolParam` |
| `namespace` | `NamespaceToolParam` |
| `tool_search` | `ToolSearchToolParam` |
| `web_search_preview` / `web_search_preview_2025_03_11` | `WebSearchPreviewToolParam` |
| `apply_patch` | `ApplyPatchToolParam` |

---

## See also (vendor docs)

Official behavior, pricing, and model availability change over time; confirm in the links below.

- [Structured model outputs](https://developers.openai.com/docs/guides/structured-outputs) — JSON Schema / `strict` tooling and reliability.
- [New tools and features in the Responses API](https://openai.com/index/new-tools-and-features-in-the-responses-api/) — product-level overview of built-in tools and MCP-related capabilities.
- [File search](https://developers.openai.com/api/docs/guides/tools-file-search) — vector stores, hybrid search, metadata filters.
- [Web search](https://developers.openai.com/api/docs/guides/tools-web-search) — citations, search modes, grounding behavior.
- [Remote MCP](https://platform.openai.com/docs/guides/tools-remote-mcp) — connectors, OAuth, and server URL tools.
- [Create a response](https://platform.openai.com/docs/api-reference/responses/create) — includes `tool_choice` next to `tools`.
