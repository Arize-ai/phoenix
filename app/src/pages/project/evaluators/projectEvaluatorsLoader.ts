import type { LoaderFunctionArgs } from "react-router";
import { replace } from "react-router";

import {
  CREATE_CODE_EVALUATOR_PARAM,
  CREATE_LLM_EVALUATOR_PARAM,
} from "@phoenix/constants/searchParams";
import {
  newCodeProjectEvaluatorPath,
  newLlmProjectEvaluatorPath,
} from "@phoenix/pages/project/evaluators/projectEvaluatorPaths";
import { withSearchParams } from "@phoenix/utils/urlUtils";

/**
 * Forwards links that open a creation form with `?createLlmEvaluator=true` or
 * `?createCodeEvaluator=true` to the routes that replaced them, so links minted
 * before the slideovers became route-driven still open the right form. Both
 * params remain the live mechanism on the dataset evaluators page.
 */
export function projectEvaluatorsLoader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  // This loader also runs for the nested creation routes, which have already
  // matched; only the list path itself needs forwarding.
  const projectRootPath = url.pathname.match(/^(.*)\/evaluators\/?$/)?.[1];
  if (projectRootPath == null) {
    return null;
  }
  const opensLlmForm =
    url.searchParams.get(CREATE_LLM_EVALUATOR_PARAM) === "true";
  const opensCodeForm =
    url.searchParams.get(CREATE_CODE_EVALUATOR_PARAM) === "true";
  if (!opensLlmForm && !opensCodeForm) {
    return null;
  }
  const creationPath = opensLlmForm
    ? newLlmProjectEvaluatorPath(projectRootPath)
    : newCodeProjectEvaluatorPath(projectRootPath);
  const search = withSearchParams(url.search, (params) => {
    params.delete(CREATE_LLM_EVALUATOR_PARAM);
    params.delete(CREATE_CODE_EVALUATOR_PARAM);
  });
  // `replace`, not `redirect`: a pushed entry would leave the legacy URL one
  // step back, so the back button would land on it and be forwarded here again.
  return replace(`${creationPath}${search}`);
}
