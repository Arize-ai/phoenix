import { Suspense } from "react";
import { usePreloadedQuery } from "react-relay";
import { useLoaderData } from "react-router";
import invariant from "tiny-invariant";

import { Flex, Loading } from "@phoenix/components";
import { EvaluatorsFilterBar } from "@phoenix/features/experiments/pages/evaluators/EvaluatorsFilterBar";
import { EvaluatorsFilterProvider } from "@phoenix/features/experiments/pages/evaluators/EvaluatorsFilterProvider";
import type { EvaluatorsPageLoaderType } from "@phoenix/features/experiments/pages/evaluators/evaluatorsPageLoader";
import { evaluatorsPageLoaderGql } from "@phoenix/features/experiments/pages/evaluators/evaluatorsPageLoader";
import { GlobalEvaluatorsTable } from "@phoenix/features/experiments/pages/evaluators/GlobalEvaluatorsTable";

export const EvaluatorsPage = () => {
  const loaderData = useLoaderData<EvaluatorsPageLoaderType>();
  invariant(loaderData, "loaderData is required");
  const query = usePreloadedQuery(evaluatorsPageLoaderGql, loaderData);
  return (
    <EvaluatorsFilterProvider>
      <Flex direction="column" height="100%">
        <EvaluatorsFilterBar />
        <Suspense fallback={<Loading />}>
          <GlobalEvaluatorsTable query={query} />
        </Suspense>
      </Flex>
    </EvaluatorsFilterProvider>
  );
};
