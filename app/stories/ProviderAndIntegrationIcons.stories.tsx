import type { Meta, StoryFn } from "@storybook/react";

import { GenerativeProviderIcon } from "@phoenix/components/generative/GenerativeProviderIcon";
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
  LiteLLMSVG,
  LlamaIndexSVG,
  MastraSVG,
  McpSVG,
  MistralAISVG,
  NodeJSSVG,
  OpenAISVG,
  PortkeySVG,
  PydanticAISVG,
  VercelSVG,
  VertexAISVG,
} from "@phoenix/components/project/IntegrationIcons";
import { ModelProviders } from "@phoenix/constants/generativeConstants";

const meta: Meta = {
  title: "Provider & Integration Icons",
};
export default meta;

const providers = Object.entries(ModelProviders)
  .map(([key, name]) => ({ key: key as ModelProvider, name }))
  .sort((a, b) => a.name.localeCompare(b.name));

const integrationIcons: { name: string; icon: React.ReactNode }[] = [
  { name: "Agno", icon: <AgnoSVG /> },
  { name: "Anthropic", icon: <AnthropicSVG /> },
  { name: "Bedrock", icon: <BedrockSVG /> },
  { name: "BeeAI", icon: <BeeAISVG /> },
  { name: "CrewAI", icon: <CrewAISVG /> },
  { name: "DSPy", icon: <DSPYSVG /> },
  { name: "Gemini", icon: <GeminiSVG /> },
  { name: "Google ADK", icon: <GoogleADKSVG /> },
  { name: "Groq", icon: <GroqSVG /> },
  { name: "Haystack", icon: <HaystackSVG /> },
  { name: "HuggingFace", icon: <HuggingFaceSVG /> },
  { name: "LangChain", icon: <LangChainSVG /> },
  { name: "LiteLLM", icon: <LiteLLMSVG /> },
  { name: "LlamaIndex", icon: <LlamaIndexSVG /> },
  { name: "Mastra", icon: <MastraSVG /> },
  { name: "MCP", icon: <McpSVG /> },
  { name: "Mistral AI", icon: <MistralAISVG /> },
  { name: "Node.js", icon: <NodeJSSVG /> },
  { name: "OpenAI", icon: <OpenAISVG /> },
  { name: "Portkey", icon: <PortkeySVG /> },
  { name: "Pydantic AI", icon: <PydanticAISVG /> },
  { name: "Vercel", icon: <VercelSVG /> },
  { name: "Vertex AI", icon: <VertexAISVG /> },
];

const listStyle: React.CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const itemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const headingStyle: React.CSSProperties = {
  margin: "0 0 12px",
  fontSize: 14,
  fontWeight: 600,
  color: "var(--global-text-color-700)",
};

export const GenerativeProviders: StoryFn = () => (
  <div>
    <h3 style={headingStyle}>Generative Provider Icons</h3>
    <ul style={listStyle}>
      {providers.map(({ key, name }) => (
        <li key={key} style={itemStyle}>
          <GenerativeProviderIcon provider={key} height={24} />
          <span>{name}</span>
        </li>
      ))}
    </ul>
  </div>
);

export const Integrations: StoryFn = () => (
  <div>
    <h3 style={headingStyle}>Integration Icons</h3>
    <ul style={listStyle}>
      {integrationIcons.map(({ name, icon }) => (
        <li key={name} style={itemStyle}>
          {icon}
          <span>{name}</span>
        </li>
      ))}
    </ul>
  </div>
);
