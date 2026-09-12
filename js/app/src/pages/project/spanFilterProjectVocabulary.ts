import { fetchQuery, graphql } from "relay-runtime";

import environment from "@phoenix/RelayEnvironment";

import type { spanFilterProjectVocabularyQuery } from "./__generated__/spanFilterProjectVocabularyQuery.graphql";
import { getNonNoteAnnotationNames } from "./spanAnnotationUtils";

/** The names a project's data gives a span filter to reference. */
export type SpanFilterProjectVocabulary = {
  /** Names usable as `annotations['<name>']`. */
  spanAnnotationNames: string[];
  /** Names usable as `trace_annotations['<name>']`. */
  traceAnnotationNames: string[];
  /** Models usable as `llm.model_name == '<name>'`; empty unless requested. */
  modelNames: string[];
};

/** Model usage is summarized from this instant on when models are requested. */
const MODEL_USAGE_START = "1970-01-01T00:00:00Z";

/**
 * Fetches the names that exist on a project's spans so a filter can be written
 * against real values rather than guessed ones. The typeahead reads the
 * annotation names; the agent's filter help also reads the model names.
 * Notes are a pseudo-annotation and are hidden from every annotation-name surface.
 */
export async function fetchSpanFilterProjectVocabulary({
  projectId,
  includeModels = false,
}: {
  projectId: string;
  includeModels?: boolean;
}): Promise<SpanFilterProjectVocabulary> {
  const data = await fetchQuery<spanFilterProjectVocabularyQuery>(
    environment,
    graphql`
      query spanFilterProjectVocabularyQuery(
        $id: ID!
        $includeModels: Boolean!
        $modelUsageStart: DateTime!
      ) {
        project: node(id: $id) {
          ... on Project {
            spanAnnotationNames
            traceAnnotationsNames
            topModelsByTokenCount(timeRange: { start: $modelUsageStart })
              @include(if: $includeModels) {
              name
            }
          }
        }
      }
    `,
    { id: projectId, includeModels, modelUsageStart: MODEL_USAGE_START }
  ).toPromise();
  const project = data?.project;

  return {
    spanAnnotationNames: getNonNoteAnnotationNames(
      project?.spanAnnotationNames ?? []
    ),
    traceAnnotationNames: getNonNoteAnnotationNames(
      project?.traceAnnotationsNames ?? []
    ),
    modelNames: project?.topModelsByTokenCount?.map(({ name }) => name) ?? [],
  };
}
