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
  supportsDecisionModels,
}: {
  instanceId: number;
  /**
   * Hide the endpoint, region and base URL fields; used where routing must
   * come from custom providers or environment variables.
   */
  disableEphemeralRouting?: boolean;
  supportsDecisionModels?: boolean;
}) {
  const isDecision = usePlaygroundContext((state) =>
    state.instances.find((instance) => instance.id === instanceId)?.model.modelType === "DECISION"
  );
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
        {!isDecision ? <InvocationParameterSpecsSync instanceId={instanceId} /> : null}
      </Suspense>
      <CompositeField>
        <PlaygroundModelMenu playgroundInstanceId={instanceId} supportsDecisionModels={supportsDecisionModels} />
        {!isDecision ? <ModelParametersConfigButton
          playgroundInstanceId={instanceId}
          disableEphemeralRouting={disableEphemeralRouting}
        /> : null}
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
