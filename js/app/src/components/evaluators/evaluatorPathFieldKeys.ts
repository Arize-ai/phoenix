import { acceptCompletion } from "@codemirror/autocomplete";
import type { Extension } from "@codemirror/state";
import { keymap } from "@codemirror/view";

import { closeCompletionOnEscape } from "./completionKeys";
import { evaluatorPathMenu } from "./evaluatorPathMenu";

/**
 * What the path field adds to the editor's keys.
 *
 * The menu's own chrome comes first: its side panels answer to Escape, which
 * has to back out of an open panel level before `closeCompletionOnEscape`
 * can take the whole menu. Tab accepts the highlighted row; with no menu
 * open it leaves the field.
 */
export const evaluatorPathFieldKeys: Extension[] = [
  evaluatorPathMenu(),
  closeCompletionOnEscape,
  keymap.of([{ key: "Tab", run: acceptCompletion }]),
];
