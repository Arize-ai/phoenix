import { css } from "@emotion/react";
import { useDefaultLayout } from "react-resizable-panels";

import { EdgeFade, Skeleton } from "@phoenix/components";

import { PLAYGROUND_PANEL_LAYOUT_ID } from "./playgroundPanelLayout";

const playgroundPageSkeletonCSS = css`
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  .playground-page-skeleton__header {
    flex: none;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--global-dimension-size-200);
  }
  .playground-page-skeleton__panels {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    gap: var(--global-dimension-size-200);
    min-height: 0;
    padding: 0 var(--global-dimension-size-200) var(--global-dimension-size-200);
  }
  .playground-page-skeleton__panel {
    flex: 1 1 0;
    min-height: 0;
  }
`;

type PlaygroundPageSkeletonProps = {
  /**
   * The panels the loaded page mounts, from {@link getPlaygroundPanelIds}.
   * Must be referentially stable: the saved layout is read by these ids.
   */
  panelIds: string[];
};

/**
 * A loading placeholder for the playground: the page header, then one box per
 * panel the loaded page mounts, sized from the user's saved panel layout, or
 * split evenly when there is none, as the panel group itself would be.
 */
export function PlaygroundPageSkeleton({
  panelIds,
}: PlaygroundPageSkeletonProps) {
  const { defaultLayout } = useDefaultLayout({
    id: PLAYGROUND_PANEL_LAYOUT_ID,
    panelIds,
    storage: localStorage,
  });
  return (
    <div
      role="status"
      aria-label="loading"
      css={playgroundPageSkeletonCSS}
      className="playground-page-skeleton"
    >
      <div className="playground-page-skeleton__header" aria-hidden>
        <Skeleton
          width="var(--global-dimension-size-1600)"
          height="var(--global-dimension-size-300)"
        />
        <Skeleton
          width="var(--global-dimension-size-3600)"
          height="var(--global-button-height-s)"
        />
      </div>
      <EdgeFade
        edge="bottom"
        className="playground-page-skeleton__panels"
        aria-hidden
      >
        {panelIds.map((panelId) => (
          <Skeleton
            key={panelId}
            className="playground-page-skeleton__panel"
            style={{ flexGrow: defaultLayout?.[panelId] ?? 1 }}
            borderRadius="medium"
          />
        ))}
      </EdgeFade>
    </div>
  );
}
