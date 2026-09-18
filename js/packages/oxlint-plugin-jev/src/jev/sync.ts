/**
 * Synchronous bridge to jev.
 *
 * oxlint JS plugin rules are synchronous (ESLint visitor semantics), but jev
 * is an HTTP API. A long-lived worker thread owns the async `fetch`; the rule
 * thread posts a request and blocks on `Atomics.wait` until the worker
 * signals completion. This is the same technique `synckit` uses for
 * eslint-plugin-prettier. Experiment 1 measured ~36ms round-trip overhead
 * including worker start-up.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  MessageChannel,
  Worker,
  receiveMessageOnPort,
} from "node:worker_threads";
import type { MessagePort } from "node:worker_threads";

import type { SystemOneRequest } from "./types.js";
import type { WorkerCall, WorkerResult } from "./worker.js";

interface Bridge {
  signal: Int32Array;
  port: MessagePort;
  worker: Worker;
}

let bridge: Bridge | undefined;

function getBridge(): Bridge {
  if (bridge) return bridge;
  const sab = new SharedArrayBuffer(4);
  const { port1, port2 } = new MessageChannel();
  const workerPath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "worker.js"
  );
  const worker = new Worker(workerPath, {
    workerData: { sab, port: port2 },
    transferList: [port2],
  });
  // Never keep the lint process alive because of us.
  worker.unref();
  bridge = { signal: new Int32Array(sab), port: port1, worker };
  return bridge;
}

export interface CallOptions {
  url: string;
  apiKey: string;
  timeoutMs?: number;
}

export function callJevSync(
  body: SystemOneRequest,
  options: CallOptions
): WorkerResult {
  const { signal, port } = getBridge();
  const timeoutMs = options.timeoutMs ?? 30_000;
  Atomics.store(signal, 0, 0);
  const call: WorkerCall = {
    url: options.url,
    apiKey: options.apiKey,
    body,
    timeoutMs,
  };
  port.postMessage(call);
  const waited = Atomics.wait(signal, 0, 0, timeoutMs + 1_000);
  if (waited === "timed-out") {
    return {
      ok: false,
      error: `jev call timed out after ${timeoutMs}ms`,
      ms: timeoutMs,
    };
  }
  const message = receiveMessageOnPort(port);
  if (!message) {
    return {
      ok: false,
      error: "worker signalled completion without a result",
      ms: 0,
    };
  }
  return message.message as WorkerResult;
}
