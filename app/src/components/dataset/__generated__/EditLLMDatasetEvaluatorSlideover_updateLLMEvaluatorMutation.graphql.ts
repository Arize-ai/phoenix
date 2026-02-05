/**
 * @generated SignedSource<<4e774cbec9a5e1730bd938378f01a7c6>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ModelProvider = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "DEEPSEEK" | "GOOGLE" | "OLLAMA" | "OPENAI" | "XAI";
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE" | "NONE";
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
  invocationParameters?: any;
  modelName: string;
  modelProvider: ModelProvider;
  responseFormat?: ResponseFormatInput | null;
  template: PromptChatTemplateInput;
  templateFormat: PromptTemplateFormat;
  tools?: ReadonlyArray<ToolDefinitionInput>;
};
export type PromptChatTemplateInput = {
  messages: ReadonlyArray<PromptMessageInput>;
};
export type PromptMessageInput = {
  content: ReadonlyArray<ContentPartInput>;
  role: string;
};
export type ContentPartInput = {
  text?: TextContentValueInput | null;
  toolCall?: ToolCallContentValueInput | null;
  toolResult?: ToolResultContentValueInput | null;
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
export type ToolDefinitionInput = {
  definition: any;
};
export type ResponseFormatInput = {
  definition: any;
};
export type AnnotationConfigInput = {
  categorical?: CategoricalAnnotationConfigInput | null;
  continuous?: ContinuousAnnotationConfigInput | null;
  freeform?: FreeformAnnotationConfigInput | null;
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
  name: string;
};
export type EvaluatorInputMappingInput = {
  literalMapping?: any;
  pathMapping?: any;
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
  (v4/*: any*/)
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
  (v3/*: any*/),
  (v4/*: any*/)
],
v13 = {
  "alias": null,
  "args": null,
  "concreteType": "Prompt",
  "kind": "LinkedField",
  "name": "prompt",
  "plural": false,
  "selections": (v12/*: any*/),
  "storageKey": null
},
v14 = {
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
v15 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "isBuiltin",
  "storageKey": null
},
v16 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "optimizationDirection",
  "storageKey": null
},
v17 = {
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
},
v18 = {
  "kind": "InlineFragment",
  "selections": [
    (v4/*: any*/),
    (v16/*: any*/),
    (v17/*: any*/)
  ],
  "type": "CategoricalAnnotationConfig",
  "abstractKey": null
},
v19 = {
  "kind": "InlineFragment",
  "selections": [
    (v4/*: any*/),
    (v16/*: any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "lowerBound",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "upperBound",
      "storageKey": null
    }
  ],
  "type": "ContinuousAnnotationConfig",
  "abstractKey": null
},
v20 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v21 = {
  "kind": "InlineFragment",
  "selections": (v5/*: any*/),
  "type": "AnnotationConfigBase",
  "abstractKey": "__isAnnotationConfigBase"
},
v22 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "definition",
    "storageKey": null
  }
],
v23 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "toolCallId",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "EditLLMDatasetEvaluatorSlideover_updateLLMEvaluatorMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
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
              (v3/*: any*/),
              (v4/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": null,
                "kind": "LinkedField",
                "name": "evaluator",
                "plural": false,
                "selections": (v5/*: any*/),
                "storageKey": null
              },
              {
                "kind": "InlineDataFragmentSpread",
                "name": "DatasetEvaluatorsTable_row",
                "selections": [
                  (v3/*: any*/),
                  (v4/*: any*/),
                  (v6/*: any*/),
                  (v7/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "User",
                    "kind": "LinkedField",
                    "name": "user",
                    "plural": false,
                    "selections": [
                      (v8/*: any*/),
                      (v9/*: any*/)
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
                      (v3/*: any*/),
                      (v4/*: any*/),
                      (v10/*: any*/),
                      (v11/*: any*/),
                      (v7/*: any*/),
                      {
                        "kind": "InlineFragment",
                        "selections": [
                          (v13/*: any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "PromptVersionTag",
                            "kind": "LinkedField",
                            "name": "promptVersionTag",
                            "plural": false,
                            "selections": (v5/*: any*/),
                            "storageKey": null
                          }
                        ],
                        "type": "LLMEvaluator",
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
                  (v3/*: any*/),
                  (v4/*: any*/),
                  (v14/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": null,
                    "kind": "LinkedField",
                    "name": "evaluator",
                    "plural": false,
                    "selections": [
                      (v3/*: any*/),
                      (v10/*: any*/),
                      (v15/*: any*/)
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
                      (v18/*: any*/),
                      (v19/*: any*/)
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
      (v1/*: any*/),
      (v0/*: any*/)
    ],
    "kind": "Operation",
    "name": "EditLLMDatasetEvaluatorSlideover_updateLLMEvaluatorMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
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
              (v3/*: any*/),
              (v4/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": null,
                "kind": "LinkedField",
                "name": "evaluator",
                "plural": false,
                "selections": [
                  (v20/*: any*/),
                  (v4/*: any*/),
                  (v3/*: any*/),
                  (v10/*: any*/),
                  (v11/*: any*/),
                  (v7/*: any*/),
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      (v13/*: any*/),
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "PromptVersionTag",
                        "kind": "LinkedField",
                        "name": "promptVersionTag",
                        "plural": false,
                        "selections": [
                          (v4/*: any*/),
                          (v3/*: any*/)
                        ],
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "CategoricalAnnotationConfig",
                        "kind": "LinkedField",
                        "name": "outputConfigs",
                        "plural": true,
                        "selections": [
                          (v21/*: any*/),
                          (v16/*: any*/),
                          (v17/*: any*/),
                          (v3/*: any*/)
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
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "ToolDefinition",
                            "kind": "LinkedField",
                            "name": "tools",
                            "plural": true,
                            "selections": (v22/*: any*/),
                            "storageKey": null
                          },
                          (v3/*: any*/),
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "modelName",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "modelProvider",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "invocationParameters",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "GenerativeModelCustomProvider",
                            "kind": "LinkedField",
                            "name": "customProvider",
                            "plural": false,
                            "selections": (v12/*: any*/),
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "ResponseFormat",
                            "kind": "LinkedField",
                            "name": "responseFormat",
                            "plural": false,
                            "selections": (v22/*: any*/),
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
                              (v20/*: any*/),
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
                                          (v20/*: any*/),
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
                                                  (v23/*: any*/),
                                                  {
                                                    "alias": null,
                                                    "args": null,
                                                    "concreteType": "ToolCallFunction",
                                                    "kind": "LinkedField",
                                                    "name": "toolCall",
                                                    "plural": false,
                                                    "selections": [
                                                      (v4/*: any*/),
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
                                                  (v23/*: any*/),
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
                          }
                        ],
                        "storageKey": null
                      }
                    ],
                    "type": "LLMEvaluator",
                    "abstractKey": null
                  },
                  (v15/*: any*/),
                  (v6/*: any*/)
                ],
                "storageKey": null
              },
              (v6/*: any*/),
              (v7/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "User",
                "kind": "LinkedField",
                "name": "user",
                "plural": false,
                "selections": [
                  (v8/*: any*/),
                  (v9/*: any*/),
                  (v3/*: any*/)
                ],
                "storageKey": null
              },
              (v14/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": null,
                "kind": "LinkedField",
                "name": "outputConfigs",
                "plural": true,
                "selections": [
                  (v20/*: any*/),
                  (v18/*: any*/),
                  (v19/*: any*/),
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      (v3/*: any*/)
                    ],
                    "type": "Node",
                    "abstractKey": "__isNode"
                  },
                  (v21/*: any*/)
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
    "cacheID": "14dc654c1d1a9bd230ae214ef941cf64",
    "id": null,
    "metadata": {},
    "name": "EditLLMDatasetEvaluatorSlideover_updateLLMEvaluatorMutation",
    "operationKind": "mutation",
    "text": "mutation EditLLMDatasetEvaluatorSlideover_updateLLMEvaluatorMutation(\n  $input: UpdateDatasetLLMEvaluatorInput!\n) {\n  updateDatasetLlmEvaluator(input: $input) {\n    evaluator {\n      id\n      name\n      evaluator {\n        __typename\n        name\n        id\n      }\n      ...DatasetEvaluatorsTable_row\n      ...PlaygroundDatasetSection_evaluator\n      ...EditLLMDatasetEvaluatorSlideover_evaluator\n      ...LLMDatasetEvaluatorDetails_datasetEvaluator\n    }\n  }\n}\n\nfragment DatasetEvaluatorsTable_row on DatasetEvaluator {\n  id\n  name\n  description\n  updatedAt\n  user {\n    username\n    profilePictureUrl\n    id\n  }\n  evaluator {\n    __typename\n    id\n    name\n    kind\n    createdAt\n    updatedAt\n    ... on LLMEvaluator {\n      prompt {\n        id\n        name\n      }\n      promptVersionTag {\n        name\n        id\n      }\n    }\n  }\n}\n\nfragment EditLLMDatasetEvaluatorSlideover_evaluator on DatasetEvaluator {\n  id\n  name\n  inputMapping {\n    literalMapping\n    pathMapping\n  }\n  outputConfigs {\n    __typename\n    ... on AnnotationConfigBase {\n      __isAnnotationConfigBase: __typename\n      name\n    }\n    ... on CategoricalAnnotationConfig {\n      optimizationDirection\n      values {\n        label\n        score\n      }\n    }\n    ... on ContinuousAnnotationConfig {\n      optimizationDirection\n      lowerBound\n      upperBound\n    }\n    ... on Node {\n      __isNode: __typename\n      id\n    }\n  }\n  evaluator {\n    __typename\n    description\n    kind\n    name\n    ... on LLMEvaluator {\n      outputConfigs {\n        ... on AnnotationConfigBase {\n          __isAnnotationConfigBase: __typename\n          name\n        }\n        optimizationDirection\n        values {\n          label\n          score\n        }\n        id\n      }\n      prompt {\n        id\n        name\n      }\n      promptVersion {\n        tools {\n          definition\n        }\n        ...fetchPlaygroundPrompt_promptVersionToInstance_promptVersion\n        id\n      }\n    }\n    id\n  }\n}\n\nfragment LLMDatasetEvaluatorDetails_datasetEvaluator on DatasetEvaluator {\n  id\n  inputMapping {\n    literalMapping\n    pathMapping\n  }\n  evaluator {\n    __typename\n    kind\n    ... on LLMEvaluator {\n      prompt {\n        id\n        name\n      }\n      promptVersion {\n        tools {\n          definition\n        }\n        ...fetchPlaygroundPrompt_promptVersionToInstance_promptVersion\n        id\n      }\n      promptVersionTag {\n        name\n        id\n      }\n    }\n    id\n  }\n  outputConfigs {\n    __typename\n    ... on CategoricalAnnotationConfig {\n      name\n      optimizationDirection\n      values {\n        label\n        score\n      }\n    }\n    ... on ContinuousAnnotationConfig {\n      name\n      optimizationDirection\n      lowerBound\n      upperBound\n    }\n    ... on Node {\n      __isNode: __typename\n      id\n    }\n  }\n}\n\nfragment PlaygroundDatasetSection_evaluator on DatasetEvaluator {\n  id\n  name\n  inputMapping {\n    literalMapping\n    pathMapping\n  }\n  evaluator {\n    __typename\n    id\n    kind\n    isBuiltin\n  }\n  outputConfigs {\n    __typename\n    ... on CategoricalAnnotationConfig {\n      name\n      optimizationDirection\n      values {\n        label\n        score\n      }\n    }\n    ... on ContinuousAnnotationConfig {\n      name\n      optimizationDirection\n      lowerBound\n      upperBound\n    }\n    ... on Node {\n      __isNode: __typename\n      id\n    }\n  }\n}\n\nfragment fetchPlaygroundPrompt_promptVersionToInstance_promptVersion on PromptVersion {\n  id\n  modelName\n  modelProvider\n  invocationParameters\n  customProvider {\n    id\n    name\n  }\n  responseFormat {\n    definition\n  }\n  template {\n    __typename\n    ... on PromptChatTemplate {\n      messages {\n        role\n        content {\n          __typename\n          ... on TextContentPart {\n            text {\n              text\n            }\n          }\n          ... on ToolCallContentPart {\n            toolCall {\n              toolCallId\n              toolCall {\n                name\n                arguments\n              }\n            }\n          }\n          ... on ToolResultContentPart {\n            toolResult {\n              toolCallId\n              result\n            }\n          }\n        }\n      }\n    }\n    ... on PromptStringTemplate {\n      template\n    }\n  }\n  tools {\n    definition\n  }\n}\n"
  }
};
})();

(node as any).hash = "eb7ef93d11916e1e2c2e10e672b5c500";

export default node;
