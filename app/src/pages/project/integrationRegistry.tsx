import { SquiggleOutline } from "@phoenix/components";
import { VercelSVG } from "@phoenix/components/project/IntegrationIcons";
import {
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
        getImplementationCode: ({ projectName }) =>
          getOtelInitCodeTypescript(projectName),
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
        packages: ["ai", "@ai-sdk/openai", "@arizeai/phoenix-otel"],
        getImplementationCode: ({ projectName }) =>
          getVercelAiSdkCodeTypescript(projectName),
      },
    },
  },
];
