import {
  CreateClassificationEvaluatorArgs,
  EvaluatorFn,
  Template,
} from "../types";
import { createClassifierFn } from "./createClassifierFn";
import { LLMEvaluator } from "./LLMEvaluator";
import { getTemplateVariables } from "../template";

/**
 * An LLM evaluator that performs evaluation via classification
 */
export class ClassificationEvaluator<
  ExampleType extends Record<string, unknown>,
> extends LLMEvaluator<ExampleType> {
  readonly evaluatorFn: EvaluatorFn<ExampleType>;
  readonly promptTemplate: Template;
  private _promptTemplateVariables: string[] | undefined;
  constructor(args: CreateClassificationEvaluatorArgs) {
    super(args);
    this.promptTemplate = args.promptTemplate;
    this.evaluatorFn = createClassifierFn<ExampleType>(args);
  }
  evaluate = (example: ExampleType) => {
    return this.evaluatorFn(example);
  };
  /**
   * List out the prompt template variables needed to perform evaluation
   */
  get promptTemplateVariables(): string[] {
    if (Array.isArray(this._promptTemplateVariables)) {
      return this._promptTemplateVariables;
    }
    this._promptTemplateVariables = getTemplateVariables({
      template: this.promptTemplate,
    });
    // Give a copy of the variables
    return [...this.promptTemplateVariables];
  }
}
