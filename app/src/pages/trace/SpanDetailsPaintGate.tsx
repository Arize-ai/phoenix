import { startTransition, Suspense, useEffect, useState } from "react";

import { SpanDetails } from "./SpanDetails";
import { SpanDetailsSkeleton } from "./TraceDetailsSkeleton";

/**
 * Commits the new tree selection and a dehydrated details shell, allows the
 * browser to paint them, and only then renders the selected span. Without this
 * gate, a Relay cache hit renders large cached LLM content synchronously and
 * delays the selection paint.
 */
export function SpanDetailsPaintGate({ spanNodeId }: { spanNodeId: string }) {
  const [hydratedSpanNodeId, setHydratedSpanNodeId] = useState<string | null>(
    null
  );

  useEffect(() => {
    let hydrationFrameId: number | null = null;
    const paintFrameId = requestAnimationFrame(() => {
      hydrationFrameId = requestAnimationFrame(() => {
        startTransition(() => {
          setHydratedSpanNodeId(spanNodeId);
        });
      });
    });

    return () => {
      cancelAnimationFrame(paintFrameId);
      if (hydrationFrameId != null) {
        cancelAnimationFrame(hydrationFrameId);
      }
    };
  }, [spanNodeId]);

  const isHydrationPending =
    hydratedSpanNodeId == null || hydratedSpanNodeId !== spanNodeId;

  if (isHydrationPending) {
    return <SpanDetailsSkeleton />;
  }

  return (
    <Suspense fallback={<SpanDetailsSkeleton />}>
      <SpanDetails key={hydratedSpanNodeId} spanNodeId={hydratedSpanNodeId} />
    </Suspense>
  );
}
