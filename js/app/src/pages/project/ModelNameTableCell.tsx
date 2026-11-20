import { css } from "@emotion/react";
import { Button as AriaButton } from "react-aria-components";

import { Tooltip, TooltipTrigger } from "@phoenix/components";
import { quietHoverCSS } from "@phoenix/components/core/styles";
import { truncateSingleCSS } from "@phoenix/components/core/utility/Truncate";
import { GenerativeProviderIcon } from "@phoenix/components/generative/GenerativeProviderIcon";
import { openInferenceModelProviderToPhoenixModelProvider } from "@phoenix/pages/playground/playgroundUtils";
import { toPythonPrimitiveStr } from "@phoenix/utils/pythonUtils";

/**
 * Builds a span filter DSL condition that matches spans invoking the given model
 */
export const makeModelNameFilterCondition = (modelName: string) =>
  `llm.model_name == ${toPythonPrimitiveStr(modelName)}`;

/**
 * Sized to its content; it takes over the quiet press's negative inline
 * margin, which would otherwise shrink a fit-content box and truncate the name.
 */
const modelNameCellCSS = css`
  width: fit-content;
  max-width: calc(100% + 2 * var(--global-dimension-size-50));
  margin-inline: calc(-1 * var(--global-dimension-size-50));
`;

/**
 * The model name is a value of the span, so it reads as text, led by its
 * provider's icon as in the prompts table. The cell owns the filter, as a
 * quiet press on that content.
 */
const modelNameButtonCSS = css`
  ${quietHoverCSS};
  appearance: none;
  display: flex;
  align-items: center;
  gap: var(--global-dimension-size-100);
  max-width: 100%;
  min-width: 0;
  margin-inline: 0;
  border: none;
  background: none;
  font: inherit;
  color: inherit;
  outline: none;
  &[data-focus-visible] {
    outline: var(--focus-ring-thickness) solid var(--focus-ring-color);
  }
  .model-name__text {
    ${truncateSingleCSS};
    min-width: 0;
  }
`;

type ModelNameTableCellProps = {
  modelName: string | null | undefined;
  /**
   * The span's "llm.provider" attribute, such as "openai". Its icon leads the
   * name when Phoenix knows the provider.
   */
  modelProvider?: string | null;
  /**
   * Called with a filter DSL condition when the user presses the model name
   */
  onFilterConditionPressed: (condition: string) => void;
};

export const ModelNameTableCell = ({
  modelName,
  modelProvider,
  onFilterConditionPressed,
}: ModelNameTableCellProps) => {
  if (!modelName) {
    return "--";
  }
  const provider =
    openInferenceModelProviderToPhoenixModelProvider(modelProvider);
  const filterLabel = `Filter spans by model ${modelName}`;
  return (
    // Stop the click from reaching the row, which would open the span details
    <div css={modelNameCellCSS} onClick={(e) => e.stopPropagation()}>
      <TooltipTrigger delay={500}>
        <AriaButton
          css={modelNameButtonCSS}
          aria-label={filterLabel}
          onPress={() =>
            onFilterConditionPressed(makeModelNameFilterCondition(modelName))
          }
        >
          {provider ? (
            <GenerativeProviderIcon provider={provider} height={16} />
          ) : null}
          <span className="model-name__text">{modelName}</span>
        </AriaButton>
        <Tooltip>{filterLabel}</Tooltip>
      </TooltipTrigger>
    </div>
  );
};
