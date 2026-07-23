/**
 * Runtime capabilities are feature flags that shape what the agent can do and
 * how the UI should expose those controls.
 *
 * For tool-extension workflow guidance, see the `defineTool` /
 * `defineClientActionTool` helpers in `./registry` and the registry aggregator
 * in `./toolRegistry`.
 */
export type AgentCapabilityKey =
  | "bash.retainInactiveSessions"
  | "graphql.mutations"
  | "session.storeSessions"
  | "subagents.enabled"
  | "web.access";

/** Describes one capability and how it should appear across the app. */
export type AgentCapabilityDefinition = {
  key: AgentCapabilityKey;
  label: string;
  description: string;
  defaultValue: boolean;
  scope: "global" | "session";
  controlSurface?: "experimental-settings";
};

/** Boolean runtime snapshot keyed by capability name. */
export type AgentCapabilities = Record<AgentCapabilityKey, boolean>;

const DEFAULT_AGENT_CAPABILITIES: AgentCapabilities = {
  "bash.retainInactiveSessions": false,
  "graphql.mutations": false,
  "session.storeSessions": false,
  "subagents.enabled": false,
  "web.access": false,
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
    controlSurface: "experimental-settings",
  },
  {
    key: "graphql.mutations",
    label: "Dangerously enable mutations",
    description:
      "Allows the phoenix-gql bash command to execute GraphQL mutations in addition to queries.",
    defaultValue: false,
    scope: "global",
    controlSurface: "experimental-settings",
  },
  {
    key: "session.storeSessions",
    label: "Store recent sessions",
    description:
      "Keeps the three most recent chat sessions instead of replacing session history when starting a new chat.",
    defaultValue: false,
    scope: "global",
    controlSurface: "experimental-settings",
  },
  {
    key: "subagents.enabled",
    label: "Subagents",
    description:
      "Lets the assistant delegate work to subagents that run their own tool-using turns. Experimental and may consume large numbers of tokens.",
    defaultValue: false,
    scope: "global",
  },
  {
    key: "web.access",
    label: "Web search",
    description:
      "Lets the assistant use provider-native web search and URL fetching when the selected model supports it.",
    defaultValue: false,
    scope: "global",
  },
];

/** Fast lookup map derived from the definitions array. */
// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- keys come from AgentCapabilityKey-typed definitions; completeness is enforced by the runtime check below
const AGENT_CAPABILITY_DEFINITIONS_BY_KEY = Object.fromEntries(
  AGENT_CAPABILITY_DEFINITIONS.map((def) => [def.key, def])
) as Record<AgentCapabilityKey, AgentCapabilityDefinition>;

// Runtime completeness check: every key in DEFAULT_AGENT_CAPABILITIES (which is
// compile-time checked against AgentCapabilityKey) must have a matching entry in
// the definitions array.  This catches the case where a developer adds a new key
// to AgentCapabilityKey and DEFAULT_AGENT_CAPABILITIES but forgets to add its
// definition to AGENT_CAPABILITY_DEFINITIONS.
// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Object.keys of a Record<AgentCapabilityKey, boolean> literal
for (const key of Object.keys(
  DEFAULT_AGENT_CAPABILITIES
) as AgentCapabilityKey[]) {
  if (!AGENT_CAPABILITY_DEFINITIONS_BY_KEY[key]) {
    throw new Error(
      `Missing AGENT_CAPABILITY_DEFINITIONS entry for capability key: "${key}"`
    );
  }
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
