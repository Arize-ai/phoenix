import { css } from "@emotion/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

import {
  AgentChatWidgetButton,
  type AgentChatWidgetButtonProps,
  type AgentChatWidgetButtonVariant,
  type AgentChatWidgetThinkingEffect,
} from "@phoenix/components/agent/AgentChatWidget";

const frameCSS = css`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
`;

const statesGridCSS = css`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 24px 32px;
  width: fit-content;

  @media (max-width: 640px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

const variantLabelCSS = css`
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--global-color-gray-500);
`;

const stateCardCSS = css`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
`;

const stateLabelCSS = css`
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
`;

const interactivePanelCSS = css`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
`;

const thinkingEffects: AgentChatWidgetThinkingEffect[] = [
  "wipe2",
  "wipe1",
  "pulse",
];

const variants: AgentChatWidgetButtonVariant[] = ["dark", "dark-glyph", "light", "glyph"];

const meta = {
  title: "Agent/AgentChatWidgetButton",
  component: AgentChatWidgetButton,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "PXI chat trigger button. Shows the resting pill state and the compact thinking state with wipe/pulse border animations used while PXI is streaming.",
      },
    },
  },
  args: {
    ariaLabel: "Open agent chat",
    isFloating: false,
  },
  argTypes: {
    onClick: {
      action: "clicked",
    },
    thinkingEffect: {
      control: "inline-radio",
      options: thinkingEffects,
    },
    variant: {
      control: "inline-radio",
      options: variants,
    },
  },
} satisfies Meta<typeof AgentChatWidgetButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const States: Story = {
  render: (args) => (
    <div css={frameCSS}>
      <div css={statesGridCSS}>
        {/* header row */}
        <div css={[stateCardCSS, stateLabelCSS]}>Resting</div>
        <div css={[stateCardCSS, stateLabelCSS]}>Thinking · Wipe2</div>
        <div css={[stateCardCSS, stateLabelCSS]}>Thinking · Wipe1</div>
        <div css={[stateCardCSS, stateLabelCSS]}>Thinking · Pulse</div>

        {variants.map((v) => (
          <>
            <div css={stateCardCSS} key={`${v}-resting`}>
              <div css={variantLabelCSS}>{v}</div>
              <AgentChatWidgetButton
                {...args}
                variant={v}
                isStreaming={false}
              />
            </div>
            {thinkingEffects.map((effect) => (
              <div css={stateCardCSS} key={`${v}-${effect}`}>
                <div css={variantLabelCSS}>{v}</div>
                <AgentChatWidgetButton
                  {...args}
                  variant={v}
                  isStreaming
                  thinkingEffect={effect}
                />
              </div>
            ))}
          </>
        ))}
      </div>
    </div>
  ),
};

function ClickToCycleRender(args: AgentChatWidgetButtonProps) {
  const [phaseIndex, setPhaseIndex] = useState(0);
  const phase = phaseIndex % 4;
  const isStreaming = phase !== 0;
  const thinkingEffect =
    phase === 1 ? "wipe2" : phase === 2 ? "wipe1" : "pulse";

  return (
    <div css={frameCSS}>
      <div css={interactivePanelCSS}>
        <AgentChatWidgetButton
          {...args}
          isStreaming={isStreaming}
          thinkingEffect={thinkingEffect}
          ariaLabel={isStreaming ? "PXI is thinking" : "Open agent chat"}
          onClick={() => setPhaseIndex((value) => value + 1)}
          isFloating
        />
      </div>
    </div>
  );
}

export const ClickToCycleStates: Story = {
  render: (args) => <ClickToCycleRender {...args} />,
};