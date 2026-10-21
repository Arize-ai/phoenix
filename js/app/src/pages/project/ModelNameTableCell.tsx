import { Token } from "@phoenix/components";
import { toPythonPrimitiveStr } from "@phoenix/utils/pythonUtils";

/**
 * Builds a span filter DSL condition that matches spans invoking the given model
 */
export const makeModelNameFilterCondition = (modelName: string) =>
  `llm.model_name == ${toPythonPrimitiveStr(modelName)}`;

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
    <span
      style={{ display: "inline-flex", maxWidth: "100%" }}
      onClick={(e) => e.stopPropagation()}
    >
      <Token
        maxWidth="100%"
        title={`Filter spans by model ${modelName}`}
        onPress={() =>
          onFilterConditionPressed(makeModelNameFilterCondition(modelName))
        }
      >
        {modelName}
      </Token>
    </span>
  );
};
