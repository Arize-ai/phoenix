import { Draggable, KeyboardSensor, PointerSensor } from "@dnd-kit/dom";

/**
 * Copy of @dnd-kit/dom
 * @see https://github.com/clauderic/dnd-kit/blob/experimental/packages/dom/src/core/sensors/keyboard/KeyboardSensor.ts#L18
 */
type KeyCode = KeyboardEvent["code"];
/**
 * Copy of @dnd-kit/dom KeyboardCodes type.
 * @see https://github.com/clauderic/dnd-kit/blob/experimental/packages/dom/src/core/sensors/keyboard/KeyboardSensor.ts#L20
 */
type KeyboardCodes = {
  start: KeyCode[];
  cancel: KeyCode[];
  end: KeyCode[];
  up: KeyCode[];
  down: KeyCode[];
  left: KeyCode[];
  right: KeyCode[];
};

/**
 * Copy of @dnd-kit/dom KeyboardSensorOptions type.
 * @see https://github.com/clauderic/dnd-kit/blob/experimental/packages/dom/src/core/sensors/keyboard/KeyboardSensor.ts#L30
 */
interface KeyboardSensorOptions {
  keyboardCodes?: KeyboardCodes;
}

/**
 * A dnd-kit {@link KeyboardSensor} that ignores keyboard events when the user is typing in a text input.
 */
export class ChatTemplateKeyboardSensor extends KeyboardSensor {
  protected handleStart(
    event: KeyboardEvent,
    source: Draggable,
    options: KeyboardSensorOptions | undefined
  ): void {
    /**
     * In some instances a text input may be nested within a draggable element.
     * In that case we want to ignore the keyboard event to allow the user to type.
     * In all other cases, we want to allow the user to move the draggable element.
     */
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement
    ) {
      return;
    }
    super.handleStart(event, source, options);
  }
}

/**
 * The default {@link PointerSensor} with activation constraints that allow for a delay and distance.
 *
 * @see https://github.com/clauderic/dnd-kit/blob/experimental/packages/react/src/core/context/DragDropProvider.tsx#L99
 * @see https://github.com/clauderic/dnd-kit/blob/experimental/packages/dom/src/core/manager/manager.ts#L23
 */
const ChatTemplatePointerSensor = PointerSensor.configure({
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

/**
 *  A list of dnd-kit sensors for the chat template dnd context.
 * Uses the default config for a {@link ChatTemplatePointerSensor|PointerSensor} and a custom {@link ChatTemplateKeyboardSensor|KeyboardSensor}.
 */
export const chatTemplateDndSensors = [
  ChatTemplatePointerSensor,
  ChatTemplateKeyboardSensor,
];
