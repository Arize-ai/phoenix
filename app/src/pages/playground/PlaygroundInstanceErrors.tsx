import React from "react";

import { Alert, Flex } from "@arizeai/components";

import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";

import { PlaygroundInstanceProps } from "./types";

/**
 * Renders errors that occurred when parsing initial data for a playground instance
 */
export function PlaygroundInstanceErrors(props: PlaygroundInstanceProps) {
  const instanceId = props.playgroundInstanceId;
  const instances = usePlaygroundContext((state) => state.instances);
  const updateInstance = usePlaygroundContext((state) => state.updateInstance);
  const instance = instances.find((instance) => instance.id === instanceId);
  if (!instance) {
    throw new Error(`Playground instance ${instanceId} not found`);
  }
  const { parsingErrors } = instance;
  if (parsingErrors == null || parsingErrors.length === 0) {
    return null;
  }

  return (
    <Flex direction="column" gap={"size-50"}>
      {parsingErrors.map((error, i) => {
        return (
          <Alert
            variant="warning"
            dismissable
            key={error}
            onDismissClick={() => {
              updateInstance({
                instanceId,
                patch: {
                  parsingErrors: parsingErrors.filter((_, j) => i !== j),
                },
              });
            }}
          >
            {error}
          </Alert>
        );
      })}
    </Flex>
  );
}
