import type { APIResponse } from "@playwright/test";

export async function expectOK(
  response: APIResponse
): Promise<{ data: unknown }> {
  if (!response.ok()) {
    throw new Error(
      `Phoenix API request failed: ${response.status()} ${await response.text()}`
    );
  }
  return response.json();
}

export function getSpanToolName(span: unknown): string | null {
  if (typeof span !== "object" || span === null) {
    return null;
  }
  const candidate = span as {
    name?: unknown;
    attributes?: Record<string, unknown>;
  };
  const attributeName = candidate.attributes?.["tool.name"];
  if (typeof attributeName === "string" && attributeName.length > 0) {
    return attributeName;
  }
  if (typeof candidate.name === "string" && candidate.name.length > 0) {
    return candidate.name;
  }
  return null;
}

export function getUiMessageToolNames(parts: unknown[]): string[] {
  return parts.flatMap((part) => {
    if (typeof part !== "object" || part === null) {
      return [];
    }
    const candidate = part as { type?: unknown; toolName?: unknown };
    if (typeof candidate.type !== "string") {
      return [];
    }
    // Static tool parts use type "tool-<name>"; dynamic tool parts use
    // type "dynamic-tool" with the name in a separate `toolName` field.
    const toolName =
      candidate.type.match(/^tool-(.+)$/)?.[1] ??
      (candidate.type === "dynamic-tool" &&
      typeof candidate.toolName === "string"
        ? candidate.toolName
        : null);
    return toolName ? [toolName] : [];
  });
}
