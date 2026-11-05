/**
 * The places a provider credential can be set, in the order the server uses
 * them. The server resolves each key on its own, so one request can combine
 * keys from different sources.
 */
export const CREDENTIAL_SOURCES = ["browser", "secret", "environment"] as const;

export type CredentialSource = (typeof CREDENTIAL_SOURCES)[number];

export const CREDENTIAL_SOURCE_NAMES: Record<CredentialSource, string> = {
  browser: "This browser",
  secret: "Phoenix secret",
  environment: "Environment variable",
};

export type CredentialRequirement = {
  readonly envVarName: string;
  readonly isRequired: boolean;
};

/** The names of the keys each source sets. */
export type CredentialPresence = Record<CredentialSource, ReadonlySet<string>>;

export type SourceCompleteness =
  | { state: "set" }
  | { state: "partial"; setCount: number; requiredCount: number }
  | { state: "unset" };

function requiredKeys(requirements: readonly CredentialRequirement[]) {
  const required = requirements.filter(({ isRequired }) => isRequired);
  return required.length > 0 ? required : requirements;
}

/**
 * Whether one source sets a whole credential. Optional keys, such as an AWS
 * session token, make a source neither more nor less complete.
 */
export function getSourceCompleteness(
  requirements: readonly CredentialRequirement[],
  setKeys: ReadonlySet<string>
): SourceCompleteness {
  const required = requiredKeys(requirements);
  const setCount = required.filter(({ envVarName }) =>
    setKeys.has(envVarName)
  ).length;
  if (setCount === required.length && setCount > 0) {
    return { state: "set" };
  }
  if (requirements.some(({ envVarName }) => setKeys.has(envVarName))) {
    return { state: "partial", setCount, requiredCount: required.length };
  }
  return { state: "unset" };
}

/**
 * What a request would get, warned about when it may not work: a required
 * key set nowhere while others are set, or keys drawn from different
 * sources, which must still belong to one credential. Nothing set at all is
 * not warned about: a provider with a default credential chain uses it then,
 * but explicit keys, even incomplete ones, replace that chain.
 */
export function getCredentialWarnings({
  requirements,
  presence,
}: {
  requirements: readonly CredentialRequirement[];
  presence: CredentialPresence;
}): string[] {
  const resolvedSource = new Map<string, CredentialSource>();
  for (const { envVarName } of requirements) {
    const source = CREDENTIAL_SOURCES.find((candidate) =>
      presence[candidate].has(envVarName)
    );
    if (source) {
      resolvedSource.set(envVarName, source);
    }
  }
  if (resolvedSource.size === 0) {
    return [];
  }
  const warnings: string[] = [];
  const missing = requiredKeys(requirements)
    .map(({ envVarName }) => envVarName)
    .filter((envVarName) => !resolvedSource.has(envVarName));
  if (missing.length > 0) {
    const keys = missing.join(" and ");
    const verb = missing.length === 1 ? "isn't" : "aren't";
    warnings.push(
      `${keys} ${verb} set anywhere. Requests will fail until ${missing.length === 1 ? "it is" : "they are"} set.`
    );
  }
  const sources = CREDENTIAL_SOURCES.filter((source) =>
    [...resolvedSource.values()].includes(source)
  );
  if (sources.length > 1) {
    const names = sources
      .map((source) => CREDENTIAL_SOURCE_NAMES[source])
      .join(", ");
    warnings.push(
      `These keys come from different places (${names}). They must belong to the same credential.`
    );
  }
  return warnings;
}
