import { Icon, Icons } from "@phoenix/components";
import { GenerativeProviderIcon } from "@phoenix/components/generative/GenerativeProviderIcon";
import {
  AgnoSVG,
  AnthropicSVG,
  AutogenSVG,
  BasetenSVG,
  BedrockSVG,
  BeeAISVG,
  ClaudeSVG,
  CloudflareSVG,
  CrewAISVG,
  DifySVG,
  DSPYSVG,
  GeminiSVG,
  GoogleADKSVG,
  GroqSVG,
  HaystackSVG,
  HuggingFaceSVG,
  LangChainSVG,
  LangGraphSVG,
  LiteLLMSVG,
  LlamaIndexSVG,
  MastraSVG,
  MistralAISVG,
  OpenAISVG,
  OpenRouterSVG,
  PortkeySVG,
  PydanticAISVG,
  StrandsAgentsSVG,
  TraceLoopSVG,
  VercelSVG,
  VertexAISVG,
} from "@phoenix/components/project/IntegrationIcons";
import {
  getAgnoCodePython,
  getAnthropicCodePython,
  getAnthropicCodeTypescript,
  getBasetenCodePython,
  getBasetenCodeTypescript,
  getCerebrasCodePython,
  getCerebrasCodeTypescript,
  getCloudflareCodePython,
  getCloudflareCodeTypescript,
  getFireworksCodePython,
  getFireworksCodeTypescript,
  getLangchainCodePython,
  getLangchainCodeTypescript,
  getLanggraphCodePython,
  getLanggraphCodeTypescript,
  getLlamaIndexCodePython,
  getMastraCodeTypescript,
  getOpenaiAgentsCodePython,
  getOpenaiCodePython,
  getOpenaiCodeTypescript,
  getOpenLLMetryCodePython,
  getOpenRouterCodePython,
  getOpenRouterCodeTypescript,
  getOtelInitCodePython,
  getOtelInitCodeTypescript,
  getStrandsAgentsCodePython,
  getPerplexityCodePython,
  getPerplexityCodeTypescript,
  getTogetherCodePython,
  getTogetherCodeTypescript,
  getVercelAiSdkCodeTypescript,
  getXaiCodePython,
  getXaiCodeTypescript,
} from "@phoenix/components/project/integrationSnippets";

import type { EnvVar, OnboardingIntegration } from "./integrationDefinitions";

const OPENAI_ENV: readonly EnvVar[] = [
  { name: "OPENAI_API_KEY", value: "<your-openai-api-key>" },
];
const ANTHROPIC_ENV: readonly EnvVar[] = [
  { name: "ANTHROPIC_API_KEY", value: "<your-anthropic-api-key>" },
];
const OPENROUTER_ENV: readonly EnvVar[] = [
  { name: "OPENROUTER_API_KEY", value: "<your-openrouter-api-key>" },
];
const CEREBRAS_ENV: readonly EnvVar[] = [
  { name: "CEREBRAS_API_KEY", value: "<your-cerebras-api-key>" },
];
const FIREWORKS_ENV: readonly EnvVar[] = [
  { name: "FIREWORKS_API_KEY", value: "<your-fireworks-api-key>" },
];
const PERPLEXITY_ENV: readonly EnvVar[] = [
  { name: "PERPLEXITY_API_KEY", value: "<your-perplexity-api-key>" },
];
const TOGETHER_ENV: readonly EnvVar[] = [
  { name: "TOGETHER_API_KEY", value: "<your-together-api-key>" },
];
const XAI_ENV: readonly EnvVar[] = [
  { name: "XAI_API_KEY", value: "<your-xai-api-key>" },
];
const BASETEN_ENV: readonly EnvVar[] = [
  { name: "BASETEN_API_KEY", value: "<your-baseten-api-key>" },
];
const CLOUDFLARE_ENV: readonly EnvVar[] = [
  { name: "CLOUDFLARE_API_KEY", value: "<your-cloudflare-api-key>" },
  { name: "CLOUDFLARE_ACCOUNT_ID", value: "<your-account-id>" },
];

export const DEFAULT_INTEGRATION_ID = "phoenix-otel";

export const ONBOARDING_INTEGRATIONS: OnboardingIntegration[] = [
  {
    id: "phoenix-otel",
    name: "Trace your app",
    icon: <Icon svg={<Icons.Trace />} />,
    configs: {
      Python: {
        packages: ["arize-phoenix-otel"],
        getImplementationCode: getOtelInitCodePython,
        docsHref:
          "https://arize.com/docs/phoenix/tracing/how-to-tracing/setup-tracing/instrument#python",
        githubHref:
          "https://github.com/Arize-ai/openinference/tree/f897cd19ef39a15fea9ee3a8f5a6e929d7a54bf1/python/openinference-instrumentation",
      },
      TypeScript: {
        packages: ["@arizeai/phoenix-otel", "@arizeai/openinference-core"],
        getImplementationCode: getOtelInitCodeTypescript,
        docsHref:
          "https://arize.com/docs/phoenix/tracing/how-to-tracing/setup-tracing/instrument#typescript",
        githubHref:
          "https://github.com/arize-ai/openinference/tree/main/js/packages/openinference-core",
      },
    },
  },
  {
    id: "langgraph",
    name: "LangGraph",
    icon: <LangGraphSVG />,
    configs: {
      Python: {
        packages: [
          "arize-phoenix-otel",
          "openinference-instrumentation-langchain",
          "langgraph",
          "langchain-openai",
        ],
        getImplementationCode: getLanggraphCodePython,
        envVars: OPENAI_ENV,
        docsHref:
          "https://arize.com/docs/phoenix/tracing/integrations-tracing/langchain",
        githubHref:
          "https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-langchain",
      },
      TypeScript: {
        packages: [
          "@arizeai/phoenix-otel",
          "@arizeai/openinference-instrumentation-langchain",
          "@langchain/core",
          "@langchain/langgraph",
          "@langchain/openai",
        ],
        getImplementationCode: getLanggraphCodeTypescript,
        envVars: OPENAI_ENV,
        docsHref:
          "https://arize.com/docs/phoenix/integrations/typescript/langchain",
        githubHref:
          "https://github.com/Arize-ai/openinference/tree/main/js/packages/openinference-instrumentation-langchain",
      },
    },
  },
  {
    id: "langchain",
    name: "LangChain",
    icon: <LangChainSVG />,
    configs: {
      Python: {
        packages: [
          "arize-phoenix-otel",
          "openinference-instrumentation-langchain",
          "langchain-openai",
        ],
        getImplementationCode: getLangchainCodePython,
        envVars: OPENAI_ENV,
        docsHref:
          "https://arize.com/docs/phoenix/tracing/integrations-tracing/langchain",
        githubHref:
          "https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-langchain",
      },
      TypeScript: {
        packages: [
          "@arizeai/phoenix-otel",
          "@arizeai/openinference-instrumentation-langchain",
          "@langchain/core",
          "@langchain/openai",
        ],
        getImplementationCode: getLangchainCodeTypescript,
        envVars: OPENAI_ENV,
        docsHref:
          "https://arize.com/docs/phoenix/integrations/typescript/langchain",
        githubHref:
          "https://github.com/Arize-ai/openinference/tree/main/js/packages/openinference-instrumentation-langchain",
      },
    },
  },
  {
    id: "openai",
    name: "OpenAI",
    icon: <OpenAISVG />,
    configs: {
      Python: {
        packages: [
          "arize-phoenix-otel",
          "openinference-instrumentation-openai",
          "openai",
        ],
        getImplementationCode: getOpenaiCodePython,
        envVars: OPENAI_ENV,
        docsHref:
          "https://arize.com/docs/phoenix/integrations/llm-providers/openai",
        githubHref:
          "https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-openai",
      },
      TypeScript: {
        packages: [
          "@arizeai/phoenix-otel",
          "@arizeai/openinference-instrumentation-openai",
          "openai",
        ],
        getImplementationCode: getOpenaiCodeTypescript,
        envVars: OPENAI_ENV,
        docsHref:
          "https://arize.com/docs/phoenix/integrations/llm-providers/openai/openai-node-js-sdk",
        githubHref:
          "https://github.com/Arize-ai/openinference/tree/main/js/packages/openinference-instrumentation-openai",
      },
    },
  },
  {
    id: "llama-index",
    name: "LlamaIndex",
    icon: <LlamaIndexSVG />,
    configs: {
      Python: {
        packages: [
          "arize-phoenix-otel",
          "openinference-instrumentation-llama-index",
          "llama-index",
          "llama-index-llms-openai",
        ],
        getImplementationCode: getLlamaIndexCodePython,
        envVars: OPENAI_ENV,
        docsHref:
          "https://arize.com/docs/phoenix/tracing/integrations-tracing/llamaindex",
        githubHref:
          "https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-llama-index",
      },
    },
  },
  {
    id: "agno",
    name: "Agno",
    icon: <AgnoSVG />,
    configs: {
      Python: {
        packages: [
          "arize-phoenix-otel",
          "openinference-instrumentation-agno",
          "agno",
          "openai",
        ],
        getImplementationCode: getAgnoCodePython,
        envVars: OPENAI_ENV,
        docsHref:
          "https://arize.com/docs/phoenix/tracing/integrations-tracing/agno",
        githubHref:
          "https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-agno",
      },
    },
  },
  {
    id: "openai-agents",
    name: "OpenAI Agents",
    icon: <OpenAISVG />,
    configs: {
      Python: {
        packages: [
          "arize-phoenix-otel",
          "openinference-instrumentation-openai-agents",
          "openai-agents",
        ],
        getImplementationCode: getOpenaiAgentsCodePython,
        envVars: OPENAI_ENV,
        docsHref:
          "https://arize.com/docs/phoenix/integrations/llm-providers/openai-agents-sdk",
        githubHref:
          "https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-openai-agents",
      },
    },
  },
  {
    id: "strands-agents",
    name: "Strands Agents",
    icon: <StrandsAgentsSVG />,
    configs: {
      Python: {
        packages: [
          "arize-phoenix-otel",
          "openinference-instrumentation-strands-agents",
          "strands-agents",
          "openai",
        ],
        getImplementationCode: getStrandsAgentsCodePython,
        docsHref:
          "https://arize.com/docs/phoenix/integrations/python/strands-agents/strands-agents-tracing",
        githubHref:
          "https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-strands-agents",
      },
    },
  },
  {
    id: "haystack",
    name: "Haystack",
    icon: <HaystackSVG />,
    configs: {
      Python: {
        docsHref:
          "https://arize.com/docs/phoenix/tracing/integrations-tracing/haystack",
        githubHref:
          "https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-haystack",
      },
    },
  },
  {
    id: "google-adk",
    name: "Google ADK",
    icon: <GoogleADKSVG />,
    configs: {
      Python: {
        docsHref:
          "https://arize.com/docs/phoenix/integrations/llm-providers/google-gen-ai/google-adk-tracing",
        githubHref:
          "https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-google-adk",
      },
    },
  },
  {
    id: "gemini",
    name: "Gemini",
    icon: <GeminiSVG />,
    configs: {
      Python: {
        docsHref:
          "https://arize.com/docs/phoenix/tracing/integrations-tracing/google-genai",
        githubHref:
          "https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-google-genai",
      },
    },
  },
  {
    id: "litellm",
    name: "LiteLLM",
    icon: <LiteLLMSVG />,
    configs: {
      Python: {
        docsHref:
          "https://arize.com/docs/phoenix/integrations/llm-providers/litellm",
        githubHref:
          "https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-litellm",
      },
    },
  },
  {
    id: "vercel-ai-sdk",
    name: "AI SDK",
    icon: <VercelSVG />,
    configs: {
      TypeScript: {
        packages: ["@arizeai/phoenix-otel", "ai", "@ai-sdk/openai"],
        getImplementationCode: getVercelAiSdkCodeTypescript,
        envVars: OPENAI_ENV,
        docsHref:
          "https://arize.com/docs/phoenix/tracing/integrations-tracing/vercel-ai-sdk",
        githubHref:
          "https://github.com/Arize-ai/openinference/tree/main/js/packages/openinference-vercel",
      },
    },
  },
  {
    id: "anthropic",
    name: "Anthropic",
    icon: <AnthropicSVG />,
    configs: {
      Python: {
        packages: [
          "arize-phoenix-otel",
          "openinference-instrumentation-anthropic",
          "anthropic",
        ],
        getImplementationCode: getAnthropicCodePython,
        envVars: ANTHROPIC_ENV,
        docsHref:
          "https://arize.com/docs/phoenix/tracing/integrations-tracing/anthropic",
        githubHref:
          "https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-anthropic",
      },
      TypeScript: {
        packages: [
          "@arizeai/phoenix-otel",
          "@arizeai/openinference-instrumentation-anthropic",
          "@anthropic-ai/sdk",
        ],
        getImplementationCode: getAnthropicCodeTypescript,
        envVars: ANTHROPIC_ENV,
        docsHref:
          "https://arize.com/docs/phoenix/integrations/llm-providers/anthropic/anthropic-sdk-typescript",
        githubHref:
          "https://github.com/Arize-ai/openinference/tree/main/js/packages/openinference-instrumentation-anthropic",
      },
    },
  },
  {
    id: "claude-agent-sdk",
    name: "Claude Agent SDK",
    icon: <ClaudeSVG />,
    configs: {
      Python: {
        docsHref:
          "https://arize.com/docs/phoenix/integrations/python/claude-agent-sdk",
      },
      TypeScript: {
        docsHref:
          "https://arize.com/docs/phoenix/integrations/typescript/claude-agent-sdk",
      },
    },
  },
  {
    id: "bedrock",
    name: "Bedrock",
    icon: <BedrockSVG />,
    configs: {
      Python: {
        docsHref:
          "https://arize.com/docs/phoenix/integrations/llm-providers/amazon-bedrock/amazon-bedrock-tracing",
        githubHref:
          "https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-bedrock",
      },
      TypeScript: {
        docsHref:
          "https://arize.com/docs/phoenix/integrations/llm-providers/amazon-bedrock/amazon-bedrock-sdk-js",
        githubHref:
          "https://github.com/Arize-ai/openinference/tree/main/js/packages/openinference-instrumentation-bedrock",
      },
    },
  },
  {
    id: "dspy",
    name: "DSPy",
    icon: <DSPYSVG />,
    configs: {
      Python: {
        docsHref:
          "https://arize.com/docs/phoenix/tracing/integrations-tracing/dspy",
        githubHref:
          "https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-dspy",
      },
    },
  },
  {
    id: "crewai",
    name: "CrewAI",
    icon: <CrewAISVG />,
    configs: {
      Python: {
        docsHref:
          "https://arize.com/docs/phoenix/tracing/integrations-tracing/crewai",
        githubHref:
          "https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-crewai",
      },
    },
  },
  {
    id: "vertex-ai",
    name: "VertexAI",
    icon: <VertexAISVG />,
    configs: {
      Python: {
        docsHref:
          "https://arize.com/docs/phoenix/integrations/llm-providers/vertexai",
        githubHref:
          "https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-vertexai",
      },
    },
  },
  {
    id: "portkey",
    name: "Portkey",
    icon: <PortkeySVG />,
    configs: {
      Python: {
        docsHref: "https://arize.com/docs/phoenix/integrations/python/portkey",
        githubHref:
          "https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-portkey",
      },
    },
  },
  {
    id: "smolagents",
    name: "Smolagents",
    icon: <HuggingFaceSVG />,
    configs: {
      Python: {
        docsHref:
          "https://arize.com/docs/phoenix/tracing/integrations-tracing/hfsmolagents",
        githubHref:
          "https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-smolagents",
      },
    },
  },
  {
    id: "pydantic-ai",
    name: "PydanticAI",
    icon: <PydanticAISVG />,
    configs: {
      Python: {
        docsHref: "https://arize.com/docs/phoenix/integrations/python/pydantic",
        githubHref:
          "https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-pydantic-ai",
      },
    },
  },
  {
    id: "beeai",
    name: "BeeAI",
    icon: <BeeAISVG />,
    configs: {
      Python: {
        docsHref: "https://arize.com/docs/phoenix/integrations/python/beeai",
        githubHref:
          "https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-beeai",
      },
      TypeScript: {
        docsHref:
          "https://arize.com/docs/phoenix/integrations/typescript/beeai",
        githubHref:
          "https://github.com/Arize-ai/openinference/tree/main/js/packages/openinference-instrumentation-beeai",
      },
    },
  },
  {
    id: "mastra",
    name: "Mastra",
    icon: <MastraSVG />,
    configs: {
      TypeScript: {
        packages: [
          "@mastra/arize",
          "@mastra/observability",
          "@mastra/core",
          "@ai-sdk/openai",
        ],
        getImplementationCode: getMastraCodeTypescript,
        envVars: OPENAI_ENV,
        docsHref:
          "https://arize.com/docs/phoenix/integrations/typescript/mastra/mastra-tracing",
        githubHref:
          "https://github.com/Arize-ai/openinference/tree/main/js/packages/openinference-mastra",
      },
    },
  },
  {
    id: "mistral-ai",
    name: "MistralAI",
    icon: <MistralAISVG />,
    configs: {
      Python: {
        docsHref:
          "https://arize.com/docs/phoenix/tracing/integrations-tracing/mistralai",
        githubHref:
          "https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-mistralai",
      },
    },
  },
  {
    id: "groq",
    name: "Groq",
    icon: <GroqSVG />,
    configs: {
      Python: {
        docsHref:
          "https://arize.com/docs/phoenix/tracing/integrations-tracing/groq",
        githubHref:
          "https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-groq",
      },
    },
  },
  {
    id: "autogen",
    name: "AutoGen",
    icon: <AutogenSVG />,
    configs: {
      Python: {
        docsHref: "https://arize.com/docs/phoenix/integrations/python/autogen",
        githubHref:
          "https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-autogen",
      },
    },
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    icon: <OpenRouterSVG />,
    configs: {
      Python: {
        packages: [
          "arize-phoenix-otel",
          "openinference-instrumentation-openai",
          "openai",
        ],
        getImplementationCode: getOpenRouterCodePython,
        envVars: OPENROUTER_ENV,
        docsHref:
          "https://arize.com/docs/phoenix/integrations/llm-providers/openrouter/openai-tracing",
        githubHref:
          "https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-openai",
      },
      TypeScript: {
        packages: [
          "@arizeai/phoenix-otel",
          "@arizeai/openinference-instrumentation-openai",
          "openai",
        ],
        getImplementationCode: getOpenRouterCodeTypescript,
        envVars: OPENROUTER_ENV,
        docsHref:
          "https://arize.com/docs/phoenix/integrations/llm-providers/openrouter/openai-tracing",
        githubHref:
          "https://github.com/Arize-ai/openinference/tree/main/js/packages/openinference-instrumentation-openai",
      },
    },
  },
  {
    id: "cerebras",
    name: "Cerebras",
    icon: <GenerativeProviderIcon provider="CEREBRAS" height={32} />,
    configs: {
      Python: {
        packages: [
          "arize-phoenix-otel",
          "openinference-instrumentation-openai",
          "openai",
        ],
        getImplementationCode: getCerebrasCodePython,
        envVars: CEREBRAS_ENV,
        docsHref:
          "https://arize.com/docs/phoenix/integrations/llm-providers/openai",
        githubHref:
          "https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-openai",
      },
      TypeScript: {
        packages: [
          "@arizeai/phoenix-otel",
          "@arizeai/openinference-instrumentation-openai",
          "openai",
        ],
        getImplementationCode: getCerebrasCodeTypescript,
        envVars: CEREBRAS_ENV,
        docsHref:
          "https://arize.com/docs/phoenix/integrations/llm-providers/openai",
        githubHref:
          "https://github.com/Arize-ai/openinference/tree/main/js/packages/openinference-instrumentation-openai",
      },
    },
  },
  {
    id: "fireworks",
    name: "Fireworks",
    icon: <GenerativeProviderIcon provider="FIREWORKS" height={32} />,
    configs: {
      Python: {
        packages: [
          "arize-phoenix-otel",
          "openinference-instrumentation-openai",
          "openai",
        ],
        getImplementationCode: getFireworksCodePython,
        envVars: FIREWORKS_ENV,
        docsHref:
          "https://arize.com/docs/phoenix/integrations/llm-providers/openai",
        githubHref:
          "https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-openai",
      },
      TypeScript: {
        packages: [
          "@arizeai/phoenix-otel",
          "@arizeai/openinference-instrumentation-openai",
          "openai",
        ],
        getImplementationCode: getFireworksCodeTypescript,
        envVars: FIREWORKS_ENV,
        docsHref:
          "https://arize.com/docs/phoenix/integrations/llm-providers/openai",
        githubHref:
          "https://github.com/Arize-ai/openinference/tree/main/js/packages/openinference-instrumentation-openai",
      },
    },
  },
  {
    id: "perplexity",
    name: "Perplexity",
    icon: <GenerativeProviderIcon provider="PERPLEXITY" height={32} />,
    configs: {
      Python: {
        packages: [
          "arize-phoenix-otel",
          "openinference-instrumentation-openai",
          "openai",
        ],
        getImplementationCode: getPerplexityCodePython,
        envVars: PERPLEXITY_ENV,
        docsHref:
          "https://arize.com/docs/phoenix/integrations/llm-providers/openai",
        githubHref:
          "https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-openai",
      },
      TypeScript: {
        packages: [
          "@arizeai/phoenix-otel",
          "@arizeai/openinference-instrumentation-openai",
          "openai",
        ],
        getImplementationCode: getPerplexityCodeTypescript,
        envVars: PERPLEXITY_ENV,
        docsHref:
          "https://arize.com/docs/phoenix/integrations/llm-providers/openai",
        githubHref:
          "https://github.com/Arize-ai/openinference/tree/main/js/packages/openinference-instrumentation-openai",
      },
    },
  },
  {
    id: "together",
    name: "Together",
    icon: <GenerativeProviderIcon provider="TOGETHER" height={32} />,
    configs: {
      Python: {
        packages: [
          "arize-phoenix-otel",
          "openinference-instrumentation-openai",
          "openai",
        ],
        getImplementationCode: getTogetherCodePython,
        envVars: TOGETHER_ENV,
        docsHref:
          "https://arize.com/docs/phoenix/integrations/llm-providers/openai",
        githubHref:
          "https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-openai",
      },
      TypeScript: {
        packages: [
          "@arizeai/phoenix-otel",
          "@arizeai/openinference-instrumentation-openai",
          "openai",
        ],
        getImplementationCode: getTogetherCodeTypescript,
        envVars: TOGETHER_ENV,
        docsHref:
          "https://arize.com/docs/phoenix/integrations/llm-providers/openai",
        githubHref:
          "https://github.com/Arize-ai/openinference/tree/main/js/packages/openinference-instrumentation-openai",
      },
    },
  },
  {
    id: "xai",
    name: "xAI",
    icon: <GenerativeProviderIcon provider="XAI" height={32} />,
    configs: {
      Python: {
        packages: [
          "arize-phoenix-otel",
          "openinference-instrumentation-openai",
          "openai",
        ],
        getImplementationCode: getXaiCodePython,
        envVars: XAI_ENV,
        docsHref:
          "https://arize.com/docs/phoenix/integrations/llm-providers/openai",
        githubHref:
          "https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-openai",
      },
      TypeScript: {
        packages: [
          "@arizeai/phoenix-otel",
          "@arizeai/openinference-instrumentation-openai",
          "openai",
        ],
        getImplementationCode: getXaiCodeTypescript,
        envVars: XAI_ENV,
        docsHref:
          "https://arize.com/docs/phoenix/integrations/llm-providers/openai",
        githubHref:
          "https://github.com/Arize-ai/openinference/tree/main/js/packages/openinference-instrumentation-openai",
      },
    },
  },
  {
    id: "baseten",
    name: "Baseten",
    icon: <BasetenSVG />,
    configs: {
      Python: {
        packages: [
          "arize-phoenix-otel",
          "openinference-instrumentation-openai",
          "openai",
        ],
        getImplementationCode: getBasetenCodePython,
        envVars: BASETEN_ENV,
        docsHref:
          "https://arize.com/docs/phoenix/integrations/llm-providers/openai",
        githubHref:
          "https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-openai",
      },
      TypeScript: {
        packages: [
          "@arizeai/phoenix-otel",
          "@arizeai/openinference-instrumentation-openai",
          "openai",
        ],
        getImplementationCode: getBasetenCodeTypescript,
        envVars: BASETEN_ENV,
        docsHref:
          "https://arize.com/docs/phoenix/integrations/llm-providers/openai",
        githubHref:
          "https://github.com/Arize-ai/openinference/tree/main/js/packages/openinference-instrumentation-openai",
      },
    },
  },
  {
    id: "cloudflare",
    name: "Cloudflare Workers AI",
    icon: <CloudflareSVG />,
    configs: {
      Python: {
        packages: [
          "arize-phoenix-otel",
          "openinference-instrumentation-openai",
          "openai",
        ],
        getImplementationCode: getCloudflareCodePython,
        envVars: CLOUDFLARE_ENV,
        docsHref:
          "https://arize.com/docs/phoenix/integrations/llm-providers/openai",
        githubHref:
          "https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-openai",
      },
      TypeScript: {
        packages: [
          "@arizeai/phoenix-otel",
          "@arizeai/openinference-instrumentation-openai",
          "openai",
        ],
        getImplementationCode: getCloudflareCodeTypescript,
        envVars: CLOUDFLARE_ENV,
        docsHref:
          "https://arize.com/docs/phoenix/integrations/llm-providers/openai",
        githubHref:
          "https://github.com/Arize-ai/openinference/tree/main/js/packages/openinference-instrumentation-openai",
      },
    },
  },
  {
    id: "dify",
    name: "Dify",
    icon: <DifySVG />,
    configs: {
      Platform: {
        docsHref:
          "https://arize.com/docs/phoenix/integrations/platforms/dify/dify-tracing",
      },
    },
  },
  {
    id: "openllmetry",
    name: "OpenLLMetry",
    icon: <TraceLoopSVG />,
    configs: {
      Python: {
        packages: [
          "arize-phoenix-otel",
          "openinference-instrumentation-openllmetry",
          "opentelemetry-instrumentation-openai",
          "openai",
        ],
        getImplementationCode: getOpenLLMetryCodePython,
        envVars: OPENAI_ENV,
        docsHref:
          "https://arize.com/docs/phoenix/tracing/concepts-tracing/translating-conventions",
        githubHref:
          "https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-openllmetry",
      },
    },
  },
];
