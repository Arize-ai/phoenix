import { assertUnreachable } from "@phoenix/typeUtils";
import {
  isPlainObject,
  safelyParseJSON,
  safelyStringifyJSON,
} from "@phoenix/utils/jsonUtils";

import type { BackendInfo, SandboxProvider } from "./types";

export function StatusText({ status }: { status: BackendInfo["status"] }) {
  const color =
    status === "AVAILABLE"
      ? "var(--global-color-success)"
      : status === "UNAVAILABLE"
        ? "var(--global-color-warning)"
        : "var(--ac-global-text-color-700)";
  return <span style={{ color }}>{statusLabel(status)}</span>;
}

export function formatTimestamp(value: string) {
  return new Date(value).toLocaleString();
}

export function statusLabel(status: BackendInfo["status"]) {
  switch (status) {
    case "AVAILABLE":
      return "Available";
    case "UNAVAILABLE":
      return "Unavailable";
    case "NOT_INSTALLED":
      return "Not installed";
    default:
      assertUnreachable(status);
  }
}

export function languageLabel(
  language:
    | SandboxProvider["language"]
    | BackendInfo["supportedLanguages"][number]
) {
  return language === "PYTHON" ? "Python" : "TypeScript";
}

export function getBackendDescription(backendType: BackendInfo["backendType"]) {
  switch (backendType) {
    case "WASM":
      return "Local WebAssembly runtime";
    case "E2B":
      return "Cloud Python sandbox";
    case "DAYTONA":
      return "Workspace-backed runtime";
    case "VERCEL":
      return "Cloud TypeScript sandbox";
    case "DENO":
      return "Local Deno runtime";
    default:
      return "Sandbox runtime";
  }
}

export function summarizeConfig(config: unknown) {
  if (!isPlainObject(config) || Object.keys(config).length === 0) {
    return "No advanced settings";
  }
  const keys = Object.keys(config);
  if (keys.length === 1) {
    return `1 setting: ${keys[0]}`;
  }
  return `${keys.length} settings: ${keys.slice(0, 2).join(", ")}${keys.length > 2 ? ", ..." : ""}`;
}

export function hasConfig(config: unknown) {
  return isPlainObject(config) && Object.keys(config).length > 0;
}

export function toPrettyJSONObject(value: unknown) {
  return safelyStringifyJSON(value ?? {}, null, 2).json ?? "{}";
}

export function parseConfigText(
  value: string
):
  | { config: Record<string, unknown>; error?: undefined }
  | { config?: undefined; error: string } {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return { config: {} };
  }
  const { json, parseError } = safelyParseJSON(trimmed);
  if (parseError) {
    return { error: "Config must be valid JSON." };
  }
  if (!isPlainObject(json)) {
    return { error: "Config must be a JSON object." };
  }
  return { config: json };
}
