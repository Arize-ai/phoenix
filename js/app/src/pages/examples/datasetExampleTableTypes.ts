export type DatasetExampleTableRow = {
  id: string;
  externalId: string | null;
  splits: readonly {
    readonly id: string;
    readonly name: string;
    readonly color: string;
  }[];
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  metadata: Record<string, unknown>;
  isNew: boolean;
};
