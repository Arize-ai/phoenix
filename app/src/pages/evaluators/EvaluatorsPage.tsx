import { Suspense } from "react";
import { usePreloadedQuery } from "react-relay";
import { useLoaderData } from "react-router";
import invariant from "tiny-invariant";

import { Flex, Loading } from "@phoenix/components";
import { EvaluatorsFilterBar } from "@phoenix/pages/evaluators/EvaluatorsFilterBar";
import { EvaluatorsFilterProvider } from "@phoenix/pages/evaluators/EvaluatorsFilterProvider";
import {
  evaluatorsPageLoaderGql,
  EvaluatorsPageLoaderType,
} from "@phoenix/pages/evaluators/evaluatorsPageLoader";
import { EvaluatorsTable } from "@phoenix/pages/evaluators/EvaluatorsTable";

export const EvaluatorsPage = () => {
  const loaderData = useLoaderData<EvaluatorsPageLoaderType>();
  invariant(loaderData, "loaderData is required");
  const query = usePreloadedQuery(evaluatorsPageLoaderGql, loaderData);
  return (
    <EvaluatorsFilterProvider>
      <Flex direction="column" height="100%">
        <EvaluatorsFilterBar />
        <Suspense fallback={<Loading />}>
          <EvaluatorsTable query={query} />
        </Suspense>
      </Flex>
    </EvaluatorsFilterProvider>
  );
};
