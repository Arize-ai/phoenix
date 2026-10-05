/**
 * @generated SignedSource<<34a5485eb0a0869c8cc9ffc015088b9f>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type useExperimentMetricsDataQuery$variables = {
  count: number;
  filterIds?: ReadonlyArray<string> | null;
  id: string;
  isSelection: boolean;
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
  "name": "filterIds"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "id"
},
v3 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "isSelection"
},
v4 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
  }
],
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "tokens",
  "storageKey": null
},
v7 = [
  (v6/*:: as any*/),
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "cost",
    "storageKey": null
  }
],
v8 = [
  (v5/*:: as any*/),
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
    "concreteType": "ExperimentAnnotationSummary",
    "kind": "LinkedField",
    "name": "annotationSummaries",
    "plural": true,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "annotationName",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "meanScore",
        "storageKey": null
      }
    ],
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
        "selections": (v7/*:: as any*/),
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "CostBreakdown",
        "kind": "LinkedField",
        "name": "completion",
        "plural": false,
        "selections": (v7/*:: as any*/),
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "CostBreakdown",
        "kind": "LinkedField",
        "name": "total",
        "plural": false,
        "selections": (v7/*:: as any*/),
        "storageKey": null
      }
    ],
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "concreteType": "SpanCostDetailSummaryEntry",
    "kind": "LinkedField",
    "name": "costDetailSummaryEntries",
    "plural": true,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "tokenType",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "isPrompt",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "CostBreakdown",
        "kind": "LinkedField",
        "name": "value",
        "plural": false,
        "selections": [
          (v6/*:: as any*/)
        ],
        "storageKey": null
      }
    ],
    "storageKey": null
  }
],
v9 = [
  {
    "kind": "InlineDataFragmentSpread",
    "name": "useExperimentMetricsData_experiment",
    "selections": (v8/*:: as any*/),
    "args": null,
    "argumentDefinitions": ([]/*:: as any*/)
  }
],
v10 = [
  {
    "kind": "Variable",
    "name": "filterIds",
    "variableName": "filterIds"
  },
  {
    "kind": "Variable",
    "name": "first",
    "variableName": "count"
  },
  {
    "kind": "Variable",
    "name": "includeEphemeral",
    "variableName": "isSelection"
  }
];
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v1/*:: as any*/),
      (v2/*:: as any*/),
      (v3/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "useExperimentMetricsDataQuery",
    "selections": [
      {
        "alias": "dataset",
        "args": (v4/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "condition": "isSelection",
                "kind": "Condition",
                "passingValue": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "Experiment",
                    "kind": "LinkedField",
                    "name": "baselineExperiment",
                    "plural": false,
                    "selections": (v9/*:: as any*/),
                    "storageKey": null
                  }
                ]
              },
              {
                "alias": "metricsExperiments",
                "args": (v10/*:: as any*/),
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
                        "selections": (v9/*:: as any*/),
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
      (v2/*:: as any*/),
      (v0/*:: as any*/),
      (v1/*:: as any*/),
      (v3/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "useExperimentMetricsDataQuery",
    "selections": [
      {
        "alias": "dataset",
        "args": (v4/*:: as any*/),
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
                "condition": "isSelection",
                "kind": "Condition",
                "passingValue": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "Experiment",
                    "kind": "LinkedField",
                    "name": "baselineExperiment",
                    "plural": false,
                    "selections": (v8/*:: as any*/),
                    "storageKey": null
                  }
                ]
              },
              {
                "alias": "metricsExperiments",
                "args": (v10/*:: as any*/),
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
                        "selections": (v8/*:: as any*/),
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
          (v5/*:: as any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "df312f481f1f3115cea2dbc8100fb651",
    "id": null,
    "metadata": {},
    "name": "useExperimentMetricsDataQuery",
    "operationKind": "query",
    "text": "query useExperimentMetricsDataQuery(\n  $id: ID!\n  $count: Int!\n  $filterIds: [ID!]\n  $isSelection: Boolean!\n) {\n  dataset: node(id: $id) {\n    __typename\n    ... on Dataset {\n      baselineExperiment @skip(if: $isSelection) {\n        ...useExperimentMetricsData_experiment\n        id\n      }\n      metricsExperiments: experiments(first: $count, filterIds: $filterIds, includeEphemeral: $isSelection) {\n        edges {\n          experiment: node {\n            ...useExperimentMetricsData_experiment\n            id\n          }\n        }\n      }\n    }\n    id\n  }\n}\n\nfragment useExperimentMetricsData_experiment on Experiment {\n  id\n  name\n  sequenceNumber\n  averageRunLatencyMs\n  errorRate\n  runCount\n  annotationSummaries {\n    annotationName\n    meanScore\n  }\n  costSummary {\n    prompt {\n      tokens\n      cost\n    }\n    completion {\n      tokens\n      cost\n    }\n    total {\n      tokens\n      cost\n    }\n  }\n  costDetailSummaryEntries {\n    tokenType\n    isPrompt\n    value {\n      tokens\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "605d7015e2c6c88f7c9a99cfbcb3a461";

export default node;
