import { SquiggleOutline } from "@phoenix/components";
import {
  LangGraphSVG,
  VercelSVG,
} from "@phoenix/components/project/IntegrationIcons";
import {
  getLanggraphCodePython,
  getLanggraphCodeTypescript,
  getOtelInitCodePython,
  getOtelInitCodeTypescript,
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
    icon: <SquiggleOutline />,
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
      },
    },
  },
];
