/**
 * summary-quality evaluator
 *
 * LLM-as-judge that grades a session summary on two axes at once: whether
 * it identifies the topic AND whether it reads like a sidebar title rather
 * than a sentence. The summary ships in the session sidebar in the PXI
 * chat UI (see `useGenerateSessionSummary.ts` and `getSessionDisplayName`),
 * so "OAuth / SSO support" is the shape we want — "Phoenix supports OAuth
 * SSO with OIDC providers" is a sentence, not a title, and fails.
 *
 * Labels:
 *   - accurate    — concise title-style noun phrase that names the topic
 *   - partial     — on-topic but verbose/sentence-y, or title-style but vague
 *   - inaccurate  — wrong, generic ("user asked a question"), or misleading
 */
import { anthropic } from "@ai-sdk/anthropic";
import {
  createClassificationEvaluator,
  type ClassificationChoicesMap,
} from "@arizeai/phoenix-evals";
import type { LanguageModel } from "ai";

export type SummaryQualityLabel = "accurate" | "partial" | "inaccurate";

const SUMMARY_QUALITY_CHOICES: ClassificationChoicesMap = {
  accurate: 1,
  partial: 0.5,
  inaccurate: 0,
};

// The experiment framework passes { input, output, expected, metadata, example }
// directly to `evaluate`. phoenix-evals' Mustache renderer supports dotted
// access, so the template reaches into `input.userMessage` etc. without any
// wrapping or input-mapping on our end.
const SUMMARY_QUALITY_PROMPT = `<role>
  You are grading a session summary that will appear as a sidebar label
  in the Phoenix chat UI. The best summaries read like sidebar titles:
  short, scannable labels that name the topic OR the user's task.
  Phoenix is always the implied subject, so the word "Phoenix" should
  generally not appear in the summary.
</role>

<style_rules>
  - Either a short noun phrase ("OAuth / SSO support") OR a short
    imperative naming the user's task ("Find slow spans", "Fix 401
    error", "Identify top errors") is acceptable.
  - Use SENTENCE CASE: only the first letter of the summary is
    capitalized. Proper nouns and acronyms (OpenAI, LangChain, Docker,
    OAuth, SSO, API, OIDC, REST) keep their natural casing. Do NOT use
    Title Case where every major word is capitalized — "Fix OpenAI
    Tracer 401 Error" is wrong; "Fix OpenAI tracer 401 error" is right.
  - Do NOT start with a gerund (-ing form): "Installing", "Creating",
    "Debugging", "Setting up", "Exporting", "Versioning", "Explaining".
    The bare imperative ("Install", "Create", "Debug") is fine.
  - Phoenix is the implied subject of every conversation, so the word
    "Phoenix" should be omitted when the title still reads cleanly
    without it. It is acceptable when the title would be ambiguous or
    grammatically broken otherwise.
  - Aim for 2-6 words.
</style_rules>

<conversation>
  <user>{{input.userMessage}}</user>
  <assistant>{{input.assistantMessage}}</assistant>
</conversation>

<generated_summary>{{output}}</generated_summary>

<labels>
  <label name="accurate">
    A short noun phrase OR short imperative (ideally 2-6 words) in
    SENTENCE CASE that names the specific subject or task. Only the
    first letter capitalized; proper nouns/acronyms keep their natural
    casing. Does not start with a gerund, does not narrate ("User
    asked..."), and does not redundantly say "Phoenix". Someone scanning
    a list of these would know what the conversation is about.
  </label>
  <label name="partial">
    On-topic but breaks one of the format rules. Examples: uses Title
    Case where every major word is capitalized ("Fix OpenAI Tracer 401
    Error"), leads with a gerund ("Installing Phoenix locally"),
    includes the word "Phoenix" gratuitously when the title would read
    fine without it ("Run Phoenix in production cheaply" → "Run in
    production cheaply"), is a full grammatical sentence ("Phoenix
    supports OAuth..."), OR is correctly formatted but too vague to
    identify the subject ("Asking about Phoenix").
  </label>
  <label name="inaccurate">
    Wrong, contradicts the conversation, or is generic filler that
    conveys nothing ("user asked a question", "technical discussion").
  </label>
</labels>

<output_format>
  Return a structured result with the chosen label and a brief
  explanation.
</output_format>`;

export interface SummaryQualityEvaluatorOptions {
  /**
   * Override the model used to grade summaries. Defaults to
   * Claude Haiku 4.5 to keep evaluation cheap.
   */
  model?: LanguageModel;
  /**
   * Override the evaluator name surfaced in Phoenix. Defaults to
   * "summary-quality".
   */
  name?: string;
}

export function createSummaryQualityEvaluator(
  options: SummaryQualityEvaluatorOptions = {}
) {
  return createClassificationEvaluator({
    name: options.name ?? "summary-quality",
    model: options.model ?? anthropic("claude-haiku-4-5-20251001"),
    promptTemplate: SUMMARY_QUALITY_PROMPT,
    choices: SUMMARY_QUALITY_CHOICES,
    optimizationDirection: "MAXIMIZE",
  });
}

export const summaryQualityEvaluator = createSummaryQualityEvaluator();
