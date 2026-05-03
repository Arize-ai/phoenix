import { css } from "@emotion/react";

import {
  Flex,
  RichTooltip,
  Text,
  TooltipTrigger,
  TriggerWrap,
} from "@phoenix/components";
import { PythonSVG, TypeScriptSVG } from "@phoenix/components/core/icon/Icons";
import { assertUnreachable } from "@phoenix/typeUtils";
import { isPlainObject } from "@phoenix/utils/jsonUtils";

import type {
  BackendInfo,
  SandboxConfigFormValues,
  SandboxProvider,
} from "./types";

type Language =
  | SandboxProvider["language"]
  | BackendInfo["supportedLanguages"][number];

export function StatusText({
  status,
  detail,
  dependencyHints = [],
}: {
  status: BackendInfo["status"];
  detail?: BackendInfo["statusDetail"];
  dependencyHints?: BackendInfo["dependencyHints"];
}) {
  const color =
    status === "AVAILABLE"
      ? "var(--global-color-success)"
      : status === "UNAVAILABLE" || status === "MISSING_CREDENTIALS"
        ? "var(--global-color-warning)"
        : "var(--ac-global-text-color-700)";
  const label = statusLabel(status);
  const tooltipLines = detail ? [detail] : dependencyHints;

  if (status === "AVAILABLE" || tooltipLines.length === 0) {
    return <span style={{ color }}>{label}</span>;
  }

  return (
    <TooltipTrigger delay={100}>
      <TriggerWrap>
        <Text
          color={status === "NOT_INSTALLED" ? "text-700" : "warning"}
          css={css`
            text-decoration: underline dotted;
            text-underline-offset: 2px;
            cursor: help;
          `}
        >
          {label}
        </Text>
      </TriggerWrap>
      <RichTooltip width={320}>
        <Flex direction="column" gap="size-50">
          {tooltipLines.map((line) => (
            <Text key={line}>{line}</Text>
          ))}
        </Flex>
      </RichTooltip>
    </TooltipTrigger>
  );
}

export function formatTimestamp(value: string) {
  return new Date(value).toLocaleString();
}

export function statusLabel(status: BackendInfo["status"]) {
  switch (status) {
    case "AVAILABLE":
      return "Available";
    case "MISSING_CREDENTIALS":
      return "Authentication required";
    case "UNAVAILABLE":
      return "Unavailable";
    case "NOT_INSTALLED":
      return "Not installed";
    default:
      assertUnreachable(status);
  }
}

export function languageLabel(language: Language) {
  return language === "PYTHON" ? "Python" : "TypeScript";
}

const languageWithIconCSS = css`
  display: inline-flex;
  align-items: center;
  gap: var(--global-dimension-size-100);
`;

export function LanguageWithIcon({ language }: { language: Language }) {
  return (
    <span css={languageWithIconCSS}>
      {language === "PYTHON" ? <PythonSVG /> : <TypeScriptSVG />}
      {languageLabel(language)}
    </span>
  );
}

/**
 * Returns true when the local-Deno trust warning should be surfaced to the user.
 *
 * The warning is meaningful only when both of the following hold:
 *
 *  1. The DENO backend can actually be exercised — i.e. the server reports
 *     `status === "AVAILABLE"`. The probe (see `WASMAdapter.probe_binary` /
 *     `_probe_deno_binary` in `SandboxConfig.py`) verifies the runtime is
 *     resolvable; suppressing the warning when the provider is `UNAVAILABLE`
 *     or `NOT_INSTALLED` avoids alarming users about a provider they cannot
 *     even select.
 *  2. The Phoenix instance is self-hosted — managed deployments inject
 *     `window.Config.managementUrl`, where the host runtime is operator-owned
 *     and the user cannot install additional binaries.
 *
 * The `managementUrl` heuristic stays as the deployment-mode signal until a
 * dedicated server flag exists; the `status` gate makes the warning
 * capability-driven *in addition to* deployment-driven (closes the heuristic
 * gap called out in #13030).
 */
export function shouldShowLocalDenoTrustWarning(
  backend: Pick<BackendInfo, "backendType" | "status"> | undefined
): boolean {
  if (backend == null || backend.backendType !== "DENO") {
    return false;
  }
  if (backend.status !== "AVAILABLE") {
    return false;
  }
  return !window.Config.managementUrl;
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

/**
 * Returns a copy of a sandbox config safe for display, with literal env_var
 * values redacted. Non-object configs and non-array env_vars pass through
 * unchanged so that malformed payloads do not throw and do not unmask
 * unexpected fields.
 */
export function getDisplaySandboxConfig(config: unknown): unknown {
  if (!isPlainObject(config)) {
    return config;
  }
  const result: Record<string, unknown> = { ...config };
  const envVars = result["env_vars"];
  if (Array.isArray(envVars)) {
    result["env_vars"] = envVars.map((entry) => {
      if (!isPlainObject(entry)) {
        return entry;
      }
      if (entry["kind"] === "literal" && "value" in entry) {
        return { ...entry, value: "<redacted>" };
      }
      return entry;
    });
  }
  return result;
}

/**
 * Splits the user-edited "one package per line" textarea into a normalized
 * list of package specifiers.
 */
export function getDependencyPackages(packagesText: string): string[] {
  return packagesText
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Produces a one-line install-command preview for the dependency textarea.
 * Returns null when there is nothing to display (no language advertised, no
 * packages typed) so the caller can hide the preview entirely.
 */
export function getDependencyPreview({
  packagesText,
  dependenciesLanguage,
  backendType,
}: {
  packagesText: string;
  dependenciesLanguage: BackendInfo["dependenciesLanguage"] | undefined | null;
  backendType: BackendInfo["backendType"] | undefined;
}): string | null {
  if (dependenciesLanguage == null) {
    return null;
  }
  const packages = getDependencyPackages(packagesText);
  if (packages.length === 0) {
    return null;
  }
  if (dependenciesLanguage === "TYPESCRIPT") {
    return "preview unavailable for typescript";
  }
  // Python branch: shape the preview after the install path the backend uses.
  const joined = packages.join(" ");
  if (backendType === "MODAL") {
    const args = packages.map((p) => `"${p}"`).join(", ");
    return `image.pip_install(${args})`;
  }
  return `pip install ${joined}`;
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
    const packages = getDependencyPackages(values.dependenciesText);
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
