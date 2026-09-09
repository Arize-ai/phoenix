import { useHotkeys } from "react-hotkeys-hook";

import {
  Button,
  Icon,
  Icons,
  Keyboard,
  VisuallyHidden,
} from "@phoenix/components";
import { useModifierKey } from "@phoenix/hooks/useModifierKey";

/**
 * The page-level Run/Stop control for the evaluator playground. Mirrors the
 * prompt playground's run button — same emphasis, icon, and ⌘⏎ shortcut — so
 * switching modes doesn't move or restyle the primary action.
 */
export function EvaluatorPlaygroundRunButton({
  isRunning,
  isDisabled,
  onRun,
  onStop,
}: {
  isRunning: boolean;
  isDisabled: boolean;
  onRun: () => void;
  onStop: () => void;
}) {
  const modifierKey = useModifierKey();
  const toggle = () => {
    if (isRunning) {
      onStop();
    } else if (!isDisabled) {
      onRun();
    }
  };
  useHotkeys(
    "mod+enter",
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggle();
    },
    {
      enableOnFormTags: true,
      enableOnContentEditable: true,
      preventDefault: true,
    }
  );
  return (
    <Button
      variant="primary"
      size="S"
      isDisabled={!isRunning && isDisabled}
      leadingVisual={
        <Icon svg={isRunning ? <Icons.Loading /> : <Icons.PlayCircle />} />
      }
      trailingVisual={
        <Keyboard>
          <VisuallyHidden>{modifierKey}</VisuallyHidden>
          <span aria-hidden="true">{modifierKey === "Cmd" ? "⌘" : "Ctrl"}</span>
          <VisuallyHidden>enter</VisuallyHidden>
          <span aria-hidden="true">⏎</span>
        </Keyboard>
      }
      onPress={toggle}
    >
      {isRunning ? "Stop" : "Run"}
    </Button>
  );
}
