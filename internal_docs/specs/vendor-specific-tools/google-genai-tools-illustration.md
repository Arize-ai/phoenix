# Google Gen AI SDK (`google-genai`): `Tool` and nested tool types

Practical JSON/dict shapes for **`Tool`** and the nested types it composes. These feed `GenerateContentConfig.tools` / `tools` on `models.generate_content` (and related APIs) after any client-side normalization.

Unlike OpenAI's `ToolParam` or Anthropic's `ToolUnionParam`, each list entry is **one `Tool` object** with many **optional** keys—you enable only the capabilities you need (for example just `function_declarations` or just `google_search`). The SDK docstrings flag **Gemini API vs Vertex AI** support per field; use them as a first compatibility check, then confirm in Google’s docs for your surface.

**Model vs dict:** request payloads align with **`Tool`** / **`ToolDict`** (Pydantic model and TypedDict for the same keys).

[source](https://github.com/googleapis/python-genai/blob/b2629a44d389370af16e9ad68af676bb565eb9b9/google/genai/types.py#L4725-L4821)

The tools list type is **`ToolListUnion`**: each entry can be a `Tool`, a **callable** (wrapped into function declarations), or, when MCP extras are importable, MCP client types.

[source](https://github.com/googleapis/python-genai/blob/b2629a44d389370af16e9ad68af676bb565eb9b9/google/genai/types.py#L4834-L4835)

Permalinks below use commit `b2629a44d389370af16e9ad68af676bb565eb9b9` from a local clone of [googleapis/python-genai](https://github.com/googleapis/python-genai); after upgrading `google-genai`, run `git rev-parse HEAD` in that repo (or browse your installed `google/genai/types.py`) and refresh line anchors if needed.

---

## `Tool` — top-level keys (optional unless noted)

| Key | Nested type (Python) | SDK note (abbrev.) |
|-----|----------------------|-------------------|
| `function_declarations` | `list[FunctionDeclaration]` | Client-executed functions |
| `google_search` | `GoogleSearch` | Google Search in model |
| `google_maps` | `GoogleMaps` | Maps grounding |
| `url_context` | `UrlContext` | URL context retrieval |
| `file_search` | `FileSearch` | Semantic file search stores (SDK: not Vertex AI) |
| `code_execution` | `ToolCodeExecution` | Model code execution (SDK: not Gemini API) |
| `enterprise_web_search` | `EnterpriseWebSearch` | Vertex AI Search / Sec4 (SDK: not Gemini API) |
| `retrieval` | `Retrieval` | External / Vertex retrieval (SDK: not Gemini API) |
| `google_search_retrieval` | `GoogleSearchRetrieval` | Grounding via Google Search |
| `parallel_ai_search` | `ToolParallelAiSearch` | Parallel.ai (SDK: not Gemini API) |
| `computer_use` | `ComputerUse` | Computer use + auto function declarations |
| `mcp_servers` | `list[McpServer]` | MCP over HTTP (SDK: not Vertex AI) |

**Insight:** The SDK field docstrings are the fastest **Gemini vs Vertex** compatibility filter—if a key says “not supported in Gemini API,” do not plan portable features on it. Combining many keys in one `Tool` is valid JSON-wise but can fail at runtime on a given surface.

---

## 1. `function_declarations` — `FunctionDeclaration`

[source](https://github.com/googleapis/python-genai/blob/b2629a44d389370af16e9ad68af676bb565eb9b9/google/genai/types.py#L4276)

OpenAPI-style declaration. **`parameters`** (SDK `Schema`) vs **`parameters_json_schema`** are **mutually exclusive**; same for **`response`** vs **`response_json_schema`**.

Example using SDK-style `Schema` dicts (`type` values such as `OBJECT`, `STRING`, `INTEGER`—see `google/genai/tests/transformers/test_t_tool.py` in the repo):

```json
{
  "function_declarations": [
    {
      "name": "get_weather",
      "description": "Get the current weather for a location.",
      "parameters": {
        "type": "OBJECT",
        "properties": {
          "city": {
            "type": "STRING",
            "description": "City name"
          },
          "unit": {
            "type": "STRING",
            "enum": ["celsius", "fahrenheit"]
          }
        },
        "required": ["city"]
      }
    }
  ]
}
```

Alternative single-object parameters as **JSON Schema** (mutually exclusive with `parameters`):

```json
{
  "function_declarations": [
    {
      "name": "register_user",
      "description": "Register a user.",
      "parameters_json_schema": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "age": { "type": "integer" }
        },
        "additionalProperties": false,
        "required": ["name", "age"],
        "propertyOrdering": ["name", "age"]
      }
    }
  ]
}
```

Optional: `response` / `response_json_schema` for output schema; `behavior` (Bidi; per SDK docstrings may be Vertex-only).

**Insight:** Pick **either** `parameters` (enum-style `Schema`) **or** `parameters_json_schema`, never both—the API cannot merge them. Output schemas (`response*`) are how you get typed tool outputs for downstream parsers without a second model pass.

---

## 2. `google_search` — `GoogleSearch`

[source](https://github.com/googleapis/python-genai/blob/b2629a44d389370af16e9ad68af676bb565eb9b9/google/genai/types.py#L4175)

Enables search; **`search_types`** defaults to web search if omitted. Nested `web_search` / `image_search` are empty marker objects (`pass` in the model).

```json
{
  "google_search": {
    "search_types": {
      "web_search": {},
      "image_search": {}
    }
  }
}
```

Default-style (web search implied):

```json
{
  "google_search": {}
}
```

Optional nested fields (check SDK docstrings and Google docs—**not** all surfaces support every field): `blocking_confidence`, `exclude_domains`, `time_range_filter` (`start_time` / `end_time` ISO datetimes).

**Insight:** Responses include **`groundingMetadata`** (queries, web chunks, citation spans)—surface it in UX for trust and debugging. `image_search` toggles multimodal search cost/latency; omit `search_types` when web-only defaults are enough.

---

## 3. `google_maps` — `GoogleMaps`

[source](https://github.com/googleapis/python-genai/blob/b2629a44d389370af16e9ad68af676bb565eb9b9/google/genai/types.py#L3427)

```json
{
  "google_maps": {
    "enable_widget": true
  }
}
```

Optional `auth_config` (per SDK docstrings: not supported in Gemini API).

**Insight:** Maps grounding is strongest for **location-in-the-query** tasks (hours, directions, “near me”); `enable_widget` ties to interactive map UIs where the product supports them. Without `auth_config` on Gemini API, assume **public** map data only.

---

## 4. `url_context` — `UrlContext`

[source](https://github.com/googleapis/python-genai/blob/b2629a44d389370af16e9ad68af676bb565eb9b9/google/genai/types.py#L4624)

Empty payload; presence enables the tool.

**Insight:** Inspect **`url_context_metadata`** on responses to see which URLs were actually retrieved (and whether cache vs live fetch applied). Pairs well with `google_search` when the model should **discover** links then **deep-read** a few.

```json
{
  "url_context": {}
}
```

---

## 5. `file_search` — `FileSearch`

[source](https://github.com/googleapis/python-genai/blob/b2629a44d389370af16e9ad68af676bb565eb9b9/google/genai/types.py#L4036)

```json
{
  "file_search": {
    "file_search_store_names": [
      "fileSearchStores/my-file-search-store-123"
    ],
    "top_k": 8,
    "metadata_filter": "optional-filter-expression"
  }
}
```

**Insight:** File Search is **managed RAG**—you pay complexity in setup (stores, imports) to save chunking/embedding plumbing. `metadata_filter` is how you implement tenant or doc-type scoping without separate stores per customer.

---

## 6. `code_execution` — `ToolCodeExecution`

[source](https://github.com/googleapis/python-genai/blob/b2629a44d389370af16e9ad68af676bb565eb9b9/google/genai/types.py#L4221)

Empty object in the type definition.

```json
{
  "code_execution": {}
}
```

Per SDK docstrings: **not supported in Gemini API**.

**Insight:** The field exists in the SDK for **Vertex / AI Studio**-style surfaces. If your app calls the **consumer Gemini API**, omit `code_execution` or detect capability at runtime—sending it can cause request errors.

---

## 7. `enterprise_web_search` — `EnterpriseWebSearch`

[source](https://github.com/googleapis/python-genai/blob/b2629a44d389370af16e9ad68af676bb565eb9b9/google/genai/types.py#L4244)

```json
{
  "enterprise_web_search": {
    "exclude_domains": ["example.com"],
    "blocking_confidence": "BLOCK_HIGH_AND_ABOVE"
  }
}
```

Per SDK docstrings: **not supported in Gemini API**. `blocking_confidence` uses `PhishBlockThreshold` in the SDK.

**Insight:** This is the **enterprise / Sec4** web-search path on Vertex—different compliance and billing from consumer Gemini. `exclude_domains` is a simple abuse-control lever for known-bad or off-brand domains.

---

## 8. `retrieval` — `Retrieval`

[source](https://github.com/googleapis/python-genai/blob/b2629a44d389370af16e9ad68af676bb565eb9b9/google/genai/types.py#L3990)

Defines Vertex-style retrieval; choose one of **`vertex_ai_search`**, **`vertex_rag_store`**, or **`external_api`** (each has its own nested shape in `types.py`).

Minimal placeholder:

```json
{
  "retrieval": {
    "vertex_ai_search": {}
  }
}
```

Per SDK docstrings: **not supported in Gemini API**.

**Insight:** `vertex_ai_search`, `vertex_rag_store`, and `external_api` are **three different architectures**—pick one branch and model your auth and latency expectations on that path (do not “fill in all three” hoping the API merges them).

---

## 9. `google_search_retrieval` — `GoogleSearchRetrieval`

[source](https://github.com/googleapis/python-genai/blob/b2629a44d389370af16e9ad68af676bb565eb9b9/google/genai/types.py#L4567)

```json
{
  "google_search_retrieval": {
    "dynamic_retrieval_config": {
      "mode": "MODE_DYNAMIC",
      "dynamic_threshold": 0.3
    }
  }
}
```

(`mode` is `DynamicRetrievalConfigMode` in the SDK.)

**Insight:** Dynamic retrieval is “search when needed”—raise `dynamic_threshold` if the model **over-grounds** trivial questions; lower it if it skips search on factual queries that need freshness.

---

## 10. `parallel_ai_search` — `ToolParallelAiSearch`

[source](https://github.com/googleapis/python-genai/blob/b2629a44d389370af16e9ad68af676bb565eb9b9/google/genai/types.py#L4588)

```json
{
  "parallel_ai_search": {
    "api_key": "optional-parallel-ai-key",
    "custom_configs": {
      "source_policy": {
        "include_domains": ["google.com", "wikipedia.org"],
        "exclude_domains": ["example.com"]
      },
      "fetch_policy": {
        "max_age_seconds": 3600
      }
    }
  }
}
```

Per SDK docstrings: **not supported in Gemini API**.

**Insight:** Requires **Parallel.ai** credentials and Vertex enablement—treat as an optional enterprise integration, not a default replacement for `google_search`. `fetch_policy.max_age_seconds` trades freshness vs cache hit rate.

---

## 11. `computer_use` — `ComputerUse`

[source](https://github.com/googleapis/python-genai/blob/b2629a44d389370af16e9ad68af676bb565eb9b9/google/genai/types.py#L3173)

`environment` uses `Environment` (e.g. `ENVIRONMENT_BROWSER`).

**Insight:** Enabling `computer_use` also **injects predefined function declarations** for UI actions—your client must implement the actual automation loop (screenshots → model → actions). `excluded_predefined_functions` removes risky actions (e.g. payments) from the declared surface.

```json
{
  "computer_use": {
    "environment": "ENVIRONMENT_BROWSER",
    "excluded_predefined_functions": ["some_predefined_action"]
  }
}
```

---

## 12. `mcp_servers` — `McpServer` + `StreamableHttpTransport`

[source](https://github.com/googleapis/python-genai/blob/b2629a44d389370af16e9ad68af676bb565eb9b9/google/genai/types.py#L4692) (`McpServer`) · [source](https://github.com/googleapis/python-genai/blob/b2629a44d389370af16e9ad68af676bb565eb9b9/google/genai/types.py#L4639) (`StreamableHttpTransport`)

Per SDK docstrings: **not supported in Vertex AI**.

**Insight:** MCP on Gemini API uses **HTTP streamable** transport—your server must implement the MCP protocol reliably; short timeouts surface as stalled tool calls in the model. Because Vertex AI does not support this key in the SDK types above, **branch your `Tool` payload** if you target both Gemini API and Vertex.

```json
{
  "mcp_servers": [
    {
      "name": "my-mcp-server",
      "streamable_http_transport": {
        "url": "https://api.example.com/mcp",
        "headers": {
          "Authorization": "Bearer token"
        },
        "timeout": "30s",
        "sse_read_timeout": "60s",
        "terminate_on_close": true
      }
    }
  ]
}
```

---

## Appendix A: `ToolType` (server-side tool call discrimination)

[source](https://github.com/googleapis/python-genai/blob/b2629a44d389370af16e9ad68af676bb565eb9b9/google/genai/types.py#L806-L820)

Enum **`ToolType`** maps server tool kinds, e.g.:

- `GOOGLE_SEARCH_WEB` / `GOOGLE_SEARCH_IMAGE` → `Tool.google_search`
- `URL_CONTEXT` → `Tool.url_context`
- `GOOGLE_MAPS` → `Tool.google_maps`
- `FILE_SEARCH` → `Tool.file_search`

Used on **`ToolCall`** / **`ToolResponse`**, not on the request `Tool` definition itself.

**Insight:** When debugging “wrong tool,” compare **request** `Tool` keys to **response** `ToolType`—server-executed tools show up as dedicated enum values, not as your `function_declarations` names.

---

## Appendix B: `ToolConfig` (shared across tools in the request)

[source](https://github.com/googleapis/python-genai/blob/b2629a44d389370af16e9ad68af676bb565eb9b9/google/genai/types.py#L4939-L4970)

The section **[Tool choice configuration](#tool-choice-configuration-toolconfig--function_calling_config)** below links official docs and expands on **`function_calling_config`** (modes, allowlists). This appendix shows the full **`ToolConfig`** shape in one place.

From `ToolConfig` / `ToolConfigDict`:

```json
{
  "function_calling_config": {
    "mode": "AUTO",
    "allowed_function_names": ["get_weather"],
    "stream_function_call_arguments": false
  },
  "retrieval_config": {
    "lat_lng": { "latitude": 37.7749, "longitude": -122.4194 },
    "language_code": "en-US"
  },
  "include_server_side_tool_invocations": true
}
```

`mode` is `FunctionCallingConfigMode`. Some nested fields are Vertex-only per SDK docstrings.

**Insight:** `function_calling_config` applies to **all** tools in the request—`allowed_function_names` is a cheap safety rail for demos and prod canaries. `include_server_side_tool_invocations` is what lets you **log** Google-hosted tool steps inside response `Content` for audits.

---

## Tool choice configuration (`ToolConfig` / `function_calling_config`)

In the Gemini API, tool **selection policy** for function-style tools lives under **`tool_config`** (REST) / **`ToolConfig`** (SDK), especially **`function_calling_config`**. It complements the `tools` list: `tools` describes declarations; `function_calling_config.mode` (and related fields) steers whether the model may omit calls, must call something, or follows other calling rules for that request.

**Official docs**

- [Function calling](https://ai.google.dev/gemini-api/docs/function-calling) — overview; **Function calling modes** anchor: [function_calling_mode](https://ai.google.dev/gemini-api/docs/function-calling#function_calling_mode).
- [Generate content (REST) / `toolConfig`](https://ai.google.dev/api/generate-content) — request field `toolConfig` (see also the linked **`ToolConfig`** schema from that page).

**Python SDK (permalinks)**

- **`FunctionCallingConfigMode`** enum (`AUTO`, `ANY`, `NONE`, `VALIDATED`, …): [source](https://github.com/googleapis/python-genai/blob/b2629a44d389370af16e9ad68af676bb565eb9b9/google/genai/types.py#L302-L314)
- **`FunctionCallingConfig`** / **`FunctionCallingConfigDict`**: [source](https://github.com/googleapis/python-genai/blob/b2629a44d389370af16e9ad68af676bb565eb9b9/google/genai/types.py#L4905-L4932)
- **`ToolConfig`** / **`ToolConfigDict`** (includes `function_calling_config`, `retrieval_config`, `include_server_side_tool_invocations`): [source](https://github.com/googleapis/python-genai/blob/b2629a44d389370af16e9ad68af676bb565eb9b9/google/genai/types.py#L4939-L4970)

**Insight:** Modes are **global for the request**—if you need different behavior per tool, split into separate `generate_content` calls or narrow `allowed_function_names`. Hosted tools (`google_search`, `url_context`, …) still surface as tool calls in responses; pair `include_server_side_tool_invocations` with your observability story.

---

## Summary

[source](https://github.com/googleapis/python-genai/blob/b2629a44d389370af16e9ad68af676bb565eb9b9/google/genai/types.py#L4725-L4821)

**Insight:** Prefer **separate `Tool` list entries** when you want different cache or billing semantics (e.g. one tool dict for `google_search`, another for `function_declarations`) instead of one mega-dict that is hard to reason about per surface.

- **One `Tool` object**, many optional keys—combine only what the API surface you use supports.
- **User-defined tools** → `function_declarations` (`FunctionDeclaration` + `Schema` or `parameters_json_schema`).
- **Built-in tools** → `google_search`, `google_maps`, `url_context`, `file_search`, `code_execution`, etc., as above.
- **Source of truth:** `google/genai/types.py` in [googleapis/python-genai](https://github.com/googleapis/python-genai) (permalink above); line numbers move between releases—re-check your installed package or refresh the commit hash in the links after upgrading.

---

## See also (vendor docs)

Gemini API vs Vertex AI differ by tool and field; pricing and model support change over time—confirm in the links below.

- [Grounding with Google Search](https://ai.google.dev/gemini-api/docs/google-search) — `google_search` tool, citations, `groundingMetadata`.
- [URL context](https://ai.google.dev/gemini-api/docs/url-context) — `url_context` tool, fetched URLs, `url_context_metadata`.
- [File Search (Gemini API)](https://ai.google.dev/gemini-api/docs/file-search) — managed RAG / file search stores (see also [intro post](https://blog.google/technology/developers/file-search-gemini-api)).
- [Grounding API (Vertex AI)](https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/grounding) — Vertex grounding and enterprise search surfaces.
- [Grounding with Google Search (Vertex)](https://cloud.google.com/vertex-ai/generative-ai/docs/grounding-with-search) — Search + Maps-style grounding on Vertex.
- [Function calling](https://ai.google.dev/gemini-api/docs/function-calling) — `toolConfig` / calling modes (`#function_calling_mode`).
