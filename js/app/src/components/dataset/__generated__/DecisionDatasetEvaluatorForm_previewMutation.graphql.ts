/**
 * @generated SignedSource<<765281936321f12f07ef99e4f3e94884>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type AnthropicOutputConfigEffort = "HIGH" | "LOW" | "MAX" | "MEDIUM" | "XHIGH";
export type AnthropicThinkingDisplay = "OMITTED" | "SUMMARIZED";
export type DecisionAnnotationQuestionType = "CHOICE" | "PREDICATE" | "SCALE";
export type DecisionAnnotationStatus = "ANSWERED" | "ERROR" | "REFUSED";
export type DecisionTemplateFormat = "F_STRING" | "MUSTACHE";
export type GenerativeProviderKey = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "CEREBRAS" | "DEEPSEEK" | "FIREWORKS" | "GOOGLE" | "GROQ" | "META" | "MINIMAX" | "MOONSHOT" | "OLLAMA" | "OPENAI" | "PERPLEXITY" | "TOGETHER" | "TYPESAFE" | "XAI" | "ZAI";
export type GoogleThinkingLevel = "HIGH" | "LOW" | "MEDIUM" | "MINIMAL";
export type Language = "PYTHON" | "TYPESCRIPT";
export type OpenAIReasoningEffort = "HIGH" | "LOW" | "MEDIUM" | "MINIMAL" | "NONE" | "XHIGH";
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE" | "NONE";
export type PromptMessageRole = "AI" | "SYSTEM" | "TOOL" | "USER";
export type PromptTemplateFormat = "F_STRING" | "MUSTACHE" | "NONE";
export type EvaluatorPreviewsInput = {
  credentials?: ReadonlyArray<GenerativeCredentialInput> | null;
  previews: ReadonlyArray<EvaluatorPreviewItemInput>;
};
export type EvaluatorPreviewItemInput = {
  applyOnlineEvaluationLimits?: boolean;
  context: any;
  datasetEvaluatorId?: string | null;
  evaluator?: EvaluatorDefinitionInput | null;
  inputMapping: EvaluatorInputMappingInput;
};
export type EvaluatorDefinitionInput = {
  builtInEvaluatorId?: never;
  codeEvaluatorId?: never;
  decisionEvaluatorId?: never;
  inlineCodeEvaluator?: never;
  inlineDecisionEvaluator: InlineDecisionEvaluatorInput;
  inlineLlmEvaluator?: never;
} | {
  builtInEvaluatorId?: never;
  codeEvaluatorId?: never;
  decisionEvaluatorId: string;
  inlineCodeEvaluator?: never;
  inlineDecisionEvaluator?: never;
  inlineLlmEvaluator?: never;
} | {
  builtInEvaluatorId: string;
  codeEvaluatorId?: never;
  decisionEvaluatorId?: never;
  inlineCodeEvaluator?: never;
  inlineDecisionEvaluator?: never;
  inlineLlmEvaluator?: never;
} | {
  builtInEvaluatorId?: never;
  codeEvaluatorId?: never;
  decisionEvaluatorId?: never;
  inlineCodeEvaluator?: never;
  inlineDecisionEvaluator?: never;
  inlineLlmEvaluator: InlineLLMEvaluatorInput;
} | {
  builtInEvaluatorId?: never;
  codeEvaluatorId: string;
  decisionEvaluatorId?: never;
  inlineCodeEvaluator?: never;
  inlineDecisionEvaluator?: never;
  inlineLlmEvaluator?: never;
} | {
  builtInEvaluatorId?: never;
  codeEvaluatorId?: never;
  decisionEvaluatorId?: never;
  inlineCodeEvaluator: InlineCodeEvaluatorInput;
  inlineDecisionEvaluator?: never;
  inlineLlmEvaluator?: never;
};
export type InlineDecisionEvaluatorInput = {
  decisionVersion: DecisionVersionInput;
  description?: string | null;
  name: string;
  scoringPolicy?: DecisionScoringPolicyInput | null;
};
export type DecisionVersionInput = {
  customProviderId?: string | null;
  description?: string | null;
  inputs: ReadonlyArray<DecisionInputDefinitionInput>;
  metadata?: any | null;
  modelName: string;
  modelProvider: GenerativeProviderKey;
  questions: ReadonlyArray<DecisionQuestionInput>;
  state: DecisionStateInput;
};
export type DecisionInputDefinitionInput = {
  description?: string | null;
  jsonSchema?: any | null;
  name: string;
};
export type DecisionStateInput = {
  input?: never;
  object: boolean;
  text?: never;
} | {
  input?: never;
  object?: never;
  text: TextStateInput;
} | {
  input: string;
  object?: never;
  text?: never;
};
export type TextStateInput = {
  template: string;
  templateFormat: DecisionTemplateFormat;
};
export type DecisionQuestionInput = {
  choice?: never;
  predicate: PredicateQuestionInput;
  scale?: never;
} | {
  choice: ChoiceQuestionInput;
  predicate?: never;
  scale?: never;
} | {
  choice?: never;
  predicate?: never;
  scale: ScaleQuestionInput;
};
export type PredicateQuestionInput = {
  criteria?: PredicateCriteriaInput | null;
  instructions: string;
  name: string;
};
export type PredicateCriteriaInput = {
  false?: string | null;
  true?: string | null;
};
export type ChoiceQuestionInput = {
  choices: ReadonlyArray<ChoiceOptionInput>;
  instructions: string;
  name: string;
};
export type ChoiceOptionInput = {
  description?: string | null;
  value: string;
};
export type ScaleQuestionInput = {
  instructions: string;
  levels: ReadonlyArray<ScaleLevelInput>;
  name: string;
};
export type ScaleLevelInput = {
  description?: string | null;
  label: string;
};
export type DecisionScoringPolicyInput = {
  questions?: ReadonlyArray<DecisionQuestionScoringInput>;
};
export type DecisionQuestionScoringInput = {
  choice?: never;
  predicate: DecisionPredicateScoringInput;
  scale?: never;
} | {
  choice: DecisionChoiceScoringInput;
  predicate?: never;
  scale?: never;
} | {
  choice?: never;
  predicate?: never;
  scale: DecisionScaleScoringInput;
};
export type DecisionPredicateScoringInput = {
  name: string;
  optimizationDirection?: OptimizationDirection;
  threshold?: number;
};
export type DecisionChoiceScoringInput = {
  name: string;
  optimizationDirection?: OptimizationDirection;
  scores?: ReadonlyArray<DecisionChoiceScoreInput>;
};
export type DecisionChoiceScoreInput = {
  choice: string;
  score: number;
};
export type DecisionScaleScoringInput = {
  includeLabel?: boolean;
  name: string;
  optimizationDirection?: OptimizationDirection;
};
export type InlineLLMEvaluatorInput = {
  description?: string | null;
  name: string;
  outputConfigs: ReadonlyArray<AnnotationConfigInput>;
  promptVersion: ChatPromptVersionInput;
};
export type ChatPromptVersionInput = {
  customProviderId?: string | null;
  description?: string | null;
  invocationParameters: PromptInvocationParametersInput;
  metadata?: any | null;
  modelName: string;
  modelProvider: GenerativeProviderKey;
  responseFormat?: PromptResponseFormatJSONSchemaInput | null;
  template: PromptChatTemplateInput;
  templateFormat: PromptTemplateFormat;
  tools?: PromptToolsInput | null;
};
export type PromptChatTemplateInput = {
  messages: ReadonlyArray<PromptMessageInput>;
};
export type PromptMessageInput = {
  content: ReadonlyArray<ContentPartInput>;
  role: PromptMessageRole;
};
export type ContentPartInput = {
  text: TextContentValueInput;
  toolCall?: never;
  toolResult?: never;
} | {
  text?: never;
  toolCall: ToolCallContentValueInput;
  toolResult?: never;
} | {
  text?: never;
  toolCall?: never;
  toolResult: ToolResultContentValueInput;
};
export type TextContentValueInput = {
  text: string;
};
export type ToolCallContentValueInput = {
  toolCall: ToolCallFunctionInput;
  toolCallId: string;
};
export type ToolCallFunctionInput = {
  arguments: string;
  name: string;
  type?: string | null;
};
export type ToolResultContentValueInput = {
  result: any;
  toolCallId: string;
};
export type PromptInvocationParametersInput = {
  anthropic?: never;
  aws?: never;
  google?: never;
  openai: PromptOpenAIInvocationParametersInput;
} | {
  anthropic: PromptAnthropicInvocationParametersInput;
  aws?: never;
  google?: never;
  openai?: never;
} | {
  anthropic?: never;
  aws?: never;
  google: PromptGoogleInvocationParametersInput;
  openai?: never;
} | {
  anthropic?: never;
  aws: PromptAwsInvocationParametersInput;
  google?: never;
  openai?: never;
};
export type PromptOpenAIInvocationParametersInput = {
  extraBody?: any | null;
  frequencyPenalty?: number | null;
  maxCompletionTokens?: number | null;
  maxTokens?: number | null;
  presencePenalty?: number | null;
  reasoningEffort?: OpenAIReasoningEffort | null;
  seed?: number | null;
  stop?: ReadonlyArray<string> | null;
  temperature?: number | null;
  topP?: number | null;
};
export type PromptAnthropicInvocationParametersInput = {
  extraBody?: any | null;
  maxTokens: number;
  outputConfig?: PromptAnthropicOutputConfigInput | null;
  stopSequences?: ReadonlyArray<string> | null;
  temperature?: number | null;
  thinking?: PromptAnthropicThinkingConfigInput | null;
  topP?: number | null;
};
export type PromptAnthropicOutputConfigInput = {
  effort?: AnthropicOutputConfigEffort | null;
};
export type PromptAnthropicThinkingConfigInput = {
  adaptive?: never;
  disabled: AnthropicThinkingDisabledMarkerInput;
  enabled?: never;
} | {
  adaptive?: never;
  disabled?: never;
  enabled: AnthropicThinkingEnabledInput;
} | {
  adaptive: AnthropicThinkingAdaptiveInput;
  disabled?: never;
  enabled?: never;
};
export type AnthropicThinkingDisabledMarkerInput = {
  disabled?: boolean;
};
export type AnthropicThinkingEnabledInput = {
  budgetTokens: number;
  display?: AnthropicThinkingDisplay | null;
};
export type AnthropicThinkingAdaptiveInput = {
  display?: AnthropicThinkingDisplay | null;
};
export type PromptGoogleInvocationParametersInput = {
  frequencyPenalty?: number | null;
  maxOutputTokens?: number | null;
  presencePenalty?: number | null;
  stopSequences?: ReadonlyArray<string> | null;
  temperature?: number | null;
  thinkingConfig?: PromptGoogleThinkingConfigInput | null;
  topK?: number | null;
  topP?: number | null;
};
export type PromptGoogleThinkingConfigInput = {
  includeThoughts?: boolean | null;
  thinkingBudget?: number | null;
  thinkingLevel?: GoogleThinkingLevel | null;
};
export type PromptAwsInvocationParametersInput = {
  maxTokens?: number | null;
  stopSequences?: ReadonlyArray<string> | null;
  temperature?: number | null;
  topP?: number | null;
};
export type PromptToolsInput = {
  disableParallelToolCalls?: boolean | null;
  toolChoice?: PromptToolChoiceInput | null;
  tools: ReadonlyArray<PromptToolInput>;
};
export type PromptToolInput = {
  function: PromptToolFunctionDefinitionInput;
  raw?: never;
} | {
  function?: never;
  raw: any;
};
export type PromptToolFunctionDefinitionInput = {
  description?: string | null;
  name: string;
  parameters?: any | null;
  strict?: boolean | null;
};
export type PromptToolChoiceInput = {
  functionName?: never;
  none: boolean;
  oneOrMore?: never;
  zeroOrMore?: never;
} | {
  functionName?: never;
  none?: never;
  oneOrMore?: never;
  zeroOrMore: boolean;
} | {
  functionName?: never;
  none?: never;
  oneOrMore: boolean;
  zeroOrMore?: never;
} | {
  functionName: string;
  none?: never;
  oneOrMore?: never;
  zeroOrMore?: never;
};
export type PromptResponseFormatJSONSchemaInput = {
  jsonSchema: PromptResponseFormatJSONSchemaDefinitionInput;
  type: string;
};
export type PromptResponseFormatJSONSchemaDefinitionInput = {
  description?: string | null;
  name: string;
  schema?: any | null;
  strict?: boolean | null;
};
export type AnnotationConfigInput = {
  categorical: CategoricalAnnotationConfigInput;
  continuous?: never;
  freeform?: never;
} | {
  categorical?: never;
  continuous: ContinuousAnnotationConfigInput;
  freeform?: never;
} | {
  categorical?: never;
  continuous?: never;
  freeform: FreeformAnnotationConfigInput;
};
export type CategoricalAnnotationConfigInput = {
  description?: string | null;
  name: string;
  optimizationDirection: OptimizationDirection;
  values: ReadonlyArray<CategoricalAnnotationConfigValueInput>;
};
export type CategoricalAnnotationConfigValueInput = {
  label: string;
  score?: number | null;
};
export type ContinuousAnnotationConfigInput = {
  description?: string | null;
  lowerBound?: number | null;
  name: string;
  optimizationDirection: OptimizationDirection;
  upperBound?: number | null;
};
export type FreeformAnnotationConfigInput = {
  description?: string | null;
  lowerBound?: number | null;
  name: string;
  optimizationDirection?: OptimizationDirection | null;
  threshold?: number | null;
  upperBound?: number | null;
};
export type InlineCodeEvaluatorInput = {
  description?: string | null;
  language: Language;
  name: string;
  outputConfigs: ReadonlyArray<AnnotationConfigInput>;
  sandboxConfigId?: string | null;
  sourceCode: string;
};
export type EvaluatorInputMappingInput = {
  literalMapping: any;
  pathMapping: any;
};
export type GenerativeCredentialInput = {
  envVarName: string;
  value: string;
};
export type DecisionDatasetEvaluatorForm_previewMutation$variables = {
  input: EvaluatorPreviewsInput;
};
export type DecisionDatasetEvaluatorForm_previewMutation$data = {
  readonly evaluatorPreviews: {
    readonly results: ReadonlyArray<{
      readonly annotation: {
        readonly decision: {
          readonly answer: {
            readonly __typename: "ChoiceAnswer";
            readonly choice: string;
            readonly choiceProbabilities: ReadonlyArray<{
              readonly probability: number;
              readonly value: string;
            }>;
            readonly confidence: number;
          } | {
            readonly __typename: "PredicateAnswer";
            readonly probability: number;
          } | {
            readonly __typename: "ScaleAnswer";
            readonly confidence: number;
            readonly expectedLevel: number;
            readonly levelProbabilities: ReadonlyArray<{
              readonly level: number;
              readonly probability: number;
            }>;
          } | {
            // This will never be '%other', but we need some
            // value in case none of the concrete values match.
            readonly __typename: "%other";
          } | null;
          readonly modelProvider: GenerativeProviderKey | null;
          readonly question: {
            readonly choices: ReadonlyArray<{
              readonly description: string | null;
              readonly value: string;
            }> | null;
            readonly levels: ReadonlyArray<{
              readonly description: string | null;
              readonly label: string;
            }> | null;
            readonly name: string;
            readonly type: DecisionAnnotationQuestionType;
          } | null;
          readonly requestedModel: string | null;
          readonly resolvedModel: string | null;
          readonly status: DecisionAnnotationStatus;
        } | null;
        readonly explanation: string | null;
        readonly id: string;
        readonly label: string | null;
        readonly name: string;
        readonly score: number | null;
      } | null;
      readonly error: string | null;
      readonly evaluatorName: string;
    }>;
  };
};
export type DecisionDatasetEvaluatorForm_previewMutation = {
  response: DecisionDatasetEvaluatorForm_previewMutation$data;
  variables: DecisionDatasetEvaluatorForm_previewMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "input"
  }
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "value",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "label",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "probability",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "confidence",
  "storageKey": null
},
v7 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "input",
        "variableName": "input"
      }
    ],
    "concreteType": "EvaluatorPreviewsPayload",
    "kind": "LinkedField",
    "name": "evaluatorPreviews",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "EvaluationResult",
        "kind": "LinkedField",
        "name": "results",
        "plural": true,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "evaluatorName",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "error",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "concreteType": "ExperimentRunAnnotation",
            "kind": "LinkedField",
            "name": "annotation",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "DecisionAnnotation",
                "kind": "LinkedField",
                "name": "decision",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "status",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "DecisionAnnotationQuestion",
                    "kind": "LinkedField",
                    "name": "question",
                    "plural": false,
                    "selections": [
                      (v1/*:: as any*/),
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "type",
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "DecisionChoiceOption",
                        "kind": "LinkedField",
                        "name": "choices",
                        "plural": true,
                        "selections": [
                          (v2/*:: as any*/),
                          (v3/*:: as any*/)
                        ],
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "DecisionScaleLevel",
                        "kind": "LinkedField",
                        "name": "levels",
                        "plural": true,
                        "selections": [
                          (v4/*:: as any*/),
                          (v3/*:: as any*/)
                        ],
                        "storageKey": null
                      }
                    ],
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": null,
                    "kind": "LinkedField",
                    "name": "answer",
                    "plural": false,
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "__typename",
                        "storageKey": null
                      },
                      {
                        "kind": "InlineFragment",
                        "selections": [
                          (v5/*:: as any*/)
                        ],
                        "type": "PredicateAnswer",
                        "abstractKey": null
                      },
                      {
                        "kind": "InlineFragment",
                        "selections": [
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "choice",
                            "storageKey": null
                          },
                          (v6/*:: as any*/),
                          {
                            "alias": "choiceProbabilities",
                            "args": null,
                            "concreteType": "ChoiceProbability",
                            "kind": "LinkedField",
                            "name": "probabilities",
                            "plural": true,
                            "selections": [
                              (v2/*:: as any*/),
                              (v5/*:: as any*/)
                            ],
                            "storageKey": null
                          }
                        ],
                        "type": "ChoiceAnswer",
                        "abstractKey": null
                      },
                      {
                        "kind": "InlineFragment",
                        "selections": [
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "expectedLevel",
                            "storageKey": null
                          },
                          (v6/*:: as any*/),
                          {
                            "alias": "levelProbabilities",
                            "args": null,
                            "concreteType": "LevelProbability",
                            "kind": "LinkedField",
                            "name": "probabilities",
                            "plural": true,
                            "selections": [
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "level",
                                "storageKey": null
                              },
                              (v5/*:: as any*/)
                            ],
                            "storageKey": null
                          }
                        ],
                        "type": "ScaleAnswer",
                        "abstractKey": null
                      }
                    ],
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "requestedModel",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "resolvedModel",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "modelProvider",
                    "storageKey": null
                  }
                ],
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "id",
                "storageKey": null
              },
              (v1/*:: as any*/),
              (v4/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "score",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "explanation",
                "storageKey": null
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "DecisionDatasetEvaluatorForm_previewMutation",
    "selections": (v7/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "DecisionDatasetEvaluatorForm_previewMutation",
    "selections": (v7/*:: as any*/)
  },
  "params": {
    "cacheID": "cf56696890a3a742bb1f3d3f7033d14b",
    "id": null,
    "metadata": {},
    "name": "DecisionDatasetEvaluatorForm_previewMutation",
    "operationKind": "mutation",
    "text": "mutation DecisionDatasetEvaluatorForm_previewMutation(\n  $input: EvaluatorPreviewsInput!\n) {\n  evaluatorPreviews(input: $input) {\n    results {\n      evaluatorName\n      error\n      annotation {\n        decision {\n          status\n          question {\n            name\n            type\n            choices {\n              value\n              description\n            }\n            levels {\n              label\n              description\n            }\n          }\n          answer {\n            __typename\n            ... on PredicateAnswer {\n              probability\n            }\n            ... on ChoiceAnswer {\n              choice\n              confidence\n              choiceProbabilities: probabilities {\n                value\n                probability\n              }\n            }\n            ... on ScaleAnswer {\n              expectedLevel\n              confidence\n              levelProbabilities: probabilities {\n                level\n                probability\n              }\n            }\n          }\n          requestedModel\n          resolvedModel\n          modelProvider\n        }\n        id\n        name\n        label\n        score\n        explanation\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "33448acb842411843921e8674d252cd4";

export default node;
