import type { LanguageModel, ModelMessage } from "ai";

import { formatTemplate, getTemplateVariables } from "../template";
import type {
  CreatePairwiseEvaluatorArgs,
  EvaluationResult,
  EvaluatorFn,
  PairwiseOrdering,
  PromptTemplate,
  WithPromptTemplate,
} from "../types";
import type { ObjectMapping } from "../types/data";
import { remapObject } from "../utils/objectMappingUtils";
import { generateClassification } from "./generateClassification";
import { LLMEvaluator } from "./LLMEvaluator";

const RESERVED_GROUPS = new Set(["tie", "item_1", "item_2", "response_1", "response_2"]);
const FORBIDDEN_TEMPLATE_VARIABLES = new Set(["response_a", "response_b", "item_a", "item_b"]);
const AB_PATTERN = /Response\s+A\b[\s\S]*Response\s+B\b/i;

type PairwiseChoice = "A" | "B" | "tie";

type PairwisePassResult = {
  choice: string;
  winner: string | "tie" | null;
  rationale?: string;
  presentedFirst: string;
  presentedSecond: string;
};

type PairwiseOutcome = {
  label: string | "tie";
  tieReason: "explicit_tie" | "disagreement" | null;
};

function validateGroups(groups: readonly [string, string]): readonly [string, string] {
  if (groups.length !== 2) {
    throw new Error("PairwiseEvaluator groups must contain exactly two strings.");
  }
  const [firstGroup, secondGroup] = groups;
  if (!firstGroup || !secondGroup) {
    throw new Error("PairwiseEvaluator groups must be non-empty strings.");
  }
  if (firstGroup === secondGroup) {
    throw new Error("PairwiseEvaluator groups must be distinct.");
  }
  const reservedGroups = groups.filter((group) => RESERVED_GROUPS.has(group));
  if (reservedGroups.length > 0) {
    throw new Error(
      `PairwiseEvaluator group names are reserved and cannot be used: ${reservedGroups.join(", ")}.`
    );
  }
  return groups;
}

function validatePromptTemplate({
  promptTemplate,
  groups,
}: {
  promptTemplate: PromptTemplate;
  groups: readonly [string, string];
}) {
  const promptText = getPromptText(promptTemplate);
  if (!AB_PATTERN.test(promptText)) {
    throw new Error(
      "PairwiseEvaluator promptTemplate must label the compared items as 'Response A' and 'Response B' (case-insensitive). The judge replies with 'A' or 'B' positionally and that label maps back to your groups."
    );
  }
  const variables = new Set(getTemplateVariables({ template: promptTemplate }));
  const forbiddenVariables = [...variables].filter((variable) => {
    const rootVariable = variable.split(".")[0] ?? variable;
    return (
      groups.includes(rootVariable) || FORBIDDEN_TEMPLATE_VARIABLES.has(rootVariable)
    );
  });
  if (forbiddenVariables.length > 0) {
    throw new Error(
      `PairwiseEvaluator promptTemplate cannot reference compared group names or reserved variables directly: ${forbiddenVariables.join(", ")}.`
    );
  }
}

function getPromptText(promptTemplate: PromptTemplate): string {
  if (typeof promptTemplate === "string") {
    return promptTemplate;
  }
  return promptTemplate
    .map((message) => {
      const { content } = message;
      if (typeof content === "string") {
        return content;
      }
      if (Array.isArray(content)) {
        return content
          .map((part) => {
            if (part && typeof part === "object" && "text" in part) {
              return String((part as { text?: unknown }).text ?? "");
            }
            return "";
          })
          .join("\n");
      }
      return "";
    })
    .join("\n");
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed: number): number {
  let state = seed >>> 0;
  state += 0x6d2b79f5;
  let result = Math.imul(state ^ (state >>> 15), state | 1);
  result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
  return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
}

function getModelIdentifier(model: LanguageModel): string {
  if (typeof model === "object" && model !== null && "modelId" in model) {
    return String(model.modelId);
  }
  return String(model);
}

function appendStructuredInstruction({
  prompt,
  allowTies,
  includeExplanation,
}: {
  prompt: ReturnType<typeof formatTemplate>;
  allowTies: boolean;
  includeExplanation: boolean;
}) {
  const tieInstruction = allowTies ? ', or "tie" if the responses are equivalent' : "";
  let structuredInstruction = `\n\nRespond with a JSON object containing "label": "A" if Response A (item_1) is better, "B" if Response B (item_2) is better${tieInstruction}`;
  structuredInstruction += includeExplanation
    ? ', and "explanation": a brief rationale.'
    : ".";
  if (typeof prompt === "string") {
    return `${prompt}${structuredInstruction}`;
  }
  return prompt.map((message, index) => {
    if (index !== prompt.length - 1) {
      return message;
    }
    if (typeof message.content === "string") {
      return {
        ...message,
        content: `${message.content}${structuredInstruction}`,
      } as ModelMessage;
    }
    // Multimodal content: append a new text part rather than dropping the
    // structured-output instruction. Without this, the prompt that explains
    // what A and B mean is silently absent for multimodal templates.
    return {
      ...message,
      content: [
        ...message.content,
        { type: "text", text: structuredInstruction },
      ],
    } as ModelMessage;
  });
}

/**
 * An LLM evaluator that compares two records side-by-side and returns the
 * preferred group.
 *
 * **Input shape.** `evaluate` expects an object with keys matching `groups[0]`
 * and `groups[1]` (defaults to `output` and `reference`), plus any additional
 * variables your prompt template references (e.g. `input`).
 *
 * **Prompt template contract.** The template MUST:
 * - Use `{{item_1}}` / `{{item_2}}` to refer to the (randomized) compared
 *   items. Do NOT reference your group keys directly.
 * - Label the items as `Response A` and `Response B` (case-insensitive)
 *   somewhere in the prompt. The judge replies with the position letter
 *   (`A` or `B`), which is then mapped back to your group keys.
 *
 * Reserved/forbidden template variables (will throw on validation):
 * - Reserved group names: `tie`, `item_1`, `item_2`, `response_1`, `response_2`
 * - Forbidden template variables: `response_a`, `response_b`, `item_a`,
 *   `item_b`, plus the literal group names you chose
 *
 * **Output.** Each `EvaluationResult.label` is one of `groups[0]`,
 * `groups[1]`, or `"tie"` — never the raw `"A"` / `"B"` from the judge.
 * `score` is `1.0` if `groups[0]` won, `0.0` if `groups[1]` won, `0.5` for
 * ties.
 *
 * **Ordering modes.**
 * - `"random"` (default): one judge call per row, position randomized via
 *   seeded RNG. 1× cost.
 * - `"both"`: two judge calls per row, requires agreement across swapped
 *   positions (otherwise structural tie). 2× cost.
 * - `"fixed"`: one judge call, `groups[0]` always shown as A. Use only when
 *   you've already accounted for position bias upstream.
 *
 * **Seed.** `seed: 0` (default) is deterministic across runs for the same row.
 * `seed: null` uses the system RNG. The `seed` is recorded in result metadata
 * only when it actually influenced the result — i.e., not when `seed: null`
 * (system RNG) and not when `ordering: "both"` (both orderings run
 * unconditionally, so seed is not consumed).
 *
 * Use the {@link createPairwiseEvaluator} factory to instantiate (consistent
 * with the rest of the package's evaluator surface).
 *
 * @example
 * ```ts
 * import { createPairwiseEvaluator } from "@arizeai/phoenix-evals";
 *
 * const evaluator = createPairwiseEvaluator({
 *   name: "quality",
 *   model,
 *   promptTemplate: `Question: {{input}}\n\nResponse A:\n{{item_1}}\n\nResponse B:\n{{item_2}}\n\nWhich is better?`,
 *   ordering: "random",
 * });
 * const result = await evaluator.evaluate({
 *   input: "What is 2+2?",
 *   output: "4",
 *   reference: "Four",
 * });
 * ```
 */
export class PairwiseEvaluator<RecordType extends Record<string, unknown>>
  extends LLMEvaluator<RecordType>
  implements WithPromptTemplate
{
  readonly evaluatorFn: EvaluatorFn<RecordType>;
  readonly promptTemplate: PromptTemplate;
  readonly model: LanguageModel;
  readonly groups: readonly [string, string];
  readonly ordering: PairwiseOrdering;
  readonly allowTies: boolean;
  readonly includeExplanation: boolean;
  readonly seed: number | null;
  private _promptTemplateVariables: string[] | undefined;

  constructor(args: CreatePairwiseEvaluatorArgs<RecordType>) {
    super(args);
    this.promptTemplate = args.promptTemplate;
    this.model = args.model;
    this.groups = validateGroups(args.groups ?? ["output", "reference"]);
    this.ordering = args.ordering ?? "random";
    if (!["random", "both", "fixed"].includes(this.ordering)) {
      throw new Error("PairwiseEvaluator ordering must be 'random', 'both', or 'fixed'.");
    }
    this.allowTies = args.allowTies ?? true;
    this.includeExplanation = args.includeExplanation ?? true;
    this.seed = args.seed === undefined ? 0 : args.seed;
    validatePromptTemplate({ promptTemplate: this.promptTemplate, groups: this.groups });
    this.evaluatorFn = this.evaluatePairwise;
  }

  evaluate = (example: RecordType) => {
    return this.evaluatorFn(
      this.inputMapping ? remapObject<RecordType>(example, this.inputMapping) : example
    );
  };

  get promptTemplateVariables(): string[] {
    if (!Array.isArray(this._promptTemplateVariables)) {
      this._promptTemplateVariables = getTemplateVariables({
        template: this.promptTemplate,
      });
    }
    return [...this._promptTemplateVariables];
  }

  bindInputMapping(inputMapping: ObjectMapping<RecordType>): PairwiseEvaluator<RecordType> {
    return new PairwiseEvaluator({
      ...this,
      inputMapping,
    });
  }

  private evaluatePairwise = async (example: RecordType): Promise<EvaluationResult> => {
    const [firstGroup, secondGroup] = this.groups;
    this.validateExampleGroups(example);
    if (this.ordering === "both") {
      const passOne = await this.judgeOnce({
        example,
        presentedFirst: firstGroup,
        presentedSecond: secondGroup,
      });
      const passTwo = await this.judgeOnce({
        example,
        presentedFirst: secondGroup,
        presentedSecond: firstGroup,
      });
      const outcome = this.resolvePasses(passOne, passTwo);
      return this.buildResult({ passOne, passTwo, outcome });
    }
    const [presentedFirst, presentedSecond] = this.getOrderedGroups(example);
    const passOne = await this.judgeOnce({ example, presentedFirst, presentedSecond });
    const outcome = this.resolvePasses(passOne);
    return this.buildResult({ passOne, outcome });
  };

  private validateExampleGroups(example: RecordType) {
    const missingGroups = this.groups.filter((group) => !(group in example));
    if (missingGroups.length > 0) {
      throw new Error(
        `PairwiseEvaluator requires both '${this.groups[0]}' and '${this.groups[1]}' keys in eval input.`
      );
    }
  }

  private getOrderedGroups(example: RecordType): readonly [string, string] {
    const [firstGroup, secondGroup] = this.groups;
    if (this.ordering === "fixed") {
      return [firstGroup, secondGroup];
    }
    if (this.seed === null) {
      return Math.random() < 0.5 ? [firstGroup, secondGroup] : [secondGroup, firstGroup];
    }
    const rowHash = hashString(stableStringify(example));
    return seededRandom((this.seed ^ rowHash) >>> 0) < 0.5
      ? [firstGroup, secondGroup]
      : [secondGroup, firstGroup];
  }

  private getValidChoices(): [PairwiseChoice, ...PairwiseChoice[]] {
    return this.allowTies ? ["A", "B", "tie"] : ["A", "B"];
  }

  private async judgeOnce({
    example,
    presentedFirst,
    presentedSecond,
  }: {
    example: RecordType;
    presentedFirst: string;
    presentedSecond: string;
  }): Promise<PairwisePassResult> {
    const prompt = appendStructuredInstruction({
      prompt: formatTemplate({
        template: this.promptTemplate,
        variables: {
          ...example,
          item_1: example[presentedFirst],
          item_2: example[presentedSecond],
        },
      }),
      allowTies: this.allowTies,
      includeExplanation: this.includeExplanation,
    });
    const response = await generateClassification({
      prompt,
      model: this.model,
      labels: this.getValidChoices(),
      includeExplanation: this.includeExplanation,
      telemetry: this.telemetry,
    });
    return {
      choice: response.label,
      winner: this.mapChoiceToWinner({
        choice: response.label,
        presentedFirst,
        presentedSecond,
      }),
      rationale: response.explanation,
      presentedFirst,
      presentedSecond,
    };
  }

  private mapChoiceToWinner({
    choice,
    presentedFirst,
    presentedSecond,
  }: {
    choice: string;
    presentedFirst: string;
    presentedSecond: string;
  }): string | "tie" | null {
    if (choice === "tie") {
      return "tie";
    }
    if (choice === "A") {
      return presentedFirst;
    }
    if (choice === "B") {
      return presentedSecond;
    }
    return null;
  }

  private resolvePasses(passOne: PairwisePassResult, passTwo?: PairwisePassResult): PairwiseOutcome {
    const validChoices = this.getValidChoices();
    if (passOne.winner === null || !validChoices.includes(passOne.choice as PairwiseChoice)) {
      throw new Error(`invalid judge choice: ${passOne.choice}`);
    }
    if (!passTwo) {
      return passOne.winner === "tie"
        ? { label: "tie", tieReason: null }
        : { label: passOne.winner, tieReason: null };
    }
    if (passTwo.winner === null || !validChoices.includes(passTwo.choice as PairwiseChoice)) {
      throw new Error(`invalid judge choice: ${passTwo.choice}`);
    }
    if (passOne.winner === "tie" || passTwo.winner === "tie") {
      return { label: "tie", tieReason: "explicit_tie" };
    }
    if (passOne.winner === passTwo.winner) {
      return { label: passOne.winner, tieReason: null };
    }
    return { label: "tie", tieReason: "disagreement" };
  }

  private scoreForLabel(label: string): number {
    if (label === this.groups[0]) {
      return 1;
    }
    if (label === this.groups[1]) {
      return 0;
    }
    return 0.5;
  }

  private buildResult({
    passOne,
    passTwo,
    outcome,
  }: {
    passOne: PairwisePassResult;
    passTwo?: PairwisePassResult;
    outcome: PairwiseOutcome;
  }): EvaluationResult {
    const passes = [
      {
        position_mapping: {
          A: passOne.presentedFirst,
          B: passOne.presentedSecond,
        },
        choice: passOne.choice,
        explanation: this.includeExplanation ? passOne.rationale ?? null : null,
      },
    ];
    if (passTwo) {
      passes.push({
        position_mapping: {
          A: passTwo.presentedFirst,
          B: passTwo.presentedSecond,
        },
        choice: passTwo.choice,
        explanation: this.includeExplanation ? passTwo.rationale ?? null : null,
      });
    }
    return {
      label: outcome.label,
      score: this.scoreForLabel(outcome.label),
      explanation: this.formatExplanation({ passOne, passTwo }),
      metadata: {
        groups: [...this.groups],
        ordering: this.ordering,
        model: getModelIdentifier(this.model),
        passes,
        // Only emit seed when it actually influenced the result. In ordering
        // "both" both orderings run unconditionally, so the seed is not
        // consumed; advertising it would mislead replay tools.
        ...(this.seed === null || this.ordering === "both"
          ? {}
          : { seed: this.seed }),
        ...(outcome.tieReason ? { tie_reason: outcome.tieReason } : {}),
      },
    };
  }

  private formatExplanation({
    passOne,
    passTwo,
  }: {
    passOne: PairwisePassResult;
    passTwo?: PairwisePassResult;
  }): string | undefined {
    if (!this.includeExplanation) {
      return undefined;
    }
    if (!passTwo) {
      return passOne.rationale;
    }
    return [
      `Pass 1 (A=${passOne.presentedFirst}, B=${passOne.presentedSecond}): ${passOne.rationale ?? ""}`,
      `Pass 2 (A=${passTwo.presentedFirst}, B=${passTwo.presentedSecond}): ${passTwo.rationale ?? ""}`,
    ].join("\n");
  }
}
