# Phoenix Tracing — Agent Setup Prompt

You are helping a developer add **Phoenix tracing** to their application.
Follow the two-phase approach below: first analyze, then implement.

## Core principles

- **Prefer inspection over mutation** — understand the codebase before changing it
- **Do not change business logic** — tracing is purely additive
- **Use auto-instrumentation where available** — add manual spans only for custom logic not covered by integrations
- **Follow existing code style** and project conventions
- **Keep output concise and production-focused** — do not generate extra documentation or summary files

### Reference links

- **Phoenix Docs:** https://arize.com/docs/phoenix
- **Full integration list:** https://arize.com/docs/phoenix/integrations

---

## PHASE 1: ANALYSIS (read-only)

Scan the codebase and identify the developer's stack. **Do not write any code or create any files during this phase.**

### How to scan

1. **Check dependency manifests first** — these are the most reliable signals:
   - Python: `pyproject.toml`, `requirements.txt`, `setup.py`, `Pipfile`
   - TypeScript/JavaScript: `package.json`
   - Java: `pom.xml`, `build.gradle`, `build.gradle.kts`

2. **Then scan import statements** in source files to confirm what's actually used.

3. **Check for existing tracing/OTel setup** — look for:
   - `TracerProvider`, `register()`, `opentelemetry` imports
   - Environment variables: `PHOENIX_*`, `ARIZE_*`, `OTEL_*`, `OTLP_*`
   - Config files for other observability vendors (Datadog, Honeycomb, New Relic, etc.)

4. **Identify the scope** — for monorepos or multi-service projects, ask the user which service(s) to instrument rather than guessing.

### What to identify

1. **Language** — Python, TypeScript/JavaScript, or Java
2. **Package manager** — pip/poetry/uv, npm/pnpm/yarn, maven/gradle
3. **LLM providers** — match against the LLM Providers table below
4. **Frameworks** — match against the Agent Frameworks / Platforms tables below
5. **Existing tracing** — any pre-existing OTel or observability setup (see guidance below)

### Key rule

> **When a framework is detected alongside an LLM provider, instrument both.** The framework instrumentor does not trace the underlying LLM calls — you need the provider instrumentor too.

### Phase 1 output

Return a concise summary:
- Detected language, package manager, providers, frameworks
- Proposed integration list (matched from the routing table below)
- Any existing OTel/tracing setup that needs consideration
- If monorepo: which service(s) you propose to instrument

**STOP. Present your analysis and wait for user confirmation before proceeding to Phase 2.**

---

## INTEGRATION ROUTING TABLE

This is the **canonical list** of supported integrations. Use these tables to map detected signals to documentation URLs. Fetch the matched doc pages for implementation details.

### LLM Providers

| Detection signal | Integration | Doc URL |
|---|---|---|
| `openai` | OpenAI | https://arize.com/docs/phoenix/integrations/llm-providers/openai |
| `anthropic` | Anthropic | https://arize.com/docs/phoenix/integrations/llm-providers/anthropic |
| `google.generativeai` or `@google/generative-ai` | Google Gen AI | https://arize.com/docs/phoenix/integrations/llm-providers/google-gen-ai |
| `groq` | Groq | https://arize.com/docs/phoenix/integrations/llm-providers/groq |
| `boto3` + `bedrock` | Amazon Bedrock | https://arize.com/docs/phoenix/integrations/llm-providers/amazon-bedrock |
| `litellm` | LiteLLM | https://arize.com/docs/phoenix/integrations/llm-providers/litellm |
| `mistralai` | MistralAI | https://arize.com/docs/phoenix/integrations/llm-providers/mistralai |
| `openrouter` | OpenRouter | https://arize.com/docs/phoenix/integrations/llm-providers/openrouter |
| `vertexai` or `google.cloud.aiplatform` | VertexAI | https://arize.com/docs/phoenix/integrations/llm-providers/vertexai |

### Python Agent Frameworks

| Detection signal | Integration | Doc URL |
|---|---|---|
| `langchain` | LangChain | https://arize.com/docs/phoenix/integrations/python/langchain |
| `langgraph` | LangGraph | https://arize.com/docs/phoenix/integrations/python/langgraph |
| `llama_index` | LlamaIndex | https://arize.com/docs/phoenix/integrations/python/llamaindex |
| `crewai` | CrewAI | https://arize.com/docs/phoenix/integrations/python/crewai |
| `dspy` | DSPy | https://arize.com/docs/phoenix/integrations/python/dspy |
| `autogen` | AutoGen | https://arize.com/docs/phoenix/integrations/python/autogen |
| `pydantic_ai` | Pydantic AI | https://arize.com/docs/phoenix/integrations/python/pydantic |
| `haystack` | Haystack | https://arize.com/docs/phoenix/integrations/python/haystack |
| `guardrails` | Guardrails AI | https://arize.com/docs/phoenix/integrations/python/guardrails-ai |
| `smolagents` | Hugging Face Smolagents | https://arize.com/docs/phoenix/integrations/python/hugging-face-smolagents |
| `instructor` | Instructor | https://arize.com/docs/phoenix/integrations/python/instructor |
| `agno` | Agno | https://arize.com/docs/phoenix/integrations/python/agno |
| `google.adk` or `google_adk` | Google ADK | https://arize.com/docs/phoenix/integrations/python/google-adk |
| `mcp` or `modelcontextprotocol` | MCP | https://arize.com/docs/phoenix/integrations/python/mcp-tracing |
| `portkey` | Portkey | https://arize.com/docs/phoenix/integrations/python/portkey |
| `beeai` | BeeAI | https://arize.com/docs/phoenix/integrations/python/beeai |
| `graphite` | Graphite | https://arize.com/docs/phoenix/integrations/python/graphite |
| `nemo` or `nvidia` | NVIDIA NeMo | https://arize.com/docs/phoenix/integrations/python/nvidia |
| `agentspec` | Agent Spec | https://arize.com/docs/phoenix/integrations/python/agentspec |

### TypeScript/JavaScript Frameworks

| Detection signal | Integration | Doc URL |
|---|---|---|
| `langchain` or `@langchain/core` (in `package.json`) | LangChain JS | https://arize.com/docs/phoenix/integrations/typescript/langchain |
| `@mastra/core` (in `package.json`) | Mastra | https://arize.com/docs/phoenix/integrations/typescript/mastra |
| `@vercel/ai` or `ai` (in `package.json` — **must** be corroborated by `@vercel/ai` in dependencies or `import { ... } from 'ai'` in source) | Vercel AI SDK | https://arize.com/docs/phoenix/integrations/typescript/vercel |
| `@i-am-bee` (in `package.json`) | BeeAI JS | https://arize.com/docs/phoenix/integrations/typescript/beeai |
| `@modelcontextprotocol` (in `package.json`) | MCP (TS) | https://arize.com/docs/phoenix/integrations/typescript/mcp |

### Java

| Detection signal | Integration | Doc URL |
|---|---|---|
| `langchain4j` (in `pom.xml` or `build.gradle`) | LangChain4j | https://arize.com/docs/phoenix/integrations/java/langchain4j |
| `spring-ai` (in `pom.xml` or `build.gradle`) | Spring AI | https://arize.com/docs/phoenix/integrations/java/springai |
| `arconia` (in `pom.xml` or `build.gradle`) | Arconia | https://arize.com/docs/phoenix/integrations/java/arconia |

### Platforms

These are UI-based platforms, not code libraries. They cannot be auto-detected from imports. If the user mentions using one, or you find platform-specific config files (e.g., Docker Compose references, deployment manifests), match them here:

| Platform | Doc URL |
|---|---|
| Dify | https://arize.com/docs/phoenix/integrations/platforms/dify |
| Flowise | https://arize.com/docs/phoenix/integrations/platforms/flowise |
| LangFlow | https://arize.com/docs/phoenix/integrations/platforms/langflow |
| Prompt flow | https://arize.com/docs/phoenix/integrations/platforms/prompt-flow |

### Fallback

If no integration matches, or for advanced use cases:

- **Setup tracing manually:** https://arize.com/docs/phoenix/tracing/how-to-tracing/setup-tracing
- **All integrations:** https://arize.com/docs/phoenix/integrations

---

## PHASE 2: IMPLEMENTATION

After the user confirms your Phase 1 analysis, implement tracing.

### 1. Fetch integration docs

Read the matched doc URLs from the routing table above. Follow the installation and instrumentation steps from those pages.

### 2. Install packages

Install the required packages using the detected package manager **before** writing any code.

- **Python:** `pip install arize-phoenix-otel` plus instrumentors (see naming convention below)
- **TypeScript/JavaScript:** `npm install @arizeai/phoenix-otel` or the relevant framework-specific `@arizeai/openinference-*` package
- **Java:** Add OpenTelemetry SDK and the relevant `openinference-instrumentation-*` dependency to `pom.xml` or `build.gradle`

### 3. Get credentials

Phoenix supports three deployment modes. Ask the user which one they are using if it's not clear from the codebase.

**Local (default):**
No authentication needed. Phoenix runs at `http://localhost:6006`.

```bash
PHOENIX_COLLECTOR_ENDPOINT=http://localhost:6006
```

**Phoenix Cloud:**
Get your **API Key** and **Collector Endpoint** from the **Settings** page in your Phoenix Cloud instance (look for the **Hostname** field). The endpoint looks like `https://app.phoenix.arize.com/s/<your-space-name>`.

```bash
PHOENIX_API_KEY=<api-key>
PHOENIX_COLLECTOR_ENDPOINT=https://app.phoenix.arize.com/s/<your-space-name>
```

**Self-hosted:**
Set the collector endpoint to your self-hosted Phoenix URL (e.g., `https://phoenix.your-company.com`). API key is required if authentication is enabled.

```bash
PHOENIX_API_KEY=<api-key>          # if auth enabled
PHOENIX_COLLECTOR_ENDPOINT=https://phoenix.your-company.com
```

### 4. Core setup patterns

Create a **single centralized instrumentation module** (e.g., `instrumentation.py`, `instrumentation.ts`). Initialize tracing **before** any LLM client is created.

#### Python (auto-instrumentation — preferred)

The simplest Python setup uses `arize-phoenix-otel` with auto-instrumentation. This automatically detects and instruments all supported libraries based on installed packages:

```python
from phoenix.otel import register

tracer_provider = register(
    project_name="your-project-name",
    auto_instrument=True,
)
```

That's it. With `auto_instrument=True`, Phoenix detects installed instrumentor packages and instruments them automatically. No manual instrumentor setup needed.

#### Python (manual instrumentors)

If `auto_instrument=True` is not desired or finer control is needed:

```python
from phoenix.otel import register

tracer_provider = register(
    project_name="your-project-name",
)

from openinference.instrumentation.openai import OpenAIInstrumentor
OpenAIInstrumentor().instrument(tracer_provider=tracer_provider)
```

##### Python instrumentor naming convention

Instrumentor packages follow a predictable pattern:

| | Pattern | Example (OpenAI) | Example (LlamaIndex) |
|---|---|---|---|
| **pip package** | `openinference-instrumentation-{name}` | `openinference-instrumentation-openai` | `openinference-instrumentation-llama-index` |
| **Import** | `openinference.instrumentation.{name}` | `openinference.instrumentation.openai` | `openinference.instrumentation.llama_index` |
| **Class** | `{Name}Instrumentor` | `OpenAIInstrumentor` | `LlamaIndexInstrumentor` |

> **Note:** pip package names use hyphens; Python module names use underscores. For multi-word names (e.g., `llama-index` → `llama_index`), convert hyphens to underscores in the import path.

#### TypeScript / JavaScript

TS/JS setup varies by framework. Fetch the matched doc URL from the routing table for framework-specific instructions.

The simplest path uses `@arizeai/phoenix-otel`:

```typescript
import { register } from "@arizeai/phoenix-otel";

register();
```

This reads `PHOENIX_COLLECTOR_ENDPOINT` and `PHOENIX_API_KEY` from environment variables.

For framework-specific setups (Mastra, Vercel AI SDK, LangChain), the doc pages provide tailored instructions. Common elements across all TS/JS setups:
- Environment variables: `PHOENIX_COLLECTOR_ENDPOINT`, `PHOENIX_API_KEY`
- All Phoenix TS packages live under the `@arizeai/` npm scope

#### Java

Java integrations use the OpenTelemetry Java SDK. The level of automation varies by framework:

**Arconia** (zero-code — recommended for Spring Boot projects):
Add dependencies and Arconia auto-configures tracing via its Spring Boot starter. No explicit OTel setup code needed — just set environment variables.

**LangChain4j** (one-liner):

```java
// After OpenTelemetry SDK initialization:
LangChain4jInstrumentor.instrument();
```

**Spring AI** (manual wiring):

```java
OITracer tracer = new OITracer(tracerProvider.get("com.example.springai"), TraceConfig.getDefault());
ObservationRegistry registry = ObservationRegistry.create();
registry.observationConfig().observationHandler(new SpringAIInstrumentor(tracer));

OpenAiChatModel model = OpenAiChatModel.builder()
    .openAiApi(openAiApi)
    .observationRegistry(registry)
    .build();
```

For full Java setup details, including OTel SDK initialization and OTLP export configuration, fetch the matched doc URL.

### 5. Handling existing OTel / tracing setup

If the codebase already has OpenTelemetry or another observability vendor configured:

- **Existing `TracerProvider` with no Phoenix exporter** — add Phoenix as an additional exporter rather than replacing the existing setup. Use a `BatchSpanProcessor` with the Phoenix OTLP exporter alongside the existing processors.
- **Existing Phoenix setup** — verify it's configured correctly and update if needed. Do not duplicate.
- **Other vendor (Datadog, Honeycomb, etc.)** — inform the user that Phoenix can run alongside other vendors via additional OTLP exporters, and ask how they'd like to proceed.

### 6. Implementation rules

- Use **auto-instrumentation first** — add manual spans only if needed
- **Fail gracefully** if environment variables are missing (warn, don't crash)
- Initialize tracing **before** any LLM client is created
- Import order matters: register tracer → instrument → create clients

---

## VERIFICATION

After implementation:

1. **Run the application** and trigger at least one LLM call
2. **Check Phoenix UI** for traces:
   - Local: http://localhost:6006
   - Phoenix Cloud: your Phoenix Cloud URL
   - Self-hosted: your Phoenix instance URL
3. **Troubleshooting:**
   - Verify `PHOENIX_COLLECTOR_ENDPOINT` is set correctly
   - Verify `PHOENIX_API_KEY` is set (if using Phoenix Cloud or auth-enabled self-hosted)
   - Ensure `register()` / `TracerProvider` initialization is called before instrumentors and client creation
   - Check network connectivity to your Phoenix instance
   - Enable debug logging: set `OTEL_LOG_LEVEL=debug` environment variable
