import { css } from "@emotion/react";
import type { PropsWithChildren } from "react";

import {
  Alert,
  Button,
  Flex,
  Icon,
  Icons,
  Input,
  NumberField,
  Text,
  TextField,
} from "@phoenix/components";
import { EvaluatorCategoricalChoiceConfig } from "@phoenix/components/evaluators/EvaluatorCategoricalChoiceConfig";
import { useEvaluatorStore } from "@phoenix/contexts/EvaluatorContext";

/** Edit the selected categorical output without replacing other outputs. */
export function EvaluatorSlotOutput({ name }: { name: string }) {
  const state = useEvaluatorStore((state) => state);
  const index = state.outputConfigs.findIndex((config) => config.name === name);
  const config = state.outputConfigs[index];
  if (!config) return <Alert variant="info">Choose an output.</Alert>;
  if (!("values" in config))
    return (
      <Flex direction="column" gap="size-100">
        <Text>Numeric output: {config.name}</Text>
        <Text color="text-500">
          Review this evaluator with an expected score. Bounds are optional.
        </Text>
        {(["lowerBound", "upperBound"] as const).map((bound) => (
          <NumberField
            key={bound}
            aria-label={bound === "lowerBound" ? "Lower bound" : "Upper bound"}
            value={config[bound] ?? NaN}
            onChange={(value) =>
              state.setOutputConfigs(
                state.outputConfigs.map((output, outputIndex) =>
                  outputIndex === index
                    ? {
                        ...config,
                        [bound]: Number.isFinite(value) ? value : null,
                      }
                    : output
                )
              )
            }
          >
            <Input
              placeholder={
                bound === "lowerBound" ? "Lower bound" : "Upper bound"
              }
            />
          </NumberField>
        ))}
      </Flex>
    );
  // The first output is the one the shared form component edits. It also owns
  // the "include explanation" switch and the optimization direction.
  if (index === 0) return <EvaluatorCategoricalChoiceConfig />;
  // Secondary outputs get the same choice grid, minus the first output's
  // evaluator-wide controls.
  return (
    <div css={outputConfigCSS}>
      <Flex direction="column" gap="size-100">
        <GridRow>
          <Text>Choice</Text>
          <Text>Score</Text>
        </GridRow>
        {config.values.map((value, valueIndex) => (
          <GridRow key={valueIndex}>
            <TextField
              aria-label={`Choice ${valueIndex + 1}`}
              value={value.label}
              onChange={(label) =>
                state.setOutputConfigValuesAtIndex(
                  index,
                  config.values.map((choice, choiceIndex) =>
                    choiceIndex === valueIndex ? { ...choice, label } : choice
                  )
                )
              }
            >
              <Input placeholder={`e.g. ${ALPHABET[valueIndex % 26]}`} />
            </TextField>
            <Flex direction="row" gap="size-100" alignItems="center">
              <NumberField
                aria-label={`Score ${valueIndex + 1}`}
                value={value.score}
                css={css`
                  width: 100%;
                `}
                onChange={(score) =>
                  state.setOutputConfigValuesAtIndex(
                    index,
                    config.values.map((choice, choiceIndex) =>
                      choiceIndex === valueIndex ? { ...choice, score } : choice
                    )
                  )
                }
              >
                <Input
                  placeholder={`e.g. ${valueIndex} (optional)`}
                  className="react-aria-Input"
                  css={css`
                    width: 100%;
                  `}
                />
              </NumberField>
              {config.values.length > 2 ? (
                <Button
                  type="button"
                  leadingVisual={<Icon svg={<Icons.Trash />} />}
                  aria-label={`Remove choice ${value.label || valueIndex + 1}`}
                  onPress={() =>
                    state.setOutputConfigValuesAtIndex(
                      index,
                      config.values.filter(
                        (_choice, choiceIndex) => choiceIndex !== valueIndex
                      )
                    )
                  }
                />
              ) : null}
            </Flex>
          </GridRow>
        ))}
        <Flex justifyContent="end">
          <Button
            type="button"
            size="S"
            variant="quiet"
            leadingVisual={<Icon svg={<Icons.Plus />} />}
            onPress={() =>
              state.setOutputConfigValuesAtIndex(index, [
                ...config.values,
                { label: "" },
              ])
            }
          >
            Add choice
          </Button>
        </Flex>
      </Flex>
    </div>
  );
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

// Same frame as EvaluatorCategoricalChoiceConfig so the first and secondary
// outputs read as the same kind of block.
const outputConfigCSS = css`
  border-radius: var(--global-rounding-medium);
  padding: var(--global-dimension-size-200);
  border: 1px solid var(--global-border-color-default);
`;

const GridRow = ({ children }: PropsWithChildren) => (
  <div
    css={css`
      width: 100%;
      display: grid;
      grid-template-columns: 3fr 1fr;
      gap: var(--global-dimension-size-100);
      align-items: start;
    `}
  >
    {children}
  </div>
);
