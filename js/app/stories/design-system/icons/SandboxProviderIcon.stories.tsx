import type { Meta, StoryObj } from "@storybook/react";

import { SandboxProviderIcon } from "@phoenix/components/sandbox/SandboxProviderIcon";

const PROVIDER_KINDS = [
  "DAYTONA",
  "MODAL",
  "WASM",
  "DENO",
  "VERCEL",
  "E2B",
] as const;

const meta: Meta<typeof SandboxProviderIcon> = {
  title: "Design System/Icons/Sandbox Provider Icon",
  tags: ["legacy", "unreviewed"],
  component: SandboxProviderIcon,
};

export default meta;

type Story = StoryObj<typeof SandboxProviderIcon>;

export const Gallery: Story = {
  render: () => (
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
      {PROVIDER_KINDS.map((kind) => (
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
  ),
};

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: Story = {
  tags: ["!dev", "!autodocs"],
  render: () => (
    <ul
      style={{
        listStyle: "none",
        margin: 0,
        padding: 0,
        display: "grid",
        gridTemplateColumns: "repeat(3, 80px)",
        gap: 16,
      }}
    >
      {PROVIDER_KINDS.map((kind) => (
        <li
          key={kind}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
          }}
        >
          <SandboxProviderIcon backendType={kind} height={32} />
          <span style={{ fontSize: 12 }}>{kind}</span>
        </li>
      ))}
    </ul>
  ),
};
