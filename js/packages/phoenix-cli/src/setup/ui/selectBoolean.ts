/**
 * Boolean choice rendered as a labeled select — setup has no bare
 * confirm. For dangerous choices the "No" option is listed first
 * so the default cursor position is the safe one.
 */

import type { Prompter } from "../deps";

export interface SelectBooleanArgs {
  prompter: Prompter;
  message: string;
  yesLabel: string;
  noLabel: string;
  yesHint?: string;
  noHint?: string;
  /** When true, "No" is listed first (safe default for dangerous choices). */
  noFirst?: boolean;
}

export async function selectBoolean({
  prompter,
  message,
  yesLabel,
  noLabel,
  yesHint,
  noHint,
  noFirst,
}: SelectBooleanArgs): Promise<boolean> {
  const yes = { value: true, label: yesLabel, hint: yesHint };
  const no = { value: false, label: noLabel, hint: noHint };
  return prompter.select<boolean>({
    message,
    options: noFirst ? [no, yes] : [yes, no],
  });
}
