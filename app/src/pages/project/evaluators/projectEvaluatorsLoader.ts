import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";

import {
  CREATE_CODE_EVALUATOR_PARAM,
  CREATE_LLM_EVALUATOR_PARAM,
} from "@phoenix/constants/searchParams";

/**
 * Forwards the retired `?createLlmEvaluator=true` / `?createCodeEvaluator=true`
 * links to the creation routes that replaced them, so links minted before the
 * slideovers became route-driven still open the right form.
 */
export function projectEvaluatorsLoader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  // A creation route is already matched; the params are only a list-page alias.
  if (!/\/evaluators\/?$/.test(url.pathname)) {
    return null;
  }
  const opensLlmForm =
    url.searchParams.get(CREATE_LLM_EVALUATOR_PARAM) === "true";
  const opensCodeForm =
    url.searchParams.get(CREATE_CODE_EVALUATOR_PARAM) === "true";
  if (!opensLlmForm && !opensCodeForm) {
    return null;
  }
  url.searchParams.delete(CREATE_LLM_EVALUATOR_PARAM);
  url.searchParams.delete(CREATE_CODE_EVALUATOR_PARAM);
  const listPath = url.pathname.replace(/\/$/, "");
  const creationPath = opensLlmForm ? "new/llm" : "new/code";
  return redirect(`${listPath}/${creationPath}${url.search}`);
}
