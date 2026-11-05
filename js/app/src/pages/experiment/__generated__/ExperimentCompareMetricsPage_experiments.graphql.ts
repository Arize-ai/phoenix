/**
 * @generated SignedSource<<5b805467bb3affc506fe0efbc5778213>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE" | "NONE";
import { FragmentRefs } from "relay-runtime";
export type ExperimentCompareMetricsPage_experiments$data = {
  readonly dataset: {
    readonly datasetEvaluators?: {
      readonly edges: ReadonlyArray<{
        readonly node: {
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
      }>;
    };
    readonly experiments?: {
      readonly edges: ReadonlyArray<{
        readonly experiment: {
          readonly annotationSummaries: ReadonlyArray<{
            readonly annotationName: string;
            readonly meanScore: number | null;
          }>;
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
          readonly id: string;
        };
      }>;
    };
  };
  readonly experimentRunMetricComparisons?: {
    readonly annotations: ReadonlyArray<{
      readonly annotationName: string;
      readonly numRunsEqual: number;
      readonly numRunsImproved: number;
      readonly numRunsRegressed: number;
    }>;
    readonly completionCost: {
      readonly numRunsEqual: number;
      readonly numRunsImproved: number;
      readonly numRunsRegressed: number;
    };
    readonly completionTokenCount: {
      readonly numRunsEqual: number;
      readonly numRunsImproved: number;
      readonly numRunsRegressed: number;
    };
    readonly latency: {
      readonly numRunsEqual: number;
      readonly numRunsImproved: number;
      readonly numRunsRegressed: number;
    };
    readonly promptCost: {
      readonly numRunsEqual: number;
      readonly numRunsImproved: number;
      readonly numRunsRegressed: number;
    };
    readonly promptTokenCount: {
      readonly numRunsEqual: number;
      readonly numRunsImproved: number;
      readonly numRunsRegressed: number;
    };
    readonly totalCost: {
      readonly numRunsEqual: number;
      readonly numRunsImproved: number;
      readonly numRunsRegressed: number;
    };
    readonly totalTokenCount: {
      readonly numRunsEqual: number;
      readonly numRunsImproved: number;
      readonly numRunsRegressed: number;
    };
  };
  readonly " $fragmentType": "ExperimentCompareMetricsPage_experiments";
};
export type ExperimentCompareMetricsPage_experiments$key = {
  readonly " $data"?: ExperimentCompareMetricsPage_experiments$data;
  readonly " $fragmentSpreads": FragmentRefs<"ExperimentCompareMetricsPage_experiments">;
};

const node: ReaderFragment = (function(){
var v0 = [
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
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "annotationName",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "optimizationDirection",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "lowerBound",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "upperBound",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "numRunsImproved",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "numRunsRegressed",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "numRunsEqual",
  "storageKey": null
},
v9 = [
  (v6/*:: as any*/),
  (v7/*:: as any*/),
  (v8/*:: as any*/)
];
return {
  "argumentDefinitions": [
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "baseExperimentId"
    },
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "compareExperimentIds"
    },
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "datasetId"
    },
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "experimentIds"
    },
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "hasCompareExperiments"
    }
  ],
  "kind": "Fragment",
  "metadata": null,
  "name": "ExperimentCompareMetricsPage_experiments",
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
                        {
                          "alias": null,
                          "args": null,
                          "kind": "ScalarField",
                          "name": "id",
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
                              "selections": (v0/*:: as any*/),
                              "storageKey": null
                            },
                            {
                              "alias": null,
                              "args": null,
                              "concreteType": "CostBreakdown",
                              "kind": "LinkedField",
                              "name": "prompt",
                              "plural": false,
                              "selections": (v0/*:: as any*/),
                              "storageKey": null
                            },
                            {
                              "alias": null,
                              "args": null,
                              "concreteType": "CostBreakdown",
                              "kind": "LinkedField",
                              "name": "completion",
                              "plural": false,
                              "selections": (v0/*:: as any*/),
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
                            (v1/*:: as any*/),
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
                        (v2/*:: as any*/),
                        {
                          "alias": null,
                          "args": null,
                          "concreteType": null,
                          "kind": "LinkedField",
                          "name": "outputConfigs",
                          "plural": true,
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
                                (v2/*:: as any*/),
                                (v3/*:: as any*/),
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
                                (v2/*:: as any*/),
                                (v3/*:: as any*/),
                                (v4/*:: as any*/),
                                (v5/*:: as any*/)
                              ],
                              "type": "ContinuousAnnotationConfig",
                              "abstractKey": null
                            },
                            {
                              "kind": "InlineFragment",
                              "selections": [
                                (v2/*:: as any*/),
                                (v3/*:: as any*/),
                                {
                                  "alias": null,
                                  "args": null,
                                  "kind": "ScalarField",
                                  "name": "threshold",
                                  "storageKey": null
                                },
                                (v4/*:: as any*/),
                                (v5/*:: as any*/)
                              ],
                              "type": "FreeformAnnotationConfig",
                              "abstractKey": null
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
              "storageKey": "datasetEvaluators(first:100)"
            }
          ],
          "type": "Dataset",
          "abstractKey": null
        }
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
            {
              "kind": "Variable",
              "name": "baseExperimentId",
              "variableName": "baseExperimentId"
            },
            {
              "kind": "Variable",
              "name": "compareExperimentIds",
              "variableName": "compareExperimentIds"
            }
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
              "selections": (v9/*:: as any*/),
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "concreteType": "ExperimentRunMetricComparison",
              "kind": "LinkedField",
              "name": "totalTokenCount",
              "plural": false,
              "selections": (v9/*:: as any*/),
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "concreteType": "ExperimentRunMetricComparison",
              "kind": "LinkedField",
              "name": "promptTokenCount",
              "plural": false,
              "selections": (v9/*:: as any*/),
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "concreteType": "ExperimentRunMetricComparison",
              "kind": "LinkedField",
              "name": "completionTokenCount",
              "plural": false,
              "selections": (v9/*:: as any*/),
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "concreteType": "ExperimentRunMetricComparison",
              "kind": "LinkedField",
              "name": "totalCost",
              "plural": false,
              "selections": (v9/*:: as any*/),
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "concreteType": "ExperimentRunMetricComparison",
              "kind": "LinkedField",
              "name": "promptCost",
              "plural": false,
              "selections": (v9/*:: as any*/),
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "concreteType": "ExperimentRunMetricComparison",
              "kind": "LinkedField",
              "name": "completionCost",
              "plural": false,
              "selections": (v9/*:: as any*/),
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
                (v1/*:: as any*/),
                (v6/*:: as any*/),
                (v7/*:: as any*/),
                (v8/*:: as any*/)
              ],
              "storageKey": null
            }
          ],
          "storageKey": null
        }
      ]
    }
  ],
  "type": "Query",
  "abstractKey": null
};
})();

(node as any).hash = "fb5ee3bbe06de86f2b48ef61f27a8f15";

export default node;
