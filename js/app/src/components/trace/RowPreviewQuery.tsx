import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";
import type { GraphQLTaggedNode } from "react-relay";
import { useLazyLoadQuery, useRelayEnvironment } from "react-relay";
import type { OperationType } from "relay-runtime";
import { createOperationDescriptor, getRequest } from "relay-runtime";

import { ErrorBoundary } from "@phoenix/components";
import { TextErrorBoundaryFallback } from "@phoenix/components/exception";
import { useRetainQuery } from "@phoenix/contexts/QueryRetentionContext";
import { useSettled } from "@phoenix/hooks";

/**
 * How long a row preview stays open before its details are fetched. React
 * Aria opens each tooltip at once after the first, so without this a scrub
 * down a list would fetch details for every row it crossed.
 */
const ROW_PREVIEW_SETTLE_MS = 150;

/**
 * A row preview follows the pointer from row to row, so it neither fades in
 * nor lingers: each hop shows the next row at once.
 */
export const rowPreviewTooltipCSS = css`
  transition: none;
  &[data-entering],
  &[data-exiting] {
    transform: none;
    opacity: 1;
  }
`;

type RowPreviewQueryProps<TQuery extends OperationType> = {
  query: GraphQLTaggedNode;
  variables: TQuery["variables"];
  /** Shown until the query settles and loads, and if it fails to. */
  placeholder: ReactNode;
  children: (data: TQuery["response"]) => ReactNode;
};

/**
 * Loads a row preview's details once the preview settles on the row, showing
 * `placeholder` until then. Details already in the store skip the settle, so
 * revisited rows never pop in, and each load is retained by the nearest
 * `QueryRetentionProvider`.
 */
export function RowPreviewQuery<TQuery extends OperationType>({
  query,
  variables,
  placeholder,
  children,
}: RowPreviewQueryProps<TQuery>) {
  const environment = useRelayEnvironment();
  const [wasCached] = useState(
    () =>
      environment.check(createOperationDescriptor(getRequest(query), variables))
        .status === "available"
  );
  const hasSettled = useSettled(ROW_PREVIEW_SETTLE_MS);
  if (!wasCached && !hasSettled) {
    return placeholder;
  }
  return (
    <ErrorBoundary fallback={TextErrorBoundaryFallback}>
      <Suspense fallback={placeholder}>
        <LoadedRowPreviewQuery query={query} variables={variables}>
          {children}
        </LoadedRowPreviewQuery>
      </Suspense>
    </ErrorBoundary>
  );
}

function LoadedRowPreviewQuery<TQuery extends OperationType>({
  query,
  variables,
  children,
}: Omit<RowPreviewQueryProps<TQuery>, "placeholder">) {
  const data = useLazyLoadQuery<TQuery>(query, variables);
  useRetainQuery(createOperationDescriptor(getRequest(query), variables));
  return children(data);
}
