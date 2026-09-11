import type { PromptTemplate } from "@arizeai/phoenix-evals";

import { DEFAULT_PROMPT_TECHNIQUE } from "../cli/config.js";
import { resolveToxicityPromptTemplate } from "./toxicity.js";

/**
 * Resolve a sweep prompt-technique override for an evaluator id.
 *
 * `default` leaves the library template in place (`undefined`). Extra
 * techniques are registered per evaluator: add `prompts/<id>.ts` and wire it
 * here. To expose the technique on the CLI (`--prompts`), also add a row in
 * `EXTRA_PROMPT_TECHNIQUES` in `src/cli/config.ts`.
 */
export function resolvePromptTemplate({
  evaluator,
  promptTechnique,
}: {
  evaluator: string;
  promptTechnique: string;
}): PromptTemplate | undefined {
  if (evaluator === "toxicity") {
    return resolveToxicityPromptTemplate(promptTechnique);
  }
  if (promptTechnique === DEFAULT_PROMPT_TECHNIQUE) {
    return undefined;
  }
  throw new Error(
    `Unknown prompt technique ${JSON.stringify(promptTechnique)} for ${JSON.stringify(evaluator)}. Only ${JSON.stringify(DEFAULT_PROMPT_TECHNIQUE)} is implemented unless registered in src/prompts/.`
  );
}
