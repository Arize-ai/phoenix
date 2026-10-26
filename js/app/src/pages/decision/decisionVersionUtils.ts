/** The version fields whose content a definition comparison should show. */
export type DecisionVersionDefinition = {
  readonly inputs: ReadonlyArray<unknown>;
  readonly state: unknown;
  readonly questions: ReadonlyArray<unknown>;
  readonly modelName: string;
  readonly modelProvider: string;
  readonly customProvider: {
    readonly id: string;
    readonly name: string;
  } | null;
};

/** Serialize definition content without version IDs, authors, timestamps, or tags. */
export function decisionVersionToText(
  version: DecisionVersionDefinition
): string {
  return JSON.stringify(
    {
      inputs: version.inputs,
      state: version.state,
      questions: version.questions,
      modelProvider: version.modelProvider,
      modelName: version.modelName,
      customProvider: version.customProvider,
    },
    (key, value: unknown) => (key === "__typename" ? undefined : value),
    2
  );
}

const RUN_DECISION_VERSION_MUTATION =
  "mutation RunSavedDecision($id: ID!, $values: JSON!) { runDecisionVersion(input: {decisionVersionId: $id, inputValues: $values}) { result { model answers { name ... on PredicateAnswer { probability } ... on ChoiceAnswer { choice confidence } ... on ScaleAnswer { expectedLevel confidence } } } error } }";

/**
 * A curl command that runs a saved decision version through the GraphQL API,
 * with a `<name>` placeholder for each of the version's inputs.
 */
export function buildRunDecisionVersionCurl({
  versionId,
  inputNames,
}: {
  versionId: string;
  inputNames: readonly string[];
}): string {
  const values = Object.fromEntries(
    inputNames.map((name) => [name, `<${name}>`])
  );
  const request = JSON.stringify({
    query: RUN_DECISION_VERSION_MUTATION,
    variables: { id: versionId, values },
  });
  return `curl "$PHOENIX_ENDPOINT/graphql" \\\n  -H 'Content-Type: application/json' \\\n  --data '${request.replaceAll("'", "'\\''")}'`;
}
