import { useState } from "react";

import { Alert, Button, Loading, View } from "@phoenix/components";

import { SpanFilterConditionField } from "./SpanFilterConditionField";
import { DEFAULT_SPAN_FILTER_CONDITION } from "./spanFilterRootScopeConstants";
import type { SettledSpanFilterSeed } from "./spanFilterSeed";

/**
 * The filter field, standing in for a spans table while its condition is
 * validated.
 *
 * A view that loads only settled conditions cannot mount its table yet -- and
 * the table is where the field that validates normally lives. Rendering the
 * field here breaks that circle, and keeps the filter on screen while the user
 * waits.
 */
export function PendingSpanFilter({
  onResolved,
}: {
  /**
   * Receives the settled seed. `persistToUrl` is false for a fallback, so the
   * URL keeps the text that was rejected rather than the one being loaded.
   */
  onResolved: (seed: SettledSpanFilterSeed, persistToUrl?: boolean) => void;
}) {
  // A transport failure is not a verdict on the condition, so it does not
  // resolve to the fallback: loading the fallback would swap in rows for a
  // different, wider filter while the URL still names the intended one, and
  // the table would read as the filtered result. Hold the pending state and
  // offer a retry instead.
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
        <SpanFilterConditionField
          onValidCondition={({ condition, selectsRootSpansOnly }) =>
            onResolved({
              condition,
              requiresServerValidation: false,
              rootSpansOnly: selectsRootSpansOnly ?? false,
            })
          }
          onValidationFailed={(reason) => {
            if (reason === "transport") {
              setHasTransportError(true);
              return;
            }
            // A rejected condition still has to resolve to something loadable.
            // The default shows root spans, as a link with no filter does,
            // rather than every span -- wider than was asked for. The field
            // keeps showing the text and its own error.
            onResolved(
              {
                condition: DEFAULT_SPAN_FILTER_CONDITION,
                requiresServerValidation: false,
                rootSpansOnly: true,
              },
              false
            );
          }}
          validationRetryKey={validationRetryKey}
        />
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
