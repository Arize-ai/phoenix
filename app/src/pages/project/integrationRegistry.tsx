import { Icon, Icons } from "@phoenix/components";
import {
  AnthropicSVG,
  LangChainSVG,
  LangGraphSVG,
  MastraSVG,
  OpenAISVG,
  VercelSVG,
} from "@phoenix/components/project/IntegrationIcons";
import {
  getAnthropicCodeTypescript,
  getLangchainCodeTypescript,
  getLanggraphCodePython,
  getLanggraphCodeTypescript,
  getMastraCodeTypescript,
  getOtelInitCodePython,
  getOtelInitCodeTypescript,
  getOpenaiCodeTypescript,
  getVercelAiSdkCodeTypescript,
  PYTHON_PACKAGES,
  TYPESCRIPT_PACKAGES,
} from "@phoenix/components/project/integrationSnippets";

import type { OnboardingIntegration } from "./integrationDefinitions";

export const DEFAULT_INTEGRATION_ID = "phoenix-otel";

export const ONBOARDING_INTEGRATIONS: OnboardingIntegration[] = [
  {
    id: "phoenix-otel",
    name: "Trace directly from app",
    icon: <Icon svg={<Icons.Trace />} />,
    supportedLanguages: ["Python", "TypeScript"],
    snippets: {
      Python: {
        packages: PYTHON_PACKAGES,
        getImplementationCode: getOtelInitCodePython,
      },
      TypeScript: {
        packages: TYPESCRIPT_PACKAGES,
        getImplementationCode: getOtelInitCodeTypescript,
      },
    },
  },
  {
    id: "langgraph",
    name: "LangGraph",
    icon: <LangGraphSVG />,
    supportedLanguages: ["Python", "TypeScript"],
    snippets: {
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
    supportedLanguages: ["TypeScript"],
    snippets: {
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
    supportedLanguages: ["TypeScript"],
    snippets: {
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
    id: "anthropic",
    name: "Anthropic",
    icon: <AnthropicSVG />,
    supportedLanguages: ["TypeScript"],
    snippets: {
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
    id: "mastra",
    name: "Mastra",
    icon: <MastraSVG />,
    supportedLanguages: ["TypeScript"],
    snippets: {
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
    id: "vercel-ai-sdk",
    name: "Vercel AI SDK",
    icon: <VercelSVG />,
    supportedLanguages: ["TypeScript"],
    snippets: {
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
];
