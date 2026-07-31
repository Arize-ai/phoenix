/**
 * @generated SignedSource<<db06c3818c91beb0839a660eb2126f71>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type EvaluationTarget = "SESSION" | "SPAN" | "TRACE";
export type EvaluatorKind = "BUILTIN" | "CODE" | "LLM";
export type InternetAccessChoice = "ALLOW" | "DENY";
export type InternetAccessMode = "BOOLEAN" | "NONE";
export type Language = "PYTHON" | "TYPESCRIPT";
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE" | "NONE";
export type PromptTemplateFormat = "F_STRING" | "MUSTACHE" | "NONE";
export type SandboxBackendStatus = "AVAILABLE" | "DISABLED" | "MISSING_CREDENTIALS" | "NOT_INSTALLED" | "UNAVAILABLE";
export type SandboxBackendType = "DAYTONA" | "DENO" | "E2B" | "MODAL" | "VERCEL" | "WASM";
export type EditProjectEvaluatorSlideoverQuery$variables = {
  projectEvaluatorId: string;
};
export type EditProjectEvaluatorSlideoverQuery$data = {
  readonly projectEvaluator: {
    readonly __typename: "ProjectEvaluator";
    readonly enabled: boolean;
    readonly evaluationTarget: EvaluationTarget;
    readonly evaluator: {
      readonly description: string | null;
      readonly id: string;
      readonly inputMapping?: {
        readonly literalMapping: any;
        readonly pathMapping: any;
      };
      readonly kind: EvaluatorKind;
      readonly language?: Language;
      readonly name: string;
      readonly outputConfigs?: ReadonlyArray<{
        readonly __typename: "CategoricalAnnotationConfig";
        readonly name: string;
        readonly optimizationDirection: OptimizationDirection;
        readonly values: ReadonlyArray<{
          readonly label: string;
          readonly score: number | null;
        }>;
      } | {
        readonly __typename: "ContinuousAnnotationConfig";
        readonly lowerBound: number | null;
        readonly name: string;
        readonly optimizationDirection: OptimizationDirection;
        readonly upperBound: number | null;
      } | {
        readonly __typename: "FreeformAnnotationConfig";
        readonly lowerBound: number | null;
        readonly name: string;
        readonly optimizationDirection: OptimizationDirection;
        readonly threshold: number | null;
        readonly upperBound: number | null;
      } | {
        // This will never be '%other', but we need some
        // value in case none of the concrete values match.
        readonly __typename: "%other";
      }>;
      readonly prompt?: {
        readonly id: string;
        readonly name: string;
      };
      readonly promptVersion?: {
        readonly templateFormat: PromptTemplateFormat;
        readonly tools: {
          readonly tools: ReadonlyArray<{
            readonly __typename: "PromptToolFunction";
            readonly function: {
              readonly parameters: any;
            };
          } | {
            readonly __typename: "PromptToolRaw";
            readonly raw: any;
          } | {
            // This will never be '%other', but we need some
            // value in case none of the concrete values match.
            readonly __typename: "%other";
          }>;
        } | null;
        readonly " $fragmentSpreads": FragmentRefs<"fetchPlaygroundPrompt_promptVersionToInstance_promptVersion">;
      };
      readonly promptVersionTag?: {
        readonly name: string;
      } | null;
      readonly sandboxConfig?: {
        readonly id: string;
      } | null;
      readonly sourceCode?: string;
    };
    readonly filterCondition: string;
    readonly id: string;
    readonly inputMapping: {
      readonly literalMapping: any;
      readonly pathMapping: any;
    };
    readonly name: string;
    readonly project: {
      readonly id: string;
    };
    readonly samplingRate: number;
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  };
  readonly sandboxBackends: ReadonlyArray<{
    readonly backendType: SandboxBackendType;
    readonly internetAccess: InternetAccessMode;
    readonly status: SandboxBackendStatus;
    readonly supportsDependencies: boolean;
    readonly supportsEnvVars: boolean;
  }>;
  readonly sandboxProviders: ReadonlyArray<{
    readonly backendType: SandboxBackendType;
    readonly configs: ReadonlyArray<{
      readonly config: {
        readonly dependencies: {
          readonly packages: ReadonlyArray<string>;
        } | null;
        readonly envVars: ReadonlyArray<{
          readonly name: string;
          readonly secretKey: string;
        }>;
        readonly internetAccess: {
          readonly mode: InternetAccessChoice;
        } | null;
      };
      readonly description: string | null;
      readonly id: string;
      readonly language: Language;
      readonly name: string;
      readonly timeout: number;
    }>;
    readonly enabled: boolean;
    readonly supportedLanguages: ReadonlyArray<Language>;
  }>;
};
export type EditProjectEvaluatorSlideoverQuery = {
  response: EditProjectEvaluatorSlideoverQuery$data;
  variables: EditProjectEvaluatorSlideoverQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "projectEvaluatorId"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "projectEvaluatorId"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
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
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "evaluationTarget",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "filterCondition",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "samplingRate",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "enabled",
  "storageKey": null
},
v9 = {
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
      "name": "pathMapping",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "literalMapping",
      "storageKey": null
    }
  ],
  "storageKey": null
},
v10 = [
  (v3/*:: as any*/)
],
v11 = {
  "alias": null,
  "args": null,
  "concreteType": "Project",
  "kind": "LinkedField",
  "name": "project",
  "plural": false,
  "selections": (v10/*:: as any*/),
  "storageKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "kind",
  "storageKey": null
},
v13 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
  "storageKey": null
},
v14 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "optimizationDirection",
  "storageKey": null
},
v15 = {
  "kind": "InlineFragment",
  "selections": [
    (v4/*:: as any*/),
    (v14/*:: as any*/),
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
v16 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "lowerBound",
  "storageKey": null
},
v17 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "upperBound",
  "storageKey": null
},
v18 = {
  "kind": "InlineFragment",
  "selections": [
    (v4/*:: as any*/),
    (v14/*:: as any*/),
    (v16/*:: as any*/),
    (v17/*:: as any*/)
  ],
  "type": "ContinuousAnnotationConfig",
  "abstractKey": null
},
v19 = {
  "kind": "InlineFragment",
  "selections": [
    (v4/*:: as any*/),
    (v14/*:: as any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "threshold",
      "storageKey": null
    },
    (v16/*:: as any*/),
    (v17/*:: as any*/)
  ],
  "type": "FreeformAnnotationConfig",
  "abstractKey": null
},
v20 = {
  "alias": null,
  "args": null,
  "concreteType": null,
  "kind": "LinkedField",
  "name": "outputConfigs",
  "plural": true,
  "selections": [
    (v2/*:: as any*/),
    (v15/*:: as any*/),
    (v18/*:: as any*/),
    (v19/*:: as any*/)
  ],
  "storageKey": null
},
v21 = [
  (v3/*:: as any*/),
  (v4/*:: as any*/)
],
v22 = {
  "alias": null,
  "args": null,
  "concreteType": "Prompt",
  "kind": "LinkedField",
  "name": "prompt",
  "plural": false,
  "selections": (v21/*:: as any*/),
  "storageKey": null
},
v23 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "templateFormat",
  "storageKey": null
},
v24 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "parameters",
  "storageKey": null
},
v25 = {
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
  "name": "modelProvider",
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
v34 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "stopSequences",
  "storageKey": null
},
v35 = {
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
    (v34/*:: as any*/),
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
        (v2/*:: as any*/),
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
v36 = {
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
    (v34/*:: as any*/),
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
v37 = {
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
    (v34/*:: as any*/)
  ],
  "type": "PromptAwsInvocationParameters",
  "abstractKey": null
},
v38 = {
  "alias": null,
  "args": null,
  "concreteType": "GenerativeModelCustomProvider",
  "kind": "LinkedField",
  "name": "customProvider",
  "plural": false,
  "selections": (v21/*:: as any*/),
  "storageKey": null
},
v39 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "strict",
  "storageKey": null
},
v40 = {
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
        (v13/*:: as any*/),
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "schema",
          "storageKey": null
        },
        (v39/*:: as any*/)
      ],
      "storageKey": null
    }
  ],
  "storageKey": null
},
v41 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "toolCallId",
  "storageKey": null
},
v42 = {
  "alias": null,
  "args": null,
  "concreteType": null,
  "kind": "LinkedField",
  "name": "template",
  "plural": false,
  "selections": [
    (v2/*:: as any*/),
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
                (v2/*:: as any*/),
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
                        (v41/*:: as any*/),
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
                        (v41/*:: as any*/),
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
v43 = {
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
v44 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "disableParallelToolCalls",
  "storageKey": null
},
v45 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "sourceCode",
  "storageKey": null
},
v46 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "language",
  "storageKey": null
},
v47 = {
  "alias": null,
  "args": null,
  "concreteType": "SandboxConfig",
  "kind": "LinkedField",
  "name": "sandboxConfig",
  "plural": false,
  "selections": (v10/*:: as any*/),
  "storageKey": null
},
v48 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "backendType",
  "storageKey": null
},
v49 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "supportedLanguages",
  "storageKey": null
},
v50 = {
  "alias": null,
  "args": null,
  "concreteType": "SandboxConfig",
  "kind": "LinkedField",
  "name": "configs",
  "plural": true,
  "selections": [
    (v3/*:: as any*/),
    (v4/*:: as any*/),
    (v13/*:: as any*/),
    (v46/*:: as any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "timeout",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "SandboxConfigData",
      "kind": "LinkedField",
      "name": "config",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "SandboxConfigEnvVar",
          "kind": "LinkedField",
          "name": "envVars",
          "plural": true,
          "selections": [
            (v4/*:: as any*/),
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "secretKey",
              "storageKey": null
            }
          ],
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "SandboxConfigInternetAccess",
          "kind": "LinkedField",
          "name": "internetAccess",
          "plural": false,
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "mode",
              "storageKey": null
            }
          ],
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "SandboxConfigDependencies",
          "kind": "LinkedField",
          "name": "dependencies",
          "plural": false,
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "packages",
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
},
v51 = {
  "alias": null,
  "args": null,
  "concreteType": "SandboxBackendInfo",
  "kind": "LinkedField",
  "name": "sandboxBackends",
  "plural": true,
  "selections": [
    (v48/*:: as any*/),
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
      "kind": "ScalarField",
      "name": "supportsEnvVars",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "internetAccess",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "supportsDependencies",
      "storageKey": null
    }
  ],
  "storageKey": null
},
v52 = {
  "alias": null,
  "args": null,
  "concreteType": null,
  "kind": "LinkedField",
  "name": "outputConfigs",
  "plural": true,
  "selections": [
    (v2/*:: as any*/),
    (v15/*:: as any*/),
    (v18/*:: as any*/),
    (v19/*:: as any*/),
    {
      "kind": "InlineFragment",
      "selections": (v10/*:: as any*/),
      "type": "Node",
      "abstractKey": "__isNode"
    }
  ],
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "EditProjectEvaluatorSlideoverQuery",
    "selections": [
      {
        "alias": "projectEvaluator",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v3/*:: as any*/),
              (v4/*:: as any*/),
              (v5/*:: as any*/),
              (v6/*:: as any*/),
              (v7/*:: as any*/),
              (v8/*:: as any*/),
              (v9/*:: as any*/),
              (v11/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": null,
                "kind": "LinkedField",
                "name": "evaluator",
                "plural": false,
                "selections": [
                  (v3/*:: as any*/),
                  (v12/*:: as any*/),
                  (v4/*:: as any*/),
                  (v13/*:: as any*/),
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      (v20/*:: as any*/),
                      (v22/*:: as any*/),
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "PromptVersionTag",
                        "kind": "LinkedField",
                        "name": "promptVersionTag",
                        "plural": false,
                        "selections": [
                          (v4/*:: as any*/)
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
                          (v23/*:: as any*/),
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
                                  (v2/*:: as any*/),
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
                                          (v24/*:: as any*/)
                                        ],
                                        "storageKey": null
                                      }
                                    ],
                                    "type": "PromptToolFunction",
                                    "abstractKey": null
                                  },
                                  (v25/*:: as any*/)
                                ],
                                "storageKey": null
                              }
                            ],
                            "storageKey": null
                          },
                          {
                            "kind": "InlineDataFragmentSpread",
                            "name": "fetchPlaygroundPrompt_promptVersionToInstance_promptVersion",
                            "selections": [
                              (v3/*:: as any*/),
                              (v26/*:: as any*/),
                              (v27/*:: as any*/),
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
                                      (v2/*:: as any*/),
                                      (v33/*:: as any*/),
                                      (v35/*:: as any*/),
                                      (v36/*:: as any*/),
                                      (v37/*:: as any*/)
                                    ],
                                    "args": null,
                                    "argumentDefinitions": []
                                  }
                                ],
                                "storageKey": null
                              },
                              (v38/*:: as any*/),
                              (v40/*:: as any*/),
                              (v42/*:: as any*/),
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
                                      (v2/*:: as any*/),
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
                                              (v4/*:: as any*/),
                                              (v13/*:: as any*/),
                                              (v24/*:: as any*/),
                                              (v39/*:: as any*/)
                                            ],
                                            "storageKey": null
                                          }
                                        ],
                                        "type": "PromptToolFunction",
                                        "abstractKey": null
                                      },
                                      (v25/*:: as any*/)
                                    ],
                                    "storageKey": null
                                  },
                                  (v43/*:: as any*/),
                                  (v44/*:: as any*/)
                                ],
                                "storageKey": null
                              }
                            ],
                            "args": null,
                            "argumentDefinitions": []
                          }
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
                      (v45/*:: as any*/),
                      (v46/*:: as any*/),
                      (v47/*:: as any*/),
                      (v9/*:: as any*/),
                      (v20/*:: as any*/)
                    ],
                    "type": "CodeEvaluator",
                    "abstractKey": null
                  }
                ],
                "storageKey": null
              }
            ],
            "type": "ProjectEvaluator",
            "abstractKey": null
          }
        ],
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "SandboxProvider",
        "kind": "LinkedField",
        "name": "sandboxProviders",
        "plural": true,
        "selections": [
          (v48/*:: as any*/),
          (v49/*:: as any*/),
          (v8/*:: as any*/),
          (v50/*:: as any*/)
        ],
        "storageKey": null
      },
      (v51/*:: as any*/)
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "EditProjectEvaluatorSlideoverQuery",
    "selections": [
      {
        "alias": "projectEvaluator",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*:: as any*/),
          (v3/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v4/*:: as any*/),
              (v5/*:: as any*/),
              (v6/*:: as any*/),
              (v7/*:: as any*/),
              (v8/*:: as any*/),
              (v9/*:: as any*/),
              (v11/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": null,
                "kind": "LinkedField",
                "name": "evaluator",
                "plural": false,
                "selections": [
                  (v2/*:: as any*/),
                  (v3/*:: as any*/),
                  (v12/*:: as any*/),
                  (v4/*:: as any*/),
                  (v13/*:: as any*/),
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      (v52/*:: as any*/),
                      (v22/*:: as any*/),
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
                          (v23/*:: as any*/),
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
                                  (v2/*:: as any*/),
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
                                          (v24/*:: as any*/),
                                          (v4/*:: as any*/),
                                          (v13/*:: as any*/),
                                          (v39/*:: as any*/)
                                        ],
                                        "storageKey": null
                                      }
                                    ],
                                    "type": "PromptToolFunction",
                                    "abstractKey": null
                                  },
                                  (v25/*:: as any*/)
                                ],
                                "storageKey": null
                              },
                              (v43/*:: as any*/),
                              (v44/*:: as any*/)
                            ],
                            "storageKey": null
                          },
                          (v3/*:: as any*/),
                          (v26/*:: as any*/),
                          (v27/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": null,
                            "kind": "LinkedField",
                            "name": "invocationParameters",
                            "plural": false,
                            "selections": [
                              (v2/*:: as any*/),
                              {
                                "kind": "TypeDiscriminator",
                                "abstractKey": "__isPromptInvocationParameters"
                              },
                              (v33/*:: as any*/),
                              (v35/*:: as any*/),
                              (v36/*:: as any*/),
                              (v37/*:: as any*/)
                            ],
                            "storageKey": null
                          },
                          (v38/*:: as any*/),
                          (v40/*:: as any*/),
                          (v42/*:: as any*/)
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
                      (v45/*:: as any*/),
                      (v46/*:: as any*/),
                      (v47/*:: as any*/),
                      (v9/*:: as any*/),
                      (v52/*:: as any*/)
                    ],
                    "type": "CodeEvaluator",
                    "abstractKey": null
                  }
                ],
                "storageKey": null
              }
            ],
            "type": "ProjectEvaluator",
            "abstractKey": null
          }
        ],
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "SandboxProvider",
        "kind": "LinkedField",
        "name": "sandboxProviders",
        "plural": true,
        "selections": [
          (v48/*:: as any*/),
          (v49/*:: as any*/),
          (v8/*:: as any*/),
          (v50/*:: as any*/),
          (v3/*:: as any*/)
        ],
        "storageKey": null
      },
      (v51/*:: as any*/)
    ]
  },
  "params": {
    "cacheID": "67e0ca582fd01065d11e59105a952b62",
    "id": null,
    "metadata": {},
    "name": "EditProjectEvaluatorSlideoverQuery",
    "operationKind": "query",
    "text": "query EditProjectEvaluatorSlideoverQuery(\n  $projectEvaluatorId: ID!\n) {\n  projectEvaluator: node(id: $projectEvaluatorId) {\n    __typename\n    ... on ProjectEvaluator {\n      id\n      name\n      evaluationTarget\n      filterCondition\n      samplingRate\n      enabled\n      inputMapping {\n        pathMapping\n        literalMapping\n      }\n      project {\n        id\n      }\n      evaluator {\n        __typename\n        id\n        kind\n        name\n        description\n        ... on LLMEvaluator {\n          outputConfigs {\n            __typename\n            ... on CategoricalAnnotationConfig {\n              name\n              optimizationDirection\n              values {\n                label\n                score\n              }\n            }\n            ... on ContinuousAnnotationConfig {\n              name\n              optimizationDirection\n              lowerBound\n              upperBound\n            }\n            ... on FreeformAnnotationConfig {\n              name\n              optimizationDirection\n              threshold\n              lowerBound\n              upperBound\n            }\n            ... on Node {\n              __isNode: __typename\n              id\n            }\n          }\n          prompt {\n            id\n            name\n          }\n          promptVersionTag {\n            name\n            id\n          }\n          promptVersion {\n            templateFormat\n            tools {\n              tools {\n                __typename\n                ... on PromptToolFunction {\n                  function {\n                    parameters\n                  }\n                }\n                ... on PromptToolRaw {\n                  raw\n                }\n              }\n            }\n            ...fetchPlaygroundPrompt_promptVersionToInstance_promptVersion\n            id\n          }\n        }\n        ... on CodeEvaluator {\n          sourceCode\n          language\n          sandboxConfig {\n            id\n          }\n          inputMapping {\n            pathMapping\n            literalMapping\n          }\n          outputConfigs {\n            __typename\n            ... on CategoricalAnnotationConfig {\n              name\n              optimizationDirection\n              values {\n                label\n                score\n              }\n            }\n            ... on ContinuousAnnotationConfig {\n              name\n              optimizationDirection\n              lowerBound\n              upperBound\n            }\n            ... on FreeformAnnotationConfig {\n              name\n              optimizationDirection\n              threshold\n              lowerBound\n              upperBound\n            }\n            ... on Node {\n              __isNode: __typename\n              id\n            }\n          }\n        }\n      }\n    }\n    id\n  }\n  sandboxProviders {\n    backendType\n    supportedLanguages\n    enabled\n    configs {\n      id\n      name\n      description\n      language\n      timeout\n      config {\n        envVars {\n          name\n          secretKey\n        }\n        internetAccess {\n          mode\n        }\n        dependencies {\n          packages\n        }\n      }\n    }\n    id\n  }\n  sandboxBackends {\n    backendType\n    status\n    supportsEnvVars\n    internetAccess\n    supportsDependencies\n  }\n}\n\nfragment PromptInvocationParametersReadableFragment on PromptInvocationParameters {\n  __isPromptInvocationParameters: __typename\n  __typename\n  ... on PromptOpenAIInvocationParameters {\n    temperature\n    openaiMaxTokens: maxTokens\n    maxCompletionTokens\n    frequencyPenalty\n    presencePenalty\n    topP\n    seed\n    stop\n    reasoningEffort\n    extraBody\n  }\n  ... on PromptAnthropicInvocationParameters {\n    anthropicMaxTokens: maxTokens\n    temperature\n    topP\n    stopSequences\n    outputConfig {\n      effort\n    }\n    thinking {\n      __typename\n      ... on PromptAnthropicThinkingDisabled {\n        disabled\n      }\n      ... on PromptAnthropicThinkingEnabled {\n        budgetTokens\n        enabledDisplay: display\n      }\n      ... on PromptAnthropicThinkingAdaptive {\n        adaptiveDisplay: display\n      }\n    }\n    extraBody\n  }\n  ... on PromptGoogleInvocationParameters {\n    temperature\n    maxOutputTokens\n    stopSequences\n    presencePenalty\n    frequencyPenalty\n    topP\n    topK\n    thinkingConfig {\n      thinkingBudget\n      thinkingLevel\n      includeThoughts\n    }\n  }\n  ... on PromptAwsInvocationParameters {\n    awsMaxTokens: maxTokens\n    temperature\n    topP\n    stopSequences\n  }\n}\n\nfragment fetchPlaygroundPrompt_promptVersionToInstance_promptVersion on PromptVersion {\n  id\n  modelName\n  modelProvider\n  invocationParameters {\n    __typename\n    ...PromptInvocationParametersReadableFragment\n  }\n  customProvider {\n    id\n    name\n  }\n  responseFormat {\n    jsonSchema {\n      name\n      description\n      schema\n      strict\n    }\n  }\n  template {\n    __typename\n    ... on PromptChatTemplate {\n      messages {\n        role\n        content {\n          __typename\n          ... on TextContentPart {\n            text {\n              text\n            }\n          }\n          ... on ToolCallContentPart {\n            toolCall {\n              toolCallId\n              toolCall {\n                name\n                arguments\n              }\n            }\n          }\n          ... on ToolResultContentPart {\n            toolResult {\n              toolCallId\n              result\n            }\n          }\n        }\n      }\n    }\n    ... on PromptStringTemplate {\n      template\n    }\n  }\n  tools {\n    tools {\n      __typename\n      ... on PromptToolFunction {\n        function {\n          name\n          description\n          parameters\n          strict\n        }\n      }\n      ... on PromptToolRaw {\n        raw\n      }\n    }\n    toolChoice {\n      type\n      functionName\n    }\n    disableParallelToolCalls\n  }\n}\n"
  }
};
})();

(node as any).hash = "f74c869b6c67a90c71c373d687a45af2";

export default node;
