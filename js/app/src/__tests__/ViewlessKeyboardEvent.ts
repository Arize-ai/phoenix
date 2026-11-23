/**
 * A `KeyboardEvent` that drops `view` from its init. React Aria's Autocomplete
 * forwards keys to the menu with `new KeyboardEvent(type, nativeEvent)`, and
 * jsdom rejects the `view` of a user-event event there ("member view is not of
 * type Window"). Tests that type into an Autocomplete stub the global with it:
 * `vi.stubGlobal("KeyboardEvent", ViewlessKeyboardEvent)`.
 */
export class ViewlessKeyboardEvent extends KeyboardEvent {
  constructor(type: string, init?: KeyboardEventInit) {
    super(
      type,
      init && {
        key: init.key,
        code: init.code,
        location: init.location,
        repeat: init.repeat,
        isComposing: init.isComposing,
        ctrlKey: init.ctrlKey,
        shiftKey: init.shiftKey,
        altKey: init.altKey,
        metaKey: init.metaKey,
        bubbles: init.bubbles,
        cancelable: init.cancelable,
        composed: init.composed,
      }
    );
  }
}
