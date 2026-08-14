/**
 * @generated SignedSource<<c94a3a1db8085c4979e7326cc3e92d3b>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type AnthropicOutputConfigEffort = "HIGH" | "LOW" | "MAX" | "MEDIUM" | "XHIGH";
export type AnthropicThinkingDisplay = "OMITTED" | "SUMMARIZED";
export type GenerativeProviderKey = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "CEREBRAS" | "DEEPSEEK" | "FIREWORKS" | "GOOGLE" | "GROQ" | "MOONSHOT" | "OLLAMA" | "OPENAI" | "PERPLEXITY" | "TOGETHER" | "XAI";
export type GoogleThinkingLevel = "HIGH" | "LOW" | "MEDIUM" | "MINIMAL";
export type OpenAIReasoningEffort = "HIGH" | "LOW" | "MEDIUM" | "MINIMAL" | "NONE" | "XHIGH";
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE" | "NONE";
export type PromptMessageRole = "AI" | "SYSTEM" | "TOOL" | "USER";
export type PromptTemplateFormat = "F_STRING" | "MUSTACHE" | "NONE";
export type UpdateDatasetLLMEvaluatorInput = {
  datasetEvaluatorId: string;
  datasetId: string;
  description?: string | null;
  inputMapping?: EvaluatorInputMappingInput | null;
  name: string;
  outputConfigs: ReadonlyArray<AnnotationConfigInput>;
  promptVersion: ChatPromptVersionInput;
  promptVersionId?: string | null;
};
export type ChatPromptVersionInput = {
  customProviderId?: string | null;
  description?: string | null;
  invocationParameters: PromptInvocationParametersInput;
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
export type EvaluatorInputMappingInput = {
  literalMapping: any;
  pathMapping: any;
};
export type EditLLMDatasetEvaluatorSlideover_updateLLMEvaluatorMutation$variables = {
  connectionIds: ReadonlyArray<string>;
  input: UpdateDatasetLLMEvaluatorInput;
};
export type EditLLMDatasetEvaluatorSlideover_updateLLMEvaluatorMutation$data = {
  readonly updateDatasetLlmEvaluator: {
    readonly evaluator: {
      readonly evaluator: {
        readonly name: string;
      };
      readonly id: string;
      readonly name: string;
      readonly " $fragmentSpreads": FragmentRefs<"DatasetEvaluatorsTable_row" | "EditLLMDatasetEvaluatorSlideover_evaluator" | "LLMDatasetEvaluatorDetails_datasetEvaluator" | "PlaygroundDatasetSection_evaluator">;
    };
  };
};
export type EditLLMDatasetEvaluatorSlideover_updateLLMEvaluatorMutation = {
  response: EditLLMDatasetEvaluatorSlideover_updateLLMEvaluatorMutation$data;
  variables: EditLLMDatasetEvaluatorSlideover_updateLLMEvaluatorMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "connectionIds"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "input"
},
v2 = [
  {
    "kind": "Variable",
    "name": "input",
    "variableName": "input"
  }
],
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v5 = [
  (v4/*:: as any*/)
],
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "updatedAt",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "username",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "profilePictureUrl",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "kind",
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "createdAt",
  "storageKey": null
},
v12 = [
  (v3/*:: as any*/),
  (v4/*:: as any*/)
],
v13 = {
  "alias": null,
  "args": null,
  "concreteType": "Prompt",
  "kind": "LinkedField",
  "name": "prompt",
  "plural": false,
  "selections": (v12/*:: as any*/),
  "storageKey": null
},
v14 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "modelName",
  "storageKey": null
},
v15 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "modelProvider",
  "storageKey": null
},
v16 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "language",
  "storageKey": null
},
v17 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "backendType",
  "storageKey": null
},
v18 = {
  "alias": null,
  "args": null,
  "concreteType": "EvaluatorInputMapping",
  "kind": "LinkedField",
  "name": "inputMapping",
  "plural": false,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "literalMapping",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "pathMapping",
      "storageKey": null
    }
  ],
  "storageKey": null
},
v19 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "isBuiltin",
  "storageKey": null
},
v20 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v21 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "optimizationDirection",
  "storageKey": null
},
v22 = {
  "kind": "InlineFragment",
  "selections": [
    (v4/*:: as any*/),
    (v21/*:: as any*/),
    {
      "alias": null,
      "args": null,
      "concreteType": "CategoricalAnnotationValue",
      "kind": "LinkedField",
      "name": "values",
      "plural": true,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "label",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "score",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "CategoricalAnnotationConfig",
  "abstractKey": null
},
v23 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "lowerBound",
  "storageKey": null
},
v24 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "upperBound",
  "storageKey": null
},
v25 = {
  "kind": "InlineFragment",
  "selections": [
    (v4/*:: as any*/),
    (v21/*:: as any*/),
    (v23/*:: as any*/),
    (v24/*:: as any*/)
  ],
  "type": "ContinuousAnnotationConfig",
  "abstractKey": null
},
v26 = {
  "kind": "InlineFragment",
  "selections": [
    (v4/*:: as any*/),
    (v21/*:: as any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "threshold",
      "storageKey": null
    },
    (v23/*:: as any*/),
    (v24/*:: as any*/)
  ],
  "type": "FreeformAnnotationConfig",
  "abstractKey": null
},
v27 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "strict",
  "storageKey": null
},
v28 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "temperature",
  "storageKey": null
},
v29 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "frequencyPenalty",
  "storageKey": null
},
v30 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "presencePenalty",
  "storageKey": null
},
v31 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "topP",
  "storageKey": null
},
v32 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "extraBody",
  "storageKey": null
},
v33 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "stopSequences",
  "storageKey": null
},
v34 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "toolCallId",
  "storageKey": null
},
v35 = {
  "kind": "InlineFragment",
  "selections": [
    (v3/*:: as any*/)
  ],
  "type": "Node",
  "abstractKey": "__isNode"
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v1/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "EditLLMDatasetEvaluatorSlideover_updateLLMEvaluatorMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*:: as any*/),
        "concreteType": "DatasetEvaluatorMutationPayload",
        "kind": "LinkedField",
        "name": "updateDatasetLlmEvaluator",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "DatasetEvaluator",
            "kind": "LinkedField",
            "name": "evaluator",
            "plural": false,
            "selections": [
              (v3/*:: as any*/),
              (v4/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": null,
                "kind": "LinkedField",
                "name": "evaluator",
                "plural": false,
                "selections": (v5/*:: as any*/),
                "storageKey": null
              },
              {
                "kind": "InlineDataFragmentSpread",
                "name": "DatasetEvaluatorsTable_row",
                "selections": [
                  (v3/*:: as any*/),
                  (v4/*:: as any*/),
                  (v6/*:: as any*/),
                  (v7/*:: as any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "User",
                    "kind": "LinkedField",
                    "name": "user",
                    "plural": false,
                    "selections": [
                      (v8/*:: as any*/),
                      (v9/*:: as any*/)
                    ],
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": null,
                    "kind": "LinkedField",
                    "name": "evaluator",
                    "plural": false,
                    "selections": [
                      (v3/*:: as any*/),
                      (v4/*:: as any*/),
                      (v10/*:: as any*/),
                      (v11/*:: as any*/),
                      (v7/*:: as any*/),
                      {
                        "kind": "InlineFragment",
                        "selections": [
                          (v13/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "PromptVersionTag",
                            "kind": "LinkedField",
                            "name": "promptVersionTag",
                            "plural": false,
                            "selections": (v5/*:: as any*/),
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "PromptVersion",
                            "kind": "LinkedField",
                            "name": "promptVersion",
                            "plural": false,
                            "selections": [
                              (v14/*:: as any*/),
                              (v15/*:: as any*/)
                            ],
                            "storageKey": null
                          }
                        ],
                        "type": "LLMEvaluator",
                        "abstractKey": null
                      },
                      {
                        "kind": "InlineFragment",
                        "selections": [
                          (v16/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "SandboxConfig",
                            "kind": "LinkedField",
                            "name": "sandboxConfig",
                            "plural": false,
                            "selections": [
                              (v3/*:: as any*/),
                              (v4/*:: as any*/),
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "SandboxProvider",
                                "kind": "LinkedField",
                                "name": "provider",
                                "plural": false,
                                "selections": [
                                  (v17/*:: as any*/)
                                ],
                                "storageKey": null
                              }
                            ],
                            "storageKey": null
                          }
                        ],
                        "type": "CodeEvaluator",
                        "abstractKey": null
                      }
                    ],
                    "storageKey": null
                  }
                ],
                "args": null,
                "argumentDefinitions": []
              },
              {
                "kind": "InlineDataFragmentSpread",
                "name": "PlaygroundDatasetSection_evaluator",
                "selections": [
                  (v3/*:: as any*/),
                  (v4/*:: as any*/),
                  (v18/*:: as any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": null,
                    "kind": "LinkedField",
                    "name": "evaluator",
                    "plural": false,
                    "selections": [
                      (v3/*:: as any*/),
                      (v10/*:: as any*/),
                      (v19/*:: as any*/)
                    ],
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": null,
                    "kind": "LinkedField",
                    "name": "outputConfigs",
                    "plural": true,
                    "selections": [
                      (v20/*:: as any*/),
                      (v22/*:: as any*/),
                      (v25/*:: as any*/),
                      (v26/*:: as any*/)
                    ],
                    "storageKey": null
                  }
                ],
                "args": null,
                "argumentDefinitions": []
              },
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "EditLLMDatasetEvaluatorSlideover_evaluator"
              },
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "LLMDatasetEvaluatorDetails_datasetEvaluator"
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v1/*:: as any*/),
      (v0/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "EditLLMDatasetEvaluatorSlideover_updateLLMEvaluatorMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*:: as any*/),
        "concreteType": "DatasetEvaluatorMutationPayload",
        "kind": "LinkedField",
        "name": "updateDatasetLlmEvaluator",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "DatasetEvaluator",
            "kind": "LinkedField",
            "name": "evaluator",
            "plural": false,
            "selections": [
              (v3/*:: as any*/),
              (v4/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": null,
                "kind": "LinkedField",
                "name": "evaluator",
                "plural": false,
                "selections": [
                  (v20/*:: as any*/),
                  (v4/*:: as any*/),
                  (v3/*:: as any*/),
                  (v10/*:: as any*/),
                  (v11/*:: as any*/),
                  (v7/*:: as any*/),
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      (v13/*:: as any*/),
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "PromptVersionTag",
                        "kind": "LinkedField",
                        "name": "promptVersionTag",
                        "plural": false,
                        "selections": [
                          (v4/*:: as any*/),
                          (v3/*:: as any*/)
                        ],
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "PromptVersion",
                        "kind": "LinkedField",
                        "name": "promptVersion",
                        "plural": false,
                        "selections": [
                          (v14/*:: as any*/),
                          (v15/*:: as any*/),
                          (v3/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "PromptTools",
                            "kind": "LinkedField",
                            "name": "tools",
                            "plural": false,
                            "selections": [
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": null,
                                "kind": "LinkedField",
                                "name": "tools",
                                "plural": true,
                                "selections": [
                                  (v20/*:: as any*/),
                                  {
                                    "kind": "InlineFragment",
                                    "selections": [
                                      {
                                        "alias": null,
                                        "args": null,
                                        "concreteType": "PromptToolFunctionDefinition",
                                        "kind": "LinkedField",
                                        "name": "function",
                                        "plural": false,
                                        "selections": [
                                          {
                                            "alias": null,
                                            "args": null,
                                            "kind": "ScalarField",
                                            "name": "parameters",
                                            "storageKey": null
                                          },
                                          (v4/*:: as any*/),
                                          (v6/*:: as any*/),
                                          (v27/*:: as any*/)
                                        ],
                                        "storageKey": null
                                      }
                                    ],
                                    "type": "PromptToolFunction",
                                    "abstractKey": null
                                  },
                                  {
                                    "kind": "InlineFragment",
                                    "selections": [
                                      {
                                        "alias": null,
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "raw",
                                        "storageKey": null
                                      }
                                    ],
                                    "type": "PromptToolRaw",
                                    "abstractKey": null
                                  }
                                ],
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "PromptToolChoice",
                                "kind": "LinkedField",
                                "name": "toolChoice",
                                "plural": false,
                                "selections": [
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
                                    "kind": "ScalarField",
                                    "name": "functionName",
                                    "storageKey": null
                                  }
                                ],
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "disableParallelToolCalls",
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
                            "name": "invocationParameters",
                            "plural": false,
                            "selections": [
                              (v20/*:: as any*/),
                              {
                                "kind": "TypeDiscriminator",
                                "abstractKey": "__isPromptInvocationParameters"
                              },
                              {
                                "kind": "InlineFragment",
                                "selections": [
                                  (v28/*:: as any*/),
                                  {
                                    "alias": "openaiMaxTokens",
                                    "args": null,
                                    "kind": "ScalarField",
                                    "name": "maxTokens",
                                    "storageKey": null
                                  },
                                  {
                                    "alias": null,
                                    "args": null,
                                    "kind": "ScalarField",
                                    "name": "maxCompletionTokens",
                                    "storageKey": null
                                  },
                                  (v29/*:: as any*/),
                                  (v30/*:: as any*/),
                                  (v31/*:: as any*/),
                                  {
                                    "alias": null,
                                    "args": null,
                                    "kind": "ScalarField",
                                    "name": "seed",
                                    "storageKey": null
                                  },
                                  {
                                    "alias": null,
                                    "args": null,
                                    "kind": "ScalarField",
                                    "name": "stop",
                                    "storageKey": null
                                  },
                                  {
                                    "alias": null,
                                    "args": null,
                                    "kind": "ScalarField",
                                    "name": "reasoningEffort",
                                    "storageKey": null
                                  },
                                  (v32/*:: as any*/)
                                ],
                                "type": "PromptOpenAIInvocationParameters",
                                "abstractKey": null
                              },
                              {
                                "kind": "InlineFragment",
                                "selections": [
                                  {
                                    "alias": "anthropicMaxTokens",
                                    "args": null,
                                    "kind": "ScalarField",
                                    "name": "maxTokens",
                                    "storageKey": null
                                  },
                                  (v28/*:: as any*/),
                                  (v31/*:: as any*/),
                                  (v33/*:: as any*/),
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": "PromptAnthropicOutputConfig",
                                    "kind": "LinkedField",
                                    "name": "outputConfig",
                                    "plural": false,
                                    "selections": [
                                      {
                                        "alias": null,
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "effort",
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
                                    "name": "thinking",
                                    "plural": false,
                                    "selections": [
                                      (v20/*:: as any*/),
                                      {
                                        "kind": "InlineFragment",
                                        "selections": [
                                          {
                                            "alias": null,
                                            "args": null,
                                            "kind": "ScalarField",
                                            "name": "disabled",
                                            "storageKey": null
                                          }
                                        ],
                                        "type": "PromptAnthropicThinkingDisabled",
                                        "abstractKey": null
                                      },
                                      {
                                        "kind": "InlineFragment",
                                        "selections": [
                                          {
                                            "alias": null,
                                            "args": null,
                                            "kind": "ScalarField",
                                            "name": "budgetTokens",
                                            "storageKey": null
                                          },
                                          {
                                            "alias": "enabledDisplay",
                                            "args": null,
                                            "kind": "ScalarField",
                                            "name": "display",
                                            "storageKey": null
                                          }
                                        ],
                                        "type": "PromptAnthropicThinkingEnabled",
                                        "abstractKey": null
                                      },
                                      {
                                        "kind": "InlineFragment",
                                        "selections": [
                                          {
                                            "alias": "adaptiveDisplay",
                                            "args": null,
                                            "kind": "ScalarField",
                                            "name": "display",
                                            "storageKey": null
                                          }
                                        ],
                                        "type": "PromptAnthropicThinkingAdaptive",
                                        "abstractKey": null
                                      }
                                    ],
                                    "storageKey": null
                                  },
                                  (v32/*:: as any*/)
                                ],
                                "type": "PromptAnthropicInvocationParameters",
                                "abstractKey": null
                              },
                              {
                                "kind": "InlineFragment",
                                "selections": [
                                  (v28/*:: as any*/),
                                  {
                                    "alias": null,
                                    "args": null,
                                    "kind": "ScalarField",
                                    "name": "maxOutputTokens",
                                    "storageKey": null
                                  },
                                  (v33/*:: as any*/),
                                  (v30/*:: as any*/),
                                  (v29/*:: as any*/),
                                  (v31/*:: as any*/),
                                  {
                                    "alias": null,
                                    "args": null,
                                    "kind": "ScalarField",
                                    "name": "topK",
                                    "storageKey": null
                                  },
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": "PromptGoogleThinkingConfig",
                                    "kind": "LinkedField",
                                    "name": "thinkingConfig",
                                    "plural": false,
                                    "selections": [
                                      {
                                        "alias": null,
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "thinkingBudget",
                                        "storageKey": null
                                      },
                                      {
                                        "alias": null,
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "thinkingLevel",
                                        "storageKey": null
                                      },
                                      {
                                        "alias": null,
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "includeThoughts",
                                        "storageKey": null
                                      }
                                    ],
                                    "storageKey": null
                                  }
                                ],
                                "type": "PromptGoogleInvocationParameters",
                                "abstractKey": null
                              },
                              {
                                "kind": "InlineFragment",
                                "selections": [
                                  {
                                    "alias": "awsMaxTokens",
                                    "args": null,
                                    "kind": "ScalarField",
                                    "name": "maxTokens",
                                    "storageKey": null
                                  },
                                  (v28/*:: as any*/),
                                  (v31/*:: as any*/),
                                  (v33/*:: as any*/)
                                ],
                                "type": "PromptAwsInvocationParameters",
                                "abstractKey": null
                              }
                            ],
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "GenerativeModelCustomProvider",
                            "kind": "LinkedField",
                            "name": "customProvider",
                            "plural": false,
                            "selections": (v12/*:: as any*/),
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "PromptResponseFormatJSONSchema",
                            "kind": "LinkedField",
                            "name": "responseFormat",
                            "plural": false,
                            "selections": [
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "PromptResponseFormatJSONSchemaDefinition",
                                "kind": "LinkedField",
                                "name": "jsonSchema",
                                "plural": false,
                                "selections": [
                                  (v4/*:: as any*/),
                                  (v6/*:: as any*/),
                                  {
                                    "alias": null,
                                    "args": null,
                                    "kind": "ScalarField",
                                    "name": "schema",
                                    "storageKey": null
                                  },
                                  (v27/*:: as any*/)
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
                            "name": "template",
                            "plural": false,
                            "selections": [
                              (v20/*:: as any*/),
                              {
                                "kind": "InlineFragment",
                                "selections": [
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": "PromptMessage",
                                    "kind": "LinkedField",
                                    "name": "messages",
                                    "plural": true,
                                    "selections": [
                                      {
                                        "alias": null,
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "role",
                                        "storageKey": null
                                      },
                                      {
                                        "alias": null,
                                        "args": null,
                                        "concreteType": null,
                                        "kind": "LinkedField",
                                        "name": "content",
                                        "plural": true,
                                        "selections": [
                                          (v20/*:: as any*/),
                                          {
                                            "kind": "InlineFragment",
                                            "selections": [
                                              {
                                                "alias": null,
                                                "args": null,
                                                "concreteType": "TextContentValue",
                                                "kind": "LinkedField",
                                                "name": "text",
                                                "plural": false,
                                                "selections": [
                                                  {
                                                    "alias": null,
                                                    "args": null,
                                                    "kind": "ScalarField",
                                                    "name": "text",
                                                    "storageKey": null
                                                  }
                                                ],
                                                "storageKey": null
                                              }
                                            ],
                                            "type": "TextContentPart",
                                            "abstractKey": null
                                          },
                                          {
                                            "kind": "InlineFragment",
                                            "selections": [
                                              {
                                                "alias": null,
                                                "args": null,
                                                "concreteType": "ToolCallContentValue",
                                                "kind": "LinkedField",
                                                "name": "toolCall",
                                                "plural": false,
                                                "selections": [
                                                  (v34/*:: as any*/),
                                                  {
                                                    "alias": null,
                                                    "args": null,
                                                    "concreteType": "ToolCallFunction",
                                                    "kind": "LinkedField",
                                                    "name": "toolCall",
                                                    "plural": false,
                                                    "selections": [
                                                      (v4/*:: as any*/),
                                                      {
                                                        "alias": null,
                                                        "args": null,
                                                        "kind": "ScalarField",
                                                        "name": "arguments",
                                                        "storageKey": null
                                                      }
                                                    ],
                                                    "storageKey": null
                                                  }
                                                ],
                                                "storageKey": null
                                              }
                                            ],
                                            "type": "ToolCallContentPart",
                                            "abstractKey": null
                                          },
                                          {
                                            "kind": "InlineFragment",
                                            "selections": [
                                              {
                                                "alias": null,
                                                "args": null,
                                                "concreteType": "ToolResultContentValue",
                                                "kind": "LinkedField",
                                                "name": "toolResult",
                                                "plural": false,
                                                "selections": [
                                                  (v34/*:: as any*/),
                                                  {
                                                    "alias": null,
                                                    "args": null,
                                                    "kind": "ScalarField",
                                                    "name": "result",
                                                    "storageKey": null
                                                  }
                                                ],
                                                "storageKey": null
                                              }
                                            ],
                                            "type": "ToolResultContentPart",
                                            "abstractKey": null
                                          }
                                        ],
                                        "storageKey": null
                                      }
                                    ],
                                    "storageKey": null
                                  }
                                ],
                                "type": "PromptChatTemplate",
                                "abstractKey": null
                              },
                              {
                                "kind": "InlineFragment",
                                "selections": [
                                  {
                                    "alias": null,
                                    "args": null,
                                    "kind": "ScalarField",
                                    "name": "template",
                                    "storageKey": null
                                  }
                                ],
                                "type": "PromptStringTemplate",
                                "abstractKey": null
                              }
                            ],
                            "storageKey": null
                          },
                          {
                            "alias": "provider",
                            "args": null,
                            "kind": "ScalarField",
                            "name": "modelProvider",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "templateType",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "templateFormat",
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
                        "name": "outputConfigs",
                        "plural": true,
                        "selections": [
                          (v20/*:: as any*/),
                          (v22/*:: as any*/),
                          (v35/*:: as any*/)
                        ],
                        "storageKey": null
                      }
                    ],
                    "type": "LLMEvaluator",
                    "abstractKey": null
                  },
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      (v16/*:: as any*/),
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "SandboxConfig",
                        "kind": "LinkedField",
                        "name": "sandboxConfig",
                        "plural": false,
                        "selections": [
                          (v3/*:: as any*/),
                          (v4/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "SandboxProvider",
                            "kind": "LinkedField",
                            "name": "provider",
                            "plural": false,
                            "selections": [
                              (v17/*:: as any*/),
                              (v3/*:: as any*/)
                            ],
                            "storageKey": null
                          }
                        ],
                        "storageKey": null
                      }
                    ],
                    "type": "CodeEvaluator",
                    "abstractKey": null
                  },
                  (v19/*:: as any*/),
                  (v6/*:: as any*/)
                ],
                "storageKey": null
              },
              (v6/*:: as any*/),
              (v7/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "User",
                "kind": "LinkedField",
                "name": "user",
                "plural": false,
                "selections": [
                  (v8/*:: as any*/),
                  (v9/*:: as any*/),
                  (v3/*:: as any*/)
                ],
                "storageKey": null
              },
              (v18/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": null,
                "kind": "LinkedField",
                "name": "outputConfigs",
                "plural": true,
                "selections": [
                  (v20/*:: as any*/),
                  (v22/*:: as any*/),
                  (v25/*:: as any*/),
                  (v26/*:: as any*/),
                  (v35/*:: as any*/)
                ],
                "storageKey": null
              }
            ],
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "filters": null,
            "handle": "appendNode",
            "key": "",
            "kind": "LinkedHandle",
            "name": "evaluator",
            "handleArgs": [
              {
                "kind": "Variable",
                "name": "connections",
                "variableName": "connectionIds"
              },
              {
                "kind": "Literal",
                "name": "edgeTypeName",
                "value": "DatasetEvaluatorEdge"
              }
            ]
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "2b2688d498b7b25b3395a03d720f7300",
    "id": null,
    "metadata": {},
    "name": "EditLLMDatasetEvaluatorSlideover_updateLLMEvaluatorMutation",
    "operationKind": "mutation",
    "text": "mutation EditLLMDatasetEvaluatorSlideover_updateLLMEvaluatorMutation(\n  $input: UpdateDatasetLLMEvaluatorInput!\n) {\n  updateDatasetLlmEvaluator(input: $input) {\n    evaluator {\n      id\n      name\n      evaluator {\n        __typename\n        name\n        id\n      }\n      ...DatasetEvaluatorsTable_row\n      ...PlaygroundDatasetSection_evaluator\n      ...EditLLMDatasetEvaluatorSlideover_evaluator\n      ...LLMDatasetEvaluatorDetails_datasetEvaluator\n    }\n  }\n}\n\nfragment DatasetEvaluatorsTable_row on DatasetEvaluator {\n  id\n  name\n  description\n  updatedAt\n  user {\n    username\n    profilePictureUrl\n    id\n  }\n  evaluator {\n    __typename\n    id\n    name\n    kind\n    createdAt\n    updatedAt\n    ... on LLMEvaluator {\n      prompt {\n        id\n        name\n      }\n      promptVersionTag {\n        name\n        id\n      }\n      promptVersion {\n        modelName\n        modelProvider\n        id\n      }\n    }\n    ... on CodeEvaluator {\n      language\n      sandboxConfig {\n        id\n        name\n        provider {\n          backendType\n          id\n        }\n      }\n    }\n  }\n}\n\nfragment EditLLMDatasetEvaluatorSlideover_evaluator on DatasetEvaluator {\n  id\n  name\n  inputMapping {\n    literalMapping\n    pathMapping\n  }\n  outputConfigs {\n    __typename\n    ... on CategoricalAnnotationConfig {\n      name\n      optimizationDirection\n      values {\n        label\n        score\n      }\n    }\n    ... on ContinuousAnnotationConfig {\n      name\n      optimizationDirection\n      lowerBound\n      upperBound\n    }\n    ... on Node {\n      __isNode: __typename\n      id\n    }\n  }\n  evaluator {\n    __typename\n    description\n    kind\n    name\n    ... on LLMEvaluator {\n      outputConfigs {\n        __typename\n        ... on CategoricalAnnotationConfig {\n          name\n          optimizationDirection\n          values {\n            label\n            score\n          }\n        }\n        ... on Node {\n          __isNode: __typename\n          id\n        }\n      }\n      prompt {\n        id\n        name\n      }\n      promptVersion {\n        tools {\n          tools {\n            __typename\n            ... on PromptToolFunction {\n              function {\n                parameters\n              }\n            }\n            ... on PromptToolRaw {\n              raw\n            }\n          }\n        }\n        ...fetchPlaygroundPrompt_promptVersionToInstance_promptVersion\n        id\n      }\n    }\n    id\n  }\n}\n\nfragment LLMDatasetEvaluatorDetails_datasetEvaluator on DatasetEvaluator {\n  id\n  inputMapping {\n    literalMapping\n    pathMapping\n  }\n  evaluator {\n    __typename\n    kind\n    ... on LLMEvaluator {\n      prompt {\n        id\n        name\n      }\n      promptVersion {\n        modelName\n        modelProvider\n        tools {\n          tools {\n            __typename\n            ... on PromptToolFunction {\n              function {\n                parameters\n              }\n            }\n            ... on PromptToolRaw {\n              raw\n            }\n          }\n        }\n        ...fetchPlaygroundPrompt_promptVersionToInstance_promptVersion\n        ...PromptChatMessagesCard__main\n        id\n      }\n      promptVersionTag {\n        name\n        id\n      }\n    }\n    id\n  }\n  outputConfigs {\n    __typename\n    ... on CategoricalAnnotationConfig {\n      name\n      optimizationDirection\n      values {\n        label\n        score\n      }\n    }\n    ... on ContinuousAnnotationConfig {\n      name\n      optimizationDirection\n      lowerBound\n      upperBound\n    }\n    ... on Node {\n      __isNode: __typename\n      id\n    }\n  }\n}\n\nfragment PlaygroundDatasetSection_evaluator on DatasetEvaluator {\n  id\n  name\n  inputMapping {\n    literalMapping\n    pathMapping\n  }\n  evaluator {\n    __typename\n    id\n    kind\n    isBuiltin\n  }\n  outputConfigs {\n    __typename\n    ... on CategoricalAnnotationConfig {\n      name\n      optimizationDirection\n      values {\n        label\n        score\n      }\n    }\n    ... on ContinuousAnnotationConfig {\n      name\n      optimizationDirection\n      lowerBound\n      upperBound\n    }\n    ... on FreeformAnnotationConfig {\n      name\n      optimizationDirection\n      threshold\n      lowerBound\n      upperBound\n    }\n    ... on Node {\n      __isNode: __typename\n      id\n    }\n  }\n}\n\nfragment PromptChatMessagesCard__main on PromptVersion {\n  provider: modelProvider\n  template {\n    __typename\n    ... on PromptChatTemplate {\n      messages {\n        role\n        content {\n          __typename\n          ... on TextContentPart {\n            text {\n              text\n            }\n          }\n          ... on ToolCallContentPart {\n            toolCall {\n              toolCallId\n              toolCall {\n                arguments\n                name\n              }\n            }\n          }\n          ... on ToolResultContentPart {\n            toolResult {\n              toolCallId\n              result\n            }\n          }\n        }\n      }\n    }\n    ... on PromptStringTemplate {\n      template\n    }\n  }\n  templateType\n  templateFormat\n}\n\nfragment PromptInvocationParametersReadableFragment on PromptInvocationParameters {\n  __isPromptInvocationParameters: __typename\n  __typename\n  ... on PromptOpenAIInvocationParameters {\n    temperature\n    openaiMaxTokens: maxTokens\n    maxCompletionTokens\n    frequencyPenalty\n    presencePenalty\n    topP\n    seed\n    stop\n    reasoningEffort\n    extraBody\n  }\n  ... on PromptAnthropicInvocationParameters {\n    anthropicMaxTokens: maxTokens\n    temperature\n    topP\n    stopSequences\n    outputConfig {\n      effort\n    }\n    thinking {\n      __typename\n      ... on PromptAnthropicThinkingDisabled {\n        disabled\n      }\n      ... on PromptAnthropicThinkingEnabled {\n        budgetTokens\n        enabledDisplay: display\n      }\n      ... on PromptAnthropicThinkingAdaptive {\n        adaptiveDisplay: display\n      }\n    }\n    extraBody\n  }\n  ... on PromptGoogleInvocationParameters {\n    temperature\n    maxOutputTokens\n    stopSequences\n    presencePenalty\n    frequencyPenalty\n    topP\n    topK\n    thinkingConfig {\n      thinkingBudget\n      thinkingLevel\n      includeThoughts\n    }\n  }\n  ... on PromptAwsInvocationParameters {\n    awsMaxTokens: maxTokens\n    temperature\n    topP\n    stopSequences\n  }\n}\n\nfragment fetchPlaygroundPrompt_promptVersionToInstance_promptVersion on PromptVersion {\n  id\n  modelName\n  modelProvider\n  invocationParameters {\n    __typename\n    ...PromptInvocationParametersReadableFragment\n  }\n  customProvider {\n    id\n    name\n  }\n  responseFormat {\n    jsonSchema {\n      name\n      description\n      schema\n      strict\n    }\n  }\n  template {\n    __typename\n    ... on PromptChatTemplate {\n      messages {\n        role\n        content {\n          __typename\n          ... on TextContentPart {\n            text {\n              text\n            }\n          }\n          ... on ToolCallContentPart {\n            toolCall {\n              toolCallId\n              toolCall {\n                name\n                arguments\n              }\n            }\n          }\n          ... on ToolResultContentPart {\n            toolResult {\n              toolCallId\n              result\n            }\n          }\n        }\n      }\n    }\n    ... on PromptStringTemplate {\n      template\n    }\n  }\n  tools {\n    tools {\n      __typename\n      ... on PromptToolFunction {\n        function {\n          name\n          description\n          parameters\n          strict\n        }\n      }\n      ... on PromptToolRaw {\n        raw\n      }\n    }\n    toolChoice {\n      type\n      functionName\n    }\n    disableParallelToolCalls\n  }\n}\n"
  }
};
})();

(node as any).hash = "eb7ef93d11916e1e2c2e10e672b5c500";

export default node;
