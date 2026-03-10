/**
 * Two distinct sandbox mismatch warnings exist in the evaluator UI:
 *
 * 1. SandboxMismatchBanner (this file) — shown in the edit dialog when
 *    `environmentMismatch` is true. Signals that the backend's config hash has
 *    drifted from the snapshot recorded when the evaluator was last saved
 *    (e.g. new packages installed, credentials rotated). Action: re-save to
 *    capture the new snapshot.
 *
 * 2. SandboxTypeSelector inline warning (SandboxTypeSelector.tsx) — shown when
 *    the user selects a different backend type than the one persisted on the
 *    evaluator. Signals a pending type switch that has not yet been saved.
 *    Action: save or revert the selection.
 *
 * These are intentionally separate: one reflects a server-side config change,
 * the other reflects an unsaved UI selection.
 */
import { css } from "@emotion/react";

import { Flex, Icon, Icons, Text } from "@phoenix/components";

const bannerCSS = css`
  background-color: var(--ac-global-color-warning-100);
  border: 1px solid var(--ac-global-color-warning-400);
  border-radius: var(--global-rounding-medium);
  padding: var(--global-dimension-static-size-150)
    var(--global-dimension-static-size-200);
`;

export function SandboxMismatchBanner() {
  return (
    <div css={bannerCSS}>
      <Flex direction="row" gap="size-100" alignItems="center">
        <Icon svg={<Icons.AlertTriangleOutline />} color="warning" />
        <Text size="S" color="warning">
          The sandbox environment has changed since this evaluator was created.
          Re-save the evaluator to update its environment snapshot.
        </Text>
      </Flex>
    </div>
  );
}

export function SandboxMismatchIcon() {
  return (
    <Icon
      svg={<Icons.AlertTriangleOutline />}
      color="warning"
      aria-label="Sandbox environment mismatch"
    />
  );
}
