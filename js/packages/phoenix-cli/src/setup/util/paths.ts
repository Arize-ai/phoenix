/**
 * Path humanization for setup output: cwd-relative if under cwd, else
 * ~/-relative, else basename.
 */

import * as os from "node:os";
import * as path from "node:path";

export function humanizePath(target: string, cwd: string): string {
  const absolute = path.resolve(cwd, target);
  const cwdRelative = path.relative(cwd, absolute);
  if (cwdRelative && !cwdRelative.startsWith("..")) {
    return cwdRelative;
  }
  if (cwdRelative === "") {
    return ".";
  }
  const home = os.homedir();
  const homeRelative = path.relative(home, absolute);
  if (homeRelative && !homeRelative.startsWith("..")) {
    return `~/${homeRelative}`;
  }
  return path.basename(absolute);
}
