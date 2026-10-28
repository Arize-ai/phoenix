# Integration check inventory

This is a human-maintained onboarding checklist. CI discovers runnable docs from
`scripts/testing/integration_docs/integrations.json`; routing overrides live in
`.agents/skills/test-integration/scripts/skip_config.json`.

| Status | Integration | Document | Notes |
|---|---|---|---|
| Enabled | Microsoft Agent Framework .NET | `docs/phoenix/integrations/dotnet/microsoft-agent-framework/microsoft-agent-framework-tracing.mdx` | OpenAI-backed C# agent; installs documented NuGet packages, checks output, and verifies an LLM span. |
| Enabled | TypeSafe AI Python | `docs/phoenix/integrations/llm-providers/typesafe/typesafe-python.mdx` | Checks output and a DECISION span; skips when `TYPESAFE_API_KEY` is missing. |
| Enabled | TypeSafe AI TypeScript | `docs/phoenix/integrations/llm-providers/typesafe/typesafe-typescript.mdx` | Checks output and a DECISION span; skips when `TYPESAFE_API_KEY` is missing. |
| Enabled | Openai Python | `docs/phoenix/integrations/llm-providers/openai/openai-tracing.mdx` | Checks documented output and Phoenix spans. |
| Env-gated | Baseten Python | `docs/phoenix/integrations/llm-providers/baseten/baseten-tracing.mdx` | Runs when required credentials/settings are configured; otherwise skips. |
| Env-gated | Cerebras Python | `docs/phoenix/integrations/llm-providers/cerebras/cerebras-tracing.mdx` | Runs when required credentials/settings are configured; otherwise skips. |
| Env-gated | Deepseek Python | `docs/phoenix/integrations/llm-providers/deepseek/deepseek-tracing.mdx` | Runs when required credentials/settings are configured; otherwise skips. |
| Env-gated | Fireworks Ai Python | `docs/phoenix/integrations/llm-providers/fireworks-ai/fireworks-ai-tracing.mdx` | Runs when required credentials/settings are configured; otherwise skips. |
| Env-gated | Novita Ai Python | `docs/phoenix/integrations/llm-providers/novita-ai/novita-ai-tracing.mdx` | Runs when required credentials/settings are configured; otherwise skips. |
| Env-gated | Xai Python | `docs/phoenix/integrations/llm-providers/xai/xai-tracing.mdx` | Runs when required credentials/settings are configured; otherwise skips. |
| Env-gated | Zai Python | `docs/phoenix/integrations/llm-providers/z-ai/z-ai-tracing.mdx` | Runs when required credentials/settings are configured; otherwise skips. |
| Enabled | Openai Javascript | `docs/phoenix/integrations/llm-providers/openai/openai-node-js-sdk.mdx` | Checks documented output and Phoenix spans. |
| Enabled | Openai Go | `docs/phoenix/integrations/llm-providers/openai/openai-go-sdk.mdx` | Checks documented output and Phoenix spans. |
| Enabled | Anthropic Python | `docs/phoenix/integrations/llm-providers/anthropic/anthropic-tracing.mdx` | Checks documented output and Phoenix spans. |
| Enabled | Anthropic Javascript | `docs/phoenix/integrations/llm-providers/anthropic/anthropic-sdk-typescript.mdx` | Checks documented output and Phoenix spans. |
| Enabled | Anthropic Go | `docs/phoenix/integrations/llm-providers/anthropic/anthropic-sdk-go.mdx` | Checks documented output and Phoenix spans. |
| Enabled | Ollama Python | `docs/phoenix/integrations/llm-providers/ollama/ollama-tracing.mdx` | Checks documented output and Phoenix spans. |
| Enabled | Ollama Javascript | `docs/phoenix/integrations/llm-providers/ollama/ollama-node-js-sdk.mdx` | Checks documented output and Phoenix spans. |
| Enabled | Ollama Go | `docs/phoenix/integrations/llm-providers/ollama/ollama-go-sdk.mdx` | Checks documented output and Phoenix spans. |
| Lint-only | Amazon Bedrock Python Lint | `docs/phoenix/integrations/llm-providers/amazon-bedrock/amazon-bedrock-tracing.mdx` | Installs dependencies and syntax-checks the example. |
| Lint-only | Strands Agents Python Lint | `docs/phoenix/integrations/python/strands-agents/strands-agents-tracing.mdx` | Installs dependencies and syntax-checks the example. |
| Lint-only | Cohere Python Lint | `docs/phoenix/integrations/llm-providers/cohere/cohere-tracing.mdx` | Installs dependencies and syntax-checks the example. |
| Lint-only | Together Python Lint | `docs/phoenix/integrations/llm-providers/together/together-tracing.mdx` | Installs dependencies and syntax-checks the example. |
| Lint-only | Openrouter Python Lint | `docs/phoenix/integrations/llm-providers/openrouter/openai-tracing.mdx` | Installs dependencies and syntax-checks the example. |
| Lint-only | Orcarouter Python Lint | `docs/phoenix/integrations/llm-providers/orcarouter/openai-tracing.mdx` | Installs dependencies and syntax-checks the example. |
| Always skip | Guardrails Python | `docs/phoenix/integrations/python/guardrails-ai/guardrails-ai-tracing.mdx` | The documented framework and instrumentor target the quarantined original Guardrails package; the guide needs a rewrite before end-to-end checks can run. |
| Enabled | Langchain Python | `docs/phoenix/integrations/python/langchain/langchain-tracing.mdx` | Checks documented output and Phoenix spans. |
| Enabled | Openai Agents Typescript | `docs/phoenix/integrations/typescript/openai-agents.mdx` | Checks documented output and Phoenix spans. |
| Enabled | Instructor Python | `docs/phoenix/integrations/python/instructor/instructor-tracing.mdx` | Checks documented output and Phoenix spans. |
| Enabled | Llamaindex Python | `docs/phoenix/integrations/python/llamaindex/llamaindex-tracing.mdx` | Checks documented output and Phoenix spans. |
| Enabled | Dspy Python | `docs/phoenix/integrations/python/dspy/dspy-tracing.mdx` | Checks documented output and Phoenix spans. |
| Enabled | Haystack Python | `docs/phoenix/integrations/python/haystack/haystack-tracing.mdx` | Checks documented output and Phoenix spans. |
| Enabled | Langgraph Python | `docs/phoenix/integrations/python/langgraph/langgraph-tracing.mdx` | Checks documented output and Phoenix spans. |
| Enabled | Agno Python | `docs/phoenix/integrations/python/agno/agno-tracing.mdx` | Checks documented output and Phoenix spans. |
| Enabled | Atomic Agents Python | `docs/phoenix/integrations/python/atomic-agents/atomic-agents-tracing.mdx` | Checks documented output and Phoenix spans. |
| Enabled | Autogen Agentchat Python | `docs/phoenix/integrations/python/autogen/autogen-agentchat-tracing.mdx` | Checks documented output and Phoenix spans. |
| Enabled | Autogen Python | `docs/phoenix/integrations/python/autogen/autogen-tracing.mdx` | Checks documented output and Phoenix spans. |
| Enabled | Llamaindex Workflows Python | `docs/phoenix/integrations/python/llamaindex/llamaindex-workflows-tracing.mdx` | Checks documented output and Phoenix spans. |
| Enabled | Microsoft Agent Framework Python | `docs/phoenix/integrations/python/microsoft-agent-framework/microsoft-agent-framework-tracing.mdx` | Checks documented output and Phoenix spans. |
| Enabled | Smolagents Python | `docs/phoenix/integrations/python/hugging-face-smolagents/smolagents-tracing.mdx` | Checks documented output and Phoenix spans. |
| Enabled | Beeai Python | `docs/phoenix/integrations/python/beeai/beeai-tracing-python.mdx` | Checks documented output and Phoenix spans. |
| Enabled | Crewai Python | `docs/phoenix/integrations/python/crewai/crewai-tracing.mdx` | Checks documented output and Phoenix spans. |
| Enabled | Litellm Python | `docs/phoenix/integrations/llm-providers/litellm/litellm-tracing.mdx` | Checks documented output and Phoenix spans. |
| Enabled | Pydantic Ai Python | `docs/phoenix/integrations/python/pydantic/pydantic-tracing.mdx` | Checks documented output and Phoenix spans. |
| Enabled | Portkey Python | `docs/phoenix/integrations/python/portkey/portkey-tracing.mdx` | Checks documented output and Phoenix spans. |
| Enabled | Beeai Typescript | `docs/phoenix/integrations/typescript/beeai/beeai-tracing-js.mdx` | Checks documented output and Phoenix spans. |
| Enabled | Mastra Typescript | `docs/phoenix/integrations/typescript/mastra/mastra-tracing.mdx` | Checks documented output and Phoenix spans. |
| Enabled | Vercel Ai Sdk Typescript | `docs/phoenix/integrations/typescript/vercel/vercel-ai-sdk-tracing-js.mdx` | Checks documented output and Phoenix spans. |
| Enabled | Ag2 Python | `docs/phoenix/integrations/python/ag2/ag2-tracing.mdx` | Checks documented output and Phoenix spans. |
| Enabled | Openai Agents Python | `docs/phoenix/integrations/llm-providers/openai/openai-agents-sdk-tracing.mdx` | Checks documented output and Phoenix spans. |
| Enabled | Langchain Typescript | `docs/phoenix/integrations/typescript/langchain/langchain-js.mdx` | Checks documented output and Phoenix spans. |
| Enabled | Mcp Python | `docs/phoenix/integrations/python/mcp-tracing.mdx` | Checks documented output and Phoenix spans. |
| Enabled | Mcp Typescript | `docs/phoenix/integrations/typescript/mcp/mcp-tracing-typescript.mdx` | Checks documented output and Phoenix spans. |
| Env-gated | Doubleword Python | `docs/phoenix/integrations/llm-providers/doubleword/doubleword-tracing.mdx` | Runs when required credentials/settings are configured; otherwise skips. |
| Env-gated | Huggingface Inference Providers Python | `docs/phoenix/integrations/llm-providers/hugging-face-inference-providers/hugging-face-inference-providers-tracing.mdx` | Runs when required credentials/settings are configured; otherwise skips. |
| Env-gated | Gravitee Python | `docs/phoenix/integrations/llm-providers/gravitee/gravitee-tracing.mdx` | Runs when required credentials/settings are configured; otherwise skips. |
| Env-gated | Qwen Python | `docs/phoenix/integrations/llm-providers/qwen/qwen-tracing.mdx` | Runs when required credentials/settings are configured; otherwise skips. |
| Env-gated | Truefoundry Python | `docs/phoenix/integrations/llm-providers/truefoundry/truefoundry-tracing.mdx` | Runs when required credentials/settings are configured; otherwise skips. |
| Env-gated | Agentspec Python | `docs/phoenix/integrations/python/agentspec/agentspec-tracing.mdx` | Runs when required credentials/settings are configured; otherwise skips. |
| Always skip | Openlit Python | `docs/phoenix/integrations/python/openlit/openlit-tracing.mdx` | Routed to `always_skip` to match AX policy. |
| Env-gated | Openllmetry Python | `docs/phoenix/integrations/python/openllmetry/openllmetry-tracing.mdx` | Runs when required credentials/settings are configured; otherwise skips. |
| Env-gated | Pipecat Python | `docs/phoenix/integrations/python/pipecat/pipecat-tracing.mdx` | Runs when required credentials/settings are configured; otherwise skips. |
| Env-gated | Semantic Kernel Python | `docs/phoenix/integrations/python/semantic-kernel/semantic-kernel-tracing.mdx` | Runs when required credentials/settings are configured; otherwise skips. |
| Lint-only | Restate Python | `docs/phoenix/integrations/python/restate/restate-tracing.mdx` | Installs dependencies and syntax-checks the example. |
| Always skip | Temporal Python | `docs/phoenix/integrations/python/temporal/temporal-tracing.mdx` | Requires a Temporal server and worker that CI does not provision. |
| Lint-only | Prismml Python | `docs/phoenix/integrations/llm-providers/prismml/prismml-tracing.mdx` | Installs dependencies and syntax-checks the example. |
| Always skip | Vllm Python | `docs/phoenix/integrations/llm-providers/vllm/vllm-tracing.mdx` | Requires a locally hosted vLLM server and model runtime. |
| Always skip | Cloudflare Ai Gateway Python | `docs/phoenix/integrations/llm-providers/cloudflare-ai-gateway/cloudflare-ai-gateway-tracing.mdx` | Requires a Cloudflare AI Gateway account and configured endpoint. |
| Lint-only | Bedrock Agentcore Python | `docs/phoenix/integrations/python/bedrock-agentcore/bedrock-agentcore-tracing.mdx` | Installs dependencies and syntax-checks the example. |
| Env-gated | Tanstack Ai Typescript | `docs/phoenix/integrations/typescript/tanstack-ai/tanstack-ai-tracing.mdx` | Runs when required credentials/settings are configured; otherwise skips. |
| Lint-only | Eve Typescript Lint | `docs/phoenix/integrations/typescript/vercel/eve-tracing.mdx` | Installs dependencies and syntax-checks the example. |
| Always skip | Antigravity | `docs/phoenix/integrations/coding-agents/antigravity.mdx` | Interactive coding-agent session; no deterministic CI run. |
| Always skip | Claude Code | `docs/phoenix/integrations/coding-agents/claude-code.mdx` | Requires an interactive CLI session; no deterministic CI run. |
| Always skip | Codex | `docs/phoenix/integrations/coding-agents/codex.mdx` | Requires an interactive CLI session; no deterministic CI run. |
| Always skip | Copilot | `docs/phoenix/integrations/coding-agents/copilot.mdx` | Requires an interactive session; no deterministic CI run. |
| Always skip | Cursor | `docs/phoenix/integrations/coding-agents/cursor.mdx` | Requires an interactive IDE session; no deterministic CI run. |
| Always skip | Devin | `docs/phoenix/integrations/coding-agents/devin.mdx` | Requires a Devin-managed live session. |
| Always skip | Gemini CLI | `docs/phoenix/integrations/coding-agents/gemini.mdx` | Requires an interactive CLI session; no deterministic CI run. |
| Always skip | Kiro | `docs/phoenix/integrations/coding-agents/kiro.mdx` | Requires an interactive IDE session; no deterministic CI run. |
| Always skip | Oh My Pi | `docs/phoenix/integrations/coding-agents/oh-my-pi.mdx` | Requires an interactive terminal session; no deterministic CI run. |
| Always skip | OpenCode | `docs/phoenix/integrations/coding-agents/opencode.mdx` | Requires an interactive session; no deterministic CI run. |
| Always skip | Dify | `docs/phoenix/integrations/platforms/dify/dify-tracing.mdx` | UI configuration; no self-contained runnable example. |
| Always skip | Flowise | `docs/phoenix/integrations/platforms/flowise/flowise-tracing.mdx` | UI configuration; no self-contained runnable example. |
| Always skip | Langflow | `docs/phoenix/integrations/platforms/langflow/langflow-tracing.mdx` | UI configuration; no self-contained runnable example. |
| Always skip | Prompt Flow | `docs/phoenix/integrations/platforms/prompt-flow/prompt-flow-tracing.mdx` | Configuration guide; no self-contained runnable example. |
| Always skip | NVIDIA NeMo Agent Toolkit | `docs/phoenix/integrations/python/nvidia/nemo-agent-tracing.mdx` | External workflow/configuration setup; no self-contained runnable example. |
| Always skip | TrueFoundry platform | `docs/phoenix/integrations/platforms/truefoundry/truefoundry-tracing.mdx` | Dashboard configuration; no self-contained runnable example. |
| Always skip | OpenRouter broadcast | `docs/phoenix/integrations/llm-providers/openrouter/openrouter-broadcast.mdx` | Dashboard-side broadcast configuration; no runnable app example. |
| Always skip | n8n | `docs/phoenix/integrations/platforms/n8n/n8n-tracing.mdx` | Requires a configured server and workflow. |
| Always skip | Open WebUI | `docs/phoenix/integrations/platforms/openwebui/openwebui-tracing.mdx` | Requires a deployed app and collector. |
| Always skip | LiveKit Agents | `docs/phoenix/integrations/python/livekit-agents/livekit-agents-tracing.mdx` | Requires live session and media traffic. |

Add integrations after the runner supports their language and example shape,
credentials are declared, and the verifier checks the behavior the page promises.
Keep this inventory aligned with the harness configuration.
