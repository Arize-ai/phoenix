import type { Meta, StoryFn } from "@storybook/react";

import { GenerativeProviderIcon } from "@phoenix/components/generative/GenerativeProviderIcon";
import { INTEGRATION_ICONS } from "@phoenix/components/project/IntegrationIcons";
import { ModelProviders } from "@phoenix/constants/generativeConstants";

const meta: Meta = {
  title: "Reference/Provider & Integration Icons",
};
export default meta;

const providers = Object.entries(ModelProviders)
  .map(([key, name]) => ({ key: key as ModelProvider, name }))
  .sort((a, b) => a.name.localeCompare(b.name));

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
      {Object.entries(INTEGRATION_ICONS)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, Icon]) => (
          <li key={key} style={itemStyle}>
            <Icon />
            <span>{key.replace(/SVG$/, "")}</span>
          </li>
        ))}
    </ul>
  </div>
);
