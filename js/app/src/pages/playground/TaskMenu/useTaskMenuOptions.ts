import { graphql, useLazyLoadQuery } from "react-relay";

import type { PromptData } from "@phoenix/pages/playground/PromptMenu";

import type { useTaskMenuOptionsDecisionsQuery } from "./__generated__/useTaskMenuOptionsDecisionsQuery.graphql";
import type { useTaskMenuOptionsEvaluatorsQuery } from "./__generated__/useTaskMenuOptionsEvaluatorsQuery.graphql";
import type { useTaskMenuOptionsPromptsQuery } from "./__generated__/useTaskMenuOptionsPromptsQuery.graphql";
import type {
  TaskMenuDecision,
  TaskMenuEvaluator,
  TaskMenuPrompt,
} from "./taskMenuItems";

/** What a task menu lists: saved prompts with their versions, their menu items, decisions, and evaluators. */
export type TaskMenuOptions = {
  prompts: PromptData[];
  promptItems: TaskMenuPrompt[];
  decisions: TaskMenuDecision[];
  evaluators: TaskMenuEvaluator[];
};

/**
 * The saved prompts, decisions and evaluators a task menu lists. Prompts come
 * with their versions for the version picker and are filtered client-side;
 * decisions and evaluators are searched on the server. Separate queries, so
 * typing a search does not refetch every prompt.
 */
export function useTaskMenuOptions({
  includePrompts,
  includeDecisions,
  includeEvaluators,
  search,
  promptsFetchKey,
  evaluatorsFetchKey,
}: {
  includePrompts: boolean;
  includeDecisions: boolean;
  includeEvaluators: boolean;
  search: string;
  /** Bump to refetch the prompts, e.g. after a save adds a version. */
  promptsFetchKey?: string;
  /**
   * Bump to refetch the decisions and evaluators. The menus bump it on every
   * opening, so a save or a rename made since the last opening shows.
   */
  evaluatorsFetchKey?: string | number;
}): TaskMenuOptions {
  const promptsData = useLazyLoadQuery<useTaskMenuOptionsPromptsQuery>(
    graphql`
      query useTaskMenuOptionsPromptsQuery($includePrompts: Boolean!) {
        prompts(first: 200) @include(if: $includePrompts) {
          edges {
            prompt: node {
              __typename
              ... on Prompt {
                id
                name
                versionTags {
                  name
                }
                promptVersions {
                  versions: edges {
                    version: node {
                      id
                      createdAt
                      description
                      isLatest
                      tags {
                        name
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `,
    { includePrompts },
    { fetchPolicy: "store-and-network", fetchKey: promptsFetchKey }
  );

  const decisionsData = useLazyLoadQuery<useTaskMenuOptionsDecisionsQuery>(
    graphql`
      query useTaskMenuOptionsDecisionsQuery(
        $filter: DecisionFilter
        $includeDecisions: Boolean!
      ) {
        decisions(first: 50, filter: $filter) @include(if: $includeDecisions) {
          edges {
            node {
              id
              name
            }
          }
        }
      }
    `,
    {
      includeDecisions,
      filter: search ? { col: "name", value: search } : null,
    },
    { fetchPolicy: "store-and-network", fetchKey: evaluatorsFetchKey }
  );

  const evaluatorsData = useLazyLoadQuery<useTaskMenuOptionsEvaluatorsQuery>(
    graphql`
      query useTaskMenuOptionsEvaluatorsQuery(
        $filter: EvaluatorFilter
        $includeEvaluators: Boolean!
      ) {
        evaluators(first: 50, filter: $filter)
          @include(if: $includeEvaluators) {
          edges {
            node {
              id
              name
              kind
              isBuiltin
            }
          }
        }
      }
    `,
    {
      includeEvaluators,
      filter: search ? { col: "name", value: search } : null,
    },
    { fetchPolicy: "store-and-network", fetchKey: evaluatorsFetchKey }
  );

  const prompts: PromptData[] = (promptsData.prompts?.edges ?? []).map(
    ({ prompt }) => ({
      id: prompt.id,
      name: prompt.name,
      versionTags: prompt.versionTags ?? [],
      versions: (prompt.promptVersions?.versions ?? []).map(({ version }) => ({
        id: version.id,
        createdAt: version.createdAt,
        description: version.description ?? null,
        isLatest: version.isLatest,
        tags: version.tags,
      })),
    })
  );

  const promptItems: TaskMenuPrompt[] = prompts.map((prompt) => ({
    id: prompt.id,
    name: prompt.name,
    // Use isLatest when marked, else the first in the list.
    latestVersionId:
      (
        prompt.versions.find((version) => version.isLatest) ??
        prompt.versions[0]
      )?.id ?? null,
  }));

  const decisions: TaskMenuDecision[] = (
    decisionsData.decisions?.edges ?? []
  ).map(({ node }) => ({ id: node.id, name: node.name }));

  const evaluators: TaskMenuEvaluator[] = (
    evaluatorsData.evaluators?.edges ?? []
  ).flatMap(({ node }) =>
    // Built-ins have no draft to edit; the menu offers what the editor opens.
    !node.isBuiltin && (node.kind === "LLM" || node.kind === "CODE")
      ? [{ id: node.id, name: node.name, kind: node.kind }]
      : []
  );

  return { prompts, promptItems, decisions, evaluators };
}
