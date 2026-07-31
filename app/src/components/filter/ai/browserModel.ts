import { browserAI, doesBrowserSupportBrowserAI } from "@browser-ai/core";
import type { LanguageModel } from "ai";

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

export async function getBrowserModelAvailability(): Promise<BrowserModelAvailability> {
  if (!doesBrowserSupportBrowserAI()) {
    return "unsupported";
  }
  try {
    const availability: string = await browserAI().availability();
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
  } catch {
    return "unavailable";
  }
}

/**
 * Starts (or joins) the on-device model download, reporting progress as a
 * fraction from 0 to 1. Resolves when the model is ready to use.
 */
export async function downloadBrowserModel(
  onProgress?: (fraction: number) => void
): Promise<void> {
  await browserAI().createSessionWithProgress(onProgress);
}

export function createBrowserModel(): LanguageModel {
  return browserAI();
}
