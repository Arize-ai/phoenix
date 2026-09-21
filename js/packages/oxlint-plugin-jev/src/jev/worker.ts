/**
 * Worker thread that performs the (async) HTTP call to jev on behalf of the
 * synchronous lint rule. See `sync.ts` for the Atomics.wait handshake.
 */
import { workerData } from "node:worker_threads";
import type { MessagePort } from "node:worker_threads";

import type { SystemOneRequest, SystemOneResponse } from "./types.js";

interface WorkerInit {
  sab: SharedArrayBuffer;
  port: MessagePort;
}

export interface WorkerCall {
  url: string;
  apiKey: string;
  body: SystemOneRequest;
  timeoutMs: number;
}

export type WorkerResult =
  | { ok: true; response: SystemOneResponse; ms: number }
  | { ok: false; error: string; status?: number; ms: number };

const { sab, port } = workerData as WorkerInit;
const signal = new Int32Array(sab);

port.on("message", async (call: WorkerCall) => {
  const started = Date.now();
  let result: WorkerResult;
  try {
    const res = await fetch(call.url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${call.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(call.body),
      signal: AbortSignal.timeout(call.timeoutMs),
    });
    const ms = Date.now() - started;
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      result = {
        ok: false,
        status: res.status,
        error: `jev responded ${res.status}: ${text.slice(0, 500)}`,
        ms,
      };
    } else {
      result = {
        ok: true,
        response: (await res.json()) as SystemOneResponse,
        ms,
      };
    }
  } catch (error) {
    result = { ok: false, error: String(error), ms: Date.now() - started };
  }
  port.postMessage(result);
  Atomics.store(signal, 0, 1);
  Atomics.notify(signal, 0);
});
