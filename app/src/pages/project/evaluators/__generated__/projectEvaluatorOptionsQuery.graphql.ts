/**
 * @generated SignedSource<<8d360467883fb6fc0e4224d868373e2a>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type EvaluatorKind = "BUILTIN" | "CODE" | "LLM";
export type Language = "PYTHON" | "TYPESCRIPT";
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE" | "NONE";
export type PromptTemplateFormat = "F_STRING" | "MUSTACHE" | "NONE";
export type projectEvaluatorOptionsQuery$variables = Record<PropertyKey, never>;
export type projectEvaluatorOptionsQuery$data = {
  readonly evaluators: {
    readonly edges: ReadonlyArray<{
      readonly evaluator: {
        readonly __typename: string;
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
        readonly promptVersion?: {
          readonly template: {
            readonly __typename: "PromptChatTemplate";
            readonly messages: ReadonlyArray<{
              readonly " $fragmentSpreads": FragmentRefs<"promptUtils_promptMessages">;
            }>;
          } | {
            readonly __typename: "PromptStringTemplate";
            readonly template: string;
          } | {
            // This will never be '%other', but we need some
            // value in case none of the concrete values match.
            readonly __typename: "%other";
          };
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
        };
        readonly sourceCode?: string;
      };
    }>;
    readonly pageInfo: {
      readonly hasNextPage: boolean;
    };
  };
};
export type projectEvaluatorOptionsQuery = {
  response: projectEvaluatorOptionsQuery$data;
  variables: projectEvaluatorOptionsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 100
  },
  {
    "kind": "Literal",
    "name": "sort",
    "value": {
      "col": "updatedAt",
      "dir": "desc"
    }
  }
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "kind",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "optimizationDirection",
  "storageKey": null
},
v7 = {
  "kind": "InlineFragment",
  "selections": [
    (v3/*:: as any*/),
    (v6/*:: as any*/),
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
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "lowerBound",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "upperBound",
  "storageKey": null
},
v10 = {
  "kind": "InlineFragment",
  "selections": [
    (v3/*:: as any*/),
    (v6/*:: as any*/),
    (v8/*:: as any*/),
    (v9/*:: as any*/)
  ],
  "type": "ContinuousAnnotationConfig",
  "abstractKey": null
},
v11 = {
  "kind": "InlineFragment",
  "selections": [
    (v3/*:: as any*/),
    (v6/*:: as any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "threshold",
      "storageKey": null
    },
    (v8/*:: as any*/),
    (v9/*:: as any*/)
  ],
  "type": "FreeformAnnotationConfig",
  "abstractKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "concreteType": null,
  "kind": "LinkedField",
  "name": "outputConfigs",
  "plural": true,
  "selections": [
    (v1/*:: as any*/),
    (v7/*:: as any*/),
    (v10/*:: as any*/),
    (v11/*:: as any*/)
  ],
  "storageKey": null
},
v13 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "templateFormat",
  "storageKey": null
},
v14 = {
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
v15 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "role",
  "storageKey": null
},
v16 = {
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
v17 = {
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
        (v1/*:: as any*/),
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
v18 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "sourceCode",
  "storageKey": null
},
v19 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "language",
  "storageKey": null
},
v20 = {
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
v21 = {
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
    }
  ],
  "storageKey": null
},
v22 = {
  "alias": null,
  "args": null,
  "concreteType": null,
  "kind": "LinkedField",
  "name": "outputConfigs",
  "plural": true,
  "selections": [
    (v1/*:: as any*/),
    (v7/*:: as any*/),
    (v10/*:: as any*/),
    (v11/*:: as any*/),
    {
      "kind": "InlineFragment",
      "selections": [
        (v2/*:: as any*/)
      ],
      "type": "Node",
      "abstractKey": "__isNode"
    }
  ],
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "projectEvaluatorOptionsQuery",
    "selections": [
      {
        "alias": null,
        "args": (v0/*:: as any*/),
        "concreteType": "EvaluatorConnection",
        "kind": "LinkedField",
        "name": "evaluators",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "EvaluatorEdge",
            "kind": "LinkedField",
            "name": "edges",
            "plural": true,
            "selections": [
              {
                "alias": "evaluator",
                "args": null,
                "concreteType": null,
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  (v1/*:: as any*/),
                  (v2/*:: as any*/),
                  (v3/*:: as any*/),
                  (v4/*:: as any*/),
                  (v5/*:: as any*/),
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      (v12/*:: as any*/),
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "PromptVersion",
                        "kind": "LinkedField",
                        "name": "promptVersion",
                        "plural": false,
                        "selections": [
                          (v13/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": null,
                            "kind": "LinkedField",
                            "name": "template",
                            "plural": false,
                            "selections": [
                              (v1/*:: as any*/),
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
                                              (v14/*:: as any*/)
                                            ],
                                            "storageKey": null
                                          },
                                          (v15/*:: as any*/)
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
                              (v16/*:: as any*/)
                            ],
                            "storageKey": null
                          },
                          (v17/*:: as any*/)
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
                      (v18/*:: as any*/),
                      (v19/*:: as any*/),
                      (v20/*:: as any*/),
                      (v12/*:: as any*/)
                    ],
                    "type": "CodeEvaluator",
                    "abstractKey": null
                  }
                ],
                "storageKey": null
              }
            ],
            "storageKey": null
          },
          (v21/*:: as any*/)
        ],
        "storageKey": "evaluators(first:100,sort:{\"col\":\"updatedAt\",\"dir\":\"desc\"})"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "projectEvaluatorOptionsQuery",
    "selections": [
      {
        "alias": null,
        "args": (v0/*:: as any*/),
        "concreteType": "EvaluatorConnection",
        "kind": "LinkedField",
        "name": "evaluators",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "EvaluatorEdge",
            "kind": "LinkedField",
            "name": "edges",
            "plural": true,
            "selections": [
              {
                "alias": "evaluator",
                "args": null,
                "concreteType": null,
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  (v1/*:: as any*/),
                  (v2/*:: as any*/),
                  (v3/*:: as any*/),
                  (v4/*:: as any*/),
                  (v5/*:: as any*/),
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      (v22/*:: as any*/),
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "PromptVersion",
                        "kind": "LinkedField",
                        "name": "promptVersion",
                        "plural": false,
                        "selections": [
                          (v13/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": null,
                            "kind": "LinkedField",
                            "name": "template",
                            "plural": false,
                            "selections": [
                              (v1/*:: as any*/),
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
                                          (v1/*:: as any*/),
                                          (v14/*:: as any*/)
                                        ],
                                        "storageKey": null
                                      },
                                      (v15/*:: as any*/)
                                    ],
                                    "storageKey": null
                                  }
                                ],
                                "type": "PromptChatTemplate",
                                "abstractKey": null
                              },
                              (v16/*:: as any*/)
                            ],
                            "storageKey": null
                          },
                          (v17/*:: as any*/),
                          (v2/*:: as any*/)
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
                      (v18/*:: as any*/),
                      (v19/*:: as any*/),
                      (v20/*:: as any*/),
                      (v22/*:: as any*/)
                    ],
                    "type": "CodeEvaluator",
                    "abstractKey": null
                  }
                ],
                "storageKey": null
              }
            ],
            "storageKey": null
          },
          (v21/*:: as any*/)
        ],
        "storageKey": "evaluators(first:100,sort:{\"col\":\"updatedAt\",\"dir\":\"desc\"})"
      }
    ]
  },
  "params": {
    "cacheID": "430e4fc0c62f4d5474de4f4b68300ef4",
    "id": null,
    "metadata": {},
    "name": "projectEvaluatorOptionsQuery",
    "operationKind": "query",
    "text": "query projectEvaluatorOptionsQuery {\n  evaluators(first: 100, sort: {col: updatedAt, dir: desc}) {\n    edges {\n      evaluator: node {\n        __typename\n        id\n        name\n        description\n        kind\n        ... on LLMEvaluator {\n          outputConfigs {\n            __typename\n            ... on CategoricalAnnotationConfig {\n              name\n              optimizationDirection\n              values {\n                label\n                score\n              }\n            }\n            ... on ContinuousAnnotationConfig {\n              name\n              optimizationDirection\n              lowerBound\n              upperBound\n            }\n            ... on FreeformAnnotationConfig {\n              name\n              optimizationDirection\n              threshold\n              lowerBound\n              upperBound\n            }\n            ... on Node {\n              __isNode: __typename\n              id\n            }\n          }\n          promptVersion {\n            templateFormat\n            template {\n              __typename\n              ... on PromptChatTemplate {\n                messages {\n                  ...promptUtils_promptMessages\n                }\n              }\n              ... on PromptStringTemplate {\n                template\n              }\n            }\n            tools {\n              tools {\n                __typename\n                ... on PromptToolFunction {\n                  function {\n                    parameters\n                  }\n                }\n                ... on PromptToolRaw {\n                  raw\n                }\n              }\n            }\n            id\n          }\n        }\n        ... on CodeEvaluator {\n          sourceCode\n          language\n          inputMapping {\n            pathMapping\n            literalMapping\n          }\n          outputConfigs {\n            __typename\n            ... on CategoricalAnnotationConfig {\n              name\n              optimizationDirection\n              values {\n                label\n                score\n              }\n            }\n            ... on ContinuousAnnotationConfig {\n              name\n              optimizationDirection\n              lowerBound\n              upperBound\n            }\n            ... on FreeformAnnotationConfig {\n              name\n              optimizationDirection\n              threshold\n              lowerBound\n              upperBound\n            }\n            ... on Node {\n              __isNode: __typename\n              id\n            }\n          }\n        }\n      }\n    }\n    pageInfo {\n      hasNextPage\n    }\n  }\n}\n\nfragment promptUtils_promptMessages on PromptMessage {\n  content {\n    __typename\n    ... on TextContentPart {\n      text {\n        text\n      }\n    }\n  }\n  role\n}\n"
  }
};
})();

(node as any).hash = "201c6eb4e320a95babf8a697af0a8d8c";

export default node;
