import { lazy, Suspense, type ComponentProps } from "react";

import { ToolPartCodeBlock } from "./ToolPartPrimitives";

/**
 * Lazy wrappers around the pierre-backed tool part views. Pierre's
 * highlighter is a heavy chunk, so it loads on demand; while it does (or on a
 * cold cache) the raw text renders in the plain code block the views replace.
 */

const ToolPartFileView = lazy(async () => {
  const module = await import("./ToolPartPierreViews");
  return { default: module.ToolPartFileView };
});

const ToolPartDiffView = lazy(async () => {
  const module = await import("./ToolPartPierreViews");
  return { default: module.ToolPartDiffView };
});

export function LazyToolPartFileView(
  props: ComponentProps<typeof ToolPartFileView>
) {
  return (
    <Suspense
      fallback={<ToolPartCodeBlock>{props.contents}</ToolPartCodeBlock>}
    >
      <ToolPartFileView {...props} />
    </Suspense>
  );
}

export function LazyToolPartDiffView(
  props: ComponentProps<typeof ToolPartDiffView>
) {
  return (
    <Suspense fallback={<ToolPartCodeBlock>{props.after}</ToolPartCodeBlock>}>
      <ToolPartDiffView {...props} />
    </Suspense>
  );
}
