// --- Bash tool ---
export { bashToolDefinition, getBashToolInput } from "./bashToolSchema";
export {
  applyBashToolFilesystemPolicy,
  BASH_TOOL_READONLY_ROOT,
  BASH_TOOL_WORKSPACE_ROOT,
} from "./bashToolFilesystemPolicy";
export {
  clearBashToolRuntime,
  garbageCollectBashToolRuntimes,
  getBashToolSessionKey,
  getOrCreateBashToolRuntime,
} from "./bashToolSessionRegistry";
export {
  createBashToolRuntime,
  DEFAULT_BASH_TOOL_CWD,
  DEFAULT_BASH_TOOL_EXECUTION_LIMITS,
} from "./bashToolRuntime";
export type { BashToolFilesystemPolicy } from "./bashToolFilesystemPolicy";
export type { BashToolInput } from "./bashToolSchema";
export {
  getBashToolCommandDisplayResult,
  isBashToolCommandResult,
} from "./bashToolTypes";
export type {
  BashToolCommandDisplayResult,
  BashToolCommandResult,
  BashToolRuntime,
} from "./bashToolTypes";

// --- Page context (drives the /phoenix virtual filesystem) ---
export { useCurrentAgentPageContext } from "./context/pageContext";
export { refreshAgentSessionContext } from "./context/refreshAgentContext";
export type {
  AgentContextRefreshReason,
  AgentPageContext,
} from "./context/pageContextTypes";
