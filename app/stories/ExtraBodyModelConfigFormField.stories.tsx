import { css } from "@emotion/react";
import type { Meta, StoryObj } from "@storybook/react";

import { View } from "@phoenix/components";
import { ExtraBodyModelConfigFormField } from "@phoenix/components/playground/model";
import {
  PlaygroundProvider,
  usePlaygroundContext,
} from "@phoenix/contexts/PlaygroundContext";
import type { PlaygroundState } from "@phoenix/store";

const storyContainerCSS = css`
  width: var(--global-dimension-size-6000);
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-200);
`;

/**
 * Pulls the first instance from the surrounding `PlaygroundProvider` and
 * renders the field against it. Each story is responsible for providing the
 * provider with an initial `modelConfigByProvider` whose first entry seeds the
 * provider/extraBody we want to demo.
 */
function ExtraBodyFieldHost() {
  const instance = usePlaygroundContext(
    (state: PlaygroundState) => state.instances[0]
  );
  if (!instance) {
    return <span>No playground instance</span>;
  }
  return (
    <div css={storyContainerCSS}>
      <View padding="size-200">
        <ExtraBodyModelConfigFormField instance={instance} />
      </View>
    </div>
  );
}

const meta = {
  title: "Playground/ExtraBodyModelConfigFormField",
  component: ExtraBodyFieldHost,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
JSON editor for provider-specific request options ("extra body"). Used in the
playground model configuration popover for OpenAI- and Anthropic-family
providers. Validates that the payload is a JSON object and surfaces a per-field
error message when it isn't.
`,
      },
    },
  },
} satisfies Meta<typeof ExtraBodyFieldHost>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default empty state — the editor renders the empty-object placeholder and no
 * error message.
 */
export const Empty: Story = {
  decorators: [
    (Story) => (
      <PlaygroundProvider
        modelConfigByProvider={{
          OPENAI: {
            provider: "OPENAI",
            modelName: "gpt-4o",
            invocationParameters: {},
          },
        }}
      >
        <Story />
      </PlaygroundProvider>
    ),
  ],
};

/**
 * Pre-populated with a non-trivial JSON object so the editor opens with
 * existing content. Edits round-trip through the playground store and the
 * adapter's `writeField("extraBody", ...)` codec.
 */
export const Prefilled: Story = {
  decorators: [
    (Story) => (
      <PlaygroundProvider
        modelConfigByProvider={{
          OPENAI: {
            provider: "OPENAI",
            modelName: "gpt-4o",
            invocationParameters: {
              extraBody: {
                custom_provider_flag: true,
                routing: { region: "us-west-2" },
              },
            },
          },
        }}
      >
        <Story />
      </PlaygroundProvider>
    ),
  ],
};
