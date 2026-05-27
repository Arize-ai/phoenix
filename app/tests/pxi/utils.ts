import type { APIRequestContext, APIResponse } from "@playwright/test";

export async function expectOK(response: APIResponse) {
  if (!response.ok()) {
    throw new Error(
      `Phoenix API request failed: ${response.status()} ${await response.text()}`
    );
  }
  return response.json() as Promise<{ data: unknown }>;
}

type GraphQLResponse<TData> = {
  data?: TData | null;
  errors?: Array<{ message?: string }>;
};

async function postGraphQL<TData>({
  request,
  query,
  variables,
}: {
  request: APIRequestContext;
  query: string;
  variables?: Record<string, unknown>;
}): Promise<TData> {
  const response = await request.post("/graphql", {
    headers: { "Content-Type": "application/json" },
    data: { query, variables },
  });
  if (!response.ok()) {
    throw new Error(
      `Phoenix GraphQL request failed: ${response.status()} ${await response.text()}`
    );
  }
  const payload = (await response.json()) as GraphQLResponse<TData>;
  if (payload.errors?.length) {
    throw new Error(
      `Phoenix GraphQL request failed: ${payload.errors
        .map((error) => error.message ?? "Unknown error")
        .join("; ")}`
    );
  }
  if (!payload.data) {
    throw new Error("Phoenix GraphQL request returned no data.");
  }
  return payload.data;
}

export async function createWasmPythonSandboxConfig({
  request,
  name,
}: {
  request: APIRequestContext;
  name: string;
}): Promise<string> {
  const data = await postGraphQL<{
    createSandboxConfig: { sandboxConfig: { id: string } };
  }>({
    request,
    query: `mutation CreatePxiSandboxConfig($input: CreateSandboxConfigInput!) {
      createSandboxConfig(input: $input) {
        sandboxConfig { id }
      }
    }`,
    variables: {
      input: {
        name,
        config: { wasm: { language: "PYTHON" } },
        enabled: true,
      },
    },
  });
  return data.createSandboxConfig.sandboxConfig.id;
}

export async function disableAllSandboxConfigs(
  request: APIRequestContext
): Promise<void> {
  const data = await postGraphQL<{
    sandboxProviders: Array<{
      configs: Array<{ id: string; enabled: boolean }>;
    }>;
  }>({
    request,
    query: `query PxiSandboxConfigs {
      sandboxProviders {
        configs { id enabled }
      }
    }`,
  });
  const enabledConfigIds = data.sandboxProviders.flatMap((provider) =>
    provider.configs
      .filter((config) => config.enabled)
      .map((config) => config.id)
  );
  for (const id of enabledConfigIds) {
    await postGraphQL<{
      updateSandboxConfig: { sandboxConfig: { id: string } };
    }>({
      request,
      query: `mutation DisablePxiSandboxConfig($input: UpdateSandboxConfigInput!) {
        updateSandboxConfig(input: $input) {
          sandboxConfig { id }
        }
      }`,
      variables: { input: { id, enabled: false } },
    });
  }
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
