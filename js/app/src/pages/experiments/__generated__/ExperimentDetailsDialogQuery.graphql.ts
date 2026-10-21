/**
 * @generated SignedSource<<7208023778ed7572029bf7d37601324f>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DecisionTemplateFormat = "F_STRING" | "MUSTACHE";
export type ExperimentJobStatus = "COMPLETED" | "ERROR" | "RUNNING" | "STOPPED";
export type GenerativeProviderKey = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "CEREBRAS" | "DEEPSEEK" | "FIREWORKS" | "GOOGLE" | "GROQ" | "META" | "MINIMAX" | "MOONSHOT" | "OLLAMA" | "OPENAI" | "PERPLEXITY" | "TOGETHER" | "TYPESAFE" | "XAI" | "ZAI";
export type OpenAIApiType = "CHAT_COMPLETIONS" | "RESPONSES";
export type PromptTemplateFormat = "F_STRING" | "MUSTACHE" | "NONE";
export type PromptTemplateType = "CHAT" | "STRING";
export type ExperimentDetailsDialogQuery$variables = {
  errorsAfter?: string | null;
  errorsFirst?: number | null;
  experimentId: string;
};
export type ExperimentDetailsDialogQuery$data = {
  readonly experiment: {
    readonly averageRunLatencyMs?: number | null;
    readonly costSummary?: {
      readonly completion: {
        readonly cost: number | null;
        readonly tokens: number | null;
      };
      readonly prompt: {
        readonly cost: number | null;
        readonly tokens: number | null;
      };
      readonly total: {
        readonly cost: number | null;
        readonly tokens: number | null;
      };
    };
    readonly createdAt?: string;
    readonly description?: string | null;
    readonly errorRate?: number | null;
    readonly expectedRunCount?: number;
    readonly id?: string;
    readonly job?: {
      readonly createdAt: string;
      readonly maxConcurrency: number;
      readonly status: ExperimentJobStatus;
      readonly taskConfig: {
        readonly __typename: "DecisionTaskConfig";
        readonly baseUrl: string | null;
        readonly customProvider: {
          readonly id: string;
          readonly name: string;
        } | null;
        readonly inputValuesPath: string;
        readonly inputs: ReadonlyArray<{
          readonly name: string;
        }>;
        readonly modelName: string;
        readonly modelProvider: GenerativeProviderKey;
        readonly questions: ReadonlyArray<{
          readonly __typename: "DecisionChoiceQuestion";
          readonly choices: ReadonlyArray<{
            readonly description: string | null;
            readonly value: string;
          }>;
          readonly instructions: string;
          readonly name: string;
        } | {
          readonly __typename: "DecisionPredicateQuestion";
          readonly criteria: {
            readonly false: string | null;
            readonly true: string | null;
          } | null;
          readonly instructions: string;
          readonly name: string;
        } | {
          readonly __typename: "DecisionScaleQuestion";
          readonly instructions: string;
          readonly levels: ReadonlyArray<{
            readonly description: string | null;
            readonly label: string;
          }>;
          readonly name: string;
        } | {
          // This will never be '%other', but we need some
          // value in case none of the concrete values match.
          readonly __typename: "%other";
        }>;
        readonly state: {
          readonly __typename: "DecisionInputState";
          readonly input: string;
        } | {
          readonly __typename: "DecisionObjectState";
          readonly object: boolean;
        } | {
          readonly __typename: "DecisionTextState";
          readonly template: string;
          readonly templateFormat: DecisionTemplateFormat;
        } | {
          // This will never be '%other', but we need some
          // value in case none of the concrete values match.
          readonly __typename: "%other";
        };
      } | {
        readonly __typename: "PromptTaskConfig";
        readonly connection: {
          readonly __typename: "AWSBedrockConnectionConfig";
          readonly endpointUrl: string | null;
          readonly regionName: string | null;
        } | {
          readonly __typename: "AnthropicConnectionConfig";
          readonly baseUrl: string | null;
        } | {
          readonly __typename: "AzureOpenAIConnectionConfig";
          readonly azureEndpoint: string;
          readonly openaiApiType: OpenAIApiType;
        } | {
          readonly __typename: "GoogleGenAIConnectionConfig";
          readonly baseUrl: string | null;
        } | {
          readonly __typename: "OpenAIConnectionConfig";
          readonly baseUrl: string | null;
          readonly openaiApiType: OpenAIApiType;
        } | {
          // This will never be '%other', but we need some
          // value in case none of the concrete values match.
          readonly __typename: "%other";
        } | null;
        readonly id: string;
        readonly prompt: {
          readonly invocationParameters: {
            readonly " $fragmentSpreads": FragmentRefs<"PromptInvocationParametersReadableFragment">;
          };
          readonly modelName: string;
          readonly modelProvider: GenerativeProviderKey;
          readonly templateFormat: PromptTemplateFormat;
          readonly templateType: PromptTemplateType;
        };
        readonly streamModelOutput: boolean;
      } | {
        // This will never be '%other', but we need some
        // value in case none of the concrete values match.
        readonly __typename: "%other";
      } | null;
      readonly " $fragmentSpreads": FragmentRefs<"ExperimentDetailsDialog_jobErrors">;
    } | null;
    readonly metadata?: any;
    readonly name?: string;
    readonly project?: {
      readonly id: string;
    } | null;
    readonly repetitions?: number;
    readonly runCount?: number;
    readonly sequenceNumber?: number;
    readonly updatedAt?: string;
    readonly user?: {
      readonly profilePictureUrl: string | null;
      readonly username: string;
    } | null;
  };
};
export type ExperimentDetailsDialogQuery = {
  response: ExperimentDetailsDialogQuery$data;
  variables: ExperimentDetailsDialogQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "errorsAfter"
},
v1 = {
  "defaultValue": 20,
  "kind": "LocalArgument",
  "name": "errorsFirst"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "experimentId"
},
v3 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "experimentId"
  }
],
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
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
  "name": "sequenceNumber",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "createdAt",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "updatedAt",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "metadata",
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "repetitions",
  "storageKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "errorRate",
  "storageKey": null
},
v13 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "runCount",
  "storageKey": null
},
v14 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "expectedRunCount",
  "storageKey": null
},
v15 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "averageRunLatencyMs",
  "storageKey": null
},
v16 = [
  (v4/*:: as any*/)
],
v17 = {
  "alias": null,
  "args": null,
  "concreteType": "Project",
  "kind": "LinkedField",
  "name": "project",
  "plural": false,
  "selections": (v16/*:: as any*/),
  "storageKey": null
},
v18 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "username",
  "storageKey": null
},
v19 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "profilePictureUrl",
  "storageKey": null
},
v20 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "tokens",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "cost",
    "storageKey": null
  }
],
v21 = {
  "alias": null,
  "args": null,
  "concreteType": "SpanCostSummary",
  "kind": "LinkedField",
  "name": "costSummary",
  "plural": false,
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "CostBreakdown",
      "kind": "LinkedField",
      "name": "total",
      "plural": false,
      "selections": (v20/*:: as any*/),
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "CostBreakdown",
      "kind": "LinkedField",
      "name": "prompt",
      "plural": false,
      "selections": (v20/*:: as any*/),
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "CostBreakdown",
      "kind": "LinkedField",
      "name": "completion",
      "plural": false,
      "selections": (v20/*:: as any*/),
      "storageKey": null
    }
  ],
  "storageKey": null
},
v22 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "status",
  "storageKey": null
},
v23 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "maxConcurrency",
  "storageKey": null
},
v24 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v25 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "modelProvider",
  "storageKey": null
},
v26 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "modelName",
  "storageKey": null
},
v27 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "baseUrl",
  "storageKey": null
},
v28 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "templateFormat",
  "storageKey": null
},
v29 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "instructions",
  "storageKey": null
},
v30 = {
  "kind": "InlineFragment",
  "selections": [
    (v25/*:: as any*/),
    (v26/*:: as any*/),
    (v27/*:: as any*/),
    {
      "alias": null,
      "args": null,
      "concreteType": "GenerativeModelCustomProvider",
      "kind": "LinkedField",
      "name": "customProvider",
      "plural": false,
      "selections": [
        (v4/*:: as any*/),
        (v5/*:: as any*/)
      ],
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "inputValuesPath",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "DecisionInputDefinition",
      "kind": "LinkedField",
      "name": "inputs",
      "plural": true,
      "selections": [
        (v5/*:: as any*/)
      ],
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": null,
      "kind": "LinkedField",
      "name": "state",
      "plural": false,
      "selections": [
        (v24/*:: as any*/),
        {
          "kind": "InlineFragment",
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "object",
              "storageKey": null
            }
          ],
          "type": "DecisionObjectState",
          "abstractKey": null
        },
        {
          "kind": "InlineFragment",
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "input",
              "storageKey": null
            }
          ],
          "type": "DecisionInputState",
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
            },
            (v28/*:: as any*/)
          ],
          "type": "DecisionTextState",
          "abstractKey": null
        }
      ],
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": null,
      "kind": "LinkedField",
      "name": "questions",
      "plural": true,
      "selections": [
        (v24/*:: as any*/),
        {
          "kind": "InlineFragment",
          "selections": [
            (v5/*:: as any*/),
            (v29/*:: as any*/),
            {
              "alias": null,
              "args": null,
              "concreteType": "DecisionPredicateCriteria",
              "kind": "LinkedField",
              "name": "criteria",
              "plural": false,
              "selections": [
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "true",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "false",
                  "storageKey": null
                }
              ],
              "storageKey": null
            }
          ],
          "type": "DecisionPredicateQuestion",
          "abstractKey": null
        },
        {
          "kind": "InlineFragment",
          "selections": [
            (v5/*:: as any*/),
            (v29/*:: as any*/),
            {
              "alias": null,
              "args": null,
              "concreteType": "DecisionChoiceOption",
              "kind": "LinkedField",
              "name": "choices",
              "plural": true,
              "selections": [
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "value",
                  "storageKey": null
                },
                (v6/*:: as any*/)
              ],
              "storageKey": null
            }
          ],
          "type": "DecisionChoiceQuestion",
          "abstractKey": null
        },
        {
          "kind": "InlineFragment",
          "selections": [
            (v5/*:: as any*/),
            (v29/*:: as any*/),
            {
              "alias": null,
              "args": null,
              "concreteType": "DecisionScaleLevel",
              "kind": "LinkedField",
              "name": "levels",
              "plural": true,
              "selections": [
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "label",
                  "storageKey": null
                },
                (v6/*:: as any*/)
              ],
              "storageKey": null
            }
          ],
          "type": "DecisionScaleQuestion",
          "abstractKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "DecisionTaskConfig",
  "abstractKey": null
},
v31 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "streamModelOutput",
  "storageKey": null
},
v32 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "templateType",
  "storageKey": null
},
v33 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "temperature",
  "storageKey": null
},
v34 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "frequencyPenalty",
  "storageKey": null
},
v35 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "presencePenalty",
  "storageKey": null
},
v36 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "topP",
  "storageKey": null
},
v37 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "extraBody",
  "storageKey": null
},
v38 = {
  "kind": "InlineFragment",
  "selections": [
    (v33/*:: as any*/),
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
    (v34/*:: as any*/),
    (v35/*:: as any*/),
    (v36/*:: as any*/),
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
    (v37/*:: as any*/)
  ],
  "type": "PromptOpenAIInvocationParameters",
  "abstractKey": null
},
v39 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "stopSequences",
  "storageKey": null
},
v40 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": "anthropicMaxTokens",
      "args": null,
      "kind": "ScalarField",
      "name": "maxTokens",
      "storageKey": null
    },
    (v33/*:: as any*/),
    (v36/*:: as any*/),
    (v39/*:: as any*/),
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
        (v24/*:: as any*/),
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
    (v37/*:: as any*/)
  ],
  "type": "PromptAnthropicInvocationParameters",
  "abstractKey": null
},
v41 = {
  "kind": "InlineFragment",
  "selections": [
    (v33/*:: as any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "maxOutputTokens",
      "storageKey": null
    },
    (v39/*:: as any*/),
    (v35/*:: as any*/),
    (v34/*:: as any*/),
    (v36/*:: as any*/),
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
v42 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": "awsMaxTokens",
      "args": null,
      "kind": "ScalarField",
      "name": "maxTokens",
      "storageKey": null
    },
    (v33/*:: as any*/),
    (v36/*:: as any*/),
    (v39/*:: as any*/)
  ],
  "type": "PromptAwsInvocationParameters",
  "abstractKey": null
},
v43 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "openaiApiType",
  "storageKey": null
},
v44 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "azureEndpoint",
  "storageKey": null
},
v45 = [
  (v24/*:: as any*/),
  (v27/*:: as any*/)
],
v46 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "regionName",
  "storageKey": null
},
v47 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "endpointUrl",
  "storageKey": null
},
v48 = [
  {
    "kind": "Variable",
    "name": "after",
    "variableName": "errorsAfter"
  },
  {
    "kind": "Variable",
    "name": "first",
    "variableName": "errorsFirst"
  }
],
v49 = {
  "alias": null,
  "args": null,
  "concreteType": null,
  "kind": "LinkedField",
  "name": "workItem",
  "plural": false,
  "selections": [
    (v24/*:: as any*/),
    {
      "kind": "InlineFragment",
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "datasetExampleId",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "repetitionNumber",
          "storageKey": null
        }
      ],
      "type": "TaskWorkItemId",
      "abstractKey": null
    },
    {
      "kind": "InlineFragment",
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "experimentRunId",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "datasetEvaluatorId",
          "storageKey": null
        }
      ],
      "type": "EvalWorkItemId",
      "abstractKey": null
    }
  ],
  "storageKey": null
},
v50 = [
  (v27/*:: as any*/)
];
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v1/*:: as any*/),
      (v2/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "ExperimentDetailsDialogQuery",
    "selections": [
      {
        "alias": "experiment",
        "args": (v3/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "kind": "InlineFragment",
            "selections": [
              (v4/*:: as any*/),
              (v5/*:: as any*/),
              (v6/*:: as any*/),
              (v7/*:: as any*/),
              (v8/*:: as any*/),
              (v9/*:: as any*/),
              (v10/*:: as any*/),
              (v11/*:: as any*/),
              (v12/*:: as any*/),
              (v13/*:: as any*/),
              (v14/*:: as any*/),
              (v15/*:: as any*/),
              (v17/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "User",
                "kind": "LinkedField",
                "name": "user",
                "plural": false,
                "selections": [
                  (v18/*:: as any*/),
                  (v19/*:: as any*/)
                ],
                "storageKey": null
              },
              (v21/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "ExperimentJob",
                "kind": "LinkedField",
                "name": "job",
                "plural": false,
                "selections": [
                  (v22/*:: as any*/),
                  (v8/*:: as any*/),
                  (v23/*:: as any*/),
                  {
                    "args": null,
                    "kind": "FragmentSpread",
                    "name": "ExperimentDetailsDialog_jobErrors"
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": null,
                    "kind": "LinkedField",
                    "name": "taskConfig",
                    "plural": false,
                    "selections": [
                      (v24/*:: as any*/),
                      (v30/*:: as any*/),
                      {
                        "kind": "InlineFragment",
                        "selections": [
                          (v4/*:: as any*/),
                          (v31/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "PromptConfig",
                            "kind": "LinkedField",
                            "name": "prompt",
                            "plural": false,
                            "selections": [
                              (v25/*:: as any*/),
                              (v26/*:: as any*/),
                              (v32/*:: as any*/),
                              (v28/*:: as any*/),
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": null,
                                "kind": "LinkedField",
                                "name": "invocationParameters",
                                "plural": false,
                                "selections": [
                                  {
                                    "kind": "InlineDataFragmentSpread",
                                    "name": "PromptInvocationParametersReadableFragment",
                                    "selections": [
                                      (v24/*:: as any*/),
                                      (v38/*:: as any*/),
                                      (v40/*:: as any*/),
                                      (v41/*:: as any*/),
                                      (v42/*:: as any*/)
                                    ],
                                    "args": null,
                                    "argumentDefinitions": []
                                  }
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
                            "name": "connection",
                            "plural": false,
                            "selections": [
                              {
                                "kind": "InlineFragment",
                                "selections": [
                                  (v24/*:: as any*/),
                                  (v27/*:: as any*/),
                                  (v43/*:: as any*/)
                                ],
                                "type": "OpenAIConnectionConfig",
                                "abstractKey": null
                              },
                              {
                                "kind": "InlineFragment",
                                "selections": [
                                  (v24/*:: as any*/),
                                  (v44/*:: as any*/),
                                  (v43/*:: as any*/)
                                ],
                                "type": "AzureOpenAIConnectionConfig",
                                "abstractKey": null
                              },
                              {
                                "kind": "InlineFragment",
                                "selections": (v45/*:: as any*/),
                                "type": "AnthropicConnectionConfig",
                                "abstractKey": null
                              },
                              {
                                "kind": "InlineFragment",
                                "selections": [
                                  (v24/*:: as any*/),
                                  (v46/*:: as any*/),
                                  (v47/*:: as any*/)
                                ],
                                "type": "AWSBedrockConnectionConfig",
                                "abstractKey": null
                              },
                              {
                                "kind": "InlineFragment",
                                "selections": (v45/*:: as any*/),
                                "type": "GoogleGenAIConnectionConfig",
                                "abstractKey": null
                              }
                            ],
                            "storageKey": null
                          }
                        ],
                        "type": "PromptTaskConfig",
                        "abstractKey": null
                      }
                    ],
                    "storageKey": null
                  }
                ],
                "storageKey": null
              }
            ],
            "type": "Experiment",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v2/*:: as any*/),
      (v1/*:: as any*/),
      (v0/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "ExperimentDetailsDialogQuery",
    "selections": [
      {
        "alias": "experiment",
        "args": (v3/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v24/*:: as any*/),
          (v4/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v5/*:: as any*/),
              (v6/*:: as any*/),
              (v7/*:: as any*/),
              (v8/*:: as any*/),
              (v9/*:: as any*/),
              (v10/*:: as any*/),
              (v11/*:: as any*/),
              (v12/*:: as any*/),
              (v13/*:: as any*/),
              (v14/*:: as any*/),
              (v15/*:: as any*/),
              (v17/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "User",
                "kind": "LinkedField",
                "name": "user",
                "plural": false,
                "selections": [
                  (v18/*:: as any*/),
                  (v19/*:: as any*/),
                  (v4/*:: as any*/)
                ],
                "storageKey": null
              },
              (v21/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "ExperimentJob",
                "kind": "LinkedField",
                "name": "job",
                "plural": false,
                "selections": [
                  (v22/*:: as any*/),
                  (v8/*:: as any*/),
                  (v23/*:: as any*/),
                  {
                    "alias": null,
                    "args": (v48/*:: as any*/),
                    "concreteType": "ExperimentLogConnection",
                    "kind": "LinkedField",
                    "name": "errors",
                    "plural": false,
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "ExperimentLogEdge",
                        "kind": "LinkedField",
                        "name": "edges",
                        "plural": true,
                        "selections": [
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "ExperimentLog",
                            "kind": "LinkedField",
                            "name": "node",
                            "plural": false,
                            "selections": [
                              (v4/*:: as any*/),
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "occurredAt",
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "category",
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "message",
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": null,
                                "kind": "LinkedField",
                                "name": "detail",
                                "plural": false,
                                "selections": [
                                  (v24/*:: as any*/),
                                  {
                                    "kind": "InlineFragment",
                                    "selections": [
                                      {
                                        "alias": null,
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "errorType",
                                        "storageKey": null
                                      },
                                      (v49/*:: as any*/)
                                    ],
                                    "type": "FailureDetail",
                                    "abstractKey": null
                                  },
                                  {
                                    "kind": "InlineFragment",
                                    "selections": [
                                      {
                                        "alias": null,
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "retryCount",
                                        "storageKey": null
                                      },
                                      {
                                        "alias": null,
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "reason",
                                        "storageKey": null
                                      },
                                      (v49/*:: as any*/)
                                    ],
                                    "type": "RetriesExhaustedDetail",
                                    "abstractKey": null
                                  }
                                ],
                                "storageKey": null
                              },
                              (v24/*:: as any*/)
                            ],
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "cursor",
                            "storageKey": null
                          }
                        ],
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "PageInfo",
                        "kind": "LinkedField",
                        "name": "pageInfo",
                        "plural": false,
                        "selections": [
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "hasNextPage",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "endCursor",
                            "storageKey": null
                          }
                        ],
                        "storageKey": null
                      }
                    ],
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": (v48/*:: as any*/),
                    "filters": null,
                    "handle": "connection",
                    "key": "ExperimentDetailsDialog_errors",
                    "kind": "LinkedHandle",
                    "name": "errors"
                  },
                  (v4/*:: as any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": null,
                    "kind": "LinkedField",
                    "name": "taskConfig",
                    "plural": false,
                    "selections": [
                      (v24/*:: as any*/),
                      (v30/*:: as any*/),
                      {
                        "kind": "InlineFragment",
                        "selections": [
                          (v4/*:: as any*/),
                          (v31/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "PromptConfig",
                            "kind": "LinkedField",
                            "name": "prompt",
                            "plural": false,
                            "selections": [
                              (v25/*:: as any*/),
                              (v26/*:: as any*/),
                              (v32/*:: as any*/),
                              (v28/*:: as any*/),
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": null,
                                "kind": "LinkedField",
                                "name": "invocationParameters",
                                "plural": false,
                                "selections": [
                                  (v24/*:: as any*/),
                                  {
                                    "kind": "TypeDiscriminator",
                                    "abstractKey": "__isPromptInvocationParameters"
                                  },
                                  (v38/*:: as any*/),
                                  (v40/*:: as any*/),
                                  (v41/*:: as any*/),
                                  (v42/*:: as any*/)
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
                            "name": "connection",
                            "plural": false,
                            "selections": [
                              (v24/*:: as any*/),
                              {
                                "kind": "InlineFragment",
                                "selections": [
                                  (v27/*:: as any*/),
                                  (v43/*:: as any*/)
                                ],
                                "type": "OpenAIConnectionConfig",
                                "abstractKey": null
                              },
                              {
                                "kind": "InlineFragment",
                                "selections": [
                                  (v44/*:: as any*/),
                                  (v43/*:: as any*/)
                                ],
                                "type": "AzureOpenAIConnectionConfig",
                                "abstractKey": null
                              },
                              {
                                "kind": "InlineFragment",
                                "selections": (v50/*:: as any*/),
                                "type": "AnthropicConnectionConfig",
                                "abstractKey": null
                              },
                              {
                                "kind": "InlineFragment",
                                "selections": [
                                  (v46/*:: as any*/),
                                  (v47/*:: as any*/)
                                ],
                                "type": "AWSBedrockConnectionConfig",
                                "abstractKey": null
                              },
                              {
                                "kind": "InlineFragment",
                                "selections": (v50/*:: as any*/),
                                "type": "GoogleGenAIConnectionConfig",
                                "abstractKey": null
                              }
                            ],
                            "storageKey": null
                          }
                        ],
                        "type": "PromptTaskConfig",
                        "abstractKey": null
                      },
                      {
                        "kind": "InlineFragment",
                        "selections": (v16/*:: as any*/),
                        "type": "Node",
                        "abstractKey": "__isNode"
                      }
                    ],
                    "storageKey": null
                  }
                ],
                "storageKey": null
              }
            ],
            "type": "Experiment",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "c1f89aa73b5f0e90fee7044ec11f23f1",
    "id": null,
    "metadata": {},
    "name": "ExperimentDetailsDialogQuery",
    "operationKind": "query",
    "text": "query ExperimentDetailsDialogQuery(\n  $experimentId: ID!\n  $errorsFirst: Int = 20\n  $errorsAfter: String = null\n) {\n  experiment: node(id: $experimentId) {\n    __typename\n    ... on Experiment {\n      id\n      name\n      description\n      sequenceNumber\n      createdAt\n      updatedAt\n      metadata\n      repetitions\n      errorRate\n      runCount\n      expectedRunCount\n      averageRunLatencyMs\n      project {\n        id\n      }\n      user {\n        username\n        profilePictureUrl\n        id\n      }\n      costSummary {\n        total {\n          tokens\n          cost\n        }\n        prompt {\n          tokens\n          cost\n        }\n        completion {\n          tokens\n          cost\n        }\n      }\n      job {\n        status\n        createdAt\n        maxConcurrency\n        ...ExperimentDetailsDialog_jobErrors\n        taskConfig {\n          __typename\n          ... on DecisionTaskConfig {\n            modelProvider\n            modelName\n            baseUrl\n            customProvider {\n              id\n              name\n            }\n            inputValuesPath\n            inputs {\n              name\n            }\n            state {\n              __typename\n              ... on DecisionObjectState {\n                object\n              }\n              ... on DecisionInputState {\n                input\n              }\n              ... on DecisionTextState {\n                template\n                templateFormat\n              }\n            }\n            questions {\n              __typename\n              ... on DecisionPredicateQuestion {\n                name\n                instructions\n                criteria {\n                  true\n                  false\n                }\n              }\n              ... on DecisionChoiceQuestion {\n                name\n                instructions\n                choices {\n                  value\n                  description\n                }\n              }\n              ... on DecisionScaleQuestion {\n                name\n                instructions\n                levels {\n                  label\n                  description\n                }\n              }\n            }\n          }\n          ... on PromptTaskConfig {\n            id\n            streamModelOutput\n            prompt {\n              modelProvider\n              modelName\n              templateType\n              templateFormat\n              invocationParameters {\n                __typename\n                ...PromptInvocationParametersReadableFragment\n              }\n            }\n            connection {\n              __typename\n              ... on OpenAIConnectionConfig {\n                __typename\n                baseUrl\n                openaiApiType\n              }\n              ... on AzureOpenAIConnectionConfig {\n                __typename\n                azureEndpoint\n                openaiApiType\n              }\n              ... on AnthropicConnectionConfig {\n                __typename\n                baseUrl\n              }\n              ... on AWSBedrockConnectionConfig {\n                __typename\n                regionName\n                endpointUrl\n              }\n              ... on GoogleGenAIConnectionConfig {\n                __typename\n                baseUrl\n              }\n            }\n          }\n          ... on Node {\n            __isNode: __typename\n            id\n          }\n        }\n        id\n      }\n    }\n    id\n  }\n}\n\nfragment ExperimentDetailsDialog_jobErrors on ExperimentJob {\n  errors(first: $errorsFirst, after: $errorsAfter) {\n    edges {\n      node {\n        id\n        occurredAt\n        category\n        message\n        detail {\n          __typename\n          ... on FailureDetail {\n            errorType\n            workItem {\n              __typename\n              ... on TaskWorkItemId {\n                datasetExampleId\n                repetitionNumber\n              }\n              ... on EvalWorkItemId {\n                experimentRunId\n                datasetEvaluatorId\n              }\n            }\n          }\n          ... on RetriesExhaustedDetail {\n            retryCount\n            reason\n            workItem {\n              __typename\n              ... on TaskWorkItemId {\n                datasetExampleId\n                repetitionNumber\n              }\n              ... on EvalWorkItemId {\n                experimentRunId\n                datasetEvaluatorId\n              }\n            }\n          }\n        }\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n  }\n  id\n}\n\nfragment PromptInvocationParametersReadableFragment on PromptInvocationParameters {\n  __isPromptInvocationParameters: __typename\n  __typename\n  ... on PromptOpenAIInvocationParameters {\n    temperature\n    openaiMaxTokens: maxTokens\n    maxCompletionTokens\n    frequencyPenalty\n    presencePenalty\n    topP\n    seed\n    stop\n    reasoningEffort\n    extraBody\n  }\n  ... on PromptAnthropicInvocationParameters {\n    anthropicMaxTokens: maxTokens\n    temperature\n    topP\n    stopSequences\n    outputConfig {\n      effort\n    }\n    thinking {\n      __typename\n      ... on PromptAnthropicThinkingDisabled {\n        disabled\n      }\n      ... on PromptAnthropicThinkingEnabled {\n        budgetTokens\n        enabledDisplay: display\n      }\n      ... on PromptAnthropicThinkingAdaptive {\n        adaptiveDisplay: display\n      }\n    }\n    extraBody\n  }\n  ... on PromptGoogleInvocationParameters {\n    temperature\n    maxOutputTokens\n    stopSequences\n    presencePenalty\n    frequencyPenalty\n    topP\n    topK\n    thinkingConfig {\n      thinkingBudget\n      thinkingLevel\n      includeThoughts\n    }\n  }\n  ... on PromptAwsInvocationParameters {\n    awsMaxTokens: maxTokens\n    temperature\n    topP\n    stopSequences\n  }\n}\n"
  }
};
})();

(node as any).hash = "2b706aff74e2312bc09d9891416e8c9a";

export default node;
