/**
 * Clack-backed implementation of setup's `Prompter` seam.
 *
 * House rules: setup has no confirm primitive — every
 * choice, including booleans, is a select. Cancellation (Ctrl-C / Escape)
 * maps to `SetupCancelledError`, unwinding to the single catch site in the
 * command handler.
 */

import {
  intro,
  isCancel,
  log,
  outro,
  password,
  select,
  text,
} from "@clack/prompts";

import type { Prompter, SelectOption } from "../deps";
import { SetupCancelledError } from "../errors";

// Nothing this seam writes belongs on stdout: under `--format raw|json` stdout
// carries the machine-readable report and nothing else, and a banner, a prompt,
// or a narration line mixed into it is a parse error for whoever is reading.
// Every clack primitive defaults to stdout and takes an `output`, so every call
// below passes this — including the prompts, which an interactive `--format
// json` run would otherwise render into the report.
const TO_STDERR = { output: process.stderr };

export function createClackPrompter(): Prompter {
  return {
    async select<T>(args: {
      message: string;
      options: Array<SelectOption<T>>;
    }): Promise<T> {
      // Loop so picking a disabled option explains itself and re-asks
      // instead of proceeding.
      for (;;) {
        // Clack's Option<T> type only resolves for primitive T; the shape
        // we build is valid for both branches, so the cast is safe.
        const answer = await select<T>({
          ...TO_STDERR,
          message: args.message,
          options: args.options.map((option) => ({
            value: option.value,
            label: option.disabled ? `✗ ${option.label}` : option.label,
            hint: option.hint,
          })) as Parameters<typeof select<T>>[0]["options"],
        });
        if (isCancel(answer)) {
          throw new SetupCancelledError();
        }
        const picked = args.options.find((option) => option.value === answer);
        if (picked?.disabled) {
          log.warn(picked.hint ?? "That option is not available.", TO_STDERR);
          continue;
        }
        return answer as T;
      }
    },

    async textInput(args: {
      message: string;
      defaultValue?: string;
      validate?: (value: string) => string | undefined;
    }): Promise<string> {
      const answer = await text({
        ...TO_STDERR,
        message: args.message,
        defaultValue: args.defaultValue,
        placeholder: args.defaultValue,
        validate: args.validate
          ? (value) => {
              // Clack substitutes defaultValue for an empty submission, but
              // runs validate on the raw (empty) input — validate what will
              // actually be returned.
              const effective =
                !value && args.defaultValue !== undefined
                  ? args.defaultValue
                  : (value ?? "");
              return args.validate?.(effective);
            }
          : undefined,
      });
      if (isCancel(answer)) {
        throw new SetupCancelledError();
      }
      return answer;
    },

    async passwordInput(args: {
      message: string;
      validate?: (value: string) => string | undefined;
    }): Promise<string> {
      const answer = await password({
        ...TO_STDERR,
        message: args.message,
        validate: args.validate
          ? (value) => args.validate?.(value ?? "")
          : undefined,
      });
      if (isCancel(answer)) {
        throw new SetupCancelledError();
      }
      return answer;
    },

    async runInterruptible<T>(
      work: (signal: AbortSignal) => Promise<T>
    ): Promise<T> {
      // Attaching a listener also suppresses Node's default terminate-on-SIGINT
      // for the duration, which is the point: with no clack prompt on screen
      // there is nothing to raise SetupCancelledError, so an unhandled Ctrl-C
      // would kill the process and discard the answers already given.
      const interrupted = new AbortController();
      const onInterrupt = () => interrupted.abort();
      process.once("SIGINT", onInterrupt);
      try {
        return await work(interrupted.signal);
      } finally {
        process.off("SIGINT", onInterrupt);
      }
    },

    note(message: string, title?: string): void {
      // A heading over an indented body, not clack's boxed `note`: clack's guide
      // rail already sets the block apart, and the box adds a border that has to
      // reflow on every resize. Untitled, there is no heading to indent under.
      if (title === undefined) {
        log.message(message, TO_STDERR);
        return;
      }
      const body = message
        .split("\n")
        .map((line) => `  ${line}`)
        .join("\n");
      log.message(`${title}\n${body}`, TO_STDERR);
    },

    line(message: string): void {
      log.message(message, TO_STDERR);
    },

    intro(message: string): void {
      intro(message, TO_STDERR);
    },

    outro(message: string): void {
      outro(message, TO_STDERR);
    },
  };
}
