import { css } from "@emotion/react";

import { TextSkeleton } from "@phoenix/components";
import { TableSkeleton } from "@phoenix/components/table";

const settingsCardSkeletonCSS = css`
  .settings-card-skeleton__header {
    display: flex;
    align-items: center;
    height: var(--global-card-header-height);
    padding: 0 var(--global-dimension-size-200);
  }
`;

/**
 * A loading placeholder for a settings tab: the header of a card above the
 * table most settings cards hold, without the card's frame.
 */
export function SettingsCardSkeleton() {
  return (
    <div role="status" aria-label="loading" css={settingsCardSkeletonCSS}>
      <div className="settings-card-skeleton__header" aria-hidden>
        <TextSkeleton size="M" width="var(--global-dimension-size-2000)" />
      </div>
      <TableSkeleton rowCount={5} aria-hidden />
    </div>
  );
}
