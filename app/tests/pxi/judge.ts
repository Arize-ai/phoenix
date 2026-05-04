import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { generateText, Output, type LanguageModel } from "ai";
import { z } from "zod";

type JudgeOutcome = {
  label: "pass" | "fail";
  score: number;
  explanation: string;
};

const DEFAULT_JUDGE_MODEL = "openai/gpt-4.1";
const DEFAULT_JUDGE_SYSTEM =
  "You are judging an AI assistant answer. Return a label, score, and concise explanation.";

function getJudgeProvider(model: string) {
  const [provider, ...modelParts] = model.split("/");
  const providerModel = modelParts.join("/");
  if (!provider || !providerModel) {
    throw new Error(
      `Judge model must use provider/model format, received: ${model}`
    );
  }

  return { provider, providerModel };
}

export function getRequiredJudgeApiKeyEnv({
  model = process.env.PXI_E2E_JUDGE_MODEL ?? DEFAULT_JUDGE_MODEL,
}: {
  model?: string;
} = {}) {
  const { provider } = getJudgeProvider(model);
  if (provider === "openai") {
    return "OPENAI_API_KEY";
  }
  if (provider === "anthropic") {
    return "ANTHROPIC_API_KEY";
  }

  throw new Error(
    `Unsupported judge model provider: ${provider}. Supported providers: openai, anthropic.`
  );
}

function getJudgeModel(model: string): LanguageModel {
  const { provider, providerModel } = getJudgeProvider(model);

  if (provider === "openai") {
    return openai(providerModel);
  }
  if (provider === "anthropic") {
    return anthropic(providerModel);
  }

  throw new Error(
    `Unsupported judge model provider: ${provider}. Supported providers: openai, anthropic.`
  );
}

/**
 * Minimal AI SDK-backed LLM-as-judge helper.
 * @param params.model - Judge model in provider/model format, e.g. openai/gpt-4.1 or anthropic/claude-sonnet-4-5.
 * @param params.system - System instructions for the judge.
 * @param params.prompt - Original user prompt sent to PXI.
 * @param params.assistantText - Final assistant answer to judge.
 * @param params.rubric - Criteria the judge should apply.
 */
export async function judge({
  model = process.env.PXI_E2E_JUDGE_MODEL ?? DEFAULT_JUDGE_MODEL,
  system = DEFAULT_JUDGE_SYSTEM,
  prompt,
  assistantText,
  rubric,
}: {
  model?: string;
  system?: string;
  prompt: string;
  assistantText: string;
  rubric: string[];
}): Promise<JudgeOutcome> {
  const result = await generateText({
    model: getJudgeModel(model),
    temperature: 0,
    output: Output.object({
      name: "JudgeOutcome",
      description: "Evaluation result for an AI assistant answer.",
      schema: z.object({
        label: z.enum(["pass", "fail"]),
        score: z.number(),
        explanation: z.string(),
      }),
    }),
    system,
    prompt: JSON.stringify({
      rubric,
      prompt,
      assistantText,
      outputSchema: {
        label: "pass | fail",
        score: "1 for pass, 0 for fail",
        explanation: "brief reason",
      },
    }),
  });

  return result.output;
}
