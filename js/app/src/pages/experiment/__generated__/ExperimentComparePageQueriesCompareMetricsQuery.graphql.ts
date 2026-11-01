/**
 * @generated SignedSource<<237c35b4e122c27cc9297b47f1b54c96>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ExperimentComparePageQueriesCompareMetricsQuery$variables = {
  baseExperimentId: string;
  compareExperimentIds: ReadonlyArray<string>;
  datasetId: string;
  experimentIds: ReadonlyArray<string>;
  hasCompareExperiments: boolean;
};
export type ExperimentComparePageQueriesCompareMetricsQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"ExperimentCompareMetricsPage_experiments">;
};
export type ExperimentComparePageQueriesCompareMetricsQuery = {
  response: ExperimentComparePageQueriesCompareMetricsQuery$data;
  variables: ExperimentComparePageQueriesCompareMetricsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "baseExperimentId"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "compareExperimentIds"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "datasetId"
},
v3 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "experimentIds"
},
v4 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "hasCompareExperiments"
},
v5 = {
  "kind": "Variable",
  "name": "baseExperimentId",
  "variableName": "baseExperimentId"
},
v6 = {
  "kind": "Variable",
  "name": "compareExperimentIds",
  "variableName": "compareExperimentIds"
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
  "name": "id",
  "storageKey": null
},
v9 = [
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
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "annotationName",
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "optimizationDirection",
  "storageKey": null
},
v13 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "lowerBound",
  "storageKey": null
},
v14 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "upperBound",
  "storageKey": null
},
v15 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "numRunsImproved",
  "storageKey": null
},
v16 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "numRunsRegressed",
  "storageKey": null
},
v17 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "numRunsEqual",
  "storageKey": null
},
v18 = [
  (v15/*:: as any*/),
  (v16/*:: as any*/),
  (v17/*:: as any*/)
];
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v1/*:: as any*/),
      (v2/*:: as any*/),
      (v3/*:: as any*/),
      (v4/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "ExperimentComparePageQueriesCompareMetricsQuery",
    "selections": [
      {
        "args": [
          (v5/*:: as any*/),
          (v6/*:: as any*/),
          {
            "kind": "Variable",
            "name": "datasetId",
            "variableName": "datasetId"
          },
          {
            "kind": "Variable",
            "name": "experimentIds",
            "variableName": "experimentIds"
          },
          {
            "kind": "Variable",
            "name": "hasCompareExperiments",
            "variableName": "hasCompareExperiments"
          }
        ],
        "kind": "FragmentSpread",
        "name": "ExperimentCompareMetricsPage_experiments"
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
      (v3/*:: as any*/),
      (v4/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "ExperimentComparePageQueriesCompareMetricsQuery",
    "selections": [
      {
        "alias": "dataset",
        "args": [
          {
            "kind": "Variable",
            "name": "id",
            "variableName": "datasetId"
          }
        ],
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v7/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": [
                  {
                    "kind": "Variable",
                    "name": "filterIds",
                    "variableName": "experimentIds"
                  },
                  {
                    "kind": "Literal",
                    "name": "includeEphemeral",
                    "value": true
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
                          (v8/*:: as any*/),
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
                                "selections": (v9/*:: as any*/),
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "CostBreakdown",
                                "kind": "LinkedField",
                                "name": "prompt",
                                "plural": false,
                                "selections": (v9/*:: as any*/),
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "CostBreakdown",
                                "kind": "LinkedField",
                                "name": "completion",
                                "plural": false,
                                "selections": (v9/*:: as any*/),
                                "storageKey": null
                              }
                            ],
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
                              (v10/*:: as any*/),
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "meanScore",
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
              {
                "alias": null,
                "args": [
                  {
                    "kind": "Literal",
                    "name": "first",
                    "value": 100
                  }
                ],
                "concreteType": "DatasetEvaluatorConnection",
                "kind": "LinkedField",
                "name": "datasetEvaluators",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "DatasetEvaluatorEdge",
                    "kind": "LinkedField",
                    "name": "edges",
                    "plural": true,
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "DatasetEvaluator",
                        "kind": "LinkedField",
                        "name": "node",
                        "plural": false,
                        "selections": [
                          (v11/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": null,
                            "kind": "LinkedField",
                            "name": "outputConfigs",
                            "plural": true,
                            "selections": [
                              (v7/*:: as any*/),
                              {
                                "kind": "InlineFragment",
                                "selections": [
                                  (v11/*:: as any*/),
                                  (v12/*:: as any*/),
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
                              {
                                "kind": "InlineFragment",
                                "selections": [
                                  (v11/*:: as any*/),
                                  (v12/*:: as any*/),
                                  (v13/*:: as any*/),
                                  (v14/*:: as any*/)
                                ],
                                "type": "ContinuousAnnotationConfig",
                                "abstractKey": null
                              },
                              {
                                "kind": "InlineFragment",
                                "selections": [
                                  (v11/*:: as any*/),
                                  (v12/*:: as any*/),
                                  {
                                    "alias": null,
                                    "args": null,
                                    "kind": "ScalarField",
                                    "name": "threshold",
                                    "storageKey": null
                                  },
                                  (v13/*:: as any*/),
                                  (v14/*:: as any*/)
                                ],
                                "type": "FreeformAnnotationConfig",
                                "abstractKey": null
                              },
                              {
                                "kind": "InlineFragment",
                                "selections": [
                                  (v8/*:: as any*/)
                                ],
                                "type": "Node",
                                "abstractKey": "__isNode"
                              }
                            ],
                            "storageKey": null
                          },
                          (v8/*:: as any*/)
                        ],
                        "storageKey": null
                      }
                    ],
                    "storageKey": null
                  }
                ],
                "storageKey": "datasetEvaluators(first:100)"
              }
            ],
            "type": "Dataset",
            "abstractKey": null
          },
          (v8/*:: as any*/)
        ],
        "storageKey": null
      },
      {
        "condition": "hasCompareExperiments",
        "kind": "Condition",
        "passingValue": true,
        "selections": [
          {
            "alias": null,
            "args": [
              (v5/*:: as any*/),
              (v6/*:: as any*/)
            ],
            "concreteType": "ExperimentRunMetricComparisons",
            "kind": "LinkedField",
            "name": "experimentRunMetricComparisons",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "ExperimentRunMetricComparison",
                "kind": "LinkedField",
                "name": "latency",
                "plural": false,
                "selections": (v18/*:: as any*/),
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "concreteType": "ExperimentRunMetricComparison",
                "kind": "LinkedField",
                "name": "totalTokenCount",
                "plural": false,
                "selections": (v18/*:: as any*/),
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "concreteType": "ExperimentRunMetricComparison",
                "kind": "LinkedField",
                "name": "promptTokenCount",
                "plural": false,
                "selections": (v18/*:: as any*/),
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "concreteType": "ExperimentRunMetricComparison",
                "kind": "LinkedField",
                "name": "completionTokenCount",
                "plural": false,
                "selections": (v18/*:: as any*/),
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "concreteType": "ExperimentRunMetricComparison",
                "kind": "LinkedField",
                "name": "totalCost",
                "plural": false,
                "selections": (v18/*:: as any*/),
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "concreteType": "ExperimentRunMetricComparison",
                "kind": "LinkedField",
                "name": "promptCost",
                "plural": false,
                "selections": (v18/*:: as any*/),
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "concreteType": "ExperimentRunMetricComparison",
                "kind": "LinkedField",
                "name": "completionCost",
                "plural": false,
                "selections": (v18/*:: as any*/),
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "concreteType": "ExperimentRunAnnotationMetricComparison",
                "kind": "LinkedField",
                "name": "annotations",
                "plural": true,
                "selections": [
                  (v10/*:: as any*/),
                  (v15/*:: as any*/),
                  (v16/*:: as any*/),
                  (v17/*:: as any*/)
                ],
                "storageKey": null
              }
            ],
            "storageKey": null
          }
        ]
      }
    ]
  },
  "params": {
    "cacheID": "5cb6a94d8e3c38a0da63adbccd99af4e",
    "id": null,
    "metadata": {},
    "name": "ExperimentComparePageQueriesCompareMetricsQuery",
    "operationKind": "query",
    "text": "query ExperimentComparePageQueriesCompareMetricsQuery(\n  $datasetId: ID!\n  $baseExperimentId: ID!\n  $compareExperimentIds: [ID!]!\n  $experimentIds: [ID!]!\n  $hasCompareExperiments: Boolean!\n) {\n  ...ExperimentCompareMetricsPage_experiments_4DSN89\n}\n\nfragment ExperimentCompareMetricsPage_experiments_4DSN89 on Query {\n  dataset: node(id: $datasetId) {\n    __typename\n    ... on Dataset {\n      experiments(filterIds: $experimentIds, includeEphemeral: true) {\n        edges {\n          experiment: node {\n            id\n            averageRunLatencyMs\n            costSummary {\n              total {\n                tokens\n                cost\n              }\n              prompt {\n                tokens\n                cost\n              }\n              completion {\n                tokens\n                cost\n              }\n            }\n            annotationSummaries {\n              annotationName\n              meanScore\n            }\n          }\n        }\n      }\n      datasetEvaluators(first: 100) {\n        edges {\n          node {\n            name\n            outputConfigs {\n              __typename\n              ... on CategoricalAnnotationConfig {\n                name\n                optimizationDirection\n                values {\n                  label\n                  score\n                }\n              }\n              ... on ContinuousAnnotationConfig {\n                name\n                optimizationDirection\n                lowerBound\n                upperBound\n              }\n              ... on FreeformAnnotationConfig {\n                name\n                optimizationDirection\n                threshold\n                lowerBound\n                upperBound\n              }\n              ... on Node {\n                __isNode: __typename\n                id\n              }\n            }\n            id\n          }\n        }\n      }\n    }\n    id\n  }\n  experimentRunMetricComparisons(baseExperimentId: $baseExperimentId, compareExperimentIds: $compareExperimentIds) @include(if: $hasCompareExperiments) {\n    latency {\n      numRunsImproved\n      numRunsRegressed\n      numRunsEqual\n    }\n    totalTokenCount {\n      numRunsImproved\n      numRunsRegressed\n      numRunsEqual\n    }\n    promptTokenCount {\n      numRunsImproved\n      numRunsRegressed\n      numRunsEqual\n    }\n    completionTokenCount {\n      numRunsImproved\n      numRunsRegressed\n      numRunsEqual\n    }\n    totalCost {\n      numRunsImproved\n      numRunsRegressed\n      numRunsEqual\n    }\n    promptCost {\n      numRunsImproved\n      numRunsRegressed\n      numRunsEqual\n    }\n    completionCost {\n      numRunsImproved\n      numRunsRegressed\n      numRunsEqual\n    }\n    annotations {\n      annotationName\n      numRunsImproved\n      numRunsRegressed\n      numRunsEqual\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "685145a4c7c865793fb65817a1232288";

export default node;
