import { safelyParseJSON } from "./jsonUtils";

const DEFAULT_MAX_DEPTH = 20;
const DEFAULT_MAX_NODES = 2_000;
const DEFAULT_MAX_PARSE_ATTEMPTS = 100;
const DEFAULT_MAX_CHARACTERS = 100_000;

/**
 * Builds display text, never replacement data or clipboard content. Only strings
 * that ultimately decode to an object/array are expanded, including multiple
 * encoding layers. Scalar-looking strings and quoted prose stay strings.
 *
 * Work is bounded across the whole preview, not per branch. If any limit is
 * reached, discard the entire preview and return the full supplied text.
 * @param params.text - Source JSON text (normally already formatted by usePrettyText).
 * @param params.maxDepth - Combined container nesting and decoding-layer limit.
 * @param params.maxNodes - Maximum total visited values.
 * @param params.maxParseAttempts - Maximum total parse attempts, including the root.
 * @param params.maxCharacters - Maximum cumulative parsed characters and output size.
 */
export function getJSONDisplayPreview({
  text,
  maxDepth = DEFAULT_MAX_DEPTH,
  maxNodes = DEFAULT_MAX_NODES,
  maxParseAttempts = DEFAULT_MAX_PARSE_ATTEMPTS,
  maxCharacters = DEFAULT_MAX_CHARACTERS,
}: {
  text: string;
  maxDepth?: number;
  maxNodes?: number;
  maxParseAttempts?: number;
  maxCharacters?: number;
}): { text: string; hasDecodedStrings: boolean } {
  const fallback = { text, hasDecodedStrings: false };
  let hasReachedLimit = false;
  let hasDecodedStrings = false;
  let visitedNodes = 0;
  let parseAttempts = 0;
  let parsedCharacters = 0;

  function parseCandidate(candidate: string): unknown {
    parseAttempts += 1;
    parsedCharacters += candidate.length;
    if (parseAttempts > maxParseAttempts || parsedCharacters > maxCharacters) {
      hasReachedLimit = true;
      return undefined;
    }
    const result = safelyParseJSON(candidate);
    return result.parseError ? undefined : result.json;
  }

  function visit({ value, depth }: { value: unknown; depth: number }): unknown {
    if (hasReachedLimit) return value;
    visitedNodes += 1;
    if (depth > maxDepth || visitedNodes > maxNodes) {
      hasReachedLimit = true;
      return value;
    }
    if (typeof value === "string") {
      let candidate: unknown = value;
      let decodingDepth = depth;
      while (typeof candidate === "string") {
        const firstCharacter = candidate.trimStart()[0];
        if (
          firstCharacter !== "{" &&
          firstCharacter !== "[" &&
          firstCharacter !== '"'
        ) {
          return value;
        }
        decodingDepth += 1;
        if (decodingDepth > maxDepth) {
          hasReachedLimit = true;
          return value;
        }
        candidate = parseCandidate(candidate);
        if (hasReachedLimit) return value;
        if (typeof candidate === "object" && candidate !== null) {
          hasDecodedStrings = true;
          return visit({ value: candidate, depth: decodingDepth });
        }
      }
      // Do not expose intermediate unquoting when it ended in a scalar/error.
      return value;
    }
    if (Array.isArray(value)) {
      if (value.length > maxNodes - visitedNodes) {
        hasReachedLimit = true;
        return value;
      }
      return value.map((item) => visit({ value: item, depth: depth + 1 }));
    }
    if (typeof value === "object" && value !== null) {
      const entries = Object.entries(value);
      if (entries.length > maxNodes - visitedNodes) {
        hasReachedLimit = true;
        return value;
      }
      // fromEntries creates own data properties, including __proto__; no
      // assignment into the source or an object's prototype is performed.
      return Object.fromEntries(
        entries.map(([key, item]) => [
          key,
          visit({ value: item, depth: depth + 1 }),
        ])
      );
    }
    return value;
  }

  const value = parseCandidate(text);
  if (value === undefined || hasReachedLimit) return fallback;
  const preview = visit({ value, depth: 0 });
  if (hasReachedLimit || !hasDecodedStrings) return fallback;
  const previewText = JSON.stringify(preview, null, 2);
  return previewText.length > maxCharacters
    ? fallback
    : { text: previewText, hasDecodedStrings: true };
}
