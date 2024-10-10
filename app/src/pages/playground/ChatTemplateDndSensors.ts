import { Draggable, KeyboardSensor, PointerSensor } from "@dnd-kit/dom";

type KeyCode = KeyboardEvent["code"];
type KeyboardCodes = {
  start: KeyCode[];
  cancel: KeyCode[];
  end: KeyCode[];
  up: KeyCode[];
  down: KeyCode[];
  left: KeyCode[];
  right: KeyCode[];
};

interface KeyboardSensorOptions {
  keyboardCodes?: KeyboardCodes;
}

export class ChatTemplateKeyboardSensor extends KeyboardSensor {
  protected handleStart(
    event: KeyboardEvent,
    source: Draggable,
    options: KeyboardSensorOptions | undefined
  ): void {
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement
    ) {
      return;
    }
    super.handleStart(event, source, options);
  }
}

export const ChatTemplatePointerSensor = PointerSensor.configure({
  activationConstraints(event, source) {
    const { pointerType, target } = event;

    if (
      pointerType === "mouse" &&
      (source.handle === target || source.handle?.contains(target as Node))
    ) {
      return undefined;
    }

    return {
      delay: { value: 200, tolerance: 10 },
      distance: { value: 5 },
    };
  },
});
