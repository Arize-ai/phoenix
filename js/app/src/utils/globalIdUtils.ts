/**
 * Utilities for Relay / Strawberry GraphQL global node IDs.
 *
 * A global node ID is the standard base64 encoding of `"<TypeName>:<nodeId>"`
 * — e.g. `btoa("Span:123")`. These helpers mirror the backend global-ID
 * parsing in `phoenix/server/api/types/node.py`: they decode the ID and inspect
 * the encoded type, rather than matching a regex against the opaque encoded
 * string (which cannot tell you what type an ID refers to). Expected-type
 * checks raise the same shape of error the server returns.
 */

export type GlobalId = {
  /** The GraphQL type name encoded in the ID, e.g. `"Span"`. */
  typeName: string;
  /** The node's row identifier, kept as a string (it is not always numeric). */
  nodeId: string;
};

const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

/**
 * Decodes a canonical standard-base64 string, returning `null` when the input
 * is not valid base64 or is a non-canonical encoding (e.g. stray padding).
 * Requiring a canonical round-trip stops loosely shaped strings from being
 * mistaken for encoded IDs.
 */
function decodeCanonicalBase64(value: string): string | null {
  if (!BASE64_PATTERN.test(value) || value.length % 4 === 1) {
    return null;
  }
  const padded = value.padEnd(
    value.length + ((4 - (value.length % 4)) % 4),
    "="
  );
  try {
    const decoded = globalThis.atob(padded);
    const canonical = globalThis.btoa(decoded);
    if (value !== canonical && value !== canonical.replace(/=+$/, "")) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Decodes a base64 global node ID into its `{ typeName, nodeId }` parts, or
 * returns `null` when the value is not a valid `"<TypeName>:<nodeId>"` ID.
 *
 * Only the first colon separates the type name from the node id (mirroring
 * Strawberry's `GlobalID`), so node ids may themselves contain colons.
 */
export function parseGlobalId(globalId: string): GlobalId | null {
  const decoded = decodeCanonicalBase64(globalId.trim());
  if (decoded === null) {
    return null;
  }
  const separatorIndex = decoded.indexOf(":");
  if (separatorIndex <= 0 || separatorIndex === decoded.length - 1) {
    return null;
  }
  return {
    typeName: decoded.slice(0, separatorIndex),
    nodeId: decoded.slice(separatorIndex + 1),
  };
}

/** Returns whether `globalId` is a valid global node ID of `expectedTypeName`. */
export function isGlobalIdOfType(
  globalId: string,
  expectedTypeName: string
): boolean {
  return parseGlobalId(globalId)?.typeName === expectedTypeName;
}

/**
 * Decodes a global node ID, requiring it to be of `expectedTypeName`. Throws a
 * descriptive error — mirroring the backend's `from_global_id_with_expected_type`
 * — when the value is malformed or the type does not match.
 */
export function fromGlobalIdWithExpectedType(
  globalId: string,
  expectedTypeName: string
): GlobalId {
  const parsed = parseGlobalId(globalId);
  if (parsed === null) {
    throw new Error(`Invalid global node ID: ${globalId}`);
  }
  if (parsed.typeName !== expectedTypeName) {
    throw new Error(
      `The node id must correspond to a node of type ${expectedTypeName}, ` +
        `but instead corresponds to a node of type: ${parsed.typeName}`
    );
  }
  return parsed;
}

/** Encodes a `{ typeName, nodeId }` pair into a base64 global node ID. */
export function toGlobalId(typeName: string, nodeId: string | number): string {
  return globalThis.btoa(`${typeName}:${nodeId}`);
}
