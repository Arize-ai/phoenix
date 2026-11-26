import { argmax, generateProbabilities } from "../fake-data.js";
import type { OpenAIDecision, OpenAIDecisionCreateParams } from "../types.js";

type Question = OpenAIDecisionCreateParams["questions"][number];
type Answer = OpenAIDecision["answers"][number];

/**
 * Estimate tokens from a JSON-serializable value
 */
function estimateTokens(value: unknown): number {
  return Math.ceil(JSON.stringify(value).length / 4);
}

/**
 * Generate a random answer for one question.
 * Answers echo the question's `name`, or `null` when it is unnamed.
 */
function generateAnswer(question: Question): Answer {
  const name = question.name ?? null;

  switch (question.type) {
    case "predicate":
      return { type: "predicate", name, probability: Math.random() };

    case "choice": {
      const probabilities = generateProbabilities(question.choices.length);
      const best = argmax(probabilities);
      return {
        type: "choice",
        name,
        choice: question.choices[best].value,
        confidence: probabilities[best],
        probabilities: question.choices.map((choice, i) => ({
          value: choice.value,
          probability: probabilities[i],
        })),
      };
    }

    case "score": {
      const probabilities = generateProbabilities(question.levels.length);
      // The score is the expected level index, so it can fall between levels
      const score = probabilities.reduce((sum, p, i) => sum + p * i, 0);
      return {
        type: "score",
        name,
        score,
        confidence: probabilities[argmax(probabilities)],
        probabilities: question.levels.map((level, i) => ({
          label: level.label,
          value: i,
          probability: probabilities[i],
        })),
      };
    }
  }
}

/**
 * Handle an OpenAI Decisions request. The endpoint has no streaming mode.
 */
export function handleDecision(
  req: OpenAIDecisionCreateParams
): OpenAIDecision {
  const inputTokens = estimateTokens(req.input) + estimateTokens(req.questions);
  const outputTokens = req.questions.length;

  return {
    model: req.model,
    answers: req.questions.map(generateAnswer),
    usage: {
      input_tokens: inputTokens,
      input_tokens_details: { cache_write_tokens: 0, cached_tokens: 0 },
      output_tokens: outputTokens,
      output_tokens_details: { reasoning_tokens: 0 },
      total_tokens: inputTokens + outputTokens,
    },
  };
}
