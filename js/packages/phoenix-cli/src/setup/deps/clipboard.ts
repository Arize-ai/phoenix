/**
 * The clipboard capability. The system implementation is composed from the
 * process runner — pbcopy & co are subprocesses, not a second effect channel.
 */

import * as process from "node:process";

import type { CommandSpec, ProcessRunner } from "./processes";

/**
 * Write text to the system clipboard. Resolves false on failure — callers
 * fall back to printing the text.
 */
export type ClipboardWriter = (text: string) => Promise<boolean>;

export function createSystemClipboardWriter(
  exec: ProcessRunner["exec"]
): ClipboardWriter {
  return async (text) => {
    const platform = process.platform;
    const candidates: CommandSpec[] =
      platform === "darwin"
        ? [{ command: "pbcopy", args: [], stdin: text }]
        : platform === "win32"
          ? [{ command: "clip", args: [], stdin: text }]
          : [
              { command: "wl-copy", args: [], stdin: text },
              {
                command: "xclip",
                args: ["-selection", "clipboard"],
                stdin: text,
              },
            ];
    for (const candidate of candidates) {
      const result = await exec(candidate);
      if (result.exitCode === 0) {
        return true;
      }
    }
    return false;
  };
}
