/**
 * @generated SignedSource<<e148f79395b7c41e25553f584258ae44>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type EvaluatorKind = "BUILTIN" | "CODE" | "LLM";
export type InternetAccessChoice = "ALLOW" | "DENY";
export type InternetAccessMode = "BOOLEAN" | "NONE";
export type Language = "PYTHON" | "TYPESCRIPT";
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE" | "NONE";
export type SandboxBackendStatus = "AVAILABLE" | "DISABLED" | "MISSING_CREDENTIALS" | "NOT_INSTALLED" | "UNAVAILABLE";
export type SandboxBackendType = "DAYTONA" | "DENO" | "E2B" | "MODAL" | "MONTY" | "VERCEL" | "WASM";
export type EditCodeDatasetEvaluatorSlideover_datasetEvaluatorQuery$variables = {
  datasetEvaluatorId: string;
  datasetId: string;
};
export type EditCodeDatasetEvaluatorSlideover_datasetEvaluatorQuery$data = {
  readonly dataset: {
    readonly datasetEvaluator?: {
      readonly description: string | null;
      readonly evaluator: {
        readonly currentVersion?: {
          readonly sourceCode: string;
        } | null;
        readonly description?: string | null;
        readonly id: string;
        readonly kind: EvaluatorKind;
        readonly language?: Language;
        readonly name?: string;
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
        readonly sandboxConfig?: {
          readonly id: string;
        } | null;
      };
      readonly id: string;
      readonly inputMapping: {
        readonly literalMapping: any;
        readonly pathMapping: any;
      };
      readonly name: string;
      readonly outputConfigs: ReadonlyArray<{
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
    };
    readonly id: string;
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
export type EditCodeDatasetEvaluatorSlideover_datasetEvaluatorQuery = {
  response: EditCodeDatasetEvaluatorSlideover_datasetEvaluatorQuery$data;
  variables: EditCodeDatasetEvaluatorSlideover_datasetEvaluatorQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "datasetEvaluatorId"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "datasetId"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "datasetId"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v3 = [
  {
    "kind": "Variable",
    "name": "datasetEvaluatorId",
    "variableName": "datasetEvaluatorId"
  }
],
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
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
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
  "kind": "InlineFragment",
  "selections": [
    (v4/*: any*/),
    (v8/*: any*/),
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
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "lowerBound",
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "upperBound",
  "storageKey": null
},
v12 = {
  "kind": "InlineFragment",
  "selections": [
    (v4/*: any*/),
    (v8/*: any*/),
    (v10/*: any*/),
    (v11/*: any*/)
  ],
  "type": "ContinuousAnnotationConfig",
  "abstractKey": null
},
v13 = {
  "kind": "InlineFragment",
  "selections": [
    (v4/*: any*/),
    (v8/*: any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "threshold",
      "storageKey": null
    },
    (v10/*: any*/),
    (v11/*: any*/)
  ],
  "type": "FreeformAnnotationConfig",
  "abstractKey": null
},
v14 = {
  "alias": null,
  "args": null,
  "concreteType": null,
  "kind": "LinkedField",
  "name": "outputConfigs",
  "plural": true,
  "selections": [
    (v7/*: any*/),
    (v9/*: any*/),
    (v12/*: any*/),
    (v13/*: any*/)
  ],
  "storageKey": null
},
v15 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "kind",
  "storageKey": null
},
v16 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "language",
  "storageKey": null
},
v17 = [
  (v2/*: any*/)
],
v18 = {
  "alias": null,
  "args": null,
  "concreteType": "SandboxConfig",
  "kind": "LinkedField",
  "name": "sandboxConfig",
  "plural": false,
  "selections": (v17/*: any*/),
  "storageKey": null
},
v19 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "sourceCode",
  "storageKey": null
},
v20 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "backendType",
  "storageKey": null
},
v21 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "supportedLanguages",
  "storageKey": null
},
v22 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "enabled",
  "storageKey": null
},
v23 = {
  "alias": null,
  "args": null,
  "concreteType": "SandboxConfig",
  "kind": "LinkedField",
  "name": "configs",
  "plural": true,
  "selections": [
    (v2/*: any*/),
    (v4/*: any*/),
    (v5/*: any*/),
    (v16/*: any*/),
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
            (v4/*: any*/),
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
v24 = {
  "alias": null,
  "args": null,
  "concreteType": "SandboxBackendInfo",
  "kind": "LinkedField",
  "name": "sandboxBackends",
  "plural": true,
  "selections": [
    (v20/*: any*/),
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
v25 = {
  "alias": null,
  "args": null,
  "concreteType": null,
  "kind": "LinkedField",
  "name": "outputConfigs",
  "plural": true,
  "selections": [
    (v7/*: any*/),
    (v9/*: any*/),
    (v12/*: any*/),
    (v13/*: any*/),
    {
      "kind": "InlineFragment",
      "selections": (v17/*: any*/),
      "type": "Node",
      "abstractKey": "__isNode"
    }
  ],
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "EditCodeDatasetEvaluatorSlideover_datasetEvaluatorQuery",
    "selections": [
      {
        "alias": "dataset",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": (v3/*: any*/),
                "concreteType": "DatasetEvaluator",
                "kind": "LinkedField",
                "name": "datasetEvaluator",
                "plural": false,
                "selections": [
                  (v2/*: any*/),
                  (v4/*: any*/),
                  (v5/*: any*/),
                  (v6/*: any*/),
                  (v14/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": null,
                    "kind": "LinkedField",
                    "name": "evaluator",
                    "plural": false,
                    "selections": [
                      (v2/*: any*/),
                      (v15/*: any*/),
                      {
                        "kind": "InlineFragment",
                        "selections": [
                          (v4/*: any*/),
                          (v5/*: any*/),
                          (v16/*: any*/),
                          (v18/*: any*/),
                          (v14/*: any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "CodeEvaluatorVersion",
                            "kind": "LinkedField",
                            "name": "currentVersion",
                            "plural": false,
                            "selections": [
                              (v19/*: any*/)
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
                "storageKey": null
              }
            ],
            "type": "Dataset",
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
          (v20/*: any*/),
          (v21/*: any*/),
          (v22/*: any*/),
          (v23/*: any*/)
        ],
        "storageKey": null
      },
      (v24/*: any*/)
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "EditCodeDatasetEvaluatorSlideover_datasetEvaluatorQuery",
    "selections": [
      {
        "alias": "dataset",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v7/*: any*/),
          (v2/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": (v3/*: any*/),
                "concreteType": "DatasetEvaluator",
                "kind": "LinkedField",
                "name": "datasetEvaluator",
                "plural": false,
                "selections": [
                  (v2/*: any*/),
                  (v4/*: any*/),
                  (v5/*: any*/),
                  (v6/*: any*/),
                  (v25/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": null,
                    "kind": "LinkedField",
                    "name": "evaluator",
                    "plural": false,
                    "selections": [
                      (v7/*: any*/),
                      (v2/*: any*/),
                      (v15/*: any*/),
                      {
                        "kind": "InlineFragment",
                        "selections": [
                          (v4/*: any*/),
                          (v5/*: any*/),
                          (v16/*: any*/),
                          (v18/*: any*/),
                          (v25/*: any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "CodeEvaluatorVersion",
                            "kind": "LinkedField",
                            "name": "currentVersion",
                            "plural": false,
                            "selections": [
                              (v19/*: any*/),
                              (v2/*: any*/)
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
                "storageKey": null
              }
            ],
            "type": "Dataset",
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
          (v20/*: any*/),
          (v21/*: any*/),
          (v22/*: any*/),
          (v23/*: any*/),
          (v2/*: any*/)
        ],
        "storageKey": null
      },
      (v24/*: any*/)
    ]
  },
  "params": {
    "cacheID": "395da128a7d38385677a36b361567041",
    "id": null,
    "metadata": {},
    "name": "EditCodeDatasetEvaluatorSlideover_datasetEvaluatorQuery",
    "operationKind": "query",
    "text": "query EditCodeDatasetEvaluatorSlideover_datasetEvaluatorQuery(\n  $datasetEvaluatorId: ID!\n  $datasetId: ID!\n) {\n  dataset: node(id: $datasetId) {\n    __typename\n    id\n    ... on Dataset {\n      datasetEvaluator(datasetEvaluatorId: $datasetEvaluatorId) {\n        id\n        name\n        description\n        inputMapping {\n          literalMapping\n          pathMapping\n        }\n        outputConfigs {\n          __typename\n          ... on CategoricalAnnotationConfig {\n            name\n            optimizationDirection\n            values {\n              label\n              score\n            }\n          }\n          ... on ContinuousAnnotationConfig {\n            name\n            optimizationDirection\n            lowerBound\n            upperBound\n          }\n          ... on FreeformAnnotationConfig {\n            name\n            optimizationDirection\n            threshold\n            lowerBound\n            upperBound\n          }\n          ... on Node {\n            __isNode: __typename\n            id\n          }\n        }\n        evaluator {\n          __typename\n          id\n          kind\n          ... on CodeEvaluator {\n            name\n            description\n            language\n            sandboxConfig {\n              id\n            }\n            outputConfigs {\n              __typename\n              ... on CategoricalAnnotationConfig {\n                name\n                optimizationDirection\n                values {\n                  label\n                  score\n                }\n              }\n              ... on ContinuousAnnotationConfig {\n                name\n                optimizationDirection\n                lowerBound\n                upperBound\n              }\n              ... on FreeformAnnotationConfig {\n                name\n                optimizationDirection\n                threshold\n                lowerBound\n                upperBound\n              }\n              ... on Node {\n                __isNode: __typename\n                id\n              }\n            }\n            currentVersion {\n              sourceCode\n              id\n            }\n          }\n        }\n      }\n    }\n  }\n  sandboxProviders {\n    backendType\n    supportedLanguages\n    enabled\n    configs {\n      id\n      name\n      description\n      language\n      timeout\n      config {\n        envVars {\n          name\n          secretKey\n        }\n        internetAccess {\n          mode\n        }\n        dependencies {\n          packages\n        }\n      }\n    }\n    id\n  }\n  sandboxBackends {\n    backendType\n    status\n    supportsEnvVars\n    internetAccess\n    supportsDependencies\n  }\n}\n"
  }
};
})();

(node as any).hash = "e29a5391fc87c178b46e1a713b5be376";

export default node;
