import { Console } from "console";
import {
  ENV_PHOENIX_NO_PROGRESS,
  ENV_PHOENIX_OUTPUT_MODE,
  getEnvironmentConfig,
} from "@arizeai/phoenix-config";

import type { LoggerOptions, OutputMode } from "./types";

const ESC = "\x1B[";
const HIDE_CURSOR = `${ESC}?25l`;
const SHOW_CURSOR = `${ESC}?25h`;

function resolveOutputMode(mode?: OutputMode): OutputMode {
  if (mode) return mode;
  const env = getEnvironmentConfig()[ENV_PHOENIX_OUTPUT_MODE];
  if (env === "quiet" || env === "default" || env === "verbose") return env;
  return "default";
}

function resolveNoProgress(noProgress?: boolean): boolean {
  if (noProgress !== undefined) return noProgress;
  return getEnvironmentConfig()[ENV_PHOENIX_NO_PROGRESS] === "1";
}

export class Logger {
  private readonly mode: OutputMode;
  private readonly outputStream: NodeJS.WritableStream;
  private readonly errorStream: NodeJS.WritableStream;
  private readonly noProgress: boolean;
  private readonly _console: Console;

  private _progressTotal = 0;
  private _progressCurrent = 0;
  private _progressLabel = "";
  private _progressActive = false;

  constructor({
    outputMode,
    outputStream = process.stdout,
    errorStream = process.stderr,
    noProgress,
  }: LoggerOptions = {}) {
    this.mode = resolveOutputMode(outputMode);
    this.outputStream = outputStream;
    this.errorStream = errorStream;
    this.noProgress = resolveNoProgress(noProgress);
    this._console = new Console({
      stdout: this.outputStream,
      stderr: this.errorStream,
    });

    if (this.isTTY) {
      const cleanup = () => {
        (this.outputStream as NodeJS.WriteStream).write(SHOW_CURSOR);
      };
      process.once("exit", cleanup);
      process.once("SIGINT", cleanup);
      process.once("SIGTERM", cleanup);
    }
  }

  get isTTY(): boolean {
    return (
      "isTTY" in this.outputStream &&
      Boolean((this.outputStream as NodeJS.WriteStream).isTTY)
    );
  }

  log(msg: string): void {
    this.info(msg);
  }

  info(msg: string): void {
    if (this.mode === "quiet") return;
    this._console.log(msg);
  }

  error(msg: string): void {
    this._console.error(msg);
  }

  verbose(msg: string): void {
    if (this.mode !== "verbose") return;
    this._console.log(msg);
  }

  summary(msg: string): void {
    this._console.log(msg);
  }

  startProgress(total: number, label: string): void {
    this._progressTotal = total;
    this._progressCurrent = 0;
    this._progressLabel = label;
    this._progressActive = true;
    if (this.isTTY && !this.noProgress) {
      (this.outputStream as NodeJS.WriteStream).write(HIDE_CURSOR);
    }
  }

  tickProgress(): void {
    if (!this._progressActive) return;
    this._progressCurrent++;
    const n = this._progressCurrent;
    const m = this._progressTotal;
    const label = this._progressLabel;
    if (this.isTTY && !this.noProgress) {
      (this.outputStream as NodeJS.WriteStream).write(`\r[${n}/${m}] ${label}`);
    } else {
      // Non-TTY: milestone logs at 25/50/75/100%
      const pct = m > 0 ? Math.round((n / m) * 100) : 100;
      const isMilestone = n === m || pct === 25 || pct === 50 || pct === 75;
      if (isMilestone) {
        this._console.log(`[${label}] ${n}/${m} (${pct}%)`);
      }
    }
  }

  stopProgress(): void {
    if (!this._progressActive) return;
    this._progressActive = false;
    if (this.isTTY && !this.noProgress) {
      const spaces = " ".repeat(30);
      (this.outputStream as NodeJS.WriteStream).write(`\r${spaces}\r`);
      (this.outputStream as NodeJS.WriteStream).write(SHOW_CURSOR);
    }
  }
}
