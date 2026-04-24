import { assertUnreachable } from "@phoenix/typeUtils";
import { isPlainObject } from "@phoenix/utils/jsonUtils";

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
    return "No custom settings";
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

export function formValuesToConfigPatch(
  values: SandboxConfigFormValues,
  backend: BackendInfo | undefined
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  if (backend?.supportsEnvVars && values.envVars.length > 0) {
    result["env_vars"] = values.envVars.map((entry) => {
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

  if (backend?.internetAccess === "BOOLEAN") {
    result["internet_access"] = {
      mode: values.internetAccessEnabled ? "allow" : "deny",
    };
  }

  if (backend?.dependenciesLanguage != null) {
    const packages = values.dependenciesText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (packages.length > 0) {
      const dep: Record<string, unknown> = { packages };
      if (values.dependenciesLockfile != null) {
        dep["lockfile"] = values.dependenciesLockfile;
      }
      result["dependencies"] = dep;
    }
  }

  return result;
}
