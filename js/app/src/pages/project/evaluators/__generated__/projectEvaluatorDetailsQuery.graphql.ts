/**
 * @generated SignedSource<<77c1bce49ee219e505b9866c15301a3a>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE" | "NONE";
export type projectEvaluatorDetailsQuery$variables = {
  id: string;
};
export type projectEvaluatorDetailsQuery$data = {
  readonly evaluator: {
    readonly __typename: string;
    readonly decisionVersion?: {
      readonly decision: {
        readonly id: string;
        readonly name: string;
      };
      readonly id: string;
      readonly questions: ReadonlyArray<{
        readonly __typename: "DecisionChoiceQuestion";
        readonly choices: ReadonlyArray<{
          readonly value: string;
        }>;
        readonly name: string;
      } | {
        readonly __typename: "DecisionPredicateQuestion";
        readonly name: string;
      } | {
        readonly __typename: "DecisionScaleQuestion";
        readonly levels: ReadonlyArray<{
          readonly label: string;
        }>;
        readonly name: string;
      } | {
        // This will never be '%other', but we need some
        // value in case none of the concrete values match.
        readonly __typename: "%other";
      }>;
    };
    readonly id?: string;
    readonly inputSchema?: any;
    readonly name?: string;
    readonly scoringPolicy?: {
      readonly questions: ReadonlyArray<{
        readonly __typename: string;
        readonly includeLabel?: boolean;
        readonly name: string;
        readonly optimizationDirection: OptimizationDirection;
        readonly scores?: ReadonlyArray<{
          readonly choice: string;
          readonly score: number;
        }>;
        readonly threshold?: number;
      }>;
    };
    readonly " $fragmentSpreads": FragmentRefs<"projectEvaluatorOptions_codeEvaluatorDetails" | "projectEvaluatorOptions_llmEvaluatorDetails">;
  };
};
export type projectEvaluatorDetailsQuery = {
  response: projectEvaluatorDetailsQuery$data;
  variables: projectEvaluatorDetailsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
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
  "name": "description",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "kind",
  "storageKey": null
},
v7 = {
  "alias": "llmInputSchema",
  "args": null,
  "kind": "ScalarField",
  "name": "inputSchema",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "optimizationDirection",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "label",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "score",
  "storageKey": null
},
v11 = {
  "kind": "InlineFragment",
  "selections": [
    (v4/*:: as any*/),
    (v8/*:: as any*/),
    {
      "alias": null,
      "args": null,
      "concreteType": "CategoricalAnnotationValue",
      "kind": "LinkedField",
      "name": "values",
      "plural": true,
      "selections": [
        (v9/*:: as any*/),
        (v10/*:: as any*/)
      ],
      "storageKey": null
    }
  ],
  "type": "CategoricalAnnotationConfig",
  "abstractKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "lowerBound",
  "storageKey": null
},
v13 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "upperBound",
  "storageKey": null
},
v14 = {
  "kind": "InlineFragment",
  "selections": [
    (v4/*:: as any*/),
    (v8/*:: as any*/),
    (v12/*:: as any*/),
    (v13/*:: as any*/)
  ],
  "type": "ContinuousAnnotationConfig",
  "abstractKey": null
},
v15 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "threshold",
  "storageKey": null
},
v16 = {
  "kind": "InlineFragment",
  "selections": [
    (v4/*:: as any*/),
    (v8/*:: as any*/),
    (v15/*:: as any*/),
    (v12/*:: as any*/),
    (v13/*:: as any*/)
  ],
  "type": "FreeformAnnotationConfig",
  "abstractKey": null
},
v17 = {
  "alias": null,
  "args": null,
  "concreteType": null,
  "kind": "LinkedField",
  "name": "outputConfigs",
  "plural": true,
  "selections": [
    (v2/*:: as any*/),
    (v11/*:: as any*/),
    (v14/*:: as any*/),
    (v16/*:: as any*/)
  ],
  "storageKey": null
},
v18 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "templateFormat",
  "storageKey": null
},
v19 = {
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
v20 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "role",
  "storageKey": null
},
v21 = {
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
},
v22 = {
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
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "parameters",
                  "storageKey": null
                }
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
    }
  ],
  "storageKey": null
},
v23 = {
  "alias": "codeInputSchema",
  "args": null,
  "kind": "ScalarField",
  "name": "inputSchema",
  "storageKey": null
},
v24 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "sourceCode",
  "storageKey": null
},
v25 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "language",
  "storageKey": null
},
v26 = [
  (v3/*:: as any*/)
],
v27 = {
  "alias": null,
  "args": null,
  "concreteType": "SandboxConfig",
  "kind": "LinkedField",
  "name": "sandboxConfig",
  "plural": false,
  "selections": (v26/*:: as any*/),
  "storageKey": null
},
v28 = {
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
v29 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "inputSchema",
  "storageKey": null
},
v30 = {
  "alias": null,
  "args": null,
  "concreteType": "DecisionScoringPolicy",
  "kind": "LinkedField",
  "name": "scoringPolicy",
  "plural": false,
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": null,
      "kind": "LinkedField",
      "name": "questions",
      "plural": true,
      "selections": [
        (v2/*:: as any*/),
        (v4/*:: as any*/),
        (v8/*:: as any*/),
        {
          "kind": "InlineFragment",
          "selections": [
            (v15/*:: as any*/)
          ],
          "type": "DecisionPredicateScoring",
          "abstractKey": null
        },
        {
          "kind": "InlineFragment",
          "selections": [
            {
              "alias": null,
              "args": null,
              "concreteType": "DecisionChoiceScore",
              "kind": "LinkedField",
              "name": "scores",
              "plural": true,
              "selections": [
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "choice",
                  "storageKey": null
                },
                (v10/*:: as any*/)
              ],
              "storageKey": null
            }
          ],
          "type": "DecisionChoiceScoring",
          "abstractKey": null
        },
        {
          "kind": "InlineFragment",
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "includeLabel",
              "storageKey": null
            }
          ],
          "type": "DecisionScaleScoring",
          "abstractKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "storageKey": null
},
v31 = {
  "alias": null,
  "args": null,
  "concreteType": "DecisionVersion",
  "kind": "LinkedField",
  "name": "decisionVersion",
  "plural": false,
  "selections": [
    (v3/*:: as any*/),
    {
      "alias": null,
      "args": null,
      "concreteType": "Decision",
      "kind": "LinkedField",
      "name": "decision",
      "plural": false,
      "selections": [
        (v3/*:: as any*/),
        (v4/*:: as any*/)
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
        (v2/*:: as any*/),
        {
          "kind": "InlineFragment",
          "selections": [
            (v4/*:: as any*/)
          ],
          "type": "DecisionPredicateQuestion",
          "abstractKey": null
        },
        {
          "kind": "InlineFragment",
          "selections": [
            (v4/*:: as any*/),
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
                }
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
            (v4/*:: as any*/),
            {
              "alias": null,
              "args": null,
              "concreteType": "DecisionScaleLevel",
              "kind": "LinkedField",
              "name": "levels",
              "plural": true,
              "selections": [
                (v9/*:: as any*/)
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
  "storageKey": null
},
v32 = {
  "alias": null,
  "args": null,
  "concreteType": null,
  "kind": "LinkedField",
  "name": "outputConfigs",
  "plural": true,
  "selections": [
    (v2/*:: as any*/),
    (v11/*:: as any*/),
    (v14/*:: as any*/),
    (v16/*:: as any*/),
    {
      "kind": "InlineFragment",
      "selections": (v26/*:: as any*/),
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
    "name": "projectEvaluatorDetailsQuery",
    "selections": [
      {
        "alias": "evaluator",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*:: as any*/),
          {
            "kind": "InlineDataFragmentSpread",
            "name": "projectEvaluatorOptions_llmEvaluatorDetails",
            "selections": [
              {
                "kind": "InlineFragment",
                "selections": [
                  (v2/*:: as any*/),
                  (v3/*:: as any*/),
                  (v4/*:: as any*/),
                  (v5/*:: as any*/),
                  (v6/*:: as any*/),
                  (v7/*:: as any*/),
                  (v17/*:: as any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "PromptVersion",
                    "kind": "LinkedField",
                    "name": "promptVersion",
                    "plural": false,
                    "selections": [
                      (v18/*:: as any*/),
                      {
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
                                    "kind": "InlineDataFragmentSpread",
                                    "name": "promptUtils_promptMessages",
                                    "selections": [
                                      {
                                        "alias": null,
                                        "args": null,
                                        "concreteType": null,
                                        "kind": "LinkedField",
                                        "name": "content",
                                        "plural": true,
                                        "selections": [
                                          (v19/*:: as any*/)
                                        ],
                                        "storageKey": null
                                      },
                                      (v20/*:: as any*/)
                                    ],
                                    "args": null,
                                    "argumentDefinitions": []
                                  }
                                ],
                                "storageKey": null
                              }
                            ],
                            "type": "PromptChatTemplate",
                            "abstractKey": null
                          },
                          (v21/*:: as any*/)
                        ],
                        "storageKey": null
                      },
                      (v22/*:: as any*/)
                    ],
                    "storageKey": null
                  }
                ],
                "type": "LLMEvaluator",
                "abstractKey": null
              }
            ],
            "args": null,
            "argumentDefinitions": []
          },
          {
            "kind": "InlineDataFragmentSpread",
            "name": "projectEvaluatorOptions_codeEvaluatorDetails",
            "selections": [
              {
                "kind": "InlineFragment",
                "selections": [
                  (v2/*:: as any*/),
                  (v3/*:: as any*/),
                  (v4/*:: as any*/),
                  (v5/*:: as any*/),
                  (v6/*:: as any*/),
                  (v23/*:: as any*/),
                  (v17/*:: as any*/),
                  (v24/*:: as any*/),
                  (v25/*:: as any*/),
                  (v27/*:: as any*/),
                  (v28/*:: as any*/)
                ],
                "type": "CodeEvaluator",
                "abstractKey": null
              }
            ],
            "args": null,
            "argumentDefinitions": []
          },
          {
            "kind": "InlineFragment",
            "selections": [
              (v3/*:: as any*/),
              (v4/*:: as any*/),
              (v29/*:: as any*/),
              (v30/*:: as any*/),
              (v31/*:: as any*/)
            ],
            "type": "DecisionEvaluator",
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
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "projectEvaluatorDetailsQuery",
    "selections": [
      {
        "alias": "evaluator",
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
              (v32/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "PromptVersion",
                "kind": "LinkedField",
                "name": "promptVersion",
                "plural": false,
                "selections": [
                  (v18/*:: as any*/),
                  {
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
                                "concreteType": null,
                                "kind": "LinkedField",
                                "name": "content",
                                "plural": true,
                                "selections": [
                                  (v2/*:: as any*/),
                                  (v19/*:: as any*/)
                                ],
                                "storageKey": null
                              },
                              (v20/*:: as any*/)
                            ],
                            "storageKey": null
                          }
                        ],
                        "type": "PromptChatTemplate",
                        "abstractKey": null
                      },
                      (v21/*:: as any*/)
                    ],
                    "storageKey": null
                  },
                  (v22/*:: as any*/),
                  (v3/*:: as any*/)
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
              (v4/*:: as any*/),
              (v5/*:: as any*/),
              (v6/*:: as any*/),
              (v23/*:: as any*/),
              (v32/*:: as any*/),
              (v24/*:: as any*/),
              (v25/*:: as any*/),
              (v27/*:: as any*/),
              (v28/*:: as any*/)
            ],
            "type": "CodeEvaluator",
            "abstractKey": null
          },
          {
            "kind": "InlineFragment",
            "selections": [
              (v4/*:: as any*/),
              (v29/*:: as any*/),
              (v30/*:: as any*/),
              (v31/*:: as any*/)
            ],
            "type": "DecisionEvaluator",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "7f0f4cd7244f888ab1b8a58aaf4151fc",
    "id": null,
    "metadata": {},
    "name": "projectEvaluatorDetailsQuery",
    "operationKind": "query",
    "text": "query projectEvaluatorDetailsQuery(\n  $id: ID!\n) {\n  evaluator: node(id: $id) {\n    __typename\n    ...projectEvaluatorOptions_llmEvaluatorDetails\n    ...projectEvaluatorOptions_codeEvaluatorDetails\n    ... on DecisionEvaluator {\n      id\n      name\n      inputSchema\n      scoringPolicy {\n        questions {\n          __typename\n          name\n          optimizationDirection\n          ... on DecisionPredicateScoring {\n            threshold\n          }\n          ... on DecisionChoiceScoring {\n            scores {\n              choice\n              score\n            }\n          }\n          ... on DecisionScaleScoring {\n            includeLabel\n          }\n        }\n      }\n      decisionVersion {\n        id\n        decision {\n          id\n          name\n        }\n        questions {\n          __typename\n          ... on DecisionPredicateQuestion {\n            name\n          }\n          ... on DecisionChoiceQuestion {\n            name\n            choices {\n              value\n            }\n          }\n          ... on DecisionScaleQuestion {\n            name\n            levels {\n              label\n            }\n          }\n        }\n      }\n    }\n    id\n  }\n}\n\nfragment projectEvaluatorOptions_codeEvaluatorDetails on CodeEvaluator {\n  __typename\n  id\n  name\n  description\n  kind\n  codeInputSchema: inputSchema\n  outputConfigs {\n    __typename\n    ... on CategoricalAnnotationConfig {\n      name\n      optimizationDirection\n      values {\n        label\n        score\n      }\n    }\n    ... on ContinuousAnnotationConfig {\n      name\n      optimizationDirection\n      lowerBound\n      upperBound\n    }\n    ... on FreeformAnnotationConfig {\n      name\n      optimizationDirection\n      threshold\n      lowerBound\n      upperBound\n    }\n    ... on Node {\n      __isNode: __typename\n      id\n    }\n  }\n  sourceCode\n  language\n  sandboxConfig {\n    id\n  }\n  inputMapping {\n    pathMapping\n    literalMapping\n  }\n}\n\nfragment projectEvaluatorOptions_llmEvaluatorDetails on LLMEvaluator {\n  __typename\n  id\n  name\n  description\n  kind\n  llmInputSchema: inputSchema\n  outputConfigs {\n    __typename\n    ... on CategoricalAnnotationConfig {\n      name\n      optimizationDirection\n      values {\n        label\n        score\n      }\n    }\n    ... on ContinuousAnnotationConfig {\n      name\n      optimizationDirection\n      lowerBound\n      upperBound\n    }\n    ... on FreeformAnnotationConfig {\n      name\n      optimizationDirection\n      threshold\n      lowerBound\n      upperBound\n    }\n    ... on Node {\n      __isNode: __typename\n      id\n    }\n  }\n  promptVersion {\n    templateFormat\n    template {\n      __typename\n      ... on PromptChatTemplate {\n        messages {\n          ...promptUtils_promptMessages\n        }\n      }\n      ... on PromptStringTemplate {\n        template\n      }\n    }\n    tools {\n      tools {\n        __typename\n        ... on PromptToolFunction {\n          function {\n            parameters\n          }\n        }\n        ... on PromptToolRaw {\n          raw\n        }\n      }\n    }\n    id\n  }\n}\n\nfragment promptUtils_promptMessages on PromptMessage {\n  content {\n    __typename\n    ... on TextContentPart {\n      text {\n        text\n      }\n    }\n  }\n  role\n}\n"
  }
};
})();

(node as any).hash = "702b0a17319a2c090e75d3f15891f5b8";

export default node;
