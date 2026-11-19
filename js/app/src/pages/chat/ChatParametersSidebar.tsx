import { css } from "@emotion/react";

import {
  Button,
  Heading,
  Input,
  Label,
  NumberField,
  Slider,
  SliderNumberField,
  Text,
  TextArea,
  TextField,
} from "@phoenix/components";

import type { ChatParameters } from "./chatParameters";
import { DEFAULT_CHAT_PARAMETERS } from "./chatParameters";

/**
 * Where an unset thumb rests — the conventional provider default for both
 * temperature and top P.
 */
const UNSET_SLIDER_POSITION = 1;

const chatParametersCSS = css`
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-300);
  padding: var(--global-dimension-size-200);

  .chat-parameters__section {
    display: flex;
    flex-direction: column;
    gap: var(--global-dimension-size-150);
  }

  .chat-parameters__section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: var(--global-dimension-size-300);
  }

  .chat-parameters__system-prompt textarea {
    resize: vertical;
    min-height: var(--global-dimension-size-1200);
  }
`;

/**
 * A sampling control that may be unset: until the user takes it over, the
 * thumb rests at the conventional default and the output reads "auto".
 */
function SamplingSlider({
  label,
  maxValue,
  value,
  onChange,
}: {
  label: string;
  maxValue: number;
  value: number | null;
  onChange: (value: number) => void;
}) {
  return (
    <Slider
      label={label}
      value={value ?? UNSET_SLIDER_POSITION}
      minValue={0}
      maxValue={maxValue}
      step={0.01}
      onChange={(next) => {
        if (typeof next === "number") {
          // Thumb drags can carry float noise (0.9800000190734864) — round
          // to the step so clean values persist and hit the API.
          onChange(Math.round(next * 100) / 100);
        }
      }}
    >
      {value == null ? (
        <Text color="text-500" fontStyle="italic">
          auto
        </Text>
      ) : (
        <SliderNumberField />
      )}
    </Slider>
  );
}

/**
 * The chat page's left rail: a system prompt plus the sampling controls
 * every model understands. A slider whose value reads "auto" hasn't been
 * touched — the model's own default applies until the user takes it over,
 * and Reset hands all three sampling controls back to the model.
 */
export function ChatParametersSidebar({
  parameters,
  onChange,
}: {
  parameters: ChatParameters;
  onChange: (parameters: ChatParameters) => void;
}) {
  const setParameter = (patch: Partial<ChatParameters>) => {
    onChange({ ...parameters, ...patch });
  };

  return (
    <aside className="chat-parameters" css={chatParametersCSS}>
      <section className="chat-parameters__section">
        <Heading level={2} weight="heavy">
          System prompt
        </Heading>
        <TextField
          size="S"
          value={parameters.systemPrompt}
          onChange={(systemPrompt) => setParameter({ systemPrompt })}
          aria-label="System prompt"
          className="chat-parameters__system-prompt"
        >
          <TextArea placeholder="Describe how the model should behave" />
        </TextField>
      </section>
      <section className="chat-parameters__section">
        <div className="chat-parameters__section-header">
          <Heading level={2} weight="heavy">
            Parameters
          </Heading>
          <Button
            size="S"
            variant="quiet"
            isDisabled={
              parameters.temperature == null &&
              parameters.topP == null &&
              parameters.maxOutputTokens == null
            }
            onPress={() =>
              onChange({
                ...DEFAULT_CHAT_PARAMETERS,
                systemPrompt: parameters.systemPrompt,
              })
            }
          >
            Reset
          </Button>
        </div>
        <SamplingSlider
          label="Temperature"
          maxValue={2}
          value={parameters.temperature}
          onChange={(temperature) => setParameter({ temperature })}
        />
        <SamplingSlider
          label="Top P"
          maxValue={1}
          value={parameters.topP}
          onChange={(topP) => setParameter({ topP })}
        />
        <NumberField
          size="S"
          value={parameters.maxOutputTokens ?? NaN}
          minValue={1}
          step={1}
          formatOptions={{ maximumFractionDigits: 0 }}
          onChange={(maxOutputTokens) =>
            setParameter({
              maxOutputTokens: Number.isFinite(maxOutputTokens)
                ? Math.floor(maxOutputTokens)
                : null,
            })
          }
        >
          <Label>Max output tokens</Label>
          <Input placeholder="auto" />
        </NumberField>
        <Text size="XS" color="text-500">
          Unset parameters use the model&apos;s own defaults.
        </Text>
      </section>
    </aside>
  );
}
