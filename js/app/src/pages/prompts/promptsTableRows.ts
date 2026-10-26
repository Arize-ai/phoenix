import { isModelProvider } from "@phoenix/utils/generativeUtils";

export type PromptsTableRowKind = "prompt" | "decision";

type User = {
  readonly username: string;
  readonly profilePictureUrl: string | null;
} | null;

type Label = {
  readonly id: string;
  readonly name: string;
  readonly color: string | null;
};

type Version = {
  readonly id: string;
  readonly createdAt: string;
  readonly modelName: string;
  readonly modelProvider: string;
};

type CommonFields = {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly createdBy: User;
  readonly updatedBy: User;
  readonly versionCount: number;
  readonly labels: readonly Label[];
};

/**
 * The shape of one node of the combined prompts and decisions connection, as
 * the prompts table selects it
 */
export type PromptsTableNode =
  | (CommonFields & {
      readonly __typename: "Prompt";
      readonly version: Version;
      readonly versionTags: readonly {
        readonly id: string;
        readonly name: string;
        readonly promptVersionId: string;
      }[];
    })
  | (CommonFields & {
      readonly __typename: "Decision";
      readonly updatedAt: string;
      readonly latestVersion: Version | null;
      readonly versionTags: readonly {
        readonly id: string;
        readonly name: string;
        readonly decisionVersionId: string;
      }[];
    })
  | { readonly __typename: "%other" };

export type PromptsTableRow = {
  kind: PromptsTableRowKind;
  id: string;
  name: string;
  description: string | null;
  createdBy: User;
  updatedBy: User;
  versionCount: number;
  labels: readonly Label[];
  modelName: string | null;
  /**
   * The provider of the latest version, when it is one the app has an icon for
   */
  modelProvider: ModelProvider | null;
  latestVersionId: string | null;
  lastUpdatedAt: string;
  versionTags: { id: string; name: string; versionId: string }[];
};

/**
 * Normalizes prompts and decisions into one row shape for the prompts table.
 * Nodes of unknown types are skipped.
 */
export function toPromptsTableRows(
  nodes: readonly PromptsTableNode[]
): PromptsTableRow[] {
  const rows: PromptsTableRow[] = [];
  for (const node of nodes) {
    if (node.__typename === "%other") {
      continue;
    }
    const common = {
      id: node.id,
      name: node.name,
      // An emptied description reads as no description
      description: node.description || null,
      createdBy: node.createdBy,
      updatedBy: node.updatedBy,
      versionCount: node.versionCount,
      labels: node.labels,
    };
    const version =
      node.__typename === "Prompt" ? node.version : node.latestVersion;
    const modelProvider =
      version && isModelProvider(version.modelProvider)
        ? version.modelProvider
        : null;
    if (node.__typename === "Prompt") {
      rows.push({
        ...common,
        kind: "prompt",
        modelName: node.version.modelName,
        modelProvider,
        latestVersionId: node.version.id,
        lastUpdatedAt: node.version.createdAt,
        versionTags: node.versionTags.map((tag) => ({
          id: tag.id,
          name: tag.name,
          versionId: tag.promptVersionId,
        })),
      });
    } else {
      rows.push({
        ...common,
        kind: "decision",
        modelName: version?.modelName ?? null,
        modelProvider,
        latestVersionId: version?.id ?? null,
        lastUpdatedAt: version?.createdAt ?? node.updatedAt,
        versionTags: node.versionTags.map((tag) => ({
          id: tag.id,
          name: tag.name,
          versionId: tag.decisionVersionId,
        })),
      });
    }
  }
  return rows;
}
