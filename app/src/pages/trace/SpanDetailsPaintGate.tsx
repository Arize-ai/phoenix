import { css } from "@emotion/react";
import { startTransition, Suspense, useEffect, useMemo, useState } from "react";

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
  const hydratedDetails = useMemo(
    () =>
      hydratedSpanNodeId == null ? null : (
        <Suspense fallback={<SpanDetailsSkeleton />}>
          <SpanDetails
            key={hydratedSpanNodeId}
            spanNodeId={hydratedSpanNodeId}
          />
        </Suspense>
      ),
    [hydratedSpanNodeId]
  );

  return (
    <div
      data-span-details-state={isHydrationPending ? "dehydrated" : "hydrating"}
      data-span-details-target-id={spanNodeId}
      css={css`
        width: 100%;
        height: 100%;
        overflow: hidden;
      `}
    >
      <div
        data-span-details-skeleton
        hidden={!isHydrationPending}
        css={css`
          width: 100%;
          height: 100%;
        `}
      >
        <SpanDetailsSkeleton />
      </div>
      {hydratedDetails == null ? null : (
        <div
          data-span-details-retained-id={hydratedSpanNodeId}
          hidden={isHydrationPending}
          css={css`
            width: 100%;
            height: 100%;
          `}
        >
          {hydratedDetails}
        </div>
      )}
    </div>
  );
}
