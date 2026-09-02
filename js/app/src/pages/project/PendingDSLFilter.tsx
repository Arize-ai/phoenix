import type { ReactNode } from "react";
import { useState } from "react";

import { Alert, Button, Loading, View } from "@phoenix/components";
import type { DSLFilterValidationFailureReason } from "@phoenix/components/filter";

/** What the pending view hands the field it renders. */
export type PendingDSLFilterFieldProps<TValidArgs> = {
  onValidCondition: (args: TValidArgs) => void;
  onValidationFailed: (reason: DSLFilterValidationFailureReason) => void;
  validationRetryKey: number;
};

/**
 * A filter field, standing in for a table while its condition is validated.
 *
 * A view that loads only settled conditions cannot mount its table yet -- and
 * the table is where the field that validates normally lives. Rendering the
 * field here breaks that circle, and keeps the filter on screen while the user
 * waits.
 */
export function PendingDSLFilter<TValidArgs>({
  onValidCondition,
  onRejected,
  renderField,
}: {
  /** Receives the field's settlement of a condition the server accepted. */
  onValidCondition: (args: TValidArgs) => void;
  /**
   * Called when the server rejects the condition. A rejected condition still
   * has to resolve to something loadable; the field keeps showing the text
   * and its own error.
   */
  onRejected: () => void;
  renderField: (props: PendingDSLFilterFieldProps<TValidArgs>) => ReactNode;
}) {
  // A transport failure is not a verdict on the condition, so it does not
  // resolve to a fallback: loading one would swap in rows for a different,
  // wider filter while the URL still names the intended one, and the table
  // would read as the filtered result. Hold the pending state and offer a
  // retry instead.
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
