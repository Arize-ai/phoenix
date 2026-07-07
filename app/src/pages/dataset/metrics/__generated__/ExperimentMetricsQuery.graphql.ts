/**
 * @generated SignedSource<<ba0239350255088a1bec39341bd705af>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ExperimentMetricsQuery$variables = {
  count: number;
  id: string;
};
export type ExperimentMetricsQuery$data = {
  readonly dataset: {
    readonly metricsExperiments?: {
      readonly edges: ReadonlyArray<{
        readonly experiment: {
          readonly averageRunLatencyMs: number | null;
          readonly costSummary: {
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
          readonly errorRate: number | null;
          readonly id: string;
          readonly name: string;
          readonly runCount: number;
          readonly sequenceNumber: number;
        };
      }>;
    };
  };
};
export type ExperimentMetricsQuery = {
  response: ExperimentMetricsQuery$data;
  variables: ExperimentMetricsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "count"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "id"
},
v2 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
  }
],
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v4 = [
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
v5 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": "metricsExperiments",
      "args": [
        {
          "kind": "Variable",
          "name": "first",
          "variableName": "count"
        }
      ],
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
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "averageRunLatencyMs",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "errorRate",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "runCount",
                  "storageKey": null
                },
                {
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
                      "name": "prompt",
                      "plural": false,
                      "selections": (v4/*: any*/),
                      "storageKey": null
                    },
                    {
                      "alias": null,
                      "args": null,
                      "concreteType": "CostBreakdown",
                      "kind": "LinkedField",
                      "name": "completion",
                      "plural": false,
                      "selections": (v4/*: any*/),
                      "storageKey": null
                    },
                    {
                      "alias": null,
                      "args": null,
                      "concreteType": "CostBreakdown",
                      "kind": "LinkedField",
                      "name": "total",
                      "plural": false,
                      "selections": (v4/*: any*/),
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
  "type": "Dataset",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "ExperimentMetricsQuery",
    "selections": [
      {
        "alias": "dataset",
        "args": (v2/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v5/*: any*/)
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
      (v0/*: any*/)
    ],
    "kind": "Operation",
    "name": "ExperimentMetricsQuery",
    "selections": [
      {
        "alias": "dataset",
        "args": (v2/*: any*/),
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
          (v5/*: any*/),
          (v3/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "863b199970263512758c39602d1d275d",
    "id": null,
    "metadata": {},
    "name": "ExperimentMetricsQuery",
    "operationKind": "query",
    "text": "query ExperimentMetricsQuery(\n  $id: ID!\n  $count: Int!\n) {\n  dataset: node(id: $id) {\n    __typename\n    ... on Dataset {\n      metricsExperiments: experiments(first: $count) {\n        edges {\n          experiment: node {\n            id\n            name\n            sequenceNumber\n            averageRunLatencyMs\n            errorRate\n            runCount\n            costSummary {\n              prompt {\n                tokens\n                cost\n              }\n              completion {\n                tokens\n                cost\n              }\n              total {\n                tokens\n                cost\n              }\n            }\n          }\n        }\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "7d415ce1b143b347b7fe1e9f1ea90d1d";

export default node;
