import { Alert, Button, Flex } from "@phoenix/components";

import { usePlaygroundExpectedOutputs } from "./PlaygroundExpectedOutputsContext";

/**
 * A banner above the rows with the ways out when a batch of expected-output
 * writes failed. Nothing otherwise: annotations show as recorded the moment
 * they are made, and a line that came and went with each batch moved the
 * whole table under the cursor while someone was annotating.
 */
export function PlaygroundExpectedOutputsStatus({
  onReloadExamples,
}: {
  /** Refetches the examples, for a write rejected on a stale revision. */
  onReloadExamples: () => void;
}) {
  const { status, error, retry } = usePlaygroundExpectedOutputs();

  if (!error) {
    return null;
  }

  return (
    <Alert
      variant="danger"
      banner
      title="Could not save expected outputs"
      extra={
        // The message can be long; it wraps, the buttons don't shrink.
        <Flex direction="row" gap="size-100" flex="none">
          <Button
            size="S"
            isDisabled={status === "saving"}
            onPress={() => void retry()}
          >
            Retry
          </Button>
          <Button
            size="S"
            isDisabled={status === "saving"}
            onPress={onReloadExamples}
          >
            Reload examples
          </Button>
        </Flex>
      }
    >
      {error}
    </Alert>
  );
}
