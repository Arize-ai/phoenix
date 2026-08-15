import { lazy, Suspense, type ComponentType } from "react";

import type {
  DiffAcceptRejectToolDetailsProps,
  PendingDiffEdit,
} from "./DiffAcceptRejectToolDetails";
import { ToolPartCodeBlock, ToolPartLabel } from "./ToolPartPrimitives";

const DiffAcceptRejectToolDetails = lazy(async () => {
  const module = await import("./DiffAcceptRejectToolDetails");
  return { default: module.DiffAcceptRejectToolDetails };
});

export function LazyDiffAcceptRejectToolDetails<
  T,
  P extends PendingDiffEdit<T>,
>(props: DiffAcceptRejectToolDetailsProps<T, P>) {
  const Component = DiffAcceptRejectToolDetails as unknown as ComponentType<
    DiffAcceptRejectToolDetailsProps<T, P>
  >;

  return (
    <Suspense
      fallback={
        <div className="tool-part__body">
          <ToolPartLabel>{props.preparingLabel}</ToolPartLabel>
          <ToolPartCodeBlock>{props.preparingText}</ToolPartCodeBlock>
        </div>
      }
    >
      <Component {...props} />
    </Suspense>
  );
}
