import type { ReactNode } from "react";
import { useState } from "react";

import { Alert, Button, Loading, View } from "@phoenix/components";
import type { DSLFilterValidationFailureReason } from "@phoenix/components/filter";

export type PendingDSLFilterFieldProps<TValidArgs> = {
  onValidCondition: (args: TValidArgs) => void;
  onValidationFailed: (reason: DSLFilterValidationFailureReason) => void;
  validationRetryKey: number;
};

/**
 * A filter field, standing in for a table while its condition is validated.
 * The field normally lives inside the table, which cannot mount until the
 * condition settles.
 */
export function PendingDSLFilter<TValidArgs>({
  onValidCondition,
  onRejected,
  renderField,
}: {
  onValidCondition: (args: TValidArgs) => void;
  /**
   * The field keeps the rejected text and its own error on screen, so the
   * caller need only load a fallback condition.
   */
  onRejected: () => void;
  renderField: (props: PendingDSLFilterFieldProps<TValidArgs>) => ReactNode;
}) {
  // A transport failure is not a verdict on the condition, so it must not
  // trigger the fallback: the table would load rows for a condition other
  // than the one on screen. Hold and offer a retry.
  const [hasTransportError, setHasTransportError] = useState(false);
  const [validationRetryKey, setValidationRetryKey] = useState(0);
  return (
    <>
      <View
        paddingTop="size-100"
        paddingBottom="size-100"
        paddingStart="size-200"
        paddingEnd="size-200"
        borderBottomColor="default"
        borderBottomWidth="thin"
        flex="none"
      >
        {renderField({
          onValidCondition,
          onValidationFailed: (reason) => {
            if (reason === "transport") {
              setHasTransportError(true);
              return;
            }
            onRejected();
          },
          validationRetryKey,
        })}
      </View>
      {hasTransportError ? (
        <Alert
          variant="danger"
          banner
          extra={
            <Button
              size="S"
              variant="primary"
              onPress={() => {
                setHasTransportError(false);
                setValidationRetryKey((key) => key + 1);
              }}
            >
              Retry
            </Button>
          }
        >
          The filter condition could not be validated because the server could
          not be reached, so the table has not been loaded.
        </Alert>
      ) : (
        <Loading />
      )}
    </>
  );
}
