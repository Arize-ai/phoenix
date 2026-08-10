import { css } from "@emotion/react";
import { Suspense, useState } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { useParams, useSearchParams } from "react-router";
import invariant from "tiny-invariant";

import { Skeleton, View } from "@phoenix/components";
import {
  CREATE_CODE_EVALUATOR_PARAM,
  CREATE_LLM_EVALUATOR_PARAM,
} from "@phoenix/constants/searchParams";
import type { ProjectEvaluatorsPageQuery } from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorsPageQuery.graphql";
import type { ProjectEvaluatorCreationMode } from "@phoenix/pages/project/evaluators/CreateProjectEvaluatorSlideover";
import { CreateProjectEvaluatorSlideover } from "@phoenix/pages/project/evaluators/CreateProjectEvaluatorSlideover";
import { ProjectEvaluatorsTable } from "@phoenix/pages/project/evaluators/ProjectEvaluatorsTable";
import { ProjectEvaluatorsToolbar } from "@phoenix/pages/project/evaluators/ProjectEvaluatorsToolbar";

export function ProjectEvaluatorsPage() {
  const { projectId } = useParams();
  invariant(projectId, "projectId is required");
  const [filter, setFilter] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  // Only two of the four creation modes are linkable today; see #15297.
  const shouldOpenScratchFromUrl =
    searchParams.get(CREATE_LLM_EVALUATOR_PARAM) === "true";
  const shouldOpenNewCodeFromUrl =
    searchParams.get(CREATE_CODE_EVALUATOR_PARAM) === "true";
  const urlCreationMode: ProjectEvaluatorCreationMode | null =
    shouldOpenScratchFromUrl
      ? { kind: "scratch" }
      : shouldOpenNewCodeFromUrl
        ? { kind: "newCode" }
        : null;
  const [creationMode, setCreationMode] =
    useState<ProjectEvaluatorCreationMode | null>(null);
  const activeCreationMode = creationMode ?? urlCreationMode;
  const clearCreationMode = () => {
    setCreationMode(null);
    if (shouldOpenScratchFromUrl || shouldOpenNewCodeFromUrl) {
      setSearchParams(
        (previousSearchParams) => {
          const nextSearchParams = new URLSearchParams(previousSearchParams);
          nextSearchParams.delete(CREATE_LLM_EVALUATOR_PARAM);
          nextSearchParams.delete(CREATE_CODE_EVALUATOR_PARAM);
          return nextSearchParams;
        },
        { replace: true }
      );
    }
  };
  return (
    <main
      css={css`
        flex: 1 1 auto;
        display: flex;
        flex-direction: column;
        min-height: 0;
      `}
    >
      <ProjectEvaluatorsToolbar
        filter={filter}
        onFilterChange={setFilter}
        onSelectCreationMode={setCreationMode}
      />
      <Suspense fallback={<ProjectEvaluatorsPageSkeleton />}>
        <ProjectEvaluatorsPageContent projectId={projectId} filter={filter} />
      </Suspense>
      {activeCreationMode ? (
        <CreateProjectEvaluatorSlideover
          isOpen
          onOpenChange={(isOpen) => {
            if (!isOpen) clearCreationMode();
          }}
          projectId={projectId}
          creationMode={activeCreationMode}
        />
      ) : null}
    </main>
  );
}

function ProjectEvaluatorsPageContent({
  projectId,
  filter,
}: {
  projectId: string;
  filter: string;
}) {
  const data = useLazyLoadQuery<ProjectEvaluatorsPageQuery>(
    graphql`
      query ProjectEvaluatorsPageQuery($projectId: ID!) {
        project: node(id: $projectId) {
          ... on Project {
            ...ProjectEvaluatorsTable_project
          }
        }
      }
    `,
    { projectId },
    { fetchPolicy: "store-and-network" }
  );
  invariant(data.project, "project is required");
  return (
    <ProjectEvaluatorsTable
      project={data.project}
      projectId={projectId}
      filter={filter}
    />
  );
}

function ProjectEvaluatorsPageSkeleton() {
  return (
    <>
      <View padding="size-100">
        <Skeleton width="100%" height={180} animation="wave" />
      </View>
    </>
  );
}
