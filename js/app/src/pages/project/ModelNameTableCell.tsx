import { css } from "@emotion/react";
import { Button as AriaButton } from "react-aria-components";

import { quietHoverCSS } from "@phoenix/components/core/styles";
import { truncateSingleCSS } from "@phoenix/components/core/utility/Truncate";
import { toPythonPrimitiveStr } from "@phoenix/utils/pythonUtils";

/**
 * Builds a span filter DSL condition that matches spans invoking the given model
 */
export const makeModelNameFilterCondition = (modelName: string) =>
  `llm.model_name == ${toPythonPrimitiveStr(modelName)}`;

/**
 * The model name is a value of the span, so it reads as text; the cell owns
 * the filter, as a quiet press on that text.
 */
const modelNameButtonCSS = css`
  ${quietHoverCSS};
  appearance: none;
  display: flex;
  max-width: 100%;
  border: none;
  background: none;
  font: inherit;
  color: inherit;
  outline: none;
  &[data-focus-visible] {
    outline: var(--focus-ring-thickness) solid var(--focus-ring-color);
  }
`;

type ModelNameTableCellProps = {
  modelName: string | null | undefined;
  /**
   * Called with a filter DSL condition when the user presses the model name
   */
  onFilterConditionPressed: (condition: string) => void;
};

export const ModelNameTableCell = ({
  modelName,
  onFilterConditionPressed,
}: ModelNameTableCellProps) => {
  if (!modelName) {
    return "--";
  }
  return (
    // Stop the click from reaching the row, which would open the span details
    <div
      style={{ width: "fit-content", maxWidth: "100%" }}
      onClick={(e) => e.stopPropagation()}
    >
      <AriaButton
        css={modelNameButtonCSS}
        aria-label={`Filter spans by model ${modelName}`}
        onPress={() =>
          onFilterConditionPressed(makeModelNameFilterCondition(modelName))
        }
      >
        <span css={truncateSingleCSS} title={modelName}>
          {modelName}
        </span>
      </AriaButton>
    </div>
  );
};
