import type { ReactNode } from "react";

import { Alert, Text, View } from "@phoenix/components";

/** Database errors embed the generated SQL and can run to thousands of characters. */
const MAX_SURFACED_ERROR = 200;

function truncate(error: string) {
  return error.length > MAX_SURFACED_ERROR
    ? `${error.slice(0, MAX_SURFACED_ERROR)}…`
    : error;
}

/**
 * Stands in for a table whose query failed, keeping its filter field on screen
 * so the condition stays editable.
 */
export function DSLFilterErrorFallback({
  error,
  hasUserFilter,
  children,
}: {
  error?: string | null;
  /** Whether someone wrote the condition, as opposed to a default this app seeded */
  hasUserFilter: boolean;
  children: ReactNode;
}) {
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
        {children}
      </View>
      <Alert variant="danger" banner>
        This view could not be loaded.
        {hasUserFilter
          ? " The filter above is a likely cause — comparing values of different types is the most common. Editing it reloads the view."
          : " Editing the filter above reloads the view."}
        {error ? (
          <View paddingTop="size-50">
            <Text size="S" color="text-700">
              {truncate(error)}
            </Text>
          </View>
        ) : null}
      </Alert>
    </>
  );
}
