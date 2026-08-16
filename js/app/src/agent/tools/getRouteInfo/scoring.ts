import type { RouteCatalogEntry } from "./types";

/**
 * Splits free-form user text into simple lowercase search tokens.
 *
 * @param value - User query or route metadata text.
 */
function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0);
}

/**
 * Assigns a relevance score for a catalog entry against a free-form query.
 *
 * @param params - Scoring inputs.
 * @param params.entry - Catalog entry to score.
 * @param params.query - User query to compare against metadata and path.
 */
export function scoreEntry({
  entry,
  query,
}: {
  entry: RouteCatalogEntry;
  query: string;
}): number {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return 1;
  }

  const queryTokens = tokenize(normalizedQuery);
  const label = entry.metadata.label.toLowerCase();
  const description = entry.metadata.description.toLowerCase();
  const path = entry.path.toLowerCase();

  let score = 0;
  // Whole-query matches get higher weights than token matches so phrases like
  // "data retention policy" prefer a route that explicitly names that phrase.
  if (label.includes(normalizedQuery)) {
    score += 12;
  }
  if (description.includes(normalizedQuery)) {
    score += 10;
  }
  if (path.includes(normalizedQuery)) {
    score += 4;
  }

  // Token matches make the search tolerant of partial questions while still
  // preferring user-facing label and description matches over path matches.
  for (const token of queryTokens) {
    if (label.includes(token)) {
      score += 5;
    }
    if (description.includes(token)) {
      score += 3;
    }
    if (path.includes(token)) {
      score += 1;
    }
  }

  return score;
}
