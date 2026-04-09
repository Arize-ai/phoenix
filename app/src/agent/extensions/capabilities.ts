/**
 * Runtime capabilities are feature flags that shape what the agent can do and
 * how the UI should expose those controls. This module is the single source of
 * truth for capability metadata, default values, and model-facing summaries.
 *
 * For frontend tool-extension workflow guidance, see
 * `.agents/skills/phoenix-pxi/rules/extending-frontend-tool-registry.md`.
 */
export type AgentCapabilityKey =
  | "bash.retainInactiveSessions"
  | "graphql.mutations";

/** Describes one capability and how it should appear across the app. */
export type AgentCapabilityDefinition = {
  key: AgentCapabilityKey;
  label: string;
  description: string;
  defaultValue: boolean;
  scope: "global" | "session";
  controlSurface?: "debug-menu";
  systemPromptState?: {
    enabled: string;
    disabled: string;
  };
};

/** Boolean runtime snapshot keyed by capability name. */
export type AgentCapabilities = Record<AgentCapabilityKey, boolean>;

const DEFAULT_AGENT_CAPABILITIES: AgentCapabilities = {
  "bash.retainInactiveSessions": false,
  "graphql.mutations": false,
};

/** Ordered capability catalog used by the UI and runtime. */
export const AGENT_CAPABILITY_DEFINITIONS: AgentCapabilityDefinition[] = [
  {
    key: "bash.retainInactiveSessions",
    label: "Retain inactive bash sessions",
    description:
      "Keeps browser bash runtimes alive when switching sessions instead of eagerly garbage-collecting them.",
    defaultValue: false,
    scope: "global",
    controlSurface: "debug-menu",
  },
  {
    key: "graphql.mutations",
    label: "Dangerously enable mutations",
    description:
      "Allows the phoenix-gql bash command to execute GraphQL mutations in addition to queries.",
    defaultValue: false,
    scope: "global",
    controlSurface: "debug-menu",
    systemPromptState: {
      enabled:
        "GraphQL mutations are enabled for phoenix-gql. Mutation operations may be executed when they are necessary and appropriate.",
      disabled:
        "GraphQL mutations are disabled for phoenix-gql. Only read-only GraphQL queries are permitted.",
    },
  },
];

/** Fast lookup map derived from the definitions array. */
const AGENT_CAPABILITY_DEFINITIONS_BY_KEY = Object.fromEntries(
  AGENT_CAPABILITY_DEFINITIONS.map((def) => [def.key, def])
) as Record<AgentCapabilityKey, AgentCapabilityDefinition>;

// Runtime completeness check: every key in DEFAULT_AGENT_CAPABILITIES (which is
// compile-time checked against AgentCapabilityKey) must have a matching entry in
// the definitions array.  This catches the case where a developer adds a new key
// to AgentCapabilityKey and DEFAULT_AGENT_CAPABILITIES but forgets to add its
// definition to AGENT_CAPABILITY_DEFINITIONS.
for (const key of Object.keys(
  DEFAULT_AGENT_CAPABILITIES
) as AgentCapabilityKey[]) {
  if (!AGENT_CAPABILITY_DEFINITIONS_BY_KEY[key]) {
    throw new Error(
      `Missing AGENT_CAPABILITY_DEFINITIONS entry for capability key: "${key}"`
    );
  }
}

function getSystemPromptLine({
  definition,
  capabilities,
}: {
  definition: AgentCapabilityDefinition;
  capabilities: AgentCapabilities;
}) {
  if (!definition.systemPromptState) {
    return null;
  }

  return capabilities[definition.key]
    ? definition.systemPromptState.enabled
    : definition.systemPromptState.disabled;
}

/** Returns the default capability state for a fresh agent store. */
export function createDefaultAgentCapabilities(): AgentCapabilities {
  return { ...DEFAULT_AGENT_CAPABILITIES };
}

/** Returns capability metadata for code paths that already know the key. */
export function getAgentCapabilityDefinition(
  key: AgentCapabilityKey
): AgentCapabilityDefinition {
  return AGENT_CAPABILITY_DEFINITIONS_BY_KEY[key];
}

/** Filters the capability catalog down to one UI control surface. */
export function getAgentCapabilitiesForControlSurface(
  controlSurface: NonNullable<AgentCapabilityDefinition["controlSurface"]>
): AgentCapabilityDefinition[] {
  return AGENT_CAPABILITY_DEFINITIONS.filter(
    (definition) => definition.controlSurface === controlSurface
  );
}

/**
 * Serializes runtime capability state into plain language that can be appended
 * to the base system prompt for a chat turn.
 */
export function buildAgentCapabilitySystemPrompt({
  capabilities,
}: {
  capabilities: AgentCapabilities;
}): string {
  const capabilityLines = AGENT_CAPABILITY_DEFINITIONS.map((definition) =>
    getSystemPromptLine({ definition, capabilities })
  ).filter((line): line is string => line !== null);

  if (capabilityLines.length === 0) {
    return "";
  }

  return [
    "Runtime capability state for this conversation:",
    ...capabilityLines.map((line) => `- ${line}`),
  ].join("\n");
}
