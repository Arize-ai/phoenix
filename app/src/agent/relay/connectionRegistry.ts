/**
 * Registry mapping schema fields to the client `@connection` declarations that
 * read them. Server-side GraphQL results normalized by
 * {@link ./applyServerGraphQLResult} carry no `@connection` directives, so the
 * runtime AST builder cannot know which fields feed Relay connections. Client
 * code registers its connection fragments here; the builder consults the
 * registry to emit the matching `LinkedHandle` nodes so committed payloads
 * update the same connection records the UI paginates over.
 */

export type AgentConnectionEntry = {
  /** __typename of the record owning the connection field ("Query" for root fields) */
  parentTypename: string;
  /** schema field name (not alias), e.g. "projects" */
  fieldName: string;
  /** the @connection key used by the client fragment, e.g. "ProjectsTable_projects" */
  key: string;
  /** the @connection filters list; null when the fragment declares none */
  filters: readonly string[] | null;
};

/**
 * Entries keyed by `${parentTypename}.${fieldName}`. Multiple connections may
 * read the same schema field (different fragments, different keys), so each
 * map value is a list.
 */
const connectionEntriesByField = new Map<string, AgentConnectionEntry[]>();

function buildFieldKey(parentTypename: string, fieldName: string): string {
  return `${parentTypename}.${fieldName}`;
}

/**
 * Register a client `@connection` declaration so server-side GraphQL results
 * that select its underlying field also update the connection's handle
 * record. Re-registering the same connection key for a field replaces the
 * previous entry, keeping registration idempotent across re-renders.
 */
export function registerAgentConnection(entry: AgentConnectionEntry): void {
  const fieldKey = buildFieldKey(entry.parentTypename, entry.fieldName);
  const entries = connectionEntriesByField.get(fieldKey);
  if (!entries) {
    connectionEntriesByField.set(fieldKey, [entry]);
    return;
  }
  const existingIndex = entries.findIndex(
    (existing) => existing.key === entry.key
  );
  if (existingIndex >= 0) {
    entries[existingIndex] = entry;
  } else {
    entries.push(entry);
  }
}

/**
 * Look up every registered connection reading the given field. Returns an
 * empty array when no connection is registered for the field.
 */
export function resolveAgentConnections(
  parentTypename: string,
  fieldName: string
): AgentConnectionEntry[] {
  return (
    connectionEntriesByField.get(buildFieldKey(parentTypename, fieldName)) ?? []
  );
}
