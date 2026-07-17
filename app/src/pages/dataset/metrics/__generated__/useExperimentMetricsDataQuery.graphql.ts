/**
 * @generated SignedSource<<b2efca2d0a76274f40bfaddfb9387357>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type useExperimentMetricsDataQuery$variables = {
  count: number;
  id: string;
};
export type useExperimentMetricsDataQuery$data = {
  readonly dataset: {
    readonly baselineExperiment?: {
      readonly " $fragmentSpreads": FragmentRefs<"useExperimentMetricsData_experiment">;
    } | null;
    readonly metricsExperiments?: {
      readonly edges: ReadonlyArray<{
        readonly experiment: {
          readonly " $fragmentSpreads": FragmentRefs<"useExperimentMetricsData_experiment">;
        };
      }>;
    };
  };
};
export type useExperimentMetricsDataQuery = {
  response: useExperimentMetricsDataQuery$data;
  variables: useExperimentMetricsDataQuery$variables;
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
v5 = [
  (v3/*:: as any*/),
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
        "selections": (v4/*:: as any*/),
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "CostBreakdown",
        "kind": "LinkedField",
        "name": "completion",
        "plural": false,
        "selections": (v4/*:: as any*/),
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "CostBreakdown",
        "kind": "LinkedField",
        "name": "total",
        "plural": false,
        "selections": (v4/*:: as any*/),
        "storageKey": null
      }
    ],
    "storageKey": null
  }
],
v6 = [
  {
    "kind": "InlineDataFragmentSpread",
    "name": "useExperimentMetricsData_experiment",
    "selections": (v5/*:: as any*/),
    "args": null,
    "argumentDefinitions": ([]/*:: as any*/)
  }
],
v7 = [
  {
    "kind": "Variable",
    "name": "first",
    "variableName": "count"
  }
];
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v1/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "useExperimentMetricsDataQuery",
    "selections": [
      {
        "alias": "dataset",
        "args": (v2/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "Experiment",
                "kind": "LinkedField",
                "name": "baselineExperiment",
                "plural": false,
                "selections": (v6/*:: as any*/),
                "storageKey": null
              },
              {
                "alias": "metricsExperiments",
                "args": (v7/*:: as any*/),
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
                        "selections": (v6/*:: as any*/),
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
    "name": "useExperimentMetricsDataQuery",
    "selections": [
      {
        "alias": "dataset",
        "args": (v2/*:: as any*/),
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
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "Experiment",
                "kind": "LinkedField",
                "name": "baselineExperiment",
                "plural": false,
                "selections": (v5/*:: as any*/),
                "storageKey": null
              },
              {
                "alias": "metricsExperiments",
                "args": (v7/*:: as any*/),
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
                        "selections": (v5/*:: as any*/),
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
          },
          (v3/*:: as any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "3a0af18c0728409044315230985351a8",
    "id": null,
    "metadata": {},
    "name": "useExperimentMetricsDataQuery",
    "operationKind": "query",
    "text": "query useExperimentMetricsDataQuery(\n  $id: ID!\n  $count: Int!\n) {\n  dataset: node(id: $id) {\n    __typename\n    ... on Dataset {\n      baselineExperiment {\n        ...useExperimentMetricsData_experiment\n        id\n      }\n      metricsExperiments: experiments(first: $count) {\n        edges {\n          experiment: node {\n            ...useExperimentMetricsData_experiment\n            id\n          }\n        }\n      }\n    }\n    id\n  }\n}\n\nfragment useExperimentMetricsData_experiment on Experiment {\n  id\n  name\n  sequenceNumber\n  averageRunLatencyMs\n  errorRate\n  runCount\n  costSummary {\n    prompt {\n      tokens\n      cost\n    }\n    completion {\n      tokens\n      cost\n    }\n    total {\n      tokens\n      cost\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "aeb501a2259b975d916fdfb807e47b40";

export default node;
