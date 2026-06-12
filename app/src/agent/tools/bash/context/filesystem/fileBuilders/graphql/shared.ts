import type { ConcreteRequest, GraphQLTaggedNode } from "relay-runtime";

import type { GeneratedContextFile } from "../types";

export function formatJsonBlock(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export function getGraphqlRequestText(
  request: GraphQLTaggedNode,
  requestName: string
) {
  const text = (request as ConcreteRequest).params.text;

  if (!text) {
    throw new Error(
      `Relay request ${requestName} did not include printable text`
    );
  }

  return `${text}\n`;
}

export function createGraphqlContextFile({
  path,
  request,
  requestName,
}: {
  path: string;
  request: GraphQLTaggedNode;
  requestName: string;
}): GeneratedContextFile {
  return {
    path,
    content: getGraphqlRequestText(request, requestName),
  };
}

export function createJsonContextFile({
  path,
  value,
}: {
  path: string;
  value: unknown;
}): GeneratedContextFile {
  return {
    path,
    content: `${formatJsonBlock(value)}\n`,
  };
}
