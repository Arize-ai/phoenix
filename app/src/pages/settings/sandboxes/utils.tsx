import { css } from "@emotion/react";

import {
  Badge,
  Flex,
  RichTooltip,
  Text,
  TooltipTrigger,
  TriggerWrap,
} from "@phoenix/components";
import { PythonSVG, TypeScriptSVG } from "@phoenix/components/core/icon/Icons";
import { assertUnreachable } from "@phoenix/typeUtils";
import { getDependencyPackages } from "@phoenix/utils/packageSpecUtils";

import type { SandboxConfigVariantInput } from "./__generated__/SandboxConfigDialogCreateSandboxConfigMutation.graphql";
import type {
  BackendInfo,
  SandboxConfigFormValues,
  SandboxProvider,
} from "./types";

type Language = SandboxProvider["supportedLanguages"][number];

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
        : "var(--global-text-color-700)";
  const label = statusLabel(status);
  const tooltipLines = detail ? [detail] : dependencyHints;

  if (status === "AVAILABLE" || tooltipLines.length === 0) {
    return <span style={{ color }}>{label}</span>;
  }

  const textColor =
    status === "NOT_INSTALLED" || status === "DISABLED"
      ? "text-700"
      : "warning";

  return (
    <TooltipTrigger delay={100}>
      <TriggerWrap>
        <Text
          color={textColor}
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

type HostingType = BackendInfo["hostingType"];

export function hostingTypeLabel(hostingType: HostingType) {
  switch (hostingType) {
    case "LOCAL":
      return "Local";
    case "HOSTED":
      return "Hosted";
    default:
      return assertUnreachable(hostingType);
  }
}

const HOSTING_TYPE_TOOLTIP: Record<HostingType, string> = {
  LOCAL:
    "Runs on the same machine as the Phoenix server. Code is sandboxed, but " +
    "execution consumes Phoenix's CPU and memory.",
  HOSTED:
    "Code runs on an external provider's infrastructure. Execution happens " +
    "off-server — Phoenix only orchestrates the run.",
};

/**
 * A badge identifying whether a sandbox backend executes locally (on the
 * Phoenix server) or on a hosted provider, with a tooltip explaining the
 * resource trade-off.
 */
export function SandboxHostingTypeBadge({
  hostingType,
}: {
  hostingType: HostingType;
}) {
  return (
    <TooltipTrigger delay={100}>
      <TriggerWrap>
        <Badge
          variant={hostingType === "LOCAL" ? "warning" : "info"}
          css={css`
            cursor: help;
          `}
        >
          {hostingTypeLabel(hostingType)}
        </Badge>
      </TriggerWrap>
      <RichTooltip width={280}>
        <Text>{HOSTING_TYPE_TOOLTIP[hostingType]}</Text>
      </RichTooltip>
    </TooltipTrigger>
  );
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
    case "DISABLED":
      return "Disabled";
    default:
      return assertUnreachable(status);
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

/**
 * Whether to show a "runtime unavailable" badge on a sandbox config row.
 * True only for a local backend that is not currently AVAILABLE.
 */
export function shouldShowRuntimeUnavailableBadge(
  backend: Pick<BackendInfo, "hostingType" | "status"> | undefined
): boolean {
  if (backend == null || backend.hostingType !== "LOCAL") {
    return false;
  }
  return backend.status !== "AVAILABLE";
}

export function getBackendDescription(backendType: BackendInfo["backendType"]) {
  switch (backendType) {
    case "WASM":
      return "Local WebAssembly runtime";
    case "E2B":
      return "Cloud Python sandbox";
    case "DAYTONA":
      return "Daytona workspace-backed Python and TypeScript runtimes";
    case "VERCEL":
      return "Vercel cloud Python and TypeScript sandboxes";
    case "DENO":
      return "Local Deno TypeScript runtime";
    case "MODAL":
      return "Modal cloud Python sandbox";
    default:
      return "Sandbox runtime";
  }
}

/**
 * Produces a one-line install-command preview for the dependency textarea.
 * Returns null when there is nothing to display (deps unsupported, language
 * absent, or no packages typed) so the caller can hide the preview entirely.
 */
export function getDependencyPreview({
  packagesText,
  supportsDependencies,
  language,
  backendType,
}: {
  packagesText: string;
  supportsDependencies: boolean | undefined | null;
  language: "PYTHON" | "TYPESCRIPT" | null | undefined;
  backendType: BackendInfo["backendType"] | undefined;
}): string | null {
  if (!supportsDependencies || language == null) {
    return null;
  }
  const packages = getDependencyPackages(packagesText);
  if (packages.length === 0) {
    return null;
  }
  const joined = packages.join(" ");
  if (language === "TYPESCRIPT") {
    return `npm install ${joined}`;
  }
  // Python branch: shape the preview after the install path the backend uses.
  if (backendType === "MODAL") {
    const args = packages.map((p) => `"${p}"`).join(", ");
    return `image.pip_install(${args})`;
  }
  return `pip install ${joined}`;
}

/**
 * Structural shape of ``SandboxConfig.config`` as returned by GraphQL. Each
 * call site's Relay-generated type is assignable to this (or to a subset
 * thereof) via duck typing, so utilities here don't need to import a
 * per-query fragment type.
 */
export type SandboxConfigShape = {
  readonly envVars: ReadonlyArray<{ readonly name: string }>;
  readonly internetAccess: { readonly mode: "ALLOW" | "DENY" } | null;
  readonly dependencies: { readonly packages: ReadonlyArray<string> } | null;
};

export function summarizeConfig(config: SandboxConfigShape): string {
  const labels: string[] = [];
  if (config.envVars.length > 0) labels.push("env_vars");
  if (config.internetAccess != null) labels.push("internet_access");
  if (config.dependencies != null) labels.push("dependencies");
  if (labels.length === 0) return "No custom settings";
  if (labels.length === 1) return `1 setting: ${labels[0]}`;
  return `${labels.length} settings: ${labels.slice(0, 2).join(", ")}${labels.length > 2 ? ", ..." : ""}`;
}

export type SandboxConfigSetting = {
  /** Stable key used by callers to discriminate (e.g. "env_vars"). */
  key: "env_vars" | "internet_access" | "dependencies";
  /** Human-readable label, e.g. "Environment Variables". */
  label: string;
  /** Compact, display-safe value summary, e.g. "FOO, BAR" or "on". */
  value: string;
};

/**
 * Flattens a sandbox config into display-ready `label → value` rows for the
 * settings summary shown in the configs table.
 *
 * Env-var secret keys are intentionally *not* shown — we surface the variable
 * *names* so the summary stays glanceable without exposing implementation
 * details in table cells. Internet access is normalized to a plain "on" /
 * "off" so it is obvious whether it is enabled.
 */
export function getSandboxConfigSettings(
  config: SandboxConfigShape
): SandboxConfigSetting[] {
  const settings: SandboxConfigSetting[] = [];

  if (config.envVars.length > 0) {
    settings.push({
      key: "env_vars",
      label: "Environment Variables",
      value: config.envVars.map((ev) => ev.name).join(", "),
    });
  }

  if (config.internetAccess != null) {
    settings.push({
      key: "internet_access",
      label: "Internet Access",
      value: config.internetAccess.mode === "ALLOW" ? "on" : "off",
    });
  }

  if (config.dependencies != null) {
    const pkgs = config.dependencies.packages;
    settings.push({
      key: "dependencies",
      label: "Dependencies",
      value: pkgs.length > 0 ? pkgs.join(", ") : "none",
    });
  }

  return settings;
}

/**
 * Maps a backend kind to the strawberry oneOf variant key on
 * ``SandboxConfigVariantInput``. Mirrors ``_VARIANT_FIELDS`` in
 * ``server/api/mutations/sandbox_config_mutations.py``.
 */
const VARIANT_KEY_BY_BACKEND_TYPE: Record<BackendInfo["backendType"], string> =
  {
    E2B: "e2b",
    DAYTONA: "daytona",
    DENO: "deno",
    VERCEL: "vercel",
    WASM: "wasm",
    MODAL: "modal",
  };

export function formValuesToConfigPatch(
  values: SandboxConfigFormValues,
  backend: BackendInfo
): SandboxConfigVariantInput;
export function formValuesToConfigPatch(
  values: SandboxConfigFormValues,
  backend: BackendInfo | undefined
): SandboxConfigVariantInput | Record<string, never>;
export function formValuesToConfigPatch(
  values: SandboxConfigFormValues,
  backend: BackendInfo | undefined
): SandboxConfigVariantInput | Record<string, never> {
  // ``language`` now lives inside each per-provider variant input
  // (mirroring the pydantic Config's ``language`` field). The dialog form
  // tracks language at the top level; we copy it into the inner capabilities
  // dict here so the GraphQL input shape matches the schema.
  const capabilities: Record<string, unknown> = { language: values.language };

  if (backend?.supportsEnvVars && values.envVars.length > 0) {
    capabilities["envVars"] = values.envVars.map((entry) => ({
      name: entry.name,
      secretKey: entry.secretKey,
    }));
  }

  if (backend?.internetAccess === "BOOLEAN") {
    capabilities["internetAccess"] = {
      mode: values.internetAccessEnabled ? "ALLOW" : "DENY",
    };
  }

  if (backend?.supportsDependencies) {
    const packages = getDependencyPackages(values.dependenciesText);
    if (packages.length > 0) {
      capabilities["dependencies"] = { packages };
    }
  }

  // WASM accepts no per-config options; senders pass {}.
  const variantKey = backend
    ? VARIANT_KEY_BY_BACKEND_TYPE[backend.backendType]
    : null;
  if (variantKey == null) {
    // No backend selected yet; caller must guard before sending. Return
    // an empty object so the dialog can detect "no variant set".
    return {};
  }
  // The variant key is computed from the backend type, which TypeScript
  // cannot correlate with the ``@oneOf`` union members, so assert the shape.
  return { [variantKey]: capabilities } as unknown as SandboxConfigVariantInput;
}
