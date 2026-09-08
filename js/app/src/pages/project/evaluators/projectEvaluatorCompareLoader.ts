import { fetchQuery, graphql, loadQuery } from "react-relay";
import type { LoaderFunctionArgs } from "react-router";
import invariant from "tiny-invariant";

import {
  PROJECT_EVALUATOR_COMPARE_A_PARAM,
  PROJECT_EVALUATOR_COMPARE_B_PARAM,
} from "@phoenix/constants/searchParams";
import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { projectEvaluatorCompareLoaderQuery } from "./__generated__/projectEvaluatorCompareLoaderQuery.graphql";

export const projectEvaluatorCompareLoaderGQL = graphql`
  query projectEvaluatorCompareLoaderQuery(
    $evaluatorAId: ID!
    $evaluatorBId: ID!
  ) {
    evaluatorA: node(id: $evaluatorAId) {
      __typename
      ... on ProjectEvaluator {
        id
        name
        evaluationTarget
        project {
          id
        }
      }
    }
    evaluatorB: node(id: $evaluatorBId) {
      __typename
      ... on ProjectEvaluator {
        id
        name
        evaluationTarget
        project {
          id
        }
      }
    }
  }
`;

export type ProjectEvaluatorCompareInvalidReason =
  | "missing"
  | "same"
  | "not-found"
  | "other-project"
  | "different-target";

export type ProjectEvaluatorCompareLoaderData = Awaited<
  ReturnType<typeof projectEvaluatorCompareLoader>
>;

export async function projectEvaluatorCompareLoader({
  params,
  request,
}: LoaderFunctionArgs): Promise<{
  queryRef: ReturnType<
    typeof loadQuery<projectEvaluatorCompareLoaderQuery>
  > | null;
  invalidReason: ProjectEvaluatorCompareInvalidReason | null;
  evaluatorAName: string | null;
  evaluatorBName: string | null;
  evaluatorAId: string | null;
  evaluatorBId: string | null;
}> {
  invariant(params.projectId, "projectId is required");
  const searchParams = new URL(request.url).searchParams;
  const evaluatorAId = searchParams.get(PROJECT_EVALUATOR_COMPARE_A_PARAM);
  const evaluatorBId = searchParams.get(PROJECT_EVALUATOR_COMPARE_B_PARAM);
  const invalid = (invalidReason: ProjectEvaluatorCompareInvalidReason) => ({
    queryRef: null,
    invalidReason,
    evaluatorAName: null,
    evaluatorBName: null,
    evaluatorAId,
    evaluatorBId,
  });
  if (!evaluatorAId || !evaluatorBId) {
    return invalid("missing");
  }
  if (evaluatorAId === evaluatorBId) {
    return invalid("same");
  }

  const variables = { evaluatorAId, evaluatorBId };
  let data: projectEvaluatorCompareLoaderQuery["response"] | undefined;
  try {
    data = await fetchQuery<projectEvaluatorCompareLoaderQuery>(
      RelayEnvironment,
      projectEvaluatorCompareLoaderGQL,
      variables
    ).toPromise();
  } catch {
    return invalid("not-found");
  }
  const evaluatorA =
    data?.evaluatorA?.__typename === "ProjectEvaluator"
      ? data.evaluatorA
      : null;
  const evaluatorB =
    data?.evaluatorB?.__typename === "ProjectEvaluator"
      ? data.evaluatorB
      : null;
  if (!evaluatorA || !evaluatorB) {
    return invalid("not-found");
  }
  if (
    evaluatorA.project.id !== params.projectId ||
    evaluatorB.project.id !== params.projectId
  ) {
    return invalid("other-project");
  }
  if (evaluatorA.evaluationTarget !== evaluatorB.evaluationTarget) {
    return invalid("different-target");
  }

  return {
    queryRef: loadQuery<projectEvaluatorCompareLoaderQuery>(
      RelayEnvironment,
      projectEvaluatorCompareLoaderGQL,
      variables
    ),
    invalidReason: null,
    evaluatorAName: evaluatorA.name,
    evaluatorBName: evaluatorB.name,
    evaluatorAId,
    evaluatorBId,
  };
}
