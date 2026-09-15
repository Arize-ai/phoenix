import { Suspense } from "react";

import {
  Button,
  CompositeField,
  Icon,
  Icons,
  Loading,
  Tooltip,
  TooltipArrow,
  TooltipTrigger,
} from "@phoenix/components";
import { InvocationParameterSpecsSync } from "@phoenix/components/playground/model/InvocationParameterSpecsSync";
import { ModelParametersConfigButton } from "@phoenix/components/playground/model/ModelParametersConfigButton";
import { PlaygroundModelMenu } from "@phoenix/components/playground/model/PlaygroundModelMenu";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";

/**
 * The model picker and parameters of an instance, for the header row of a
 * prompt task and of an LLM evaluator task, whose judge is the instance's
 * model.
 */
export function PlaygroundInstanceModelControls({
  instanceId,
  disableEphemeralRouting,
}: {
  instanceId: number;
  /**
   * Hide the endpoint, region and base URL fields; used where routing must
   * come from custom providers or environment variables.
   */
  disableEphemeralRouting?: boolean;
}) {
  return (
    <>
      <Suspense
        fallback={
          <div>
            <Loading size="S" />
          </div>
        }
      >
        {/* Keeps instance invocation parameters aligned with the frontend
            spec table when model metadata or saved defaults change. */}
        <InvocationParameterSpecsSync instanceId={instanceId} />
      </Suspense>
      <CompositeField>
        <PlaygroundModelMenu playgroundInstanceId={instanceId} />
        <ModelParametersConfigButton
          playgroundInstanceId={instanceId}
          disableEphemeralRouting={disableEphemeralRouting}
        />
      </CompositeField>
    </>
  );
}

export function PlaygroundInstanceDeleteButton({
  instanceId,
}: {
  instanceId: number;
}) {
  const deleteInstance = usePlaygroundContext((state) => state.deleteInstance);
  return (
    <TooltipTrigger>
      <Button
        size="S"
        aria-label="Delete this instance of the playground"
        leadingVisual={<Icon svg={<Icons.Trash />} />}
        onPress={() => {
          deleteInstance(instanceId);
        }}
      />
      <Tooltip>
        <TooltipArrow />
        Delete this instance of the playground
      </Tooltip>
    </TooltipTrigger>
  );
}
