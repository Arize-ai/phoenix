import type { DataUIPart } from "ai";

export const AGENT_ADVERTISED_TOOLS_DATA_TYPE = "data-agent-advertised-tools";

export type AgentAdvertisedTool = {
  name: string;
  execution: "browser" | "server";
  family?: string | null;
};

export type AgentAdvertisedToolsData = {
  tools: AgentAdvertisedTool[];
};

export type AgentChatDataParts = {
  "agent-advertised-tools": AgentAdvertisedToolsData;
};

export function parseAgentAdvertisedToolsDataPart(
  part: DataUIPart<AgentChatDataParts>
): AgentAdvertisedToolsData | null {
  if (part.type !== AGENT_ADVERTISED_TOOLS_DATA_TYPE) {
    return null;
  }
  return parseAgentAdvertisedToolsData(part.data);
}

export function parseAgentAdvertisedToolsData(
  data: unknown
): AgentAdvertisedToolsData | null {
  if (typeof data !== "object" || data === null || !("tools" in data)) {
    return null;
  }
  const tools = (data as { tools?: unknown }).tools;
  if (!Array.isArray(tools)) {
    return null;
  }
  const parsedTools: AgentAdvertisedTool[] = [];
  for (const tool of tools) {
    const parsedTool = parseAgentAdvertisedTool(tool);
    if (parsedTool == null) {
      return null;
    }
    parsedTools.push(parsedTool);
  }
  return { tools: parsedTools };
}

export function getServerExecutedToolNames(
  data: AgentAdvertisedToolsData
): Set<string> {
  return new Set(
    data.tools
      .filter((tool) => tool.execution === "server")
      .map((tool) => tool.name)
  );
}

function parseAgentAdvertisedTool(input: unknown): AgentAdvertisedTool | null {
  if (typeof input !== "object" || input === null) {
    return null;
  }
  const candidate = input as {
    name?: unknown;
    execution?: unknown;
    family?: unknown;
  };
  if (typeof candidate.name !== "string") {
    return null;
  }
  if (candidate.execution !== "browser" && candidate.execution !== "server") {
    return null;
  }
  if (
    candidate.family !== undefined &&
    candidate.family !== null &&
    typeof candidate.family !== "string"
  ) {
    return null;
  }
  return {
    name: candidate.name,
    execution: candidate.execution,
    ...(candidate.family !== undefined ? { family: candidate.family } : {}),
  };
}
