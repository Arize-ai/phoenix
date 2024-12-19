/**
 * @generated SignedSource<<c0ec818d892b85bd1cb928ec89a894c9>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
export type ExperimentRunAnnotatorKind = "CODE" | "HUMAN" | "LLM";
export type ExperimentCompareTableQuery$variables = {
  datasetId: string;
  experimentIds: ReadonlyArray<string>;
  filterCondition?: string | null;
};
export type ExperimentCompareTableQuery$data = {
  readonly comparisons: ReadonlyArray<{
    readonly example: {
      readonly id: string;
      readonly revision: {
        readonly input: any;
        readonly referenceOutput: any;
      };
    };
    readonly runComparisonItems: ReadonlyArray<{
      readonly experimentId: string;
      readonly runs: ReadonlyArray<{
        readonly annotations: {
          readonly edges: ReadonlyArray<{
            readonly annotation: {
              readonly annotatorKind: ExperimentRunAnnotatorKind;
              readonly explanation: string | null;
              readonly id: string;
              readonly label: string | null;
              readonly name: string;
              readonly score: number | null;
              readonly trace: {
                readonly projectId: string;
                readonly traceId: string;
              } | null;
            };
          }>;
        };
        readonly endTime: string;
        readonly error: string | null;
        readonly output: any | null;
        readonly startTime: string;
        readonly trace: {
          readonly projectId: string;
          readonly traceId: string;
        } | null;
      }>;
    }>;
  }>;
  readonly dataset: {
    readonly experiments?: {
      readonly edges: ReadonlyArray<{
        readonly experiment: {
          readonly id: string;
          readonly metadata: any;
          readonly name: string;
          readonly project: {
            readonly id: string;
          } | null;
          readonly sequenceNumber: number;
        };
      }>;
    };
    readonly id: string;
  };
};
export type ExperimentCompareTableQuery = {
  response: ExperimentCompareTableQuery$data;
  variables: ExperimentCompareTableQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "datasetId"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "experimentIds"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "filterCondition"
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
  "concreteType": "Trace",
  "kind": "LinkedField",
  "name": "trace",
  "plural": false,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "traceId",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "projectId",
      "storageKey": null
    }
  ],
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
  "alias": "comparisons",
  "args": [
    {
      "kind": "Variable",
      "name": "experimentIds",
      "variableName": "experimentIds"
    },
    {
      "kind": "Variable",
      "name": "filterCondition",
      "variableName": "filterCondition"
    }
  ],
  "concreteType": "ExperimentComparison",
  "kind": "LinkedField",
  "name": "compareExperiments",
  "plural": true,
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "DatasetExample",
      "kind": "LinkedField",
      "name": "example",
      "plural": false,
      "selections": [
        (v3/*: any*/),
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
              "name": "input",
              "storageKey": null
            },
            {
              "alias": "referenceOutput",
              "args": null,
              "kind": "ScalarField",
              "name": "output",
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
      "concreteType": "RunComparisonItem",
      "kind": "LinkedField",
      "name": "runComparisonItems",
      "plural": true,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "experimentId",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "ExperimentRun",
          "kind": "LinkedField",
          "name": "runs",
          "plural": true,
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "output",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "error",
              "storageKey": null
            },
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
            (v4/*: any*/),
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
                        (v3/*: any*/),
                        (v5/*: any*/),
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
                          "name": "label",
                          "storageKey": null
                        },
                        {
                          "alias": null,
                          "args": null,
                          "kind": "ScalarField",
                          "name": "annotatorKind",
                          "storageKey": null
                        },
                        {
                          "alias": null,
                          "args": null,
                          "kind": "ScalarField",
                          "name": "explanation",
                          "storageKey": null
                        },
                        (v4/*: any*/)
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
        }
      ],
      "storageKey": null
    }
  ],
  "storageKey": null
},
v7 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "datasetId"
  }
],
v8 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "ExperimentConnection",
      "kind": "LinkedField",
      "name": "experiments",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "ExperimentEdge",
          "kind": "LinkedField",
          "name": "edges",
          "plural": true,
          "selections": [
            {
              "alias": "experiment",
              "args": null,
              "concreteType": "Experiment",
              "kind": "LinkedField",
              "name": "node",
              "plural": false,
              "selections": [
                (v3/*: any*/),
                (v5/*: any*/),
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "sequenceNumber",
                  "storageKey": null
                },
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
                  "concreteType": "Project",
                  "kind": "LinkedField",
                  "name": "project",
                  "plural": false,
                  "selections": [
                    (v3/*: any*/)
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
    }
  ],
  "type": "Dataset",
  "abstractKey": null
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
    "name": "ExperimentCompareTableQuery",
    "selections": [
      (v6/*: any*/),
      {
        "alias": "dataset",
        "args": (v7/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v3/*: any*/),
          (v8/*: any*/)
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
      (v1/*: any*/),
      (v0/*: any*/),
      (v2/*: any*/)
    ],
    "kind": "Operation",
    "name": "ExperimentCompareTableQuery",
    "selections": [
      (v6/*: any*/),
      {
        "alias": "dataset",
        "args": (v7/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "__typename",
            "storageKey": null
          },
          (v3/*: any*/),
          (v8/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "2858d6862ebdeb9248578effd1944942",
    "id": null,
    "metadata": {},
    "name": "ExperimentCompareTableQuery",
    "operationKind": "query",
    "text": "query ExperimentCompareTableQuery(\n  $experimentIds: [GlobalID!]!\n  $datasetId: GlobalID!\n  $filterCondition: String\n) {\n  comparisons: compareExperiments(experimentIds: $experimentIds, filterCondition: $filterCondition) {\n    example {\n      id\n      revision {\n        input\n        referenceOutput: output\n      }\n    }\n    runComparisonItems {\n      experimentId\n      runs {\n        output\n        error\n        startTime\n        endTime\n        trace {\n          traceId\n          projectId\n        }\n        annotations {\n          edges {\n            annotation: node {\n              id\n              name\n              score\n              label\n              annotatorKind\n              explanation\n              trace {\n                traceId\n                projectId\n              }\n            }\n          }\n        }\n      }\n    }\n  }\n  dataset: node(id: $datasetId) {\n    __typename\n    id\n    ... on Dataset {\n      experiments {\n        edges {\n          experiment: node {\n            id\n            name\n            sequenceNumber\n            metadata\n            project {\n              id\n            }\n          }\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "3a013b01c738ae156d59ed0d0dcced72";

export default node;
