import { Suspense } from "react";
import { usePreloadedQuery } from "react-relay";
import { useLoaderData } from "react-router";
import invariant from "tiny-invariant";

import { Flex, Icon, Icons, LinkButton, Loading } from "@phoenix/components";
import { EvaluatorsFilterBar } from "@phoenix/pages/evaluators/EvaluatorsFilterBar";
import { EvaluatorsFilterProvider } from "@phoenix/pages/evaluators/EvaluatorsFilterProvider";
import {
  evaluatorsPageLoaderGql,
  EvaluatorsPageLoaderType,
} from "@phoenix/pages/evaluators/evaluatorsPageLoader";
import { GlobalEvaluatorsTable } from "@phoenix/pages/evaluators/GlobalEvaluatorsTable";

export const EvaluatorsPage = () => {
  const loaderData = useLoaderData<EvaluatorsPageLoaderType>();
  invariant(loaderData, "loaderData is required");
  const query = usePreloadedQuery(evaluatorsPageLoaderGql, loaderData);
  return (
    <EvaluatorsFilterProvider>
      <Flex direction="column" height="100%">
        <EvaluatorsFilterBar
          extraActions={
            <LinkButton
              size="M"
              leadingVisual={<Icon svg={<Icons.Scale />} />}
              variant="primary"
              to="/evaluators/new"
            >
              New Evaluator
            </LinkButton>
          }
        />
        <Suspense fallback={<Loading />}>
          <GlobalEvaluatorsTable query={query} />
        </Suspense>
      </Flex>
    </EvaluatorsFilterProvider>
  );
};
