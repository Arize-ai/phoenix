import { closeCompletion, completionStatus } from "@codemirror/autocomplete";
import { Prec } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

/**
 * Escape closes an open menu and stops there.
 *
 * The evaluator forms sit in dialogs that close on Escape, and the menu stays
 * open on a name that can still go on — so the key that dismisses it has to
 * end at the editor, or it reaches the dialog and takes the form with it.
 * With no menu open the key passes through as before.
 */
export const closeCompletionOnEscape = Prec.highest(
  EditorView.domEventHandlers({
    keydown(event, view) {
      if (event.key !== "Escape" || completionStatus(view.state) === null) {
        return false;
      }
      event.stopPropagation();
      closeCompletion(view);
      return true;
    },
  })
);
