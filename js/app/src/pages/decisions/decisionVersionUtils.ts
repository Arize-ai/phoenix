/** The version fields whose content a definition comparison should show. */
export type DecisionVersionDefinition = {
  readonly templateFormat: string;
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
      templateFormat: version.templateFormat,
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
