/**
 * @generated SignedSource<<fa2e5f41316fc8c544aa920e6452b0e9>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type EvaluatorKind = "BUILTIN" | "CODE" | "LLM";
export type InternetAccessMode = "ALLOWLIST" | "BOOLEAN" | "NONE";
export type Language = "PYTHON" | "TYPESCRIPT";
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE" | "NONE";
export type SandboxBackendStatus = "AVAILABLE" | "MISSING_CREDENTIALS" | "NOT_INSTALLED" | "UNAVAILABLE";
export type EditCodeDatasetEvaluatorSlideover_datasetEvaluatorQuery$variables = {
  canManageSandboxes: boolean;
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
          readonly lowerBound?: number | null;
          readonly name?: string;
          readonly optimizationDirection?: OptimizationDirection;
          readonly upperBound?: number | null;
          readonly values?: ReadonlyArray<{
            readonly label: string;
            readonly score: number | null;
          }>;
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
        readonly lowerBound?: number | null;
        readonly name?: string;
        readonly optimizationDirection?: OptimizationDirection;
        readonly upperBound?: number | null;
        readonly values?: ReadonlyArray<{
          readonly label: string;
          readonly score: number | null;
        }>;
      }>;
    };
    readonly id: string;
  };
  readonly sandboxBackends: ReadonlyArray<{
    readonly backendType: string;
    readonly dependenciesLanguage: Language | null;
    readonly internetAccess: InternetAccessMode;
    readonly status: SandboxBackendStatus;
    readonly supportsEnvVars: boolean;
  }>;
  readonly sandboxProviders: ReadonlyArray<{
    readonly backendType: string;
    readonly configs: ReadonlyArray<{
      readonly config?: any;
      readonly description: string | null;
      readonly id: string;
      readonly name: string;
      readonly timeout: number;
    }>;
    readonly enabled: boolean;
    readonly language: Language;
  }>;
};
export type EditCodeDatasetEvaluatorSlideover_datasetEvaluatorQuery = {
  response: EditCodeDatasetEvaluatorSlideover_datasetEvaluatorQuery$data;
  variables: EditCodeDatasetEvaluatorSlideover_datasetEvaluatorQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "canManageSandboxes"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "datasetEvaluatorId"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "datasetId"
},
v3 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "datasetId"
  }
],
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v5 = [
  {
    "kind": "Variable",
    "name": "datasetEvaluatorId",
    "variableName": "datasetEvaluatorId"
  }
],
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
  "storageKey": null
},
v8 = {
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
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "optimizationDirection",
  "storageKey": null
},
v10 = {
  "kind": "InlineFragment",
  "selections": [
    (v6/*: any*/),
    (v9/*: any*/),
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
v11 = {
  "kind": "InlineFragment",
  "selections": [
    (v6/*: any*/),
    (v9/*: any*/),
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
v12 = {
  "alias": null,
  "args": null,
  "concreteType": null,
  "kind": "LinkedField",
  "name": "outputConfigs",
  "plural": true,
  "selections": [
    (v10/*: any*/),
    (v11/*: any*/)
  ],
  "storageKey": null
},
v13 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "kind",
  "storageKey": null
},
v14 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "language",
  "storageKey": null
},
v15 = [
  (v4/*: any*/)
],
v16 = {
  "alias": null,
  "args": null,
  "concreteType": "SandboxConfig",
  "kind": "LinkedField",
  "name": "sandboxConfig",
  "plural": false,
  "selections": (v15/*: any*/),
  "storageKey": null
},
v17 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "sourceCode",
  "storageKey": null
},
v18 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "backendType",
  "storageKey": null
},
v19 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "enabled",
  "storageKey": null
},
v20 = {
  "alias": null,
  "args": null,
  "concreteType": "SandboxConfig",
  "kind": "LinkedField",
  "name": "configs",
  "plural": true,
  "selections": [
    (v4/*: any*/),
    (v6/*: any*/),
    (v7/*: any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "timeout",
      "storageKey": null
    },
    {
      "condition": "canManageSandboxes",
      "kind": "Condition",
      "passingValue": true,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "config",
          "storageKey": null
        }
      ]
    }
  ],
  "storageKey": null
},
v21 = {
  "alias": null,
  "args": null,
  "concreteType": "SandboxBackendInfo",
  "kind": "LinkedField",
  "name": "sandboxBackends",
  "plural": true,
  "selections": [
    (v18/*: any*/),
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
      "name": "dependenciesLanguage",
      "storageKey": null
    }
  ],
  "storageKey": null
},
v22 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v23 = {
  "alias": null,
  "args": null,
  "concreteType": null,
  "kind": "LinkedField",
  "name": "outputConfigs",
  "plural": true,
  "selections": [
    (v22/*: any*/),
    (v10/*: any*/),
    (v11/*: any*/),
    {
      "kind": "InlineFragment",
      "selections": (v15/*: any*/),
      "type": "Node",
      "abstractKey": "__isNode"
    }
  ],
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/),
      (v2/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "EditCodeDatasetEvaluatorSlideover_datasetEvaluatorQuery",
    "selections": [
      {
        "alias": "dataset",
        "args": (v3/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v4/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": (v5/*: any*/),
                "concreteType": "DatasetEvaluator",
                "kind": "LinkedField",
                "name": "datasetEvaluator",
                "plural": false,
                "selections": [
                  (v4/*: any*/),
                  (v6/*: any*/),
                  (v7/*: any*/),
                  (v8/*: any*/),
                  (v12/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": null,
                    "kind": "LinkedField",
                    "name": "evaluator",
                    "plural": false,
                    "selections": [
                      (v4/*: any*/),
                      (v13/*: any*/),
                      {
                        "kind": "InlineFragment",
                        "selections": [
                          (v6/*: any*/),
                          (v7/*: any*/),
                          (v14/*: any*/),
                          (v16/*: any*/),
                          (v12/*: any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "CodeEvaluatorVersion",
                            "kind": "LinkedField",
                            "name": "currentVersion",
                            "plural": false,
                            "selections": [
                              (v17/*: any*/)
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
          (v18/*: any*/),
          (v14/*: any*/),
          (v19/*: any*/),
          (v20/*: any*/)
        ],
        "storageKey": null
      },
      (v21/*: any*/)
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v1/*: any*/),
      (v2/*: any*/),
      (v0/*: any*/)
    ],
    "kind": "Operation",
    "name": "EditCodeDatasetEvaluatorSlideover_datasetEvaluatorQuery",
    "selections": [
      {
        "alias": "dataset",
        "args": (v3/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v22/*: any*/),
          (v4/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": (v5/*: any*/),
                "concreteType": "DatasetEvaluator",
                "kind": "LinkedField",
                "name": "datasetEvaluator",
                "plural": false,
                "selections": [
                  (v4/*: any*/),
                  (v6/*: any*/),
                  (v7/*: any*/),
                  (v8/*: any*/),
                  (v23/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": null,
                    "kind": "LinkedField",
                    "name": "evaluator",
                    "plural": false,
                    "selections": [
                      (v22/*: any*/),
                      (v4/*: any*/),
                      (v13/*: any*/),
                      {
                        "kind": "InlineFragment",
                        "selections": [
                          (v6/*: any*/),
                          (v7/*: any*/),
                          (v14/*: any*/),
                          (v16/*: any*/),
                          (v23/*: any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "CodeEvaluatorVersion",
                            "kind": "LinkedField",
                            "name": "currentVersion",
                            "plural": false,
                            "selections": [
                              (v17/*: any*/),
                              (v4/*: any*/)
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
          (v18/*: any*/),
          (v14/*: any*/),
          (v19/*: any*/),
          (v20/*: any*/),
          (v4/*: any*/)
        ],
        "storageKey": null
      },
      (v21/*: any*/)
    ]
  },
  "params": {
    "cacheID": "a29016df1dd87189a5f71f798c2db3d3",
    "id": null,
    "metadata": {},
    "name": "EditCodeDatasetEvaluatorSlideover_datasetEvaluatorQuery",
    "operationKind": "query",
    "text": "query EditCodeDatasetEvaluatorSlideover_datasetEvaluatorQuery(\n  $datasetEvaluatorId: ID!\n  $datasetId: ID!\n  $canManageSandboxes: Boolean!\n) {\n  dataset: node(id: $datasetId) {\n    __typename\n    id\n    ... on Dataset {\n      datasetEvaluator(datasetEvaluatorId: $datasetEvaluatorId) {\n        id\n        name\n        description\n        inputMapping {\n          literalMapping\n          pathMapping\n        }\n        outputConfigs {\n          __typename\n          ... on CategoricalAnnotationConfig {\n            name\n            optimizationDirection\n            values {\n              label\n              score\n            }\n          }\n          ... on ContinuousAnnotationConfig {\n            name\n            optimizationDirection\n            lowerBound\n            upperBound\n          }\n          ... on Node {\n            __isNode: __typename\n            id\n          }\n        }\n        evaluator {\n          __typename\n          id\n          kind\n          ... on CodeEvaluator {\n            name\n            description\n            language\n            sandboxConfig {\n              id\n            }\n            outputConfigs {\n              __typename\n              ... on CategoricalAnnotationConfig {\n                name\n                optimizationDirection\n                values {\n                  label\n                  score\n                }\n              }\n              ... on ContinuousAnnotationConfig {\n                name\n                optimizationDirection\n                lowerBound\n                upperBound\n              }\n              ... on Node {\n                __isNode: __typename\n                id\n              }\n            }\n            currentVersion {\n              sourceCode\n              id\n            }\n          }\n        }\n      }\n    }\n  }\n  sandboxProviders {\n    backendType\n    language\n    enabled\n    configs {\n      id\n      name\n      description\n      timeout\n      config @include(if: $canManageSandboxes)\n    }\n    id\n  }\n  sandboxBackends {\n    backendType\n    status\n    supportsEnvVars\n    internetAccess\n    dependenciesLanguage\n  }\n}\n"
  }
};
})();

(node as any).hash = "3cec5f883a4a87198df2f0f856f27e9e";

export default node;
