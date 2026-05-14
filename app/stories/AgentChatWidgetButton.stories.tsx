import { css } from "@emotion/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

import {
  AgentChatWidgetButton,
  type AgentChatWidgetButtonProps,
  type PxiGlyphThinkingVariant,
} from "@phoenix/components/agent/AgentChatWidget";

const frameCSS = css`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
`;

const statesGridCSS = css`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
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
  visibility: hidden;
`;

const stateCardCSS = css`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
`;

const interactivePanelCSS = css`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
`;

const interactiveCanvasCSS = css`
  position: relative;
  width: min(360px, calc(100vw - 48px));
  height: 240px;
  border: 1px solid var(--global-border-color-default);
  border-radius: 18px;
  background:
    radial-gradient(
      circle at top left,
      rgba(125, 176, 255, 0.14),
      transparent 36%
    ),
    linear-gradient(
      180deg,
      var(--ac-global-background-color-dark-300),
      var(--ac-global-background-color-dark-200)
    );
  overflow: hidden;
`;

const interactiveCanvasButtonCSS = css`
  position: absolute;
  right: 24px;
  bottom: 24px;
`;

const glyphComparisonSectionCSS = css`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const glyphComparisonGridCSS = css`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 20px;

  @media (max-width: 900px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: 640px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

const thinkingGlyphVariants: PxiGlyphThinkingVariant[] = [
  "orbit-reveal",
  "wave-reveal",
  "twinkle-reveal",
  "wave-hold",
];

const thinkingGlyphLabels: Record<PxiGlyphThinkingVariant, string> = {
  "wave-reveal": "Wave Reveal",
  "orbit-reveal": "Orbit Reveal",
  "twinkle-reveal": "Twinkle Reveal",
  "wave-hold": "Wave Hold",
};

const meta = {
  title: "Agent/AgentChatWidgetButton",
  component: AgentChatWidgetButton,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "PXI chat trigger button. Shows the resting pill state, the single wipe border treatment used while streaming, and the four kept animated glyph options for glyph mode.",
      },
    },
  },
  args: {
    ariaLabel: "Open agent chat",
    isFloating: false,
    variant: "glyph",
    thinkingGlyphVariant: "orbit-reveal",
  },
  argTypes: {
    onClick: {
      action: "clicked",
    },
    thinkingGlyphVariant: {
      control: "inline-radio",
      options: thinkingGlyphVariants,
    },
  },
} satisfies Meta<typeof AgentChatWidgetButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const GlyphStates: Story = {
  render: (args) => (
    <div css={frameCSS}>
      <div css={statesGridCSS}>
        <div css={stateCardCSS}>
          <div css={variantLabelCSS}>glyph</div>
          <AgentChatWidgetButton {...args} isStreaming={false} />
        </div>
        <div css={stateCardCSS}>
          <div css={variantLabelCSS}>glyph</div>
          <AgentChatWidgetButton {...args} isStreaming />
        </div>
      </div>
    </div>
  ),
};

export const ProgressStates: Story = {
  args: {
    variant: "progress",
  },
  render: (args) => (
    <div css={frameCSS}>
      <div css={statesGridCSS}>
        <div css={stateCardCSS}>
          <div css={variantLabelCSS}>progress</div>
          <AgentChatWidgetButton {...args} isStreaming={false} />
        </div>
        <div css={stateCardCSS}>
          <div css={variantLabelCSS}>progress</div>
          <AgentChatWidgetButton {...args} isStreaming />
        </div>
      </div>
    </div>
  ),
};

export const ThinkingGlyphCandidates: Story = {
  render: (args) => (
    <div css={frameCSS}>
      <div css={glyphComparisonSectionCSS}>
        <div css={glyphComparisonGridCSS}>
          {thinkingGlyphVariants.map((thinkingGlyphVariant) => (
            <div css={stateCardCSS} key={thinkingGlyphVariant}>
              <div css={variantLabelCSS}>
                {thinkingGlyphLabels[thinkingGlyphVariant]}
              </div>
              <AgentChatWidgetButton
                {...args}
                variant="glyph"
                isStreaming
                thinkingGlyphVariant={thinkingGlyphVariant}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  ),
};

function ClickToCycleRender(args: AgentChatWidgetButtonProps) {
  const [isStreaming, setIsStreaming] = useState(false);

  return (
    <div css={frameCSS}>
      <div css={interactivePanelCSS}>
        <div css={interactiveCanvasCSS}>
          <div css={interactiveCanvasButtonCSS}>
            <AgentChatWidgetButton
              {...args}
              isStreaming={isStreaming}
              thinkingGlyphVariant={
                args.thinkingGlyphVariant ?? thinkingGlyphVariants[0]
              }
              ariaLabel={isStreaming ? "PXI is thinking" : "Open agent chat"}
              onClick={() => setIsStreaming((value) => !value)}
              isFloating={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export const ClickToCycleStates: Story = {
  args: {
    variant: "glyph",
  },
  render: (args) => <ClickToCycleRender {...args} />,
};
