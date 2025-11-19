import { getTemplateVariables } from "../template";
import {
  CreateClassificationEvaluatorArgs,
  EvaluatorFn,
  PromptTemplate,
  WithPromptTemplate,
} from "../types";

import { createClassifierFn } from "./createClassifierFn";
import { LLMEvaluator } from "./LLMEvaluator";

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
  constructor(args: CreateClassificationEvaluatorArgs) {
    super(args);
    this.promptTemplate = args.promptTemplate;
    this.evaluatorFn = createClassifierFn<RecordType>(args);
  }
  evaluate = (example: RecordType) => {
    return this.evaluatorFn(example);
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
}
