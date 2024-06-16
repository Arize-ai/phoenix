/**
 * @generated SignedSource<<ad6566446957a95aa7163472050c83c9>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
export type ExperimentCompareTableQuery$variables = {
  baselineExperimentId: string;
  datasetId: string;
  experimentIds: ReadonlyArray<string>;
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
        readonly error: string | null;
        readonly output: any | null;
      }>;
    }>;
  }>;
  readonly dataset: {
    readonly experiments?: {
      readonly edges: ReadonlyArray<{
        readonly experiment: {
          readonly id: string;
          readonly name: string;
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
  "name": "baselineExperimentId"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "datasetId"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "experimentIds"
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v4 = {
  "alias": "comparisons",
  "args": [
    {
      "kind": "Variable",
      "name": "baselineExperimentId",
      "variableName": "baselineExperimentId"
    },
    {
      "kind": "Variable",
      "name": "comparisonExperimentIds",
      "variableName": "experimentIds"
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
v5 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "datasetId"
  }
],
v6 = {
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
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "name",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "sequenceNumber",
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
      (v4/*: any*/),
      {
        "alias": "dataset",
        "args": (v5/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v3/*: any*/),
          (v6/*: any*/)
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
      (v0/*: any*/),
      (v2/*: any*/),
      (v1/*: any*/)
    ],
    "kind": "Operation",
    "name": "ExperimentCompareTableQuery",
    "selections": [
      (v4/*: any*/),
      {
        "alias": "dataset",
        "args": (v5/*: any*/),
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
          (v6/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "78859e7276230778607e8f877dacb51c",
    "id": null,
    "metadata": {},
    "name": "ExperimentCompareTableQuery",
    "operationKind": "query",
    "text": "query ExperimentCompareTableQuery(\n  $baselineExperimentId: GlobalID!\n  $experimentIds: [GlobalID!]!\n  $datasetId: GlobalID!\n) {\n  comparisons: compareExperiments(baselineExperimentId: $baselineExperimentId, comparisonExperimentIds: $experimentIds) {\n    example {\n      id\n      revision {\n        input\n        referenceOutput: output\n      }\n    }\n    runComparisonItems {\n      experimentId\n      runs {\n        output\n        error\n      }\n    }\n  }\n  dataset: node(id: $datasetId) {\n    __typename\n    id\n    ... on Dataset {\n      experiments {\n        edges {\n          experiment: node {\n            id\n            name\n            sequenceNumber\n          }\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "744dab08840ad9c5469343fdd18f93eb";

export default node;
