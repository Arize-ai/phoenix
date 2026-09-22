import { Alert, Button, Flex, View } from "@phoenix/components";

import { ExpectedOutputSaveIndicator } from "./ExpectedOutputSaveIndicator";
import { usePlaygroundExpectedOutputs } from "./PlaygroundExpectedOutputsContext";

/**
 * Where the table's expected-output writes stand, above the rows: a quiet
 * line while a batch is pending, saving or just saved, and a banner with the
 * ways out when a batch failed. Nothing while there is nothing to say.
 */
export function PlaygroundExpectedOutputsStatus({
  onReloadExamples,
}: {
  /** Refetches the examples, for a write rejected on a stale revision. */
  onReloadExamples: () => void;
}) {
  const { status, pendingCount, error, retry } = usePlaygroundExpectedOutputs();

  if (error) {
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

  if (status === "idle") {
    return null;
  }

  return (
    <View
      paddingX="size-200"
      paddingY="size-50"
      borderBottomWidth="thin"
      borderBottomColor="default"
      flex="none"
    >
      <ExpectedOutputSaveIndicator
        status={status}
        pendingCount={pendingCount}
      />
    </View>
  );
}
