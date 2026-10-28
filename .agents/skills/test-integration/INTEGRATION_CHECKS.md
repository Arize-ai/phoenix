# Integration check inventory

This is a human-maintained onboarding checklist. CI does not discover runnable
docs from this file; `scripts/testing/integration_docs/integrations.json` is the
source of truth for the currently enabled set. Changes to this inventory alone
do not trigger a full integration run.

| Status | Integration | Document | Notes |
|---|---|---|---|
| Enabled | OpenAI Python | `docs/phoenix/integrations/llm-providers/openai/openai-tracing.mdx` | Checks documented output and an LLM span with a model name. |
| Enabled | OpenAI JavaScript | `docs/phoenix/integrations/llm-providers/openai/openai-node-js-sdk.mdx` | Checks documented output and an LLM span with a model name. |
| Enabled | OpenAI Go | `docs/phoenix/integrations/llm-providers/openai/openai-go-sdk.mdx` | Checks documented output and an LLM span with a model name. |
| Enabled | Baseten Python | `docs/phoenix/integrations/llm-providers/baseten/baseten-tracing.mdx` | Checks documented output and an LLM span; requires a Baseten API key and model ID. |
| Enabled | Cerebras Python | `docs/phoenix/integrations/llm-providers/cerebras/cerebras-tracing.mdx` | Checks documented output and an LLM span; requires a Cerebras API key and model ID. |
| Enabled | DeepSeek Python | `docs/phoenix/integrations/llm-providers/deepseek/deepseek-tracing.mdx` | Checks documented output and an LLM span. |
| Enabled | Fireworks AI Python | `docs/phoenix/integrations/llm-providers/fireworks-ai/fireworks-ai-tracing.mdx` | Checks documented output and an LLM span; requires a Fireworks API key and model ID. |
| Enabled | Novita AI Python | `docs/phoenix/integrations/llm-providers/novita-ai/novita-ai-tracing.mdx` | Checks documented output and an LLM span; requires a Novita API key and model ID. |
| Enabled | xAI Python | `docs/phoenix/integrations/llm-providers/xai/xai-tracing.mdx` | Checks documented output and an LLM span. |
| Enabled | Z.ai Python | `docs/phoenix/integrations/llm-providers/z-ai/z-ai-tracing.mdx` | Checks documented output and an LLM span. |
| Enabled | Ollama Python | `docs/phoenix/integrations/llm-providers/ollama/ollama-tracing.mdx` | Native Ollama client; CI pulls `llama3.2:1b` locally. |
| Enabled | Ollama Node.js | `docs/phoenix/integrations/llm-providers/ollama/ollama-node-js-sdk.mdx` | OpenAI SDK via Ollama's OpenAI-compatible API; CI pulls `llama3.2:1b`. |
| Enabled | Ollama Go | `docs/phoenix/integrations/llm-providers/ollama/ollama-go-sdk.mdx` | OpenAI SDK via Ollama's OpenAI-compatible API; CI pulls `llama3.2:1b`. |
| Enabled | LangChain Python | `docs/phoenix/integrations/python/langchain/langchain-tracing.mdx` | OpenAI-backed Python framework; checks output and an LLM span. |
| Enabled | OpenAI Agents SDK TypeScript | `docs/phoenix/integrations/typescript/openai-agents.mdx` | Checks output and an LLM span; flushes before the short-lived script exits. |
| Enabled | Anthropic Python | `docs/phoenix/integrations/llm-providers/anthropic/anthropic-tracing.mdx` | Checks output and an LLM span. |
| Enabled | Anthropic TypeScript | `docs/phoenix/integrations/llm-providers/anthropic/anthropic-sdk-typescript.mdx` | Checks output and an LLM span. |
| Enabled | Anthropic Go | `docs/phoenix/integrations/llm-providers/anthropic/anthropic-sdk-go.mdx` | Checks output and an LLM span. |
| Enabled | OpenAI Agents SDK Python | `docs/phoenix/integrations/llm-providers/openai/openai-agents-sdk-tracing.mdx` | Checks output and an LLM span; flushes before the short-lived script exits. |
| Enabled | Instructor Python | `docs/phoenix/integrations/python/instructor/instructor-tracing.mdx` | OpenAI-backed structured output; checks output and an LLM span. |
| Enabled | LlamaIndex Python | `docs/phoenix/integrations/python/llamaindex/llamaindex-tracing.mdx` | OpenAI-backed LlamaIndex call; checks output and an LLM span. |
| Enabled | DSPy Python | `docs/phoenix/integrations/python/dspy/dspy-tracing.mdx` | OpenAI-backed DSPy prediction; checks output and an LLM span. |
| Enabled | Haystack Python | `docs/phoenix/integrations/python/haystack/haystack-tracing.mdx` | OpenAI-backed pipeline; checks output and an LLM span. |
| Enabled | LangGraph Python | `docs/phoenix/integrations/python/langgraph/langgraph-tracing.mdx` | OpenAI-backed tool-calling agent; checks output and an LLM span. |
| Enabled | Agno Python | `docs/phoenix/integrations/python/agno/agno-tracing.mdx` | OpenAI-backed agent; checks output and an LLM span. |
| Enabled | Atomic Agents Python | `docs/phoenix/integrations/python/atomic-agents/atomic-agents-tracing.mdx` | OpenAI-backed multi-agent example; checks output and an LLM span. |
| Enabled | AutoGen AgentChat Python | `docs/phoenix/integrations/python/autogen/autogen-agentchat-tracing.mdx` | OpenAI-backed AgentChat team; checks output and an LLM span. |
| Enabled | AutoGen Python | `docs/phoenix/integrations/python/autogen/autogen-tracing.mdx` | OpenAI-backed AutoGen Classic; checks output and an LLM span. |
| Enabled | LlamaIndex Workflows Python | `docs/phoenix/integrations/python/llamaindex/llamaindex-workflows-tracing.mdx` | OpenAI call inside a LlamaIndex workflow; checks output and an LLM span. |
| Deferred | Guardrails AI Python | `docs/phoenix/integrations/python/guardrails-ai/guardrails-ai-tracing.mdx` | Legacy Guardrails SDK and instrumentor are incompatible; AX skips this doc pending a rewrite for the replacement SDK. |
| Enabled | Microsoft Agent Framework Python | `docs/phoenix/integrations/python/microsoft-agent-framework/microsoft-agent-framework-tracing.mdx` | OpenAI-backed agent; checks output and an LLM span. |
| Enabled | smolagents Python | `docs/phoenix/integrations/python/hugging-face-smolagents/smolagents-tracing.mdx` | OpenAI-backed agent; checks output and an LLM span. |
| Enabled | AG2 Python | `docs/phoenix/integrations/python/ag2/ag2-tracing.mdx` | AG2 Classic with OpenAI; checks output and an LLM span. |
| Enabled | BeeAI Python | `docs/phoenix/integrations/python/beeai/beeai-tracing-python.mdx` | OpenAI-backed agent; checks output and an LLM span. |
| Enabled | CrewAI Python | `docs/phoenix/integrations/python/crewai/crewai-tracing.mdx` | OpenAI-backed crew; checks output and an LLM span. |
| Enabled | MCP Python | `docs/phoenix/integrations/python/mcp-tracing.mdx` | OpenAI Agents client with a local MCP server; checks output and an LLM span. |
| Enabled | LiteLLM Python | `docs/phoenix/integrations/llm-providers/litellm/litellm-tracing.mdx` | OpenAI-backed LiteLLM call; checks output and an LLM span. |
| Enabled | Pydantic AI Python | `docs/phoenix/integrations/python/pydantic/pydantic-tracing.mdx` | OpenAI-backed agent; checks output and an LLM span. |
| Enabled | Portkey Python | `docs/phoenix/integrations/python/portkey/portkey-tracing.mdx` | Needs `PORTKEY_API_KEY` as well as OpenAI; skips in CI until that secret is added. |
| Enabled | LangChain.js | `docs/phoenix/integrations/typescript/langchain/langchain-js.mdx` | Anthropic-backed LangChain.js agent; checks output and an LLM span. |
| Enabled | BeeAI TypeScript | `docs/phoenix/integrations/typescript/beeai/beeai-tracing-js.mdx` | OpenAI-backed agent; checks output and an LLM span. |
| Enabled | Mastra TypeScript | `docs/phoenix/integrations/typescript/mastra/mastra-tracing.mdx` | OpenAI-backed agent; checks output and an LLM span. |
| Enabled | MCP TypeScript | `docs/phoenix/integrations/typescript/mcp/mcp-tracing-typescript.mdx` | Runs an MCP client and server; checks the documented tool span. |
| Enabled | Vercel AI SDK TypeScript | `docs/phoenix/integrations/typescript/vercel/vercel-ai-sdk-tracing-js.mdx` | OpenAI-backed generateText call; checks output and an LLM span. |

| Lint-only | Amazon Bedrock Python | `docs/phoenix/integrations/llm-providers/amazon-bedrock/amazon-bedrock-tracing.mdx` | Installs dependencies and syntax-checks; CI credentials cannot reliably access Bedrock. |
| Lint-only | Strands Agents Python | `docs/phoenix/integrations/python/strands-agents/strands-agents-tracing.mdx` | Installs dependencies and syntax-checks; uses Bedrock credentials unavailable to CI. |
| Lint-only | Cohere Python | `docs/phoenix/integrations/llm-providers/cohere/cohere-tracing.mdx` | Installs dependencies and syntax-checks; no Cohere key is configured for CI. |
| Lint-only | Together AI Python | `docs/phoenix/integrations/llm-providers/together/together-tracing.mdx` | Installs dependencies and syntax-checks; no stable provider credits are available for CI. |
| Lint-only | OpenRouter Python | `docs/phoenix/integrations/llm-providers/openrouter/openai-tracing.mdx` | Installs dependencies and syntax-checks; no stable provider credits are available for CI. |
| Lint-only | OrcaRouter Python | `docs/phoenix/integrations/llm-providers/orcarouter/openai-tracing.mdx` | Installs dependencies and syntax-checks; no OrcaRouter API key is configured for CI. |

| Skipped | Guardrails AI Python | `docs/phoenix/integrations/python/guardrails-ai/guardrails-ai-tracing.mdx` | AX quarantine: legacy framework and instrumentor need a coordinated rewrite for the replacement SDK. |

Add integrations one at a time after the runner supports their language and
example shape, credentials are declared, and the verifier checks the behavior
the page promises. Do not add an integration here as a substitute for enabling
it in `integrations.json`.
| Enabled | LangChain Python | `docs/phoenix/integrations/python/langchain/langchain-tracing.mdx` | OpenAI-backed Python framework; checks output and an LLM span. |
| Enabled | OpenAI Agents SDK TypeScript | `docs/phoenix/integrations/typescript/openai-agents.mdx` | Checks output and an LLM span; flushes before the short-lived script exits. |
| Enabled | Instructor Python | `docs/phoenix/integrations/python/instructor/instructor-tracing.mdx` | OpenAI-backed structured output; checks output and an LLM span. |
| Enabled | LlamaIndex Python | `docs/phoenix/integrations/python/llamaindex/llamaindex-tracing.mdx` | OpenAI-backed LlamaIndex call; checks output and an LLM span. |
| Enabled | DSPy Python | `docs/phoenix/integrations/python/dspy/dspy-tracing.mdx` | OpenAI-backed DSPy prediction; checks output and an LLM span. |
| Enabled | Haystack Python | `docs/phoenix/integrations/python/haystack/haystack-tracing.mdx` | OpenAI-backed pipeline; checks output and an LLM span. |
| Enabled | LangGraph Python | `docs/phoenix/integrations/python/langgraph/langgraph-tracing.mdx` | OpenAI-backed tool-calling agent; checks output and an LLM span. |
| Enabled | Agno Python | `docs/phoenix/integrations/python/agno/agno-tracing.mdx` | OpenAI-backed agent; checks output and an LLM span. |
| Enabled | Atomic Agents Python | `docs/phoenix/integrations/python/atomic-agents/atomic-agents-tracing.mdx` | OpenAI-backed multi-agent example; checks output and an LLM span. |
| Enabled | AutoGen AgentChat Python | `docs/phoenix/integrations/python/autogen/autogen-agentchat-tracing.mdx` | OpenAI-backed AgentChat team; checks output and an LLM span. |
| Enabled | AutoGen Python | `docs/phoenix/integrations/python/autogen/autogen-tracing.mdx` | OpenAI-backed AutoGen Classic; checks output and an LLM span. |
| Enabled | LlamaIndex Workflows Python | `docs/phoenix/integrations/python/llamaindex/llamaindex-workflows-tracing.mdx` | OpenAI call inside a LlamaIndex workflow; checks output and an LLM span. |
| Deferred | Guardrails AI Python | `docs/phoenix/integrations/python/guardrails-ai/guardrails-ai-tracing.mdx` | Legacy Guardrails SDK and instrumentor are incompatible; AX skips this doc pending a rewrite for the replacement SDK. |
| Enabled | Microsoft Agent Framework Python | `docs/phoenix/integrations/python/microsoft-agent-framework/microsoft-agent-framework-tracing.mdx` | OpenAI-backed agent; checks output and an LLM span. |
| Enabled | smolagents Python | `docs/phoenix/integrations/python/hugging-face-smolagents/smolagents-tracing.mdx` | OpenAI-backed agent; checks output and an LLM span. |
| Enabled | AG2 Python | `docs/phoenix/integrations/python/ag2/ag2-tracing.mdx` | AG2 Classic with OpenAI; checks output and an LLM span. |
| Enabled | BeeAI Python | `docs/phoenix/integrations/python/beeai/beeai-tracing-python.mdx` | OpenAI-backed agent; checks output and an LLM span. |
| Enabled | CrewAI Python | `docs/phoenix/integrations/python/crewai/crewai-tracing.mdx` | OpenAI-backed crew; checks output and an LLM span. |
| Enabled | MCP Python | `docs/phoenix/integrations/python/mcp-tracing.mdx` | OpenAI Agents client with a local MCP server; checks output and an LLM span. |
| Enabled | LiteLLM Python | `docs/phoenix/integrations/llm-providers/litellm/litellm-tracing.mdx` | OpenAI-backed LiteLLM call; checks output and an LLM span. |
| Enabled | Pydantic AI Python | `docs/phoenix/integrations/python/pydantic/pydantic-tracing.mdx` | OpenAI-backed agent; checks output and an LLM span. |
| Enabled | Portkey Python | `docs/phoenix/integrations/python/portkey/portkey-tracing.mdx` | OpenAI-backed Portkey call; checks output and an LLM span. |
| Enabled | LangChain.js | `docs/phoenix/integrations/typescript/langchain/langchain-js.mdx` | Anthropic-backed LangChain.js agent; checks output and an LLM span. |
| Enabled | BeeAI TypeScript | `docs/phoenix/integrations/typescript/beeai/beeai-tracing-js.mdx` | OpenAI-backed agent; checks output and an LLM span. |
| Enabled | Mastra TypeScript | `docs/phoenix/integrations/typescript/mastra/mastra-tracing.mdx` | OpenAI-backed agent; checks output and an LLM span. |
| Enabled | MCP TypeScript | `docs/phoenix/integrations/typescript/mcp/mcp-tracing-typescript.mdx` | Runs an MCP client and server; checks the documented tool span. |
| Enabled | Vercel AI SDK TypeScript | `docs/phoenix/integrations/typescript/vercel/vercel-ai-sdk-tracing-js.mdx` | OpenAI-backed generateText call; checks output and an LLM span. |
