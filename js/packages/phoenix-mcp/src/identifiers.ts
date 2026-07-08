/**
 * Parsed components of a Relay GlobalID.
 *
 * Relay GlobalIDs encode a `TypeName:nodeId` pair as base64.
 */
export interface RelayGlobalId {
  typeName: string;
  nodeId: string;
}

/**
 * Attempt to decode a base64 string, returning `null` when the input
 * is not valid base64 or cannot round-trip cleanly.
 */
function decodeBase64(value: string): string | null {
  try {
    const decoded = Buffer.from(value, "base64").toString("utf8");
    // Round-trip: re-encode and compare (ignoring padding) to reject
    // strings that happen to survive lossy base64 decoding.
    const reEncoded = Buffer.from(decoded, "utf8")
      .toString("base64")
      .replace(/=+$/, "");
    const unpadded = value.replace(/=+$/, "");
    return reEncoded === unpadded ? decoded : null;
  } catch {
    return null;
  }
}

/**
 * Trim surrounding whitespace from an identifier string.
 */
function getNormalizedIdentifier(identifier: string): string {
  return identifier.trim();
}

/**
 * Require a non-empty identifier value and return it trimmed.
 *
 * @param options.identifier - The raw identifier string to validate.
 * @param options.label - A human-readable label used in the error message
 *   (e.g. `"projectIdentifier"`).
 * @throws When the identifier is empty or whitespace-only.
 */
export function requireIdentifier({
  identifier,
  label,
}: {
  identifier: string;
  label: string;
}): string {
  const normalizedIdentifier = getNormalizedIdentifier(identifier);
  if (!normalizedIdentifier) {
    throw new Error(`${label} is required`);
  }

  return normalizedIdentifier;
}

/**
 * Parse a Relay GlobalID into its `TypeName:nodeId` components.
 *
 * @returns The parsed components, or `null` if the string is not a valid Relay GlobalID.
 */
export function parseRelayGlobalId(identifier: string): RelayGlobalId | null {
  const normalizedIdentifier = getNormalizedIdentifier(identifier);
  if (!normalizedIdentifier) {
    return null;
  }

  const decodedIdentifier = decodeBase64(normalizedIdentifier);
  if (!decodedIdentifier) {
    return null;
  }

  const separatorIndex = decodedIdentifier.indexOf(":");
  if (separatorIndex <= 0 || separatorIndex === decodedIdentifier.length - 1) {
    return null;
  }

  return {
    typeName: decodedIdentifier.slice(0, separatorIndex),
    nodeId: decodedIdentifier.slice(separatorIndex + 1),
  };
}

/**
 * Return the normalized Relay GlobalID when it matches the expected type,
 * or `null` otherwise.
 *
 * Useful for distinguishing a human-readable name from a Relay ID so that
 * the correct API call path can be chosen.
 */
export function getRelayGlobalIdIfType({
  identifier,
  expectedTypeName,
}: {
  identifier: string;
  expectedTypeName: string;
}): string | null {
  const normalizedIdentifier = getNormalizedIdentifier(identifier);
  const relayGlobalId = parseRelayGlobalId(normalizedIdentifier);

  return relayGlobalId?.typeName === expectedTypeName
    ? normalizedIdentifier
    : null;
}
