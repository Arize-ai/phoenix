const BASE64_BODY_PATTERN = /^[A-Za-z0-9+/]+$/;

export interface RelayGlobalId {
  typeName: string;
  nodeId: string;
}

function decodeBase64(value: string): string | null {
  const unpaddedValue = value.replace(/=+$/, "");
  if (!unpaddedValue || !BASE64_BODY_PATTERN.test(unpaddedValue)) {
    return null;
  }

  const paddingLength = (4 - (unpaddedValue.length % 4)) % 4;
  const normalizedValue = `${unpaddedValue}${"=".repeat(paddingLength)}`;

  try {
    const decodedValue = Buffer.from(normalizedValue, "base64").toString(
      "utf8"
    );
    const reEncodedValue = Buffer.from(decodedValue, "utf8")
      .toString("base64")
      .replace(/=+$/, "");

    return reEncodedValue === unpaddedValue ? decodedValue : null;
  } catch {
    return null;
  }
}

export function getNormalizedIdentifier(identifier: string): string {
  return identifier.trim();
}

/**
 * Require a non-empty identifier value and return it trimmed.
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
 * Resolve a preferred identifier, optionally falling back to a legacy field.
 */
export function requirePreferredIdentifier({
  identifier,
  legacyIdentifier,
  label,
  legacyLabel,
}: {
  identifier?: string;
  legacyIdentifier?: string;
  label: string;
  legacyLabel: string;
}): string {
  const normalizedIdentifier = identifier?.trim() || legacyIdentifier?.trim();
  if (!normalizedIdentifier) {
    throw new Error(`${label} or legacy ${legacyLabel} is required`);
  }

  return normalizedIdentifier;
}

/**
 * Parse a Relay GlobalID into its `TypeName:nodeId` components.
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
  if (
    separatorIndex <= 0 ||
    separatorIndex === decodedIdentifier.length - 1
  ) {
    return null;
  }

  return {
    typeName: decodedIdentifier.slice(0, separatorIndex),
    nodeId: decodedIdentifier.slice(separatorIndex + 1),
  };
}

/**
 * Return the normalized Relay GlobalID when it matches the expected type.
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
