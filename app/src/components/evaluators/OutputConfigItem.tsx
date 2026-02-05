import { PropsWithChildren, useCallback } from "react";
import { css } from "@emotion/react";

import {
  Button,
  FieldError,
  Flex,
  Icon,
  Icons,
  Input,
  Label,
  ListBox,
  NumberField,
  Popover,
  Select,
  SelectChevronUpDownIcon,
  SelectItem,
  SelectValue,
  Text,
  TextField,
} from "@phoenix/components";
import { useEvaluatorStore } from "@phoenix/contexts/EvaluatorContext";
import type { AnnotationConfig } from "@phoenix/store/evaluatorStore";
import type {
  ClassificationChoice,
  EvaluatorOptimizationDirection,
} from "@phoenix/types";

import { optimizationDirectionOptions } from "./OptimizationDirectionField";

export type OutputConfigItemProps = {
  /**
   * The config to display/edit.
   */
  config: AnnotationConfig;
  /**
   * The index of this config in the outputConfigs array.
   */
  index: number;
  /**
   * If true, name and values/bounds will be read-only.
   * Optimization direction will still be editable.
   */
  isReadOnly?: boolean;
  /**
   * If true, shows a duplicate name error.
   */
  hasDuplicateNameError?: boolean;
  /**
   * If true, hides the name label (useful when name is shown in accordion header).
   */
  hideNameLabel?: boolean;
};

const containerCSS = css`
  background-color: var(--ac-global-background-color-dark);
  border-radius: var(--ac-global-rounding-medium);
  padding: var(--ac-global-dimension-static-size-200);
  border: 1px solid var(--ac-global-border-color-default);
`;

const containerNoBorderCSS = css`
  background-color: transparent;
  padding: 0;
`;

/**
 * A component for displaying/editing a single output configuration.
 * Supports both categorical and continuous configs.
 */
export const OutputConfigItem = ({
  config,
  index,
  isReadOnly,
  hasDuplicateNameError,
  hideNameLabel,
}: OutputConfigItemProps) => {
  const {
    setOutputConfigNameAtIndex,
    setOutputConfigOptimizationDirectionAtIndex,
    setOutputConfigValuesAtIndex,
    updateOutputConfig,
  } = useEvaluatorStore((state) => ({
    setOutputConfigNameAtIndex: state.setOutputConfigNameAtIndex,
    setOutputConfigOptimizationDirectionAtIndex:
      state.setOutputConfigOptimizationDirectionAtIndex,
    setOutputConfigValuesAtIndex: state.setOutputConfigValuesAtIndex,
    updateOutputConfig: state.updateOutputConfig,
  }));

  const isCategorical = "values" in config;

  const handleNameChange = useCallback(
    (value: string) => {
      setOutputConfigNameAtIndex(index, value);
    },
    [index, setOutputConfigNameAtIndex]
  );

  const handleOptimizationDirectionChange = useCallback(
    (value: EvaluatorOptimizationDirection) => {
      setOutputConfigOptimizationDirectionAtIndex(index, value);
    },
    [index, setOutputConfigOptimizationDirectionAtIndex]
  );

  const handleValuesChange = useCallback(
    (values: ClassificationChoice[]) => {
      setOutputConfigValuesAtIndex(index, values);
    },
    [index, setOutputConfigValuesAtIndex]
  );

  const handleChoiceLabelChange = useCallback(
    (choiceIndex: number, label: string) => {
      if (!isCategorical) return;
      const newValues = [...config.values];
      newValues[choiceIndex] = { ...newValues[choiceIndex], label };
      handleValuesChange(newValues);
    },
    [config, isCategorical, handleValuesChange]
  );

  const handleChoiceScoreChange = useCallback(
    (choiceIndex: number, score: number | undefined) => {
      if (!isCategorical) return;
      const newValues = [...config.values];
      newValues[choiceIndex] = { ...newValues[choiceIndex], score };
      handleValuesChange(newValues);
    },
    [config, isCategorical, handleValuesChange]
  );

  const handleAddChoice = useCallback(() => {
    if (!isCategorical) return;
    const newValues = [...config.values, { label: "", score: undefined }];
    handleValuesChange(newValues);
  }, [config, isCategorical, handleValuesChange]);

  const handleRemoveChoice = useCallback(
    (choiceIndex: number) => {
      if (!isCategorical || config.values.length <= 2) return;
      const newValues = config.values.filter((_, i) => i !== choiceIndex);
      handleValuesChange(newValues);
    },
    [config, isCategorical, handleValuesChange]
  );

  const handleBoundChange = useCallback(
    (bound: "lowerBound" | "upperBound", value: number | undefined) => {
      if (isCategorical) return;
      updateOutputConfig(index, { [bound]: value });
    },
    [index, isCategorical, updateOutputConfig]
  );

  return (
    <div css={hideNameLabel ? containerNoBorderCSS : containerCSS}>
      <Flex direction="column" gap="size-200">
        <Flex alignItems="center" justifyContent="space-between" gap="size-200">
          <TextField
            isDisabled={isReadOnly}
            value={config.name}
            onChange={handleNameChange}
            isInvalid={hasDuplicateNameError}
          >
            {!hideNameLabel && <Label>Name</Label>}
            <Input placeholder="e.g. correctness" />
            {hasDuplicateNameError && (
              <FieldError>Name must be unique</FieldError>
            )}
          </TextField>
          <Select
            value={config.optimizationDirection}
            onChange={(e) =>
              handleOptimizationDirectionChange(
                e as EvaluatorOptimizationDirection
              )
            }
            aria-label="Optimization direction"
            data-testid={`optimization-direction-picker-${index}`}
            css={css`
              width: 100%;
            `}
          >
            <Label>Optimization direction</Label>
            <Button>
              <SelectValue />
              <SelectChevronUpDownIcon />
            </Button>
            <Popover>
              <ListBox>
                {optimizationDirectionOptions.map((option) => (
                  <SelectItem key={option.value} id={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </ListBox>
            </Popover>
          </Select>
        </Flex>

        {isCategorical ? (
          <Flex direction="column" gap="size-100">
            <GridRow>
              <Text>Choice</Text>
              <Text>Score</Text>
            </GridRow>
            {config.values.map((value, choiceIndex) => (
              <GridRow key={choiceIndex}>
                <TextField
                  isDisabled={isReadOnly}
                  value={value.label ?? ""}
                  onChange={(newLabel) =>
                    handleChoiceLabelChange(choiceIndex, newLabel)
                  }
                  aria-label={`Choice ${choiceIndex + 1}`}
                  css={css`
                    flex: 1 1 auto;
                    flex-shrink: 1;
                  `}
                >
                  <Input placeholder={`e.g. ${ALPHABET[choiceIndex % 26]}`} />
                </TextField>
                <Flex direction="row" gap="size-100" alignItems="center">
                  <NumberField
                    isDisabled={isReadOnly}
                    value={
                      typeof value.score === "number" ? value.score : undefined
                    }
                    onChange={(newScore) =>
                      handleChoiceScoreChange(choiceIndex, newScore)
                    }
                    aria-label={`Score ${choiceIndex + 1}`}
                    css={css`
                      width: 100%;
                    `}
                  >
                    <Input
                      placeholder={`e.g. ${choiceIndex} (optional)`}
                      className="react-aria-Input"
                      css={css`
                        width: 100%;
                      `}
                    />
                  </NumberField>
                  {!isReadOnly && choiceIndex > 1 && (
                    <Button
                      type="button"
                      leadingVisual={<Icon svg={<Icons.TrashOutline />} />}
                      aria-label="Remove choice"
                      onPress={() => {
                        if (config.values.length === 2) {
                          return;
                        }
                        handleRemoveChoice(choiceIndex);
                      }}
                    />
                  )}
                </Flex>
              </GridRow>
            ))}
            {!isReadOnly && (
              <Button
                type="button"
                size="S"
                variant="quiet"
                css={css`
                  width: fit-content;
                  align-self: flex-end;
                `}
                leadingVisual={<Icon svg={<Icons.PlusOutline />} />}
                aria-label="Add choice"
                onPress={handleAddChoice}
              >
                Add choice
              </Button>
            )}
          </Flex>
        ) : (
          // Continuous config
          <Flex direction="row" gap="size-200" alignItems="end">
            <NumberField
              isDisabled={isReadOnly}
              value={config.lowerBound ?? undefined}
              onChange={(value) => handleBoundChange("lowerBound", value)}
            >
              <Label>Lower bound</Label>
              <Input
                placeholder={
                  config.lowerBound != null ? undefined : "unbounded"
                }
              />
            </NumberField>
            <NumberField
              isDisabled={isReadOnly}
              value={config.upperBound ?? undefined}
              onChange={(value) => handleBoundChange("upperBound", value)}
            >
              <Label>Upper bound</Label>
              <Input
                placeholder={
                  config.upperBound != null ? undefined : "unbounded"
                }
              />
            </NumberField>
          </Flex>
        )}
      </Flex>
    </div>
  );
};

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const GridRow = ({ children }: PropsWithChildren) => {
  return (
    <div
      css={css`
        width: 100%;
        display: grid;
        grid-template-columns: 3fr 1fr;
        gap: var(--ac-global-dimension-static-size-100);
        align-items: start;
      `}
    >
      {children}
    </div>
  );
};
