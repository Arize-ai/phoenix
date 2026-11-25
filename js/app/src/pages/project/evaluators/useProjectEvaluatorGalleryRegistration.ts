import { useContext, useEffect, useRef } from "react";
import { fetchQuery, graphql, useRelayEnvironment } from "react-relay";
import { useNavigate } from "react-router";
import invariant from "tiny-invariant";

import {
  createOpenProjectEvaluatorGalleryItemClientAction,
  createReadProjectEvaluatorGalleryClientAction,
  type GalleryItemToOpen,
  type ProjectEvaluatorGalleryHost,
  type ProjectEvaluatorGalleryListing,
  type ProjectEvaluatorGalleryTemplateDetails,
} from "@phoenix/agent/tools/projectEvaluatorGallery";
import { registerUIOperations } from "@phoenix/agent/uiOperations/catalog";
import {
  openProjectEvaluatorGalleryItemOperation,
  readProjectEvaluatorGalleryOperation,
} from "@phoenix/agent/uiOperations/operations/projectEvaluator";
import { markRouteChanged } from "@phoenix/agent/uiOperations/routeSettle";
import { AgentContext } from "@phoenix/contexts/AgentContext";
import type { projectEvaluatorTemplatesQuery as ProjectEvaluatorTemplatesQueryType } from "@phoenix/pages/project/evaluators/__generated__/projectEvaluatorTemplatesQuery.graphql";
import type { useProjectEvaluatorGalleryRegistrationQuery as GalleryCustomEvaluatorsQueryType } from "@phoenix/pages/project/evaluators/__generated__/useProjectEvaluatorGalleryRegistrationQuery.graphql";
import {
  type CustomEvaluator,
  getCustomEvaluatorKind,
  getGalleryItemCreationPath,
  isGalleryCustomEvaluator,
} from "@phoenix/pages/project/evaluators/projectEvaluatorGallerySelection";
import { useProjectEvaluatorCreationPaths } from "@phoenix/pages/project/evaluators/projectEvaluatorPaths";
import {
  getProjectEvaluatorTemplateCategoryLabel,
  getProjectEvaluatorTemplateChoices,
  getProjectEvaluatorTemplateDefaults,
  getProjectEvaluatorTemplateMessages,
  type ProjectEvaluatorTemplate,
  projectEvaluatorTemplatesQuery,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTemplates";

// The same custom evaluators the gallery modal lists: saved evaluators not
// yet on this project, newest first.
const galleryCustomEvaluatorsQuery = graphql`
  query useProjectEvaluatorGalleryRegistrationQuery($projectId: ID!) {
    evaluators(
      first: 100
      sort: { col: updatedAt, dir: desc }
      excludeProjectId: $projectId
    ) {
      edges {
        evaluator: node {
          __typename
          id
          name
          description
        }
      }
    }
  }
`;

/** A template as its card and details pane show it. */
export function toGalleryTemplateDetails(
  template: ProjectEvaluatorTemplate
): ProjectEvaluatorGalleryTemplateDetails {
  const { targetType, filterCondition, inputMapping } =
    getProjectEvaluatorTemplateDefaults(template);
  return {
    name: template.name,
    kind: "LLM",
    category: getProjectEvaluatorTemplateCategoryLabel(template.category),
    description: template.description ?? null,
    targetType,
    filterCondition,
    inputs: (template.inputs ?? []).map((input) => ({
      name: input.name,
      description: input.description ?? null,
      defaultPath: inputMapping.pathMapping[input.name] ?? null,
    })),
    labels: getProjectEvaluatorTemplateChoices(template),
    optimizationDirection: template.optimizationDirection,
    details: template.details ?? null,
    promptMessages: getProjectEvaluatorTemplateMessages(template).map(
      ({ role, content }) => ({ role, content })
    ),
  };
}

/**
 * Lets PXI read the evaluator gallery and start a project evaluator from one
 * of its cards. Opening a card navigates to the creation form the card
 * opens, so the form's own operations (scope, edit, bench, submit) take
 * over; nothing here saves.
 */
export function useProjectEvaluatorGalleryRegistration({
  projectId,
}: {
  projectId: string;
}) {
  const agentStore = useContext(AgentContext);
  const environment = useRelayEnvironment();
  const navigate = useNavigate();
  const creationPaths = useProjectEvaluatorCreationPaths();
  const latestRef = useRef({ navigate, creationPaths });
  // eslint-disable-next-line react/refs
  latestRef.current = { navigate, creationPaths };
  useEffect(() => {
    if (!agentStore) {
      return undefined;
    }
    // Which card a custom evaluator is, for the path its card opens.
    let typenamesById = new Map<string, CustomEvaluator["__typename"]>();
    const loadListing = async (): Promise<ProjectEvaluatorGalleryListing> => {
      const [templateData, customData] = await Promise.all([
        fetchQuery<ProjectEvaluatorTemplatesQueryType>(
          environment,
          projectEvaluatorTemplatesQuery,
          {},
          { fetchPolicy: "store-or-network" }
        ).toPromise(),
        // Attaching elsewhere changes which evaluators this project can
        // reuse, so this list is always fresh.
        fetchQuery<GalleryCustomEvaluatorsQueryType>(
          environment,
          galleryCustomEvaluatorsQuery,
          { projectId },
          { fetchPolicy: "network-only" }
        ).toPromise(),
      ]);
      const customEvaluators = (customData?.evaluators.edges ?? [])
        .map(({ evaluator }) => evaluator)
        .filter(isGalleryCustomEvaluator);
      typenamesById = new Map(
        customEvaluators.map((evaluator) => [
          evaluator.id,
          evaluator.__typename,
        ])
      );
      return {
        templates: (templateData?.evaluatorGalleryConfigs ?? []).map(
          toGalleryTemplateDetails
        ),
        customEvaluators: customEvaluators.map((evaluator) => {
          const kind = getCustomEvaluatorKind(evaluator);
          return {
            evaluatorId: evaluator.id,
            name: evaluator.name,
            kind,
            description: evaluator.description ?? null,
            opensAs: kind === "LLM" ? "copy" : "attach",
          };
        }),
      };
    };
    // Items are resolved against the listing just loaded, so it holds them.
    const getTypename = (evaluatorId: string) => {
      const typename = typenamesById.get(evaluatorId);
      invariant(typename, `${evaluatorId} is not in the gallery listing`);
      return typename;
    };
    const openItem = (item: GalleryItemToOpen): string => {
      const { navigate: navigateTo, creationPaths: paths } = latestRef.current;
      const path = getGalleryItemCreationPath({
        item:
          item.kind === "template"
            ? { kind: "template", template: item.template }
            : {
                kind: "custom",
                evaluator: {
                  id: item.evaluator.evaluatorId,
                  __typename: getTypename(item.evaluator.evaluatorId),
                },
              },
        creationPaths: paths,
      });
      // Opens the window in which the form's operations are waited for, so
      // the script's next call does not race the form's mount.
      markRouteChanged();
      navigateTo(path);
      return path;
    };
    let host: ProjectEvaluatorGalleryHost | null = { loadListing, openItem };
    const getHost = () => host;
    const unregister = registerUIOperations({
      agentStore,
      operations: [
        {
          descriptor: readProjectEvaluatorGalleryOperation,
          handler: createReadProjectEvaluatorGalleryClientAction({ getHost }),
        },
        {
          descriptor: openProjectEvaluatorGalleryItemOperation,
          handler: createOpenProjectEvaluatorGalleryItemClientAction({
            getHost,
            shouldAutoAccept: () =>
              agentStore.getState().permissions.edits === "bypass",
          }),
        },
      ],
    });
    return () => {
      host = null;
      unregister();
    };
  }, [agentStore, environment, projectId]);
}
