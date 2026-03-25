import { css } from "@emotion/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useCallback, useState } from "react";

import {
  Button,
  Flex,
  Icon,
  Icons,
  Menu,
  MenuContainer,
  MenuItem,
  MenuTrigger,
  Text,
} from "@phoenix/components";
import {
  PromptInput,
  PromptInputActions,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@phoenix/components/ai/prompt-input";
import type { PromptInputStatus } from "@phoenix/components/ai/prompt-input";
import { GenerativeProviderIcon } from "@phoenix/components/generative/GenerativeProviderIcon";

const containerCSS = css`
  width: 600px;
`;

const meta = {
  title: "AI/PromptInput",
  parameters: {
    layout: "centered",
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Basic prompt input with textarea and submit button.
 */
export const Default: Story = {
  render: () => {
    const handleSubmit = (value: string) => {
      // eslint-disable-next-line no-console
      console.log("Submitted:", value);
    };

    return (
      <div css={containerCSS}>
        <PromptInput onSubmit={handleSubmit}>
          <PromptInputBody>
            <PromptInputTextarea />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools />
            <PromptInputActions>
              <PromptInputSubmit />
            </PromptInputActions>
          </PromptInputFooter>
        </PromptInput>
      </div>
    );
  },
};

/**
 * Prompt input with icon tool buttons in the footer.
 */
export const WithToolbar: Story = {
  render: () => {
    const handleSubmit = (value: string) => {
      // eslint-disable-next-line no-console
      console.log("Submitted:", value);
    };

    return (
      <div css={containerCSS}>
        <PromptInput onSubmit={handleSubmit}>
          <PromptInputBody>
            <PromptInputTextarea placeholder="Ask a question..." />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools>
              <PromptInputButton aria-label="Add attachment">
                <Icon svg={<Icons.PlusOutline />} />
              </PromptInputButton>
              <PromptInputButton aria-label="Search the web">
                <Icon svg={<Icons.SearchOutline />} />
              </PromptInputButton>
              <PromptInputButton aria-label="Take screenshot">
                <Icon svg={<Icons.ImageOutline />} />
              </PromptInputButton>
            </PromptInputTools>
            <PromptInputActions>
              <PromptInputSubmit />
            </PromptInputActions>
          </PromptInputFooter>
        </PromptInput>
      </div>
    );
  },
};

/**
 * Demonstrates the declarative tooltip API on tool buttons, including
 * simple string tooltips, keyboard shortcut hints, and custom placement.
 */
export const WithTooltips: Story = {
  render: () => {
    const handleSubmit = (value: string) => {
      // eslint-disable-next-line no-console
      console.log("Submitted:", value);
    };

    return (
      <div css={containerCSS}>
        <PromptInput onSubmit={handleSubmit}>
          <PromptInputBody>
            <PromptInputTextarea placeholder="Hover the tool buttons to see tooltips..." />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools>
              <PromptInputButton
                tooltip="Attach files"
                aria-label="Attach files"
              >
                <Icon svg={<Icons.PlusOutline />} />
              </PromptInputButton>
              <PromptInputButton
                tooltip={{ content: "Search the web", shortcut: "\u2318K" }}
                aria-label="Search the web"
              >
                <Icon svg={<Icons.SearchOutline />} />
              </PromptInputButton>
              <PromptInputButton
                tooltip={{
                  content: "Take screenshot",
                  shortcut: "\u2318M",
                  position: "bottom",
                }}
                aria-label="Take screenshot"
              >
                <Icon svg={<Icons.ImageOutline />} />
              </PromptInputButton>
            </PromptInputTools>
            <PromptInputActions>
              <PromptInputSubmit />
            </PromptInputActions>
          </PromptInputFooter>
        </PromptInput>
      </div>
    );
  },
};

const MODELS: { provider: ModelProvider; name: string }[] = [
  { provider: "OPENAI", name: "gpt-4o" },
  { provider: "OPENAI", name: "gpt-4o-mini" },
  { provider: "ANTHROPIC", name: "claude-sonnet-4-20250514" },
  { provider: "ANTHROPIC", name: "claude-haiku-4-5-20251001" },
  { provider: "GOOGLE", name: "gemini-2.0-flash" },
  { provider: "DEEPSEEK", name: "deepseek-chat" },
];

/**
 * Demonstrates how a model selector (like ModelMenu) composes into the
 * PromptInput footer alongside tool buttons. Uses a lightweight mock menu
 * since the real ModelMenu requires a Relay environment.
 */
export const WithModelSelector: Story = {
  render: function WithModelSelectorStory() {
    const [selectedModel, setSelectedModel] = useState(MODELS[0]);

    const handleSubmit = (value: string) => {
      // eslint-disable-next-line no-console
      console.log("Submitted:", value, "with model:", selectedModel.name);
    };

    return (
      <div css={containerCSS}>
        <PromptInput onSubmit={handleSubmit}>
          <PromptInputBody>
            <PromptInputTextarea placeholder="Plan, search, build anything" />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools>
              <PromptInputButton aria-label="Add attachment">
                <Icon svg={<Icons.PlusOutline />} />
              </PromptInputButton>
              <MenuTrigger>
                <Button size="S" variant="quiet">
                  <Flex direction="row" gap="size-100" alignItems="center">
                    <GenerativeProviderIcon
                      provider={selectedModel.provider}
                      height={16}
                    />
                    <Text>{selectedModel.name}</Text>
                  </Flex>
                </Button>
                <MenuContainer placement="top start" shouldFlip>
                  <Menu
                    onAction={(key) => {
                      const model = MODELS.find((m) => m.name === key);
                      if (model) setSelectedModel(model);
                    }}
                  >
                    {MODELS.map((model) => (
                      <MenuItem key={model.name} id={model.name}>
                        <Flex
                          direction="row"
                          gap="size-100"
                          alignItems="center"
                          width="100%"
                        >
                          <GenerativeProviderIcon
                            provider={model.provider}
                            height={16}
                          />
                          <Text flex="1 1 auto">{model.name}</Text>
                          {model.name === selectedModel.name && (
                            <Icon svg={<Icons.CheckmarkOutline />} />
                          )}
                        </Flex>
                      </MenuItem>
                    ))}
                  </Menu>
                </MenuContainer>
              </MenuTrigger>
            </PromptInputTools>
            <PromptInputActions>
              <PromptInputButton aria-label="Take screenshot">
                <Icon svg={<Icons.ImageOutline />} />
              </PromptInputButton>
              <PromptInputSubmit />
            </PromptInputActions>
          </PromptInputFooter>
        </PromptInput>
      </div>
    );
  },
};

const STREAMING_TIMEOUT = 3000;

/**
 * Demonstrates streaming status with stop button functionality.
 */
export const Streaming: Story = {
  render: function StreamingStory() {
    const [status, setStatus] = useState<PromptInputStatus>("ready");

    const handleSubmit = useCallback((value: string) => {
      // eslint-disable-next-line no-console
      console.log("Submitted:", value);
      setStatus("streaming");

      setTimeout(() => {
        setStatus("ready");
      }, STREAMING_TIMEOUT);
    }, []);

    const handleStop = useCallback(() => {
      // eslint-disable-next-line no-console
      console.log("Stopped generation");
      setStatus("ready");
    }, []);

    return (
      <div css={containerCSS}>
        <PromptInput onSubmit={handleSubmit} status={status}>
          <PromptInputBody>
            <PromptInputTextarea placeholder="Try submitting to see the stop button..." />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools>
              <PromptInputButton aria-label="Add attachment">
                <Icon svg={<Icons.PlusOutline />} />
              </PromptInputButton>
            </PromptInputTools>
            <PromptInputActions>
              <PromptInputSubmit onPress={handleStop} />
            </PromptInputActions>
          </PromptInputFooter>
        </PromptInput>
      </div>
    );
  },
};

/**
 * Prompt input with custom placeholder text.
 */
export const CustomPlaceholder: Story = {
  render: () => {
    const handleSubmit = (value: string) => {
      // eslint-disable-next-line no-console
      console.log("Submitted:", value);
    };

    return (
      <div css={containerCSS}>
        <PromptInput onSubmit={handleSubmit}>
          <PromptInputBody>
            <PromptInputTextarea placeholder="Describe your experiment..." />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools />
            <PromptInputActions>
              <PromptInputSubmit />
            </PromptInputActions>
          </PromptInputFooter>
        </PromptInput>
      </div>
    );
  },
};

/**
 * Gallery showing all prompt input variants.
 */
export const Gallery: Story = {
  render: function GalleryStory() {
    const [status, setStatus] = useState<PromptInputStatus>("ready");

    const handleSubmit = useCallback((value: string) => {
      // eslint-disable-next-line no-console
      console.log("Submitted:", value);
      setStatus("streaming");
      setTimeout(() => setStatus("ready"), STREAMING_TIMEOUT);
    }, []);

    return (
      <Flex direction="column" gap="size-200">
        {/* Minimal */}
        <div css={containerCSS}>
          <PromptInput onSubmit={handleSubmit}>
            <PromptInputBody>
              <PromptInputTextarea placeholder="Minimal — textarea + submit only" />
            </PromptInputBody>
            <PromptInputFooter>
              <PromptInputTools />
              <PromptInputActions>
                <PromptInputSubmit />
              </PromptInputActions>
            </PromptInputFooter>
          </PromptInput>
        </div>

        {/* With toolbar */}
        <div css={containerCSS}>
          <PromptInput onSubmit={handleSubmit}>
            <PromptInputBody>
              <PromptInputTextarea placeholder="With toolbar — icon buttons" />
            </PromptInputBody>
            <PromptInputFooter>
              <PromptInputTools>
                <PromptInputButton aria-label="Add attachment">
                  <Icon svg={<Icons.PlusOutline />} />
                </PromptInputButton>
                <PromptInputButton aria-label="Search">
                  <Icon svg={<Icons.SearchOutline />} />
                </PromptInputButton>
              </PromptInputTools>
              <PromptInputActions>
                <PromptInputSubmit />
              </PromptInputActions>
            </PromptInputFooter>
          </PromptInput>
        </div>

        {/* Streaming state */}
        <div css={containerCSS}>
          <PromptInput onSubmit={handleSubmit} status={status}>
            <PromptInputBody>
              <PromptInputTextarea placeholder="Streaming state — submit to see stop button" />
            </PromptInputBody>
            <PromptInputFooter>
              <PromptInputTools>
                <PromptInputButton aria-label="Add attachment">
                  <Icon svg={<Icons.PlusOutline />} />
                </PromptInputButton>
              </PromptInputTools>
              <PromptInputActions>
                <PromptInputSubmit onPress={() => setStatus("ready")} />
              </PromptInputActions>
            </PromptInputFooter>
          </PromptInput>
        </div>

        {/* Disabled */}
        <div css={containerCSS}>
          <PromptInput onSubmit={handleSubmit} isDisabled>
            <PromptInputBody>
              <PromptInputTextarea placeholder="Disabled state" />
            </PromptInputBody>
            <PromptInputFooter>
              <PromptInputTools />
              <PromptInputActions>
                <PromptInputSubmit />
              </PromptInputActions>
            </PromptInputFooter>
          </PromptInput>
        </div>
      </Flex>
    );
  },
};
