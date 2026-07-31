/**
 * The prompting capability: every question setup asks — selects, text,
 * masked secrets — and every line it narrates between them.
 *
 * Contract only. The real terminal implementation is `ui/clackPrompter.ts`
 * (kept with the rest of the UI, since rendering rules live there); tests
 * script answers through `scriptedPrompter`.
 */

export interface SelectOption<T> {
  value: T;
  label: string;
  hint?: string;
  /** Rendered unselectable with the reason appended to the label. */
  disabled?: boolean;
}

export interface Prompter {
  /** Throws SetupCancelledError on Ctrl-C / Escape. */
  select<T>(args: {
    message: string;
    options: Array<SelectOption<T>>;
  }): Promise<T>;
  /** Throws SetupCancelledError on Ctrl-C / Escape. */
  textInput(args: {
    message: string;
    defaultValue?: string;
    validate?: (value: string) => string | undefined;
  }): Promise<string>;
  /** Masked input for secrets. Throws SetupCancelledError on Ctrl-C / Escape. */
  passwordInput(args: {
    message: string;
    validate?: (value: string) => string | undefined;
  }): Promise<string>;
  /**
   * Run `work` with a signal that aborts on Ctrl-C rather than raising
   * SetupCancelledError. For the waits that have no prompt on screen to
   * cancel — a browser login, say: this seam owns the terminal, so it owns the
   * signal, and `work` decides what an interruption means.
   */
  runInterruptible<T>(work: (signal: AbortSignal) => Promise<T>): Promise<T>;
  /** Non-interactive display of a block of text between prompts. */
  note(message: string, title?: string): void;
  /** One-line status/warning between prompts (stderr). */
  line(message: string): void;
  /** Open the setup session frame. */
  intro(message: string): void;
  /** Close the setup session frame. */
  outro(message: string): void;
}
