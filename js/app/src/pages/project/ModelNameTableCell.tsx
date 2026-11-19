import { Tag, Tooltip, TooltipTrigger } from "@phoenix/components";
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

/**
 * The model is an object the span calls, so it is a Tag, and its one action
 * filters the spans to those that call it.
 */
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
      <TooltipTrigger delay={500}>
        <Tag
          maxWidth="100%"
          onPress={() =>
            onFilterConditionPressed(makeModelNameFilterCondition(modelName))
          }
        >
          {modelName}
        </Tag>
        <Tooltip>{`Filter spans by model ${modelName}`}</Tooltip>
      </TooltipTrigger>
    </div>
  );
};
