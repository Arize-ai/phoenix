import { ToolPartCodeBlock, ToolPartLabel } from "./ToolPartPrimitives";
import type { ToolInvocationPart } from "./toolPartTypes";
import { stringifyToolValue } from "./toolPartTypes";

/**
 * Shared details for the read-only dataset tools (list_datasets,
 * list_dataset_examples, list_dataset_splits, list_dataset_labels): renders the
 * tool's output under `label`, or the error. `label` names the success result
 * (e.g. "Datasets", "Splits").
 */
export function DatasetReadToolDetails({
  part,
  label,
}: {
  part: ToolInvocationPart;
  label: string;
}) {
  return (
    <div className="tool-part__body">
      {part.state === "output-available" ? (
        <>
          <ToolPartLabel variant="success">{label}</ToolPartLabel>
          <ToolPartCodeBlock>
            {stringifyToolValue(part.output)}
          </ToolPartCodeBlock>
        </>
      ) : null}
      {part.state === "output-error" ? (
        <>
          <ToolPartLabel variant="danger">Error</ToolPartLabel>
          <ToolPartCodeBlock>{part.errorText ?? ""}</ToolPartCodeBlock>
        </>
      ) : null}
    </div>
  );
}
