/**
 * @generated SignedSource<<2aef30d9fee261b885f243750b17f24f>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ExperimentJobStatus = "COMPLETED" | "ERROR" | "RUNNING" | "STOPPED";
export type readExperimentResultsQuery$variables = {
  experimentId: string;
  first: number;
};
export type readExperimentResultsQuery$data = {
  readonly experiment: {
    readonly __typename: "Experiment";
    readonly annotationSummaries: ReadonlyArray<{
      readonly annotationName: string;
      readonly count: number;
      readonly errorCount: number;
      readonly meanScore: number | null;
    }>;
    readonly averageRunLatencyMs: number | null;
    readonly costSummary: {
      readonly total: {
        readonly cost: number | null;
        readonly tokens: number | null;
      };
    };
    readonly errorRate: number | null;
    readonly expectedRunCount: number;
    readonly id: string;
    readonly job: {
      readonly status: ExperimentJobStatus;
      readonly taskConfig: {
        readonly __typename: string;
      } | null;
    } | null;
    readonly name: string;
    readonly runCount: number;
    readonly runs: {
      readonly edges: ReadonlyArray<{
        readonly node: {
          readonly annotations: {
            readonly edges: ReadonlyArray<{
              readonly node: {
                readonly explanation: string | null;
                readonly label: string | null;
                readonly name: string;
                readonly score: number | null;
              };
            }>;
          };
          readonly error: string | null;
          readonly example: {
            readonly id: string;
            readonly revision: {
              readonly expectedOutputs: ReadonlyArray<{
                readonly annotationName: string;
                readonly explanation: string | null;
                readonly label: string | null;
                readonly score: number | null;
              }>;
              readonly input: any;
              readonly metadata: any;
              readonly output: any;
              readonly revisionId: string;
            };
          };
          readonly id: string;
          readonly latencyMs: number;
          readonly output: any | null;
        };
      }>;
    };
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  };
};
export type readExperimentResultsQuery = {
  response: readExperimentResultsQuery$data;
  variables: readExperimentResultsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "experimentId"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "first"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "experimentId"
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
  "name": "runCount",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "expectedRunCount",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "errorRate",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "averageRunLatencyMs",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "status",
  "storageKey": null
},
v10 = {
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
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "cost",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "tokens",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "annotationName",
  "storageKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "concreteType": "ExperimentAnnotationSummary",
  "kind": "LinkedField",
  "name": "annotationSummaries",
  "plural": true,
  "selections": [
    (v11/*:: as any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "meanScore",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "count",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "errorCount",
      "storageKey": null
    }
  ],
  "storageKey": null
},
v13 = [
  {
    "kind": "Variable",
    "name": "first",
    "variableName": "first"
  }
],
v14 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "output",
  "storageKey": null
},
v15 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "latencyMs",
  "storageKey": null
},
v16 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "error",
  "storageKey": null
},
v17 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "label",
  "storageKey": null
},
v18 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "score",
  "storageKey": null
},
v19 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "explanation",
  "storageKey": null
},
v20 = {
  "alias": null,
  "args": null,
  "concreteType": "DatasetExample",
  "kind": "LinkedField",
  "name": "example",
  "plural": false,
  "selections": [
    (v3/*:: as any*/),
    {
      "alias": null,
      "args": null,
      "concreteType": "DatasetExampleRevision",
      "kind": "LinkedField",
      "name": "revision",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "revisionId",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "input",
          "storageKey": null
        },
        (v14/*:: as any*/),
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "metadata",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "DatasetExampleExpectedOutput",
          "kind": "LinkedField",
          "name": "expectedOutputs",
          "plural": true,
          "selections": [
            (v11/*:: as any*/),
            (v17/*:: as any*/),
            (v18/*:: as any*/),
            (v19/*:: as any*/)
          ],
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "readExperimentResultsQuery",
    "selections": [
      {
        "alias": "experiment",
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
              {
                "alias": null,
                "args": null,
                "concreteType": "ExperimentJob",
                "kind": "LinkedField",
                "name": "job",
                "plural": false,
                "selections": [
                  (v9/*:: as any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": null,
                    "kind": "LinkedField",
                    "name": "taskConfig",
                    "plural": false,
                    "selections": [
                      (v2/*:: as any*/)
                    ],
                    "storageKey": null
                  }
                ],
                "storageKey": null
              },
              (v10/*:: as any*/),
              (v12/*:: as any*/),
              {
                "alias": null,
                "args": (v13/*:: as any*/),
                "concreteType": "ExperimentRunConnection",
                "kind": "LinkedField",
                "name": "runs",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "ExperimentRunEdge",
                    "kind": "LinkedField",
                    "name": "edges",
                    "plural": true,
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "ExperimentRun",
                        "kind": "LinkedField",
                        "name": "node",
                        "plural": false,
                        "selections": [
                          (v3/*:: as any*/),
                          (v14/*:: as any*/),
                          (v15/*:: as any*/),
                          (v16/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "ExperimentRunAnnotationConnection",
                            "kind": "LinkedField",
                            "name": "annotations",
                            "plural": false,
                            "selections": [
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "ExperimentRunAnnotationEdge",
                                "kind": "LinkedField",
                                "name": "edges",
                                "plural": true,
                                "selections": [
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": "ExperimentRunAnnotation",
                                    "kind": "LinkedField",
                                    "name": "node",
                                    "plural": false,
                                    "selections": [
                                      (v4/*:: as any*/),
                                      (v17/*:: as any*/),
                                      (v18/*:: as any*/),
                                      (v19/*:: as any*/)
                                    ],
                                    "storageKey": null
                                  }
                                ],
                                "storageKey": null
                              }
                            ],
                            "storageKey": null
                          },
                          (v20/*:: as any*/)
                        ],
                        "storageKey": null
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
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "readExperimentResultsQuery",
    "selections": [
      {
        "alias": "experiment",
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
              {
                "alias": null,
                "args": null,
                "concreteType": "ExperimentJob",
                "kind": "LinkedField",
                "name": "job",
                "plural": false,
                "selections": [
                  (v9/*:: as any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": null,
                    "kind": "LinkedField",
                    "name": "taskConfig",
                    "plural": false,
                    "selections": [
                      (v2/*:: as any*/),
                      {
                        "kind": "InlineFragment",
                        "selections": [
                          (v3/*:: as any*/)
                        ],
                        "type": "Node",
                        "abstractKey": "__isNode"
                      }
                    ],
                    "storageKey": null
                  },
                  (v3/*:: as any*/)
                ],
                "storageKey": null
              },
              (v10/*:: as any*/),
              (v12/*:: as any*/),
              {
                "alias": null,
                "args": (v13/*:: as any*/),
                "concreteType": "ExperimentRunConnection",
                "kind": "LinkedField",
                "name": "runs",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "ExperimentRunEdge",
                    "kind": "LinkedField",
                    "name": "edges",
                    "plural": true,
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "ExperimentRun",
                        "kind": "LinkedField",
                        "name": "node",
                        "plural": false,
                        "selections": [
                          (v3/*:: as any*/),
                          (v14/*:: as any*/),
                          (v15/*:: as any*/),
                          (v16/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "ExperimentRunAnnotationConnection",
                            "kind": "LinkedField",
                            "name": "annotations",
                            "plural": false,
                            "selections": [
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "ExperimentRunAnnotationEdge",
                                "kind": "LinkedField",
                                "name": "edges",
                                "plural": true,
                                "selections": [
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": "ExperimentRunAnnotation",
                                    "kind": "LinkedField",
                                    "name": "node",
                                    "plural": false,
                                    "selections": [
                                      (v4/*:: as any*/),
                                      (v17/*:: as any*/),
                                      (v18/*:: as any*/),
                                      (v19/*:: as any*/),
                                      (v3/*:: as any*/)
                                    ],
                                    "storageKey": null
                                  }
                                ],
                                "storageKey": null
                              }
                            ],
                            "storageKey": null
                          },
                          (v20/*:: as any*/)
                        ],
                        "storageKey": null
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
    "cacheID": "3b16f6d8d98a59b866f4b48c5ce909bf",
    "id": null,
    "metadata": {},
    "name": "readExperimentResultsQuery",
    "operationKind": "query",
    "text": "query readExperimentResultsQuery(\n  $experimentId: ID!\n  $first: Int!\n) {\n  experiment: node(id: $experimentId) {\n    __typename\n    ... on Experiment {\n      id\n      name\n      runCount\n      expectedRunCount\n      errorRate\n      averageRunLatencyMs\n      job {\n        status\n        taskConfig {\n          __typename\n          ... on Node {\n            __isNode: __typename\n            id\n          }\n        }\n        id\n      }\n      costSummary {\n        total {\n          cost\n          tokens\n        }\n      }\n      annotationSummaries {\n        annotationName\n        meanScore\n        count\n        errorCount\n      }\n      runs(first: $first) {\n        edges {\n          node {\n            id\n            output\n            latencyMs\n            error\n            annotations {\n              edges {\n                node {\n                  name\n                  label\n                  score\n                  explanation\n                  id\n                }\n              }\n            }\n            example {\n              id\n              revision {\n                revisionId\n                input\n                output\n                metadata\n                expectedOutputs {\n                  annotationName\n                  label\n                  score\n                  explanation\n                }\n              }\n            }\n          }\n        }\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "bfa1796028fc5bcf3d43fd5b17881227";

export default node;
