import type { Meta, StoryObj } from "@storybook/react";
import { Suspense } from "react";
import { RelayEnvironmentProvider } from "react-relay";
import { Environment, Network, RecordSource, Store } from "relay-runtime";
import { fn } from "storybook/test";

import { Loading } from "@phoenix/components";
import { SavePromptForm } from "@phoenix/pages/playground/SavePromptForm";

const prompts = [
  {
    id: "UHJvbXB0OjE=",
    name: "customer-support-agent",
    versionTags: [{ id: "UHJvbXB0VmVyc2lvblRhZzox", name: "canary" }],
    metadata: { owner: "support" },
  },
  {
    id: "UHJvbXB0OjI=",
    name: "code-review-assistant",
    versionTags: [],
    metadata: {},
  },
];

// One payload answers both SavePromptFormQuery and PromptComboBoxQuery
const environment = new Environment({
  network: Network.create(async () => ({
    data: {
      prompts: {
        edges: prompts.map(({ metadata, ...prompt }, index) => ({
          prompt: {
            __typename: "Prompt",
            ...prompt,
            version: { id: `UHJvbXB0VmVyc2lvbjo${index}`, metadata },
          },
        })),
      },
    },
  })),
  store: new Store(new RecordSource()),
});

/**
 * Pick a prompt to save a new version of it, or type a name to create one.
 * Spaces in prompt and tag names become dashes as you type.
 */
const meta = {
  title: "Domains/Playground/Save Prompt Form",
  component: SavePromptForm,
  tags: ["updated", "complete", "unreviewed"],
  args: {
    onCreate: fn(),
    onUpdate: fn(),
    onClose: fn(),
    isSubmitting: false,
  },
  decorators: [
    (Story) => (
      <RelayEnvironmentProvider environment={environment}>
        <Suspense fallback={<Loading />}>
          <div style={{ width: 500 }}>
            <Story />
          </div>
        </Suspense>
      </RelayEnvironmentProvider>
    ),
  ],
} satisfies Meta<typeof SavePromptForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ExistingPromptSelected: Story = {
  args: { defaultSelectedPromptId: prompts[0].id },
};
