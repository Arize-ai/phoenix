import { assertUnreachable } from "@phoenix/typeUtils";
import {
  isPlainObject,
  safelyParseJSON,
  safelyStringifyJSON,
} from "@phoenix/utils/jsonUtils";

import type {
  BackendInfo,
  SandboxConfigFormValues,
  SandboxProvider,
} from "./types";

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
    case "DAYTONA_PYTHON":
      return "Daytona workspace-backed Python runtime";
    case "VERCEL_PYTHON":
      return "Vercel cloud Python sandbox";
    case "VERCEL_TYPESCRIPT":
      return "Vercel cloud TypeScript sandbox";
    case "DENO":
      return "Local Deno TypeScript runtime";
    case "MODAL":
      return "Modal cloud Python sandbox";
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

export function formValuesToConfigPatch(
  values: SandboxConfigFormValues,
  backend: BackendInfo | undefined,
  storedConfig: Record<string, unknown>
): Record<string, unknown> {
  // Start from a clone of the stored config so keys not visible in the current
  // UI (capability flag is false, or activeBackend is undefined) are preserved.
  const base: Record<string, unknown> = { ...storedConfig };

  // Remove the three capability-gated keys; they are re-applied below from
  // either form state (when the UI is visible) or left from storedConfig.
  delete base["env_vars"];
  delete base["internet_access"];
  delete base["dependencies"];

  // Merge flat configText keys on top (non-capability-gated backend settings).
  // Strip capability-gated keys the user may have typed into the editor — only
  // the structured editors may author env_vars, internet_access, dependencies.
  const flatConfig = parseConfigText(values.configText).config ?? {};
  delete flatConfig["env_vars"];
  delete flatConfig["internet_access"];
  delete flatConfig["dependencies"];
  Object.assign(base, flatConfig);

  // env_vars: authoritative from form when visible; preserve stored when hidden.
  if (backend?.supportsEnvVars) {
    if (values.envVars.length > 0) {
      base["env_vars"] = values.envVars.map((entry) => {
        if (entry.kind === "secret_ref") {
          return {
            kind: "secret_ref",
            name: entry.name,
            secret_key: entry.secret_key,
          };
        }
        return { kind: "literal", name: entry.name, value: entry.value };
      });
    }
    // Empty envVars list means the user cleared it intentionally — omit the key.
  } else if (storedConfig["env_vars"] !== undefined) {
    base["env_vars"] = storedConfig["env_vars"];
  }

  // internet_access: authoritative from form when visible; preserve stored when hidden.
  if (backend?.internetAccess === "BOOLEAN") {
    base["internet_access"] = {
      mode: values.internetAccessEnabled ? "allow" : "deny",
    };
  } else if (storedConfig["internet_access"] !== undefined) {
    base["internet_access"] = storedConfig["internet_access"];
  }

  // dependencies: authoritative from form when visible; preserve stored when hidden.
  if (backend?.dependenciesLanguage != null) {
    const packages = values.dependenciesText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (packages.length > 0) {
      base["dependencies"] = {
        ...(storedConfig["dependencies"] as
          | Record<string, unknown>
          | undefined),
        packages,
      };
    }
    // Empty packages means the user cleared it intentionally — omit the key.
  } else if (storedConfig["dependencies"] !== undefined) {
    base["dependencies"] = storedConfig["dependencies"];
  }

  return base;
}
