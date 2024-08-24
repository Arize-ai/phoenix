import React, { ReactNode } from "react";
import { css } from "@emotion/react";

import {
  HaystackSVG,
  LangChainSVG,
  LlamaIndexSVG,
  MistralAISVG,
  OpenAISVG,
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
  min-width: 190px;
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
    docsHref: "https://docs.arize.com/phoenix/integrations/overview",
    githubHref:
      "https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-openai",
    icon: <OpenAISVG />,
  },
  {
    name: "LlamaIndex",
    githubHref:
      "https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-llama-index",
    docsHref: "https://docs.arize.com/phoenix/integrations/overview",
    icon: <LlamaIndexSVG />,
  },
  {
    name: "LangChain",
    docsHref: "https://docs.arize.com/phoenix/integrations/overview",
    githubHref:
      "https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-langchain",
    icon: <LangChainSVG />,
  },
  {
    name: "Haystack",
    docsHref: "https://docs.arize.com/phoenix/integrations/overview",
    githubHref:
      "https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-haystack",
    icon: <HaystackSVG />,
  },
  {
    name: "Vertex AI",
    docsHref: "https://docs.arize.com/phoenix/integrations/overview",
    githubHref:
      "https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-vertexai",
    icon: <VertexAISVG />,
  },
  {
    name: "Mistral AI",
    docsHref: "https://docs.arize.com/phoenix/integrations/overview",
    githubHref:
      "https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-mistralai",
    icon: <MistralAISVG />,
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
