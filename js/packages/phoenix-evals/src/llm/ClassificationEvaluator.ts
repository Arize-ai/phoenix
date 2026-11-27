import type { LanguageModel } from "ai";

import { getTemplateVariables } from "../template";
import type {
  ClassificationChoicesMap,
  CreateClassificationEvaluatorArgs,
  Criterion,
  CriterionResult,
  EvaluationResult,
  EvaluatorFn,
  PromptTemplate,
  WithPromptTemplate,
} from "../types";
import type { ObjectMapping } from "../types/data";
import { isCriteriaList } from "../utils/isCriteriaList";
import type { DecisionModel } from "../utils/isDecisionModel";
import { remapObject } from "../utils/objectMappingUtils";
import {
  type CriteriaEvaluatorFn,
  createClassifierFn,
  createCriteriaClassifierFn,
} from "./createClassifierFn";
import { LLMEvaluator } from "./LLMEvaluator";

/**
 * An LLM evaluator that performs evaluation via classification
 */
export class ClassificationEvaluator<RecordType extends Record<string, unknown>>
  extends LLMEvaluator<RecordType>
  implements WithPromptTemplate
{
  readonly promptTemplate: PromptTemplate;
  /**
   * A dynamically computed set of prompt template variables
   */
  private _promptTemplateVariables: string[] | undefined;
  /**
   * The model to use for classification
   */
  readonly model: LanguageModel | DecisionModel;
  /**
   * The choices to classify the example into. A label-to-score map for a
   * single-criterion classifier, or a list of {@link Criterion} for a
   * multi-criterion classifier.
   */
  readonly choices: ClassificationChoicesMap | Criterion[];
  /**
   * Set when `choices` is a label-to-score map; produces a single result.
   * Undefined for a multi-criterion evaluator (use `evaluateCriteria`).
   */
  readonly evaluatorFn?: EvaluatorFn<RecordType>;
  /**
   * Set when `choices` is a list of criteria; produces one result per criterion.
   */
  private readonly _criteriaEvaluatorFn?: CriteriaEvaluatorFn<RecordType>;

  constructor(args: CreateClassificationEvaluatorArgs<RecordType>) {
    super(args);
    this.promptTemplate = args.promptTemplate;
    this.model = args.model;
    this.choices = args.choices;
    if (isCriteriaList(args.choices)) {
      this._criteriaEvaluatorFn = createCriteriaClassifierFn<RecordType>({
        ...args,
      });
    } else {
      this.evaluatorFn = createClassifierFn<RecordType>({
        ...args,
      });
    }
  }
  evaluate = async (example: RecordType): Promise<EvaluationResult> => {
    if (!this.evaluatorFn) {
      throw new Error(
        "This classifier was created with a list of criteria; call evaluateCriteria() for one result per criterion."
      );
    }
    return this.evaluatorFn(
      this.inputMapping
        ? remapObject<RecordType>(example, this.inputMapping)
        : example
    );
  };
  /**
   * Evaluate every criterion against one example, returning one result per
   * criterion in the order given. Only valid when the evaluator was created
   * with a list of {@link Criterion}; throws otherwise.
   */
  evaluateCriteria = async (
    example: RecordType
  ): Promise<CriterionResult[]> => {
    if (!this._criteriaEvaluatorFn) {
      throw new Error(
        "This classifier was created with a label-to-score choices map; call evaluate() for a single result."
      );
    }
    return this._criteriaEvaluatorFn(
      this.inputMapping
        ? remapObject<RecordType>(example, this.inputMapping)
        : example
    );
  };
  /**
   * List out the prompt template variables needed to perform evaluation
   */
  get promptTemplateVariables(): string[] {
    // Use dynamic programming to see if it's computed already
    if (!Array.isArray(this._promptTemplateVariables)) {
      this._promptTemplateVariables = getTemplateVariables({
        template: this.promptTemplate,
      });
    }
    // Give a copy of the variables
    return [...this._promptTemplateVariables];
  }
  /**
   * Binds the input mapping to the evaluator. It makes a a copy of the evaluator and returns it.
   */
  bindInputMapping(
    inputMapping: ObjectMapping<RecordType>
  ): ClassificationEvaluator<RecordType> {
    return new ClassificationEvaluator({
      ...this,
      inputMapping,
    });
  }
}
