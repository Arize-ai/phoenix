import { css } from "@emotion/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

import {
  AgentChatWidgetButton,
  type AgentChatWidgetButtonProps,
  type PxiGlyphAnimation,
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

const glyphAnimations: PxiGlyphAnimation[] = [
  "orbit-reveal",
  "wave-reveal",
  "twinkle-reveal",
  "wave-hold",
];

const meta = {
  title: "Agent/AgentChatWidgetButton",
  component: AgentChatWidgetButton,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "PXI chat trigger button. Shows the resting pill state, the single wipe border treatment used while streaming, and the retained animated glyph options for the thinking state.",
      },
    },
  },
  args: {
    ariaLabel: "Open agent chat",
    glyphAnimation: "wave-reveal",
  },
  argTypes: {
    onClick: {
      action: "clicked",
    },
    glyphAnimation: {
      control: "inline-radio",
      options: glyphAnimations,
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
          <AgentChatWidgetButton {...args} isStreaming={false} />
        </div>
        <div css={stateCardCSS}>
          <AgentChatWidgetButton {...args} isStreaming />
        </div>
      </div>
    </div>
  ),
};

export const ThinkingAnimationAlternates: Story = {
  render: (args) => (
    <div css={frameCSS}>
      <div css={glyphComparisonSectionCSS}>
        <div css={glyphComparisonGridCSS}>
          {glyphAnimations.map((glyphAnimation) => (
            <div css={stateCardCSS} key={glyphAnimation}>
              <AgentChatWidgetButton
                {...args}
                isStreaming
                glyphAnimation={glyphAnimation}
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
              glyphAnimation={args.glyphAnimation ?? glyphAnimations[0]}
              ariaLabel={isStreaming ? "PXI is thinking" : "Open agent chat"}
              onClick={() => setIsStreaming((value) => !value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export const ClickToCycleStates: Story = {
  render: (args) => <ClickToCycleRender {...args} />,
};
