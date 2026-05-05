# Anthropic Messages API: `ToolUnionParam` variants

Practical JSON examples for each shape you can pass in `tools` on `POST /v1/messages` (or `messages.create(..., tools=[...])` in the Python SDK). They follow the TypedDict names under `anthropic/types/`, which mirror the HTTP schema. Use a section's example as a starting point and drop fields you do not need.

**Terms:** **`tool_use`** = an assistant message block where the model asks to run a tool (with `name`, `id`, `input`). **`tool_result`** = your next user message block that returns output for that call (with matching `tool_use_id`). **Server tools** (web search, bash, etc.) run on Anthropic’s side; **client tools** are the ones your code executes.

**Full union** (same order as the SDK):

[source](https://github.com/anthropics/anthropic-sdk-python/blob/8496c50655999cbb2c871e71331996f87025e240/src/anthropic/types/tool_union_param.py#L27-L44)

```python
ToolUnionParam: TypeAlias = Union[
    ToolParam,
    ToolBash20250124Param,
    CodeExecutionTool20250522Param,
    CodeExecutionTool20250825Param,
    CodeExecutionTool20260120Param,
    MemoryTool20250818Param,
    ToolTextEditor20250124Param,
    ToolTextEditor20250429Param,
    ToolTextEditor20250728Param,
    WebSearchTool20250305Param,
    WebFetchTool20250910Param,
    WebSearchTool20260209Param,
    WebFetchTool20260209Param,
    WebFetchTool20260309Param,
    ToolSearchToolBm25_20251119Param,
    ToolSearchToolRegex20251119Param,
]
```

Permalinks below use commit `8496c50655999cbb2c871e71331996f87025e240` from a local clone of [anthropics/anthropic-sdk-python](https://github.com/anthropics/anthropic-sdk-python); re-run `git rev-parse HEAD` there after upgrading and replace the hash in URLs if you need an exact match to your installed version.

**Built-in tools** (bash, web search, …): each entry includes a versioned **`type`** (e.g. `web_search_20260209`) and a fixed **`name`** (e.g. `web_search`) that must match the API. **User-defined tools** (`ToolParam`): required **`name`** and **`input_schema`**; top-level **`type` is omitted** unless you use the optional `"custom"` discriminator (see §1 examples).

Shared optional fields on many tools: `allowed_callers`, `cache_control`, `defer_loading`, `strict`. See per-section notes.

---

## 1. `ToolParam` (user-defined / custom tool)

[source](https://github.com/anthropics/anthropic-sdk-python/blob/8496c50655999cbb2c871e71331996f87025e240/src/anthropic/types/tool_param.py#L33)

JSON Schema describes arguments the model emits in `tool_use` blocks. `description` is strongly recommended in practice.

```json
{
  "name": "get_weather",
  "description": "Get the current weather for a location.",
  "input_schema": {
    "type": "object",
    "properties": {
      "city": { "type": "string", "description": "City name" },
      "unit": {
        "type": "string",
        "enum": ["celsius", "fahrenheit"],
        "description": "Temperature unit"
      }
    },
    "required": ["city"]
  },
  "strict": true
}
```

Explicit custom discriminator (optional on API; SDK allows `type: "custom"`):

```json
{
  "type": "custom",
  "name": "get_weather",
  "description": "Get the current weather for a location.",
  "input_schema": {
    "type": "object",
    "properties": { "city": { "type": "string" } },
    "required": ["city"]
  }
}
```

Optional extras: `input_examples`, `defer_loading`, `allowed_callers`, `cache_control`, `eager_input_streaming`.

**Insight:** User tools surface as normal `tool_use` blocks—your runner executes them and must return **`tool_result` with matching `tool_use_id`**. Use `strict: true` when you want the API to enforce `input_schema` (and the tool name) so `tool_use` payloads are well-formed before handlers run that change real data or call external services—still validate auth and business rules in your own code.

---

## 2. `ToolBash20250124Param`

[source](https://github.com/anthropics/anthropic-sdk-python/blob/8496c50655999cbb2c871e71331996f87025e240/src/anthropic/types/tool_bash_20250124_param.py#L13)

Shell/bash tool. Fixed `name` and `type`.

**Insight:** Bash is **server-side** (Anthropic runs it)—you do not shell out on your own machine. Combine with `allowed_callers` when only certain tools (e.g. code execution) should invoke it.

```json
{
  "type": "bash_20250124",
  "name": "bash"
}
```

---

## 3. `CodeExecutionTool20250522Param`

[source](https://github.com/anthropics/anthropic-sdk-python/blob/8496c50655999cbb2c871e71331996f87025e240/src/anthropic/types/code_execution_tool_20250522_param.py#L13)

**Insight:** Older code-execution revision; prefer newer `type` strings for new projects unless you must pin legacy behavior. Only one code-execution tool variant should appear per request.

```json
{
  "type": "code_execution_20250522",
  "name": "code_execution"
}
```

---

## 4. `CodeExecutionTool20250825Param`

[source](https://github.com/anthropics/anthropic-sdk-python/blob/8496c50655999cbb2c871e71331996f87025e240/src/anthropic/types/code_execution_tool_20250825_param.py#L13)

**Insight:** Common “stable” generation for Python/bash sandboxes; often paired with **web search** or **web fetch** in agent recipes so the model can pull facts then compute.

```json
{
  "type": "code_execution_20250825",
  "name": "code_execution"
}
```

---

## 5. `CodeExecutionTool20260120Param`

[source](https://github.com/anthropics/anthropic-sdk-python/blob/8496c50655999cbb2c871e71331996f87025e240/src/anthropic/types/code_execution_tool_20260120_param.py#L13)

Newer code execution (REPL persistence / daemon semantics per SDK docstring).

**Insight:** Use when you need **state across turns** inside the sandbox (variables, loaded data) or richer “agentic” execution semantics; confirm model and channel support (direct API vs cloud) before relying on it.

```json
{
  "type": "code_execution_20260120",
  "name": "code_execution"
}
```

---

## 6. `MemoryTool20250818Param`

[source](https://github.com/anthropics/anthropic-sdk-python/blob/8496c50655999cbb2c871e71331996f87025e240/src/anthropic/types/memory_tool_20250818_param.py#L13)

**Insight:** Geared toward **long-horizon** sessions where the model persists structured memory server-side—still treat retention, PII, and deletion as your compliance problem, not “free storage.”

```json
{
  "type": "memory_20250818",
  "name": "memory"
}
```

---

## 7. `ToolTextEditor20250124Param`

[source](https://github.com/anthropics/anthropic-sdk-python/blob/8496c50655999cbb2c871e71331996f87025e240/src/anthropic/types/tool_text_editor_20250124_param.py#L13)

**Insight:** `str_replace_editor` is the **older editor surface**; migrate to newer `text_editor_*` types for new builds so prompts and training match current tool behavior.

```json
{
  "type": "text_editor_20250124",
  "name": "str_replace_editor"
}
```

---

## 8. `ToolTextEditor20250429Param`

[source](https://github.com/anthropics/anthropic-sdk-python/blob/8496c50655999cbb2c871e71331996f87025e240/src/anthropic/types/tool_text_editor_20250429_param.py#L13)

**Insight:** `str_replace_based_edit_tool` is the **modern default name** for patch-style edits; keep `name` exactly as the API expects or tool calls will not dispatch.

```json
{
  "type": "text_editor_20250429",
  "name": "str_replace_based_edit_tool"
}
```

---

## 9. `ToolTextEditor20250728Param`

[source](https://github.com/anthropics/anthropic-sdk-python/blob/8496c50655999cbb2c871e71331996f87025e240/src/anthropic/types/tool_text_editor_20250728_param.py#L13)

Adds optional `max_characters` (view limit when displaying file contents).

**Insight:** Set `max_characters` to cap **read_file / view** payloads so huge files do not blow the context window; pair with code execution when you need summarization or chunk-wise processing.

```json
{
  "type": "text_editor_20250728",
  "name": "str_replace_based_edit_tool",
  "max_characters": 10000
}
```

Minimal:

```json
{
  "type": "text_editor_20250728",
  "name": "str_replace_based_edit_tool"
}
```

---

## 10. `WebSearchTool20250305Param`

[source](https://github.com/anthropics/anthropic-sdk-python/blob/8496c50655999cbb2c871e71331996f87025e240/src/anthropic/types/web_search_tool_20250305_param.py#L15)

```json
{
  "type": "web_search_20250305",
  "name": "web_search",
  "max_uses": 5,
  "allowed_domains": ["arxiv.org", "pubmed.ncbi.nlm.nih.gov"],
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
  "type": "web_search_20250305",
  "name": "web_search"
}
```

`allowed_domains` and `blocked_domains` are mutually exclusive.

**Insight:** `max_uses` is your **budget** per request—tune it to control cost and latency. Domain allow/block lists are a safety and relevance knob; they are mutually exclusive so the API never receives contradictory routing rules.

---

## 11. `WebSearchTool20260209Param`

[source](https://github.com/anthropics/anthropic-sdk-python/blob/8496c50655999cbb2c871e71331996f87025e240/src/anthropic/types/web_search_tool_20260209_param.py#L15)

Same fields as `web_search_20250305`; different `type` version string.

**Insight:** Bump the `type` when Anthropic ships search behavior or citation changes you need; newer models may **require** the newer string—check the tool-use docs for your model ID.

```json
{
  "type": "web_search_20260209",
  "name": "web_search",
  "max_uses": 5,
  "blocked_domains": ["example-spam.com"],
  "user_location": {
    "type": "approximate",
    "country": "US"
  }
}
```

---

## 12. `WebFetchTool20250910Param`

[source](https://github.com/anthropics/anthropic-sdk-python/blob/8496c50655999cbb2c871e71331996f87025e240/src/anthropic/types/web_fetch_tool_20250910_param.py#L15)

Fetch URL content for the model. Optional `citations` and domain limits.

```json
{
  "type": "web_fetch_20250910",
  "name": "web_fetch",
  "max_uses": 10,
  "max_content_tokens": 80000,
  "allowed_domains": ["docs.anthropic.com"],
  "citations": { "enabled": true }
}
```

Minimal:

```json
{
  "type": "web_fetch_20250910",
  "name": "web_fetch"
}
```

**Insight:** `max_content_tokens` prevents one huge page from dominating the prompt; enable `citations` when you want traceability back to fetched segments. Prefer **web search → shortlist URLs → web fetch** instead of fetching the whole open web.

---

## 13. `WebFetchTool20260209Param`

[source](https://github.com/anthropics/anthropic-sdk-python/blob/8496c50655999cbb2c871e71331996f87025e240/src/anthropic/types/web_fetch_tool_20260209_param.py#L15)

Same shape as `web_fetch_20250910` with updated `type`.

**Insight:** Same knobs as `20250910`; migrate the `type` string when your model or docs require the newer revision—behavioral differences are in the service, not this stub.

```json
{
  "type": "web_fetch_20260209",
  "name": "web_fetch",
  "blocked_domains": ["malicious.example"],
  "max_content_tokens": 50000
}
```

---

## 14. `WebFetchTool20260309Param`

[source](https://github.com/anthropics/anthropic-sdk-python/blob/8496c50655999cbb2c871e71331996f87025e240/src/anthropic/types/web_fetch_tool_20260309_param.py#L15)

Same optional fields as the other `web_fetch_*` tools, with `type: "web_fetch_20260309"`. Adds **`use_cache`**: set to `false` when the user wants a fresh fetch (for example rapidly changing pages); default behavior uses cache when available.

Minimal:

```json
{
  "type": "web_fetch_20260309",
  "name": "web_fetch"
}
```

Bypass cache for this tool:

```json
{
  "type": "web_fetch_20260309",
  "name": "web_fetch",
  "use_cache": false,
  "max_uses": 5
}
```

**Insight:** Prefer `use_cache: false` only when freshness beats cost (live dashboards, incident pages); default caching cuts duplicate fetches when the model revisits the same URL in one session.

---

## 15. `ToolSearchToolBm25_20251119Param`

[source](https://github.com/anthropics/anthropic-sdk-python/blob/8496c50655999cbb2c871e71331996f87025e240/src/anthropic/types/tool_search_tool_bm25_20251119_param.py#L13)

BM25 search over the registered tool set (for deferred / large tool lists). `type` may be the versioned string or alias `tool_search_tool_bm25`.

```json
{
  "type": "tool_search_tool_bm25_20251119",
  "name": "tool_search_tool_bm25"
}
```

```json
{
  "type": "tool_search_tool_bm25",
  "name": "tool_search_tool_bm25"
}
```

**Insight:** BM25 favors **lexical** overlap with the query—great when tool names and descriptions contain distinctive keywords; less ideal when tools differ only by subtle metadata.

---

## 16. `ToolSearchToolRegex20251119Param`

[source](https://github.com/anthropics/anthropic-sdk-python/blob/8496c50655999cbb2c871e71331996f87025e240/src/anthropic/types/tool_search_tool_regex_20251119_param.py#L13)

```json
{
  "type": "tool_search_tool_regex_20251119",
  "name": "tool_search_tool_regex"
}
```

```json
{
  "type": "tool_search_tool_regex",
  "name": "tool_search_tool_regex"
}
```

**Insight:** Regex search shines when you can **name tools with predictable patterns** (prefixes, domains) or when BM25 misses short acronyms; keep regexes simple—expensive patterns add latency.

---

## Appendix A: `tool_choice` (not part of `ToolUnionParam`)

`tools` defines **what** the model may use; **`tool_choice`** on the same `POST /v1/messages` request defines **whether** it must use tools and **which** pattern. It is **not** a member of `ToolUnionParam`.

| `tool_choice` shape | Effect (plain language) |
|---------------------|-------------------------|
| `{ "type": "auto" }` | Model may reply with plain text **or** call tools (default-style behavior). |
| `{ "type": "any" }` | Model **must** call at least one tool (no text-only answer). |
| `{ "type": "none" }` | Model **must not** use tools. |
| `{ "type": "tool", "name": "…" }` | Model must use the tool whose **`name`** matches (must exist in `tools`). |

Optional on `auto`, `any`, and `tool`: **`disable_parallel_tool_use`** — when `true`, limits how many tool calls appear in a single assistant turn (see API reference for exact semantics).

**Official docs**

- [Create a Message](https://docs.claude.com/claude/reference/messages_post) — request body documents `tool_choice` (`ToolChoiceAuto`, `ToolChoiceAny`, `ToolChoiceTool`, `ToolChoiceNone`) including `disable_parallel_tool_use`.
- [Parallel tool use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/parallel-tool-use) — returning multiple `tool_result` blocks in one user turn and using `disable_parallel_tool_use` with `tool_choice`.

**Python SDK (permalinks)**

- **`ToolChoiceParam` union**: [source](https://github.com/anthropics/anthropic-sdk-python/blob/8496c50655999cbb2c871e71331996f87025e240/src/anthropic/types/tool_choice_param.py#L15)
- **`ToolChoiceAutoParam`** (`type: "auto"`, optional `disable_parallel_tool_use`): [source](https://github.com/anthropics/anthropic-sdk-python/blob/8496c50655999cbb2c871e71331996f87025e240/src/anthropic/types/tool_choice_auto_param.py#L10)
- **`ToolChoiceAnyParam`** (`type: "any"`): [source](https://github.com/anthropics/anthropic-sdk-python/blob/8496c50655999cbb2c871e71331996f87025e240/src/anthropic/types/tool_choice_any_param.py#L10)
- **`ToolChoiceNoneParam`** (`type: "none"`): [source](https://github.com/anthropics/anthropic-sdk-python/blob/8496c50655999cbb2c871e71331996f87025e240/src/anthropic/types/tool_choice_none_param.py#L10)
- **`ToolChoiceToolParam`** (`type: "tool"`, required `name`): [source](https://github.com/anthropics/anthropic-sdk-python/blob/8496c50655999cbb2c871e71331996f87025e240/src/anthropic/types/tool_choice_tool_param.py#L10)

**Illustrative JSON** (`ToolChoiceParam` shapes):

```json
{ "type": "auto" }
```

```json
{ "type": "any" }
```

```json
{ "type": "none" }
```

```json
{ "type": "tool", "name": "get_weather" }
```

Add `"disable_parallel_tool_use": true` inside the same object as `type` when you need it (allowed with `auto`, `any`, and `tool`).

**Insight:** When the model emits **several** `tool_use` blocks, return **one user message** whose `content` lists a `tool_result` for each `tool_use_id` (see [Parallel tool use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/parallel-tool-use)). Use `disable_parallel_tool_use` when parallel calls would race on shared state. `tool: { name }` helps in **tests or fixed pipelines**; prefer `auto` for open-ended chat.

---

## Appendix B: Beta-only `BetaToolUnionParam` extras

[source](https://github.com/anthropics/anthropic-sdk-python/blob/8496c50655999cbb2c871e71331996f87025e240/src/anthropic/types/beta/beta_tool_union_param.py#L33-L56)

The SDK's `beta_tool_union_param.py` extends the stable union with older tool versions (e.g. `bash_20241022`, `text_editor_20241022`), **computer use**, and **MCP toolsets**. These require the appropriate beta API features and headers per Anthropic docs.

**Insight:** Beta tools are **not** interchangeable with stable ones—headers, model allowlists, and org settings gate them. Ship behind feature flags and re-test whenever Anthropic bumps beta version strings.

**Computer use (example: `BetaToolComputerUse20251124Param`):**

[source](https://github.com/anthropics/anthropic-sdk-python/blob/8496c50655999cbb2c871e71331996f87025e240/src/anthropic/types/beta/beta_tool_computer_use_20251124_param.py#L13)

```json
{
  "type": "computer_20251124",
  "name": "computer",
  "display_width_px": 1920,
  "display_height_px": 1080,
  "display_number": 0,
  "enable_zoom": true
}
```

**Insight:** Display width/height affect **screenshot resolution and click coordinates**; wrong numbers produce misaligned actions. Treat `enable_zoom` as a capability bit that may change how the model plans UI navigation.

**MCP toolset (`BetaMCPToolsetParam`):**

[source](https://github.com/anthropics/anthropic-sdk-python/blob/8496c50655999cbb2c871e71331996f87025e240/src/anthropic/types/beta/beta_mcp_toolset_param.py#L15)

```json
{
  "type": "mcp_toolset",
  "mcp_server_name": "my-server",
  "default_config": { "enabled": true, "defer_loading": false },
  "configs": {
    "some_tool": { "enabled": true, "defer_loading": true }
  }
}
```

**Insight:** `default_config` vs per-tool `configs` is how you **defer** heavy MCP tools until referenced—mirror the pattern of `defer_loading` on user tools so only enabled paths hit the server.

---

## Summary: discriminating `type` (`ToolUnionParam`)

[source](https://github.com/anthropics/anthropic-sdk-python/blob/8496c50655999cbb2c871e71331996f87025e240/src/anthropic/types/tool_union_param.py#L27-L44)

**Insight:** Built-in tools need **both** a versioned `type` and the exact fixed `name`—logging only `name` misses the revision (`web_search_20250305` vs `web_search_20260209`) that explains behavior changes.

| `type` value | Python param (representative) | Fixed `name` (if any) |
|--------------|-------------------------------|------------------------|
| *(absent or `"custom"`)* | `ToolParam` | *(your tool name)* |
| `bash_20250124` | `ToolBash20250124Param` | `bash` |
| `code_execution_20250522` | `CodeExecutionTool20250522Param` | `code_execution` |
| `code_execution_20250825` | `CodeExecutionTool20250825Param` | `code_execution` |
| `code_execution_20260120` | `CodeExecutionTool20260120Param` | `code_execution` |
| `memory_20250818` | `MemoryTool20250818Param` | `memory` |
| `text_editor_20250124` | `ToolTextEditor20250124Param` | `str_replace_editor` |
| `text_editor_20250429` | `ToolTextEditor20250429Param` | `str_replace_based_edit_tool` |
| `text_editor_20250728` | `ToolTextEditor20250728Param` | `str_replace_based_edit_tool` |
| `web_search_20250305` | `WebSearchTool20250305Param` | `web_search` |
| `web_search_20260209` | `WebSearchTool20260209Param` | `web_search` |
| `web_fetch_20250910` | `WebFetchTool20250910Param` | `web_fetch` |
| `web_fetch_20260209` | `WebFetchTool20260209Param` | `web_fetch` |
| `web_fetch_20260309` | `WebFetchTool20260309Param` | `web_fetch` |
| `tool_search_tool_bm25_20251119` / `tool_search_tool_bm25` | `ToolSearchToolBm25_20251119Param` | `tool_search_tool_bm25` |
| `tool_search_tool_regex_20251119` / `tool_search_tool_regex` | `ToolSearchToolRegex20251119Param` | `tool_search_tool_regex` |

Union members and version strings change between SDK releases; compare your installed package with `tool_union_param.py` or the permalink above.

---

## See also (vendor docs)

Official behavior, pricing, and which tools run on which channels (API vs cloud) change over time; confirm in the links below.

- [Create a Message (API reference)](https://docs.claude.com/claude/reference/messages_post) — includes `tool_choice` and `tools` on the request body.
- [How tool use works](https://console.anthropic.com/docs/en/agents-and-tools/tool-use/how-tool-use-works) — `tool_use` / `tool_result` loop and message shape.
- [Parallel tool use](https://console.anthropic.com/docs/en/agents-and-tools/tool-use/parallel-tool-use) — batching `tool_result` blocks and `disable_parallel_tool_use`.
- [Tool combinations](https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-combinations) — supported pairings and platform caveats.
- [Web search tool](https://docs.claude.com/en/docs/agents-and-tools/tool-use/web-search-tool) — citations, domains, versioning.
- [Web fetch tool](https://docs.claude.com/en/docs/agents-and-tools/tool-use/web-fetch-tool) — fetching URL bodies (often paired with web search).
- [Code execution tool](https://docs.claude.com/en/docs/agents-and-tools/tool-use/code-execution-tool) — sandbox, versions (`code_execution_*`), and limits.
- [Tool search tool](https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-search-tool) — BM25 / regex deferred tool loading.
