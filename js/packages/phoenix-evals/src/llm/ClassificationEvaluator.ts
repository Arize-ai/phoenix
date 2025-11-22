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
import { LLMEvaluator } from "./LLMEvaluatorBase";

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
  private _promptTemplateVariables: string[] | undefined;
  readonly _model: LanguageModel;
  readonly _choices: ClassificationChoicesMap;
  constructor(args: CreateClassificationEvaluatorArgs<RecordType>) {
    super(args);
    this.promptTemplate = args.promptTemplate;
    this._model = args.model;
    this._choices = args.choices;
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
      name: this.name,
      optimizationDirection: this.optimizationDirection,
      model: this._model,
      choices: this._choices,
      promptTemplate: this.promptTemplate,
      inputMapping,
    });
  }
}
