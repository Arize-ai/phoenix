import { Icon, Icons } from "@phoenix/components";
import {
  AgnoSVG,
  AnthropicSVG,
  BedrockSVG,
  BeeAISVG,
  CrewAISVG,
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
  PortkeySVG,
  PydanticAISVG,
  VercelSVG,
  VertexAISVG,
} from "@phoenix/components/project/IntegrationIcons";
import {
  getAgnoCodePython,
  getAnthropicCodePython,
  getAnthropicCodeTypescript,
  getLangchainCodePython,
  getLangchainCodeTypescript,
  getLanggraphCodePython,
  getLanggraphCodeTypescript,
  getLlamaIndexCodePython,
  getMastraCodeTypescript,
  getOpenaiAgentsCodePython,
  getOpenaiCodePython,
  getOtelInitCodePython,
  getOtelInitCodeTypescript,
  getOpenaiCodeTypescript,
  getVercelAiSdkCodeTypescript,
} from "@phoenix/components/project/integrationSnippets";

import type { OnboardingIntegration } from "./integrationDefinitions";

export const DEFAULT_INTEGRATION_ID = "phoenix-otel";

export const ONBOARDING_INTEGRATIONS: OnboardingIntegration[] = [
  {
    id: "phoenix-otel",
    name: "Trace directly from app",
    icon: <Icon svg={<Icons.Trace />} />,
    supportedLanguages: ["Python", "TypeScript"],
    languages: {
      Python: {
        packages: ["arize-phoenix-otel"],
        getImplementationCode: getOtelInitCodePython,
      },
      TypeScript: {
        packages: ["@arizeai/phoenix-otel"],
        getImplementationCode: getOtelInitCodeTypescript,
      },
    },
  },
  {
    id: "langgraph",
    name: "LangGraph",
    icon: <LangGraphSVG />,
    supportedLanguages: ["Python", "TypeScript"],
    languages: {
      Python: {
        packages: [
          "arize-phoenix-otel",
          "openinference-instrumentation-langchain",
          "langgraph",
          "langchain-openai",
        ],
        getImplementationCode: getLanggraphCodePython,
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
    supportedLanguages: ["Python", "TypeScript"],
    languages: {
      Python: {
        packages: [
          "arize-phoenix-otel",
          "openinference-instrumentation-langchain",
          "langchain-openai",
        ],
        getImplementationCode: getLangchainCodePython,
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
    supportedLanguages: ["Python", "TypeScript"],
    languages: {
      Python: {
        packages: [
          "arize-phoenix-otel",
          "openinference-instrumentation-openai",
          "openai",
        ],
        getImplementationCode: getOpenaiCodePython,
        docsHref:
          "https://arize.com/docs/phoenix/tracing/integrations-tracing/openai",
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
    supportedLanguages: ["Python"],
    languages: {
      Python: {
        packages: [
          "arize-phoenix-otel",
          "openinference-instrumentation-llama-index",
          "llama-index",
          "llama-index-llms-openai",
        ],
        getImplementationCode: getLlamaIndexCodePython,
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
    supportedLanguages: ["Python"],
    languages: {
      Python: {
        packages: [
          "arize-phoenix-otel",
          "openinference-instrumentation-agno",
          "agno",
          "openai",
        ],
        getImplementationCode: getAgnoCodePython,
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
    supportedLanguages: ["Python"],
    languages: {
      Python: {
        packages: [
          "arize-phoenix-otel",
          "openinference-instrumentation-openai-agents",
          "openai-agents",
        ],
        getImplementationCode: getOpenaiAgentsCodePython,
        docsHref:
          "https://arize.com/docs/phoenix/tracing/integrations-tracing/openai-agents-sdk",
        githubHref:
          "https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-openai-agents",
      },
    },
  },
  {
    id: "haystack",
    name: "Haystack",
    icon: <HaystackSVG />,
    supportedLanguages: ["Python"],
    languages: {
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
    supportedLanguages: ["Python"],
    languages: {
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
    supportedLanguages: ["Python"],
    languages: {
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
    supportedLanguages: ["Python"],
    languages: {
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
    name: "Vercel AI SDK",
    icon: <VercelSVG />,
    supportedLanguages: ["TypeScript"],
    languages: {
      TypeScript: {
        packages: ["@arizeai/phoenix-otel", "ai", "@ai-sdk/openai"],
        getImplementationCode: getVercelAiSdkCodeTypescript,
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
    supportedLanguages: ["Python", "TypeScript"],
    languages: {
      Python: {
        packages: [
          "arize-phoenix-otel",
          "openinference-instrumentation-anthropic",
          "anthropic",
        ],
        getImplementationCode: getAnthropicCodePython,
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
        docsHref:
          "https://arize.com/docs/phoenix/integrations/llm-providers/anthropic/anthropic-sdk-typescript",
        githubHref:
          "https://github.com/Arize-ai/openinference/tree/main/js/packages/openinference-instrumentation-anthropic",
      },
    },
  },
  {
    id: "bedrock",
    name: "Bedrock",
    icon: <BedrockSVG />,
    supportedLanguages: ["Python", "TypeScript"],
    languages: {
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
    supportedLanguages: ["Python"],
    languages: {
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
    supportedLanguages: ["Python"],
    languages: {
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
    supportedLanguages: ["Python"],
    languages: {
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
    supportedLanguages: ["Python"],
    languages: {
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
    supportedLanguages: ["Python"],
    languages: {
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
    supportedLanguages: ["Python"],
    languages: {
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
    supportedLanguages: ["Python", "TypeScript"],
    languages: {
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
    supportedLanguages: ["TypeScript"],
    languages: {
      TypeScript: {
        packages: [
          "@mastra/arize",
          "@mastra/observability",
          "@mastra/core",
          "@ai-sdk/openai",
        ],
        getImplementationCode: getMastraCodeTypescript,
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
    supportedLanguages: ["Python"],
    languages: {
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
    supportedLanguages: ["Python"],
    languages: {
      Python: {
        docsHref:
          "https://arize.com/docs/phoenix/tracing/integrations-tracing/groq",
        githubHref:
          "https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-groq",
      },
    },
  },
];
