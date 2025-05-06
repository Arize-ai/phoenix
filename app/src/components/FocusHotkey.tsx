import { FocusManagerOptions, useFocusManager } from "react-aria";
import { useHotkeys } from "react-hotkeys-hook";

/**
 * Place this component inside of a FocusScope, give it a hotkey, and it will
 * focus the first element in the FocusScope when the hotkey is pressed.
 */
export const FocusHotkey = ({
  hotkey,
  accept,
}: {
  hotkey: string;
  accept?: FocusManagerOptions["accept"];
}) => {
  const focus = useFocusManager();

  useHotkeys(
    hotkey,
    () => {
      focus?.focusFirst({
        accept,
      });
    },
    { preventDefault: true }
  );

  return null;
};
