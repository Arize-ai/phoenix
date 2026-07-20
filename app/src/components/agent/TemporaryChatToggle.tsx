import { css } from "@emotion/react";

import {
  Button,
  Icon,
  Icons,
  Tooltip,
  TooltipTrigger,
} from "@phoenix/components";

const temporaryChatTooltipCSS = css`
  max-width: none;
  white-space: nowrap;
`;

const temporaryChatToggleCSS = css`
  justify-self: end;
  color: var(--global-text-color-300);

  .theme--light & {
    color: var(--global-text-color-500);
  }

  &[data-is-temporary="true"] {
    color: var(--global-static-color-white-900);
  }
`;

/**
 * Toggle for a new chat's temporary mode.
 * A session's mode is fixed at creation, so
 * the toggle never applies to an existing chat.
 */
export function TemporaryChatToggle({
  isTemporary,
  onToggle,
}: {
  isTemporary: boolean;
  onToggle: () => void;
}) {
  const label = isTemporary
    ? "Turn off temporary chat"
    : "Turn on temporary chat";
  return (
    <TooltipTrigger delay={0}>
      <Button
        variant="quiet"
        size="S"
        aria-label={label}
        onPress={onToggle}
        css={temporaryChatToggleCSS}
        data-is-temporary={isTemporary}
        leadingVisual={
          <Icon
            svg={
              isTemporary ? (
                <Icons.ChatEphemeralityOn />
              ) : (
                <Icons.ChatEphemeralityOff />
              )
            }
          />
        }
      />
      <Tooltip placement="left" css={temporaryChatTooltipCSS}>
        {label}
      </Tooltip>
    </TooltipTrigger>
  );
}
