import {
  Button,
  Icon,
  Icons,
  Tooltip,
  TooltipTrigger,
} from "@phoenix/components";

/**
 * Toggle for a new chat's temporary mode, shown beneath the composer until
 * the first message is submitted. A session's mode is fixed at creation, so
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
        leadingVisual={
          <Icon svg={isTemporary ? <Icons.EyeOff /> : <Icons.Eye />} />
        }
      />
      <Tooltip>{label}</Tooltip>
    </TooltipTrigger>
  );
}
