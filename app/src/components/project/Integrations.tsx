import { ReactNode } from "react";
import { css } from "@emotion/react";

import {
  AgnoSVG,
  AnthropicSVG,
  BedrockSVG,
  BeeAISVG,
  CrewAISVG,
  DSPYSVG,
  GeminiSVG,
  GroqSVG,
  HaystackSVG,
  HuggingFaceSVG,
  IntegrationSVG,
  LangChainSVG,
  LlamaIndexSVG,
  McpSVG,
  MistralAISVG,
  NodeJSSVG,
  OpenAISVG,
  VercelSVG,
  VertexAISVG,
} from "./IntegrationIcons";

export type IntegrationLinkProps = {
  docsHref: string;
  githubHref: string;
  icon: ReactNode;
  name: string;
};

const integrationLinkCSS = css`
  border-radius: var(--ac-global-rounding-medium);
  border: 1px solid var(--ac-global-color-grey-400);
  padding: var(--ac-global-dimension-size-100)
    var(--ac-global-dimension-size-150);
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: var(--ac-global-dimension-size-100);
  transition:
    background-color 0.2s ease-in-out,
    border-color 0.2s ease-in-out;
  &:hover {
    background-color: var(--ac-global-color-grey-100);
    border-color: var(--ac-global-color-primary);
  }
  min-width: 230px;
  .integration__main-link {
    flex: 1 1 auto;
    color: var(--ac-global-text-color-900);
    text-decoration: none;
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: var(--ac-global-dimension-size-150);
  }
  .integration__github-link {
    color: var(--ac-global-color-grey-500);
    transition: color 0.2s ease-in-out;
    display: flex;
    align-items: center;
    &:hover {
      color: var(--ac-global-color-grey-700);
    }
  }
`;

function IntegrationLink({
  docsHref,
  githubHref,
  icon,
  name,
}: IntegrationLinkProps) {
  return (
    <div css={integrationLinkCSS}>
      <a
        href={docsHref}
        className="integration__main-link"
        target="_blank"
        rel="noreferrer"
      >
        {icon}
        {name}
      </a>
      <div>
        <a
          href={githubHref}
          target="_blank"
          rel="noreferrer"
          className="integration__github-link"
          aria-label="GitHub link"
        >
          <GitHubSVG />
        </a>
      </div>
    </div>
  );
}

const PYTHON_INTEGRATIONS: IntegrationLinkProps[] = [
  {
    name: "OpenAI",
    docsHref:
      "https://docs.arize.com/phoenix/tracing/integrations-tracing/openai",
    githubHref:
      "https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-openai",
    icon: <OpenAISVG />,
  },
  {
    name: "LlamaIndex",
    githubHref:
      "https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-llama-index",
    docsHref:
      "https://docs.arize.com/phoenix/tracing/integrations-tracing/llamaindex",
    icon: <LlamaIndexSVG />,
  },
  {
    name: "LangChain",
    docsHref:
      "https://docs.arize.com/phoenix/tracing/integrations-tracing/langchain",
    githubHref:
      "https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-langchain",
    icon: <LangChainSVG />,
  },
  {
    name: "Haystack",
    docsHref:
      "https://docs.arize.com/phoenix/tracing/integrations-tracing/haystack",
    githubHref:
      "https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-haystack",
    icon: <HaystackSVG />,
  },
  {
    name: "Vertex AI",
    docsHref:
      "https://docs.arize.com/phoenix/tracing/integrations-tracing/vertex",
    githubHref:
      "https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-vertexai",
    icon: <VertexAISVG />,
  },
  {
    name: "Mistral AI",
    docsHref:
      "https://docs.arize.com/phoenix/tracing/integrations-tracing/mistralai",
    githubHref:
      "https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-mistralai",
    icon: <MistralAISVG />,
  },
  {
    name: "DSPy",
    docsHref:
      "https://docs.arize.com/phoenix/tracing/integrations-tracing/dspy",
    githubHref:
      "https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-dspy",
    icon: <DSPYSVG />,
  },
  {
    name: "Anthropic",
    docsHref:
      "https://docs.arize.com/phoenix/tracing/integrations-tracing/anthropic",
    githubHref:
      "https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-anthropic",
    icon: <AnthropicSVG />,
  },
  {
    name: "Smolagents",
    docsHref:
      "https://docs.arize.com/phoenix/tracing/integrations-tracing/hfsmolagents",
    githubHref:
      "https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-smolagents",
    icon: <HuggingFaceSVG />,
  },
  {
    name: "OpenAI Agents",
    docsHref:
      "https://docs.arize.com/phoenix/tracing/integrations-tracing/openai-agents-sdk",
    githubHref:
      "https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-openai-agents",
    icon: <OpenAISVG />,
  },
  {
    name: "Agno",
    docsHref:
      "https://docs.arize.com/phoenix/tracing/integrations-tracing/agno",
    githubHref:
      "https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-agno",
    icon: <AgnoSVG />,
  },
  {
    name: "Bedrock",
    docsHref:
      "https://docs.arize.com/phoenix/tracing/integrations-tracing/bedrock",
    githubHref:
      "https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-bedrock",
    icon: <BedrockSVG />,
  },
  {
    name: "Google GenAI",
    docsHref:
      "https://docs.arize.com/phoenix/tracing/integrations-tracing/google-genai",
    githubHref:
      "https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-google-genai",
    icon: <GeminiSVG />,
  },
  {
    name: "Groq",
    docsHref:
      "https://docs.arize.com/phoenix/tracing/integrations-tracing/groq",
    githubHref:
      "https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-groq",
    icon: <GroqSVG />,
  },
  {
    name: "CrewAI",
    docsHref:
      "https://docs.arize.com/phoenix/tracing/integrations-tracing/crewai",
    githubHref:
      "https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-crewai",
    icon: <CrewAISVG />,
  },
  {
    name: "LiteLLM",
    docsHref:
      "https://docs.arize.com/phoenix/tracing/integrations-tracing/litellm",
    githubHref:
      "https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-litellm",
    icon: <IntegrationSVG />,
  },
  {
    name: "Model Context Protocol",
    docsHref:
      "https://docs.arize.com/phoenix/tracing/integrations-tracing/model-context-protocol-mcp",
    githubHref:
      "https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-mcp",
    icon: <McpSVG />,
  },
];
const integrationsListCSS = css`
  width: 100%;
  display: flex;
  flex-direction: row;
  gap: var(--ac-global-dimension-size-100);
  flex-wrap: wrap;
`;

export function PythonIntegrations() {
  return (
    <ul css={integrationsListCSS}>
      {PYTHON_INTEGRATIONS.map((integration) => (
        <li key={integration.name}>
          <IntegrationLink key={integration.name} {...integration} />
        </li>
      ))}
    </ul>
  );
}

const TYPESCRIPT_PLATFORM_INTEGRATIONS: IntegrationLinkProps[] = [
  {
    name: "Node",
    docsHref:
      "https://opentelemetry.io/docs/languages/js/getting-started/nodejs/",
    githubHref: "https://github.com/open-telemetry/opentelemetry-js",
    icon: <NodeJSSVG />,
  },
  {
    name: "Vercel",
    docsHref: "https://vercel.com/docs/observability/otel-overview",
    githubHref: "https://github.com/vercel/otel",
    icon: <VercelSVG />,
  },
];
export function TypeScriptPlatformIntegrations() {
  return (
    <ul css={integrationsListCSS}>
      {TYPESCRIPT_PLATFORM_INTEGRATIONS.map((integration) => (
        <li key={integration.name}>
          <IntegrationLink key={integration.name} {...integration} />
        </li>
      ))}
    </ul>
  );
}

const TYPESCRIPT_INTEGRATIONS: IntegrationLinkProps[] = [
  {
    name: "OpenAI NodeJS SDK",
    docsHref:
      "https://docs.arize.com/phoenix/tracing/integrations-tracing/openai-node-sdk",
    githubHref:
      "https://github.com/Arize-ai/openinference/tree/main/js/packages/openinference-vercel",
    icon: <OpenAISVG />,
  },
  {
    name: "LangChain.js",
    docsHref:
      "https://docs.arize.com/phoenix/tracing/integrations-tracing/langchain.js",
    githubHref:
      "https://github.com/Arize-ai/openinference/tree/main/js/packages/openinference-instrumentation-langchain",
    icon: <LangChainSVG />,
  },
  {
    name: "Vercel AI SDK",
    docsHref:
      "https://docs.arize.com/phoenix/tracing/integrations-tracing/vercel-ai-sdk",
    githubHref:
      "https://github.com/Arize-ai/openinference/tree/main/js/packages/openinference-vercel",
    icon: <VercelSVG />,
  },
  {
    name: "BeeAI",
    docsHref:
      "https://docs.arize.com/phoenix/tracing/integrations-tracing/beeai",
    githubHref:
      "https://github.com/Arize-ai/openinference/tree/main/js/packages/openinference-instrumentation-beeai",
    icon: <BeeAISVG />,
  },
  {
    name: "Model Context Protocol",
    docsHref:
      "https://docs.arize.com/phoenix/tracing/integrations-tracing/model-context-protocol-mcp",
    githubHref:
      "https://github.com/Arize-ai/openinference/tree/main/js/packages/openinference-instrumentation-mcp",
    icon: <McpSVG />,
  },
];
export function TypeScriptIntegrations() {
  return (
    <ul css={integrationsListCSS}>
      {TYPESCRIPT_INTEGRATIONS.map((integration) => (
        <li key={integration.name}>
          <IntegrationLink key={integration.name} {...integration} />
        </li>
      ))}
    </ul>
  );
}

const GitHubSVG = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
  >
    <g data-name="Layer 2">
      <rect width="24" height="24" transform="rotate(180 12 12)" opacity="0" />
      <path
        d="M12 1A10.89 10.89 0 0 0 1 11.77 10.79 10.79 0 0 0 8.52 22c.55.1.75-.23.75-.52v-1.83c-3.06.65-3.71-1.44-3.71-1.44a2.86 2.86 0 0 0-1.22-1.58c-1-.66.08-.65.08-.65a2.31 2.31 0 0 1 1.68 1.11 2.37 2.37 0 0 0 3.2.89 2.33 2.33 0 0 1 .7-1.44c-2.44-.27-5-1.19-5-5.32a4.15 4.15 0 0 1 1.11-2.91 3.78 3.78 0 0 1 .11-2.84s.93-.29 3 1.1a10.68 10.68 0 0 1 5.5 0c2.1-1.39 3-1.1 3-1.1a3.78 3.78 0 0 1 .11 2.84A4.15 4.15 0 0 1 19 11.2c0 4.14-2.58 5.05-5 5.32a2.5 2.5 0 0 1 .75 2v2.95c0 .35.2.63.75.52A10.8 10.8 0 0 0 23 11.77 10.89 10.89 0 0 0 12 1"
        data-name="github"
        fill="currentColor"
      />
    </g>
  </svg>
);
