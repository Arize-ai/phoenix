import type { Meta, StoryFn, StoryObj } from "@storybook/react";

import { GenerativeProviderIcon } from "@phoenix/components/generative/GenerativeProviderIcon";
import { INTEGRATION_ICONS } from "@phoenix/components/project/IntegrationIcons";
import { SandboxProviderIcon } from "@phoenix/components/sandbox/SandboxProviderIcon";
import { ModelProviders } from "@phoenix/constants/generativeConstants";

/**
 * Brand marks for the third-party services Phoenix connects to: generative
 * model providers, tracing integrations, and code-execution sandbox
 * providers. Each section lists every mark its component knows.
 */
const meta: Meta = {
  title: "Design System/Icons/Provider and Integration Icons",
  tags: ["legacy", "unreviewed"],
};
export default meta;

const providers = Object.entries(ModelProviders)
  .map(([key, name]) => ({ key: key as ModelProvider, name }))
  .sort((a, b) => a.name.localeCompare(b.name));

const SANDBOX_PROVIDER_KINDS = [
  "DAYTONA",
  "MODAL",
  "WASM",
  "DENO",
  "VERCEL",
  "E2B",
] as const;

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

export const SandboxProviders: StoryFn = () => (
  <div>
    <h3 style={headingStyle}>Sandbox Provider Icons</h3>
    <ul
      style={{
        listStyle: "none",
        margin: 0,
        padding: 0,
        display: "flex",
        flexWrap: "wrap",
        gap: 24,
      }}
    >
      {SANDBOX_PROVIDER_KINDS.map((kind) => (
        <li
          key={kind}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
            minWidth: 96,
          }}
        >
          <SandboxProviderIcon backendType={kind} height={48} />
          <span style={{ fontSize: 12 }}>{kind}</span>
        </li>
      ))}
    </ul>
  </div>
);

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryObj = {
  tags: ["!dev", "!autodocs"],
  render: () => (
    <ul
      style={{
        ...listStyle,
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: 16,
      }}
    >
      {providers.map(({ key }) => (
        <li key={key}>
          <GenerativeProviderIcon provider={key} height={24} />
        </li>
      ))}
    </ul>
  ),
};
