import { PropsWithChildren } from "react";
import { useShallow } from "zustand/react/shallow";
import { css } from "@emotion/react";

import { Flex, Input, Label, Text, TextField } from "@phoenix/components";
import { useEvaluatorStore } from "@phoenix/contexts/EvaluatorContext";
import { ClassificationEvaluatorAnnotationConfig } from "@phoenix/types";

import { OptimizationDirectionField } from "./OptimizationDirectionField";

export type ReadOnlyCategoricalConfigProps = {
  /**
   * If true, the optimization direction field will be read-only.
   * If false or omitted, it will be editable.
   */
  isReadOnly?: boolean;
};

/**
 * A display component for categorical evaluator output configuration that pulls
 * values from the EvaluatorStore.
 * Displays name and choices as disabled form fields matching the LLM evaluator style.
 * Optimization direction can be editable or read-only based on `isReadOnly` prop.
 */
export const ReadOnlyCategoricalConfig = ({
  isReadOnly,
}: ReadOnlyCategoricalConfigProps) => {
  const outputConfig = useEvaluatorStore(
    useShallow((state) => {
      const firstConfig = state.outputConfigs[0];
      if (firstConfig && "values" in firstConfig) {
        return firstConfig as ClassificationEvaluatorAnnotationConfig;
      }
      return null;
    })
  );

  if (!outputConfig) {
    return null;
  }

  const { name, values } = outputConfig;

  return (
    <div
      css={css`
        background-color: var(--ac-global-background-color-dark);
        border-radius: var(--ac-global-rounding-medium);
        padding: var(--ac-global-dimension-static-size-200);
        margin-top: var(--ac-global-dimension-static-size-50);
        border: 1px solid var(--ac-global-border-color-default);
      `}
    >
      <Flex direction="column" gap="size-200">
        <Flex alignItems="center" justifyContent="space-between" gap="size-200">
          <TextField isDisabled value={name}>
            <Label>Name</Label>
            <Input placeholder="e.g. correctness" />
          </TextField>
          <OptimizationDirectionField isReadOnly={isReadOnly} />
        </Flex>
        <Flex direction="column" gap="size-100">
          <GridRow>
            <Text>Choice</Text>
            <Text>Score</Text>
          </GridRow>
          {values.map((value, index) => (
            <GridRow key={index}>
              <TextField
                isDisabled
                value={value.label ?? ""}
                aria-label={`Choice ${index + 1}`}
                css={css`
                  flex: 1 1 auto;
                  flex-shrink: 1;
                `}
              >
                <Input />
              </TextField>
              <TextField
                isDisabled
                value={value.score != null ? String(value.score) : ""}
                aria-label={`Score ${index + 1}`}
                css={css`
                  width: 100%;
                `}
              >
                <Input />
              </TextField>
            </GridRow>
          ))}
        </Flex>
      </Flex>
    </div>
  );
};

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
