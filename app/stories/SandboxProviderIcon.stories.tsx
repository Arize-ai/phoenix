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
  title: "Sandbox/SandboxProviderIcon",
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
          <SandboxProviderIcon kind={kind} height={48} />
          <span style={{ fontSize: 12 }}>{kind}</span>
        </li>
      ))}
    </ul>
  ),
};
