/**
 * @generated SignedSource<<65bef52b9d9fc95822ef931690aebe0d>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ExampleDetailsDialogQuery$variables = {
  datasetVersionId?: string | null;
  exampleId: string;
};
export type ExampleDetailsDialogQuery$data = {
  readonly example: {
    readonly dataset?: {
      readonly id: string;
    };
    readonly datasetSplits?: ReadonlyArray<{
      readonly color: string;
      readonly id: string;
      readonly name: string;
    }>;
    readonly externalId?: string | null;
    readonly id?: string;
    readonly revision?: {
      readonly input: any;
      readonly metadata: any;
      readonly output: any;
    };
    readonly span?: {
      readonly id: string;
      readonly trace: {
        readonly id: string;
        readonly project: {
          readonly id: string;
        };
        readonly traceId: string;
      };
    } | null;
    readonly " $fragmentSpreads": FragmentRefs<"ExampleExperimentRunsTableFragment">;
  };
};
export type ExampleDetailsDialogQuery = {
  response: ExampleDetailsDialogQuery$data;
  variables: ExampleDetailsDialogQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "datasetVersionId"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "exampleId"
},
v2 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "exampleId"
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
  "name": "externalId",
  "storageKey": null
},
v5 = [
  (v3/*:: as any*/)
],
v6 = {
  "alias": null,
  "args": null,
  "concreteType": "Dataset",
  "kind": "LinkedField",
  "name": "dataset",
  "plural": false,
  "selections": (v5/*:: as any*/),
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "output",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "metadata",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": [
    {
      "kind": "Variable",
      "name": "datasetVersionId",
      "variableName": "datasetVersionId"
    }
  ],
  "concreteType": "DatasetExampleRevision",
  "kind": "LinkedField",
  "name": "revision",
  "plural": false,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "input",
      "storageKey": null
    },
    (v7/*:: as any*/),
    (v8/*:: as any*/)
  ],
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "concreteType": "DatasetSplit",
  "kind": "LinkedField",
  "name": "datasetSplits",
  "plural": true,
  "selections": [
    (v3/*:: as any*/),
    (v10/*:: as any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "color",
      "storageKey": null
    }
  ],
  "storageKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "traceId",
  "storageKey": null
},
v13 = {
  "alias": null,
  "args": null,
  "concreteType": "Span",
  "kind": "LinkedField",
  "name": "span",
  "plural": false,
  "selections": [
    (v3/*:: as any*/),
    {
      "alias": null,
      "args": null,
      "concreteType": "Trace",
      "kind": "LinkedField",
      "name": "trace",
      "plural": false,
      "selections": [
        (v3/*:: as any*/),
        (v12/*:: as any*/),
        {
          "alias": null,
          "args": null,
          "concreteType": "Project",
          "kind": "LinkedField",
          "name": "project",
          "plural": false,
          "selections": (v5/*:: as any*/),
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "storageKey": null
},
v14 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v15 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 100
  }
],
v16 = {
  "alias": null,
  "args": null,
  "concreteType": "Trace",
  "kind": "LinkedField",
  "name": "trace",
  "plural": false,
  "selections": [
    (v3/*:: as any*/),
    (v12/*:: as any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "projectId",
      "storageKey": null
    }
  ],
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v1/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "ExampleDetailsDialogQuery",
    "selections": [
      {
        "alias": "example",
        "args": (v2/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "kind": "InlineFragment",
            "selections": [
              (v3/*:: as any*/),
              (v4/*:: as any*/),
              (v6/*:: as any*/),
              (v9/*:: as any*/),
              (v11/*:: as any*/),
              (v13/*:: as any*/)
            ],
            "type": "DatasetExample",
            "abstractKey": null
          },
          {
            "args": null,
            "kind": "FragmentSpread",
            "name": "ExampleExperimentRunsTableFragment"
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
      (v1/*:: as any*/),
      (v0/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "ExampleDetailsDialogQuery",
    "selections": [
      {
        "alias": "example",
        "args": (v2/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v14/*:: as any*/),
          (v3/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v4/*:: as any*/),
              (v6/*:: as any*/),
              (v9/*:: as any*/),
              (v11/*:: as any*/),
              (v13/*:: as any*/),
              {
                "alias": null,
                "args": (v15/*:: as any*/),
                "concreteType": "ExperimentRunConnection",
                "kind": "LinkedField",
                "name": "experimentRuns",
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
                        "alias": "run",
                        "args": null,
                        "concreteType": "ExperimentRun",
                        "kind": "LinkedField",
                        "name": "node",
                        "plural": false,
                        "selections": [
                          (v3/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "startTime",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "endTime",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "error",
                            "storageKey": null
                          },
                          (v7/*:: as any*/),
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
                                    "alias": "annotation",
                                    "args": null,
                                    "concreteType": "ExperimentRunAnnotation",
                                    "kind": "LinkedField",
                                    "name": "node",
                                    "plural": false,
                                    "selections": [
                                      (v3/*:: as any*/),
                                      (v10/*:: as any*/),
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
                                      },
                                      {
                                        "alias": null,
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "explanation",
                                        "storageKey": null
                                      },
                                      (v8/*:: as any*/),
                                      {
                                        "alias": null,
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "annotatorKind",
                                        "storageKey": null
                                      },
                                      (v16/*:: as any*/)
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
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "cursor",
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "ExperimentRun",
                        "kind": "LinkedField",
                        "name": "node",
                        "plural": false,
                        "selections": [
                          (v14/*:: as any*/),
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
                    "concreteType": "PageInfo",
                    "kind": "LinkedField",
                    "name": "pageInfo",
                    "plural": false,
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "endCursor",
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "hasNextPage",
                        "storageKey": null
                      }
                    ],
                    "storageKey": null
                  }
                ],
                "storageKey": "experimentRuns(first:100)"
              },
              {
                "alias": null,
                "args": (v15/*:: as any*/),
                "filters": null,
                "handle": "connection",
                "key": "ExampleExperimentRunsTable_experimentRuns",
                "kind": "LinkedHandle",
                "name": "experimentRuns"
              }
            ],
            "type": "DatasetExample",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "0c30383396134dceb680b057f240be11",
    "id": null,
    "metadata": {},
    "name": "ExampleDetailsDialogQuery",
    "operationKind": "query",
    "text": "query ExampleDetailsDialogQuery(\n  $exampleId: ID!\n  $datasetVersionId: ID\n) {\n  example: node(id: $exampleId) {\n    __typename\n    ... on DatasetExample {\n      id\n      externalId\n      dataset {\n        id\n      }\n      revision(datasetVersionId: $datasetVersionId) {\n        input\n        output\n        metadata\n      }\n      datasetSplits {\n        id\n        name\n        color\n      }\n      span {\n        id\n        trace {\n          id\n          traceId\n          project {\n            id\n          }\n        }\n      }\n    }\n    ...ExampleExperimentRunsTableFragment\n    id\n  }\n}\n\nfragment ExampleExperimentRunsTableFragment on DatasetExample {\n  experimentRuns(first: 100) {\n    edges {\n      run: node {\n        id\n        startTime\n        endTime\n        error\n        output\n        trace {\n          id\n          traceId\n          projectId\n        }\n        annotations {\n          edges {\n            annotation: node {\n              id\n              name\n              label\n              score\n              explanation\n              metadata\n              annotatorKind\n              trace {\n                id\n                traceId\n                projectId\n              }\n            }\n          }\n        }\n      }\n      cursor\n      node {\n        __typename\n        id\n      }\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n  id\n}\n"
  }
};
})();

(node as any).hash = "874ee7d09ccd8c1d2bf8fb3e28f6b292";

export default node;
