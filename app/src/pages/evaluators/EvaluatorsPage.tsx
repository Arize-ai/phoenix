import { Suspense } from "react";
import { useLoaderData } from "react-router";
import invariant from "tiny-invariant";

import { Flex, Loading } from "@phoenix/components";
import { useOwnedPreloadedQuery } from "@phoenix/hooks";
import type { evaluatorsPageLoaderQuery } from "@phoenix/pages/evaluators/__generated__/evaluatorsPageLoaderQuery.graphql";
import { EvaluatorsFilterBar } from "@phoenix/pages/evaluators/EvaluatorsFilterBar";
import { EvaluatorsFilterProvider } from "@phoenix/pages/evaluators/EvaluatorsFilterProvider";
import type { EvaluatorsPageLoaderType } from "@phoenix/pages/evaluators/evaluatorsPageLoader";
import { evaluatorsPageLoaderGql } from "@phoenix/pages/evaluators/evaluatorsPageLoader";
import { GlobalEvaluatorsTable } from "@phoenix/pages/evaluators/GlobalEvaluatorsTable";

export const EvaluatorsPage = () => {
  const loaderData = useLoaderData<EvaluatorsPageLoaderType>();
  invariant(loaderData, "loaderData is required");
  const query = useOwnedPreloadedQuery<evaluatorsPageLoaderQuery>({
    query: evaluatorsPageLoaderGql,
    queryRef: loaderData,
  });
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
