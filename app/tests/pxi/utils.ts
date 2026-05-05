import type { APIRequestContext } from "@playwright/test";

export async function expectOK(
  response: Awaited<ReturnType<APIRequestContext["get"]>>
) {
  if (!response.ok()) {
    throw new Error(
      `Phoenix API request failed: ${response.status()} ${await response.text()}`
    );
  }
  return response.json() as Promise<{ data: unknown }>;
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
