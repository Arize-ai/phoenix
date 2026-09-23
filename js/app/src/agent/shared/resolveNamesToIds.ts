/**
 * Resolve a list of names to ids against a set of named items, matching
 * exactly. Returns the resolved `ids` (in input order) and any `unknown` names
 * that matched nothing — callers format their own error from `unknown`.
 *
 * Matching is case-sensitive because split and label names are case-sensitive
 * identifiers on the server (a plain unique constraint, so `Train` and `train`
 * are distinct). Case-insensitive matching would collapse such names and could
 * resolve to the wrong one; an exact match hits at most one item. The agent
 * gets canonical names from the list tools, so it has the exact spelling to
 * pass. Used to turn split & label names into the ids the GraphQL mutations
 * require.
 */
export function resolveNamesToIds(
  items: ReadonlyArray<{ id: string; name: string }>,
  names: ReadonlyArray<string>
): { ids: string[]; unknown: string[] } {
  const idByName = new Map(items.map((item) => [item.name, item.id]));
  const ids: string[] = [];
  const unknown: string[] = [];
  for (const name of names) {
    const id = idByName.get(name);
    if (id) {
      ids.push(id);
    } else {
      unknown.push(name);
    }
  }
  return { ids, unknown };
}
