import { getTemplateVariables } from "../template";
import {
  ClassificationChoicesMap,
  CreateClassificationEvaluatorArgs,
  EvaluatorFn,
  PromptTemplate,
  WithPromptTemplate,
} from "../types";
import { ObjectMapping } from "../types/data";
import { remapObject } from "../utils/objectMappingUtils";

import { createClassifierFn } from "./createClassifierFn";
import { LLMEvaluator } from "./LLMEvaluator";

import { LanguageModel } from "ai";

/**
 * An LLM evaluator that performs evaluation via classification
 */
export class ClassificationEvaluator<RecordType extends Record<string, unknown>>
  extends LLMEvaluator<RecordType>
  implements WithPromptTemplate
{
  readonly evaluatorFn: EvaluatorFn<RecordType>;
  readonly promptTemplate: PromptTemplate;
  /**
   * A dynamically computed set of prompt template variables
   */
  private _promptTemplateVariables: string[] | undefined;
  /**
   * The model to use for classification
   */
  readonly model: LanguageModel;
  /**
   * The choices to classify the example into
   */
  readonly choices: ClassificationChoicesMap;

  constructor(args: CreateClassificationEvaluatorArgs<RecordType>) {
    super(args);
    this.promptTemplate = args.promptTemplate;
    this.model = args.model;
    this.choices = args.choices;
    this.evaluatorFn = createClassifierFn<RecordType>({
      ...args,
    });
  }
  evaluate = (example: RecordType) => {
    return this.evaluatorFn(
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
