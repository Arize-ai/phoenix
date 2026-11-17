import { Suspense } from "react";

import { CompositeField, Loading } from "@phoenix/components";
import { InvocationParameterSpecsSync } from "@phoenix/components/playground/model/InvocationParameterSpecsSync";
import { ModelParametersConfigButton } from "@phoenix/components/playground/model/ModelParametersConfigButton";
import {
  PlaygroundModelMenu,
  type PlaygroundModelMenuProps,
} from "@phoenix/components/playground/model/PlaygroundModelMenu";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { isDecisionInstance } from "@phoenix/store/playground";

import type { InstanceModelRouting } from "./modelControlTypes";

/**
 * The model picker and parameters of an instance, for the header row of a
 * prompt task and of an LLM or decision evaluator, whose judge is the
 * instance's model.
 */
export function PlaygroundInstanceModelControls({
  instanceId,
  modelTypes,
  credentialSource,
  routing,
}: Pick<PlaygroundModelMenuProps, "modelTypes" | "credentialSource"> & {
  instanceId: number;
  /** Defaults to "editable". */
  routing?: InstanceModelRouting;
}) {
  const isDecision = usePlaygroundContext((state) =>
    isDecisionInstance(
      state.instances.find((instance) => instance.id === instanceId)
    )
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
        {!isDecision ? (
          <InvocationParameterSpecsSync instanceId={instanceId} />
        ) : null}
      </Suspense>
      <CompositeField>
        <PlaygroundModelMenu
          playgroundInstanceId={instanceId}
          modelTypes={modelTypes}
          credentialSource={credentialSource}
        />
        {/* A decision instance has no sampling parameters, but its model
            name and endpoint are set here too. */}
        <ModelParametersConfigButton
          playgroundInstanceId={instanceId}
          routing={routing}
        />
      </CompositeField>
    </>
  );
}
