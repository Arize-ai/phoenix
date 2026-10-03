import { Suspense } from "react";
import { graphql, useFragment, useLazyLoadQuery } from "react-relay";

import {
  Card,
  ContextualHelp,
  Flex,
  Icon,
  Icons,
  LinkButton,
  Loading,
  Text,
  View,
} from "@phoenix/components";
import type {
  CodeEvaluatorSandboxCard_sandboxConfig$data,
  CodeEvaluatorSandboxCard_sandboxConfig$key,
} from "@phoenix/components/evaluators/__generated__/CodeEvaluatorSandboxCard_sandboxConfig.graphql";
import type {
  CodeEvaluatorSandboxCardBackendsQuery,
  CodeEvaluatorSandboxCardBackendsQuery$data,
} from "@phoenix/components/evaluators/__generated__/CodeEvaluatorSandboxCardBackendsQuery.graphql";
import {
  EvaluatorDetailList,
  EvaluatorDetailRow,
} from "@phoenix/components/evaluators/EvaluatorDetailsSection";
import { SandboxProviderIcon } from "@phoenix/components/sandbox/SandboxProviderIcon";
import { useViewerCanManageSandboxes } from "@phoenix/contexts";
import { getSandboxConfigSettings } from "@phoenix/pages/settings/sandboxes/utils";

type SandboxBackend =
  CodeEvaluatorSandboxCardBackendsQuery$data["sandboxBackends"][number];

function CapabilityRow({ label, value }: { label: string; value: string }) {
  return (
    <Flex direction="row" gap="size-200" justifyContent="space-between">
      <Text size="XS" color="text-700">
        {label}
      </Text>
      <Text size="XS">{value}</Text>
    </Flex>
  );
}

function ProviderCapabilitiesHelp({
  sandboxBackend,
}: {
  sandboxBackend: SandboxBackend | undefined;
}) {
  return (
    <ContextualHelp variant="info">
      <Flex direction="column" gap="size-100">
        <Text weight="heavy" size="S">
          Capabilities
        </Text>
        <Flex direction="column" gap="size-50">
          <CapabilityRow
            label="env_vars"
            value={
              sandboxBackend?.supportsEnvVars ? "supported" : "not supported"
            }
          />
          <CapabilityRow
            label="internet_access"
            value={getInternetAccessLabel(
              sandboxBackend?.internetAccess ?? "NONE"
            )}
          />
          <CapabilityRow
            label="dependencies"
            value={getDependenciesLabel(
              sandboxBackend?.supportsDependencies ?? false
            )}
          />
        </Flex>
      </Flex>
    </ContextualHelp>
  );
}

/** Values that should render in muted-italic (off / none) vs plain mono. */
const MUTED_SETTING_VALUES = new Set(["off", "none"]);

/** Setting keys whose values are comma-separated lists best shown one-per-line. */
const LIST_SETTING_KEYS = new Set(["env_vars", "dependencies"]);

function SettingValue({
  settingKey,
  value,
}: {
  settingKey: string;
  value: string;
}) {
  const isMuted = MUTED_SETTING_VALUES.has(value);
  if (LIST_SETTING_KEYS.has(settingKey) && !isMuted) {
    const items = value.split(", ").filter((s) => s.length > 0);
    return (
      <Flex direction="column" alignItems="end" gap="size-25">
        {items.map((item) => (
          <Text key={item} size="S" fontFamily="mono">
            {item}
          </Text>
        ))}
      </Flex>
    );
  }
  return (
    <Text
      size="S"
      fontFamily="mono"
      color={isMuted ? "text-500" : undefined}
      fontStyle={isMuted ? "italic" : undefined}
    >
      {value}
    </Text>
  );
}

function getInternetAccessLabel(
  internetAccess: SandboxBackend["internetAccess"]
) {
  return internetAccess === "BOOLEAN" ? "Configurable" : "Not supported";
}

function getDependenciesLabel(supportsDependencies: boolean) {
  return supportsDependencies ? "Supported" : "Not supported";
}

/**
 * The sandbox a code evaluator executes in: which config and provider it runs
 * on, its timeout, and any custom settings. Shared by the dataset and project
 * evaluator details pages so a sandbox reads the same wherever it appears.
 *
 * The card fetches the backend capability facts itself, so only pages that
 * actually render it pay for the server's backend probes.
 */
export function CodeEvaluatorSandboxCard({
  sandboxConfigRef,
}: {
  /** The evaluator's sandbox config, or null when none is selected. */
  sandboxConfigRef:
    | CodeEvaluatorSandboxCard_sandboxConfig$key
    | null
    | undefined;
}) {
  const sandboxConfig = useFragment(
    graphql`
      fragment CodeEvaluatorSandboxCard_sandboxConfig on SandboxConfig {
        id
        name
        description
        timeout
        config {
          envVars {
            name
            secretKey
          }
          internetAccess {
            mode
          }
          dependencies {
            packages
          }
        }
        provider {
          backendType
        }
      }
    `,
    sandboxConfigRef ?? null
  );
  const canManageSandboxes = useViewerCanManageSandboxes();

  return (
    <Card
      title={
        <Flex direction="row" gap="size-100" alignItems="center">
          <Icon svg={<Icons.HardDrive />} />
          <span>Sandbox</span>
        </Flex>
      }
      extra={
        canManageSandboxes ? (
          <LinkButton
            size="S"
            to="/settings/sandboxes"
            aria-label="Configure sandboxes"
            leadingVisual={<Icon svg={<Icons.Settings />} />}
          />
        ) : undefined
      }
    >
      {sandboxConfig == null ? (
        <View padding="size-200">
          <Text color="text-700">No sandbox configuration selected.</Text>
        </View>
      ) : (
        <Suspense fallback={<Loading />}>
          <SandboxConfigDetails sandboxConfig={sandboxConfig} />
        </Suspense>
      )}
    </Card>
  );
}

function SandboxConfigDetails({
  sandboxConfig,
}: {
  sandboxConfig: CodeEvaluatorSandboxCard_sandboxConfig$data;
}) {
  const data = useLazyLoadQuery<CodeEvaluatorSandboxCardBackendsQuery>(
    graphql`
      query CodeEvaluatorSandboxCardBackendsQuery {
        sandboxBackends {
          backendType
          displayName
          supportsEnvVars
          internetAccess
          supportsDependencies
        }
      }
    `,
    {}
  );
  const sandboxBackend = data.sandboxBackends.find(
    (backend) => backend.backendType === sandboxConfig.provider.backendType
  );
  const customSettings = getSandboxConfigSettings(sandboxConfig.config);

  return (
    <EvaluatorDetailList>
      <EvaluatorDetailRow label="Config">
        <Text size="S" fontFamily="mono">
          {sandboxConfig.name}
        </Text>
      </EvaluatorDetailRow>
      {sandboxConfig.description ? (
        <EvaluatorDetailRow label="Description">
          {sandboxConfig.description}
        </EvaluatorDetailRow>
      ) : null}
      <EvaluatorDetailRow
        label="Provider"
        labelExtra={
          <ProviderCapabilitiesHelp sandboxBackend={sandboxBackend} />
        }
      >
        <Flex direction="row" gap="size-100" alignItems="center">
          <SandboxProviderIcon
            backendType={sandboxConfig.provider.backendType}
            height={16}
          />
          <Text size="S">
            {sandboxBackend?.displayName ?? sandboxConfig.provider.backendType}
          </Text>
        </Flex>
      </EvaluatorDetailRow>
      <EvaluatorDetailRow label="Timeout">
        {`${sandboxConfig.timeout} seconds`}
      </EvaluatorDetailRow>
      {customSettings.map((setting) => (
        <EvaluatorDetailRow key={setting.key} label={setting.label}>
          <SettingValue settingKey={setting.key} value={setting.value} />
        </EvaluatorDetailRow>
      ))}
    </EvaluatorDetailList>
  );
}
