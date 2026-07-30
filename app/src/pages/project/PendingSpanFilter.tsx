import { useState } from "react";

import { Alert, Button, Loading, View } from "@phoenix/components";

import { SpanFilterConditionField } from "./SpanFilterConditionField";
import { DEFAULT_SPAN_FILTER_CONDITION } from "./spanFilterRootScopeConstants";
import { spanFilterSeed, type SettledSpanFilterSeed } from "./spanFilterSeed";

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
  fallbackCondition = DEFAULT_SPAN_FILTER_CONDITION,
}: {
  /**
   * Receives the settled seed. This component passes `persistToUrl: false` for
   * a fallback, so the URL keeps the text that was rejected rather than the one
   * being loaded. Other callers pass it for their own reasons.
   */
  onResolved: (seed: SettledSpanFilterSeed, persistToUrl?: boolean) => void;
  /**
   * What to load when the server rejects the condition. Must be one this app
   * can classify, and must match what the host view shows when the URL carries
   * no condition -- the traces tab shows every span, so it passes `""` rather
   * than inheriting the spans tab's root-span default.
   */
  fallbackCondition?: string;
}) {
  const fallbackSeed = spanFilterSeed(fallbackCondition);
  if (fallbackSeed.requiresServerValidation) {
    throw new Error(
      `PendingSpanFilter fallback must not need validation: ${fallbackCondition}`
    );
  }
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
            // A rejected condition still has to resolve to something loadable,
            // so fall back to what this view shows with no filter at all
            // rather than to something wider or narrower. The field keeps
            // showing the text and its own error.
            onResolved(fallbackSeed, false);
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
