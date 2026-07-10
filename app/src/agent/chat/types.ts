import type { UIMessage } from "ai";

import type { components } from "@phoenix/api/__generated__/v1";

/** Wire schema of the transient `data-graphql-result` stream chunk. */
type GraphQLResultChunk = components["schemas"]["GraphQLResultChunk"];

type AgentUIDataTypes = {
  "graphql-result": GraphQLResultChunk["data"];
};

/**
 * AI SDK `UIMessage` parameterized with the backend's assistant-message
 * metadata shape, sourced from the generated OpenAPI types.
 */
export type AgentUIMessage = UIMessage<
  components["schemas"]["AssistantMessageMetadata"],
  AgentUIDataTypes
>;
