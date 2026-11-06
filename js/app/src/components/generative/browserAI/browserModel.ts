import { browserAI, doesBrowserSupportBrowserAI } from "@browser-ai/core";
import type { LanguageModel } from "ai";
import { useEffect, useState } from "react";

/**
 * Where the on-device browser model stands, normalized across the Prompt
 * API's naming revisions ("available-after-download" vs. "downloadable"):
 *
 * - `unsupported` — the browser has no Prompt API (anything but Chrome/Edge)
 * - `unavailable` — the API exists but no model can be provisioned
 * - `needs-download` — usable once the model is downloaded
 * - `downloading` — a download is already in flight
 * - `available` — ready to use
 */
export type BrowserModelAvailability =
  | "unsupported"
  | "unavailable"
  | "needs-download"
  | "downloading"
  | "available";

/**
 * The identity of the browser's built-in on-device model. The Prompt API
 * never names its model, but each browser that implements it ships a known
 * one, so the name is derived from which browser this is.
 */
export type BrowserBuiltInModel = {
  /** e.g. "Gemini Nano" */
  modelName: string;
  /** e.g. "Chrome" */
  browserName: string;
};

// The answer can't change for the lifetime of the document, and callers sit
// in render paths — resolve once on first ask
let builtInModel: BrowserBuiltInModel | null | undefined;

export function getBrowserBuiltInModel(): BrowserBuiltInModel | null {
  if (builtInModel === undefined) {
    builtInModel = !doesBrowserSupportBrowserAI()
      ? null
      : // Edge keeps "Chrome/" in its UA, so it must be checked first
        navigator.userAgent.includes("Edg/")
        ? { modelName: "Phi", browserName: "Edge" }
        : { modelName: "Gemini Nano", browserName: "Chrome" };
  }
  return builtInModel;
}

// Concurrent probes share one Prompt API round-trip — several surfaces can
// mount at once (the settings card and the model card on the same page) and
// each probe constructs a throwaway model instance. Cleared on settle so
// every later look still gets a fresh answer.
let inFlightAvailability: Promise<BrowserModelAvailability> | null = null;

export function getBrowserModelAvailability(): Promise<BrowserModelAvailability> {
  if (!doesBrowserSupportBrowserAI()) {
    return Promise.resolve("unsupported");
  }
  inFlightAvailability ??= browserAI()
    .availability()
    .then(
      (availability: string): BrowserModelAvailability => {
        switch (availability) {
          case "available":
            return "available";
          case "downloading":
            return "downloading";
          case "downloadable":
          case "available-after-download":
            return "needs-download";
          default:
            return "unavailable";
        }
      },
      () => "unavailable" as const
    )
    .finally(() => {
      inFlightAvailability = null;
    });
  return inFlightAvailability;
}

// The browser only runs one model download; mirror that here so every
// caller (a card mounting, a first search, a remount mid-download) joins
// the same session creation instead of stacking new ones
let activeDownload: {
  promise: Promise<void>;
  listeners: Set<(fraction: number) => void>;
} | null = null;

/**
 * Starts (or joins) the on-device model download, reporting progress as a
 * fraction from 0 to 1. Resolves when the model is ready to use. Aborting
 * `signal` detaches `onProgress` and rejects the returned promise with an
 * AbortError — the download itself is shared and keeps going — so a caller
 * that cancels or unmounts gets its answer immediately instead of staying
 * parked on a download that can take minutes.
 */
export function downloadBrowserModel(
  onProgress?: (fraction: number) => void,
  { signal }: { signal?: AbortSignal } = {}
): Promise<void> {
  if (activeDownload === null) {
    const listeners = new Set<(fraction: number) => void>();
    const download = {
      listeners,
      promise: browserAI()
        .createSessionWithProgress((fraction: number) => {
          for (const listener of listeners) {
            listener(fraction);
          }
        })
        .then(() => undefined)
        .finally(() => {
          activeDownload = null;
        }),
    };
    activeDownload = download;
  }
  if (onProgress && !signal?.aborted) {
    const { listeners } = activeDownload;
    listeners.add(onProgress);
    signal?.addEventListener("abort", () => listeners.delete(onProgress), {
      once: true,
    });
  }
  const downloadPromise = activeDownload.promise;
  if (!signal) {
    return downloadPromise;
  }
  return new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      reject(new DOMException("The download wait was cancelled", "AbortError"));
    };
    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener("abort", onAbort, { once: true });
    downloadPromise.then(
      () => {
        signal.removeEventListener("abort", onAbort);
        resolve();
      },
      (error) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      }
    );
  });
}

export function createBrowserModel(): LanguageModel {
  return browserAI();
}

/**
 * The on-device model's availability, fetched when the consuming surface
 * mounts (i.e. each time it opens, so a finished download is reflected on
 * the next look). `null` while the probe is in flight.
 */
export function useBrowserModelAvailability(): BrowserModelAvailability | null {
  const [availability, setAvailability] =
    useState<BrowserModelAvailability | null>(null);
  useEffect(() => {
    let isCancelled = false;
    void getBrowserModelAvailability().then((result) => {
      if (!isCancelled) {
        setAvailability(result);
      }
    });
    return () => {
      isCancelled = true;
    };
  }, []);
  return availability;
}
