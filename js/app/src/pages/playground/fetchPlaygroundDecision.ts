import { fetchQuery, graphql } from "react-relay";

import { TemplateFormats } from "@phoenix/components/templateEditor/constants";
import type { TemplateFormat } from "@phoenix/components/templateEditor/types";
import { DEFAULT_MODEL_PROVIDER } from "@phoenix/constants/generativeConstants";
import RelayEnvironment from "@phoenix/RelayEnvironment";
import type {
  PlaygroundInstance,
  PlaygroundInstanceDecision,
} from "@phoenix/store/playground";
import { createDecisionTaskInstance } from "@phoenix/store/playground";
import { isModelProvider } from "@phoenix/utils/generativeUtils";

import type {
  fetchPlaygroundDecisionQuery,
  fetchPlaygroundDecisionQuery$data,
} from "./__generated__/fetchPlaygroundDecisionQuery.graphql";
import {
  type SavedDecisionVersion,
  savedDecisionVersionToDraft,
} from "./savedDecisionUtils";

const decisionVersionQuery = graphql`
  query fetchPlaygroundDecisionQuery(
    $decisionId: ID!
    $versionId: ID
    $tagName: Identifier
  ) {
    decision: node(id: $decisionId) {
      ... on Decision {
        id
        name
        version(versionId: $versionId, tagName: $tagName) {
          id
          modelProvider
          modelName
          customProvider {
            id
            name
          }
          state {
            __typename
            ... on DecisionInputState {
              input
            }
            ... on DecisionTextState {
              template
              templateFormat
            }
          }
          questions {
            __typename
            ... on DecisionPredicateQuestion {
              name
              instructions
              criteria {
                true
                false
              }
            }
            ... on DecisionChoiceQuestion {
              name
              instructions
              choices {
                value
                description
              }
            }
            ... on DecisionScaleQuestion {
              name
              instructions
              levels {
                label
                description
              }
            }
          }
        }
      }
    }
  }
`;

type FetchedVersion = NonNullable<
  NonNullable<fetchPlaygroundDecisionQuery$data["decision"]>["version"]
>;

/** The fetched version in the shape the editor-draft conversion reads. */
function toSavedVersion(version: FetchedVersion): SavedDecisionVersion {
  const state: SavedDecisionVersion["state"] =
    version.state.__typename === "DecisionInputState"
      ? { kind: "input", input: version.state.input }
      : version.state.__typename === "DecisionTextState"
        ? {
            kind: "text",
            template: version.state.template,
            templateFormat: version.state.templateFormat,
          }
        : { kind: "object" };
  const questions = version.questions.flatMap(
    (question): SavedDecisionVersion["questions"][number][] => {
      switch (question.__typename) {
        case "DecisionPredicateQuestion":
          return [
            {
              kind: "predicate",
              name: question.name,
              instructions: question.instructions,
              criteria: question.criteria ?? null,
            },
          ];
        case "DecisionChoiceQuestion":
          return [
            {
              kind: "choice",
              name: question.name,
              instructions: question.instructions,
              choices: question.choices,
            },
          ];
        case "DecisionScaleQuestion":
          return [
            {
              kind: "scale",
              name: question.name,
              instructions: question.instructions,
              levels: question.levels,
            },
          ];
        default:
          return [];
      }
    }
  );
  return { state, questions };
}

/** A saved decision version, as fetched: its definition and its model. */
export type FetchedDecisionVersion = {
  decision: Omit<PlaygroundInstanceDecision, "tag">;
  version: SavedDecisionVersion;
  modelProvider: string;
  modelName: string;
  customProvider: { id: string; name: string } | null;
};

/**
 * Fetches a saved decision's version, by version id or by tag; the latest
 * when neither is given. Null when the decision or the version is gone.
 */
export async function fetchDecisionVersion({
  decisionId,
  decisionVersionId = null,
  tagName = null,
}: {
  decisionId: string;
  decisionVersionId?: string | null;
  tagName?: string | null;
}): Promise<FetchedDecisionVersion | null> {
  const data = await fetchQuery<fetchPlaygroundDecisionQuery>(
    RelayEnvironment,
    decisionVersionQuery,
    { decisionId, versionId: decisionVersionId, tagName },
    { fetchPolicy: "network-only" }
  ).toPromise();
  const decision = data?.decision;
  const version = decision?.version;

  if (!decision?.id || !decision.name || !version) {
    return null;
  }

  return {
    decision: {
      id: decision.id,
      name: decision.name,
      versionId: version.id,
    },
    version: toSavedVersion(version),
    modelProvider: version.modelProvider,
    modelName: version.modelName,
    customProvider: version.customProvider ?? null,
  };
}

/**
 * The template format a version's state is written in, or null when it has
 * none (an input state reads the same in either).
 */
export function getDecisionTemplateFormat(
  fetched: Pick<FetchedDecisionVersion, "version">
): TemplateFormat | null {
  const { state } = fetched.version;

  if (state.kind !== "text") {
    return null;
  }

  return state.templateFormat === "F_STRING"
    ? TemplateFormats.FString
    : TemplateFormats.Mustache;
}

/**
 * The decision instance for a fetched version, written in the page's
 * template format. A base instance keeps what the version doesn't set: the
 * chat model the instance can switch back to, and the base URL of a provider
 * the version still uses.
 *
 * Throws when the page's format can't express the version's state; see
 * {@link savedDecisionVersionToDraft}.
 */
export function toDecisionInstance({
  fetched,
  tagName,
  templateFormat,
  base,
}: {
  fetched: FetchedDecisionVersion;
  tagName: string | null;
  templateFormat: TemplateFormat;
  base?: Pick<PlaygroundInstance, "model" | "llmModel">;
}): Omit<PlaygroundInstance, "id"> {
  const decisionRequest = savedDecisionVersionToDraft({
    version: fetched.version,
    templateFormat,
  });
  const provider = isModelProvider(fetched.modelProvider)
    ? fetched.modelProvider
    : (base?.model.provider ?? DEFAULT_MODEL_PROVIDER);
  const baseModel = base?.model.modelType === "DECISION" ? base.model : null;
  const instance = createDecisionTaskInstance({
    model: baseModel ?? undefined,
    llmModel: base?.llmModel ?? (baseModel ? undefined : base?.model),
  });

  return {
    ...instance,
    decisionRequest,
    decision: { ...fetched.decision, tag: tagName },
    model: {
      ...instance.model,
      provider,
      modelName: fetched.modelName,
      modelType: "DECISION",
      customProvider: fetched.customProvider,
      baseUrl:
        !fetched.customProvider && baseModel && provider === baseModel.provider
          ? (baseModel.baseUrl ?? null)
          : null,
    },
  };
}

/**
 * Fetches a saved decision version as the instance content to land with
 * `loadInstance`. Null when it no longer exists. Throws when the page's
 * template format can't express it.
 */
export async function fetchPlaygroundDecisionAsInstance({
  decisionId,
  decisionVersionId,
  tagName,
  templateFormat,
  base,
}: {
  decisionId: string;
  decisionVersionId?: string | null;
  tagName?: string | null;
  /** The page's format; the version's own when the page has no say. */
  templateFormat: TemplateFormat | null;
  base?: Pick<PlaygroundInstance, "model" | "llmModel">;
}): Promise<{
  instance: Omit<PlaygroundInstance, "id">;
  templateFormat: TemplateFormat;
} | null> {
  const fetched = await fetchDecisionVersion({
    decisionId,
    decisionVersionId,
    tagName,
  });

  if (!fetched) {
    return null;
  }

  const format =
    templateFormat ??
    getDecisionTemplateFormat(fetched) ??
    TemplateFormats.Mustache;

  return {
    instance: toDecisionInstance({
      fetched,
      tagName: tagName ?? null,
      templateFormat: format,
      base,
    }),
    templateFormat: format,
  };
}
