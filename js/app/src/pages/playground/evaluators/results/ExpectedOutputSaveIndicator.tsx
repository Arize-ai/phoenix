import { css } from "@emotion/react";

import { Icon, Icons, Text } from "@phoenix/components";
import { ProgressCircle } from "@phoenix/components/core/progress/ProgressCircle";

import type { ExpectedOutputSaveStatus } from "../expectedOutputQueue";

/**
 * Where queued annotations stand. Annotations show as recorded the moment they are
 * made and are written a couple of seconds later in one batch, so this is the
 * only sign that a write is pending, happening, or done. Errors get the banner.
 */
export function ExpectedOutputSaveIndicator({
  status,
  pendingCount,
}: {
  status: ExpectedOutputSaveStatus;
  pendingCount: number;
}) {
  if (status === "pending")
    return (
      <Text size="S" color="text-500" role="status">
        {pendingCount} unsaved{" "}
        {pendingCount === 1 ? "annotation" : "annotations"}
      </Text>
    );

  if (status === "saving")
    return (
      <span css={saveIndicatorCSS} role="status">
        <ProgressCircle
          isIndeterminate
          size="S"
          aria-label="Saving annotations"
        />
        <Text size="S" color="text-500">
          Saving annotations…
        </Text>
      </span>
    );

  if (status === "saved")
    return (
      <span css={saveIndicatorCSS} role="status">
        <Icon svg={<Icons.Checkmark />} color="success" />
        <Text size="S" color="success">
          Annotations saved
        </Text>
      </span>
    );

  return null;
}

const saveIndicatorCSS = css`
  display: inline-flex;
  align-items: center;
  gap: var(--global-dimension-size-75);
`;
