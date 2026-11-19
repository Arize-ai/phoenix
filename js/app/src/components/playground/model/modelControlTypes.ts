/**
 * The model types an instance's model menu offers: chat models only,
 * decision models only, or both on separate tabs.
 */
export type InstanceModelTypes = "CHAT" | "DECISION" | "CHAT_OR_DECISION";

/**
 * Where an instance's endpoint, region and base URL come from: fields the
 * user edits in the browser, or only custom providers and server
 * environment variables.
 */
export type InstanceModelRouting = "editable" | "configured";
