/**
 * @generated SignedSource<<708eeb0026d99c807a864ed989d0f7f2>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ExperimentCompareMetricsPage_experiments$data = {
  readonly compareExperimentRunAnnotationMetricCounts: ReadonlyArray<{
    readonly annotationName: string;
    readonly compareExperimentId: string;
    readonly numDecreases: number;
    readonly numEqual: number;
    readonly numIncreases: number;
  }>;
  readonly compareExperimentRunMetricCounts: ReadonlyArray<{
    readonly compareExperimentId: string;
    readonly completionCost: {
      readonly numDecreases: number;
      readonly numEqual: number;
      readonly numIncreases: number;
    };
    readonly completionTokenCount: {
      readonly numDecreases: number;
      readonly numEqual: number;
      readonly numIncreases: number;
    };
    readonly latency: {
      readonly numDecreases: number;
      readonly numEqual: number;
      readonly numIncreases: number;
    };
    readonly promptCost: {
      readonly numDecreases: number;
      readonly numEqual: number;
      readonly numIncreases: number;
    };
    readonly promptTokenCount: {
      readonly numDecreases: number;
      readonly numEqual: number;
      readonly numIncreases: number;
    };
    readonly totalCost: {
      readonly numDecreases: number;
      readonly numEqual: number;
      readonly numIncreases: number;
    };
    readonly totalTokenCount: {
      readonly numDecreases: number;
      readonly numEqual: number;
      readonly numIncreases: number;
    };
  }>;
  readonly dataset: {
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
v2 = [
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
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "compareExperimentId",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "numIncreases",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "numDecreases",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "numEqual",
  "storageKey": null
},
v7 = [
  (v4/*: any*/),
  (v5/*: any*/),
  (v6/*: any*/)
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
                              "selections": (v0/*: any*/),
                              "storageKey": null
                            },
                            {
                              "alias": null,
                              "args": null,
                              "concreteType": "CostBreakdown",
                              "kind": "LinkedField",
                              "name": "prompt",
                              "plural": false,
                              "selections": (v0/*: any*/),
                              "storageKey": null
                            },
                            {
                              "alias": null,
                              "args": null,
                              "concreteType": "CostBreakdown",
                              "kind": "LinkedField",
                              "name": "completion",
                              "plural": false,
                              "selections": (v0/*: any*/),
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
                            (v1/*: any*/),
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
      "args": (v2/*: any*/),
      "concreteType": "CompareExperimentRunMetricCounts",
      "kind": "LinkedField",
      "name": "compareExperimentRunMetricCounts",
      "plural": true,
      "selections": [
        (v3/*: any*/),
        {
          "alias": null,
          "args": null,
          "concreteType": "MetricCounts",
          "kind": "LinkedField",
          "name": "latency",
          "plural": false,
          "selections": (v7/*: any*/),
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "MetricCounts",
          "kind": "LinkedField",
          "name": "totalTokenCount",
          "plural": false,
          "selections": (v7/*: any*/),
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "MetricCounts",
          "kind": "LinkedField",
          "name": "promptTokenCount",
          "plural": false,
          "selections": (v7/*: any*/),
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "MetricCounts",
          "kind": "LinkedField",
          "name": "completionTokenCount",
          "plural": false,
          "selections": (v7/*: any*/),
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "MetricCounts",
          "kind": "LinkedField",
          "name": "totalCost",
          "plural": false,
          "selections": (v7/*: any*/),
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "MetricCounts",
          "kind": "LinkedField",
          "name": "promptCost",
          "plural": false,
          "selections": (v7/*: any*/),
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "MetricCounts",
          "kind": "LinkedField",
          "name": "completionCost",
          "plural": false,
          "selections": (v7/*: any*/),
          "storageKey": null
        }
      ],
      "storageKey": null
    },
    {
      "alias": null,
      "args": (v2/*: any*/),
      "concreteType": "CompareExperimentRunAnnotationMetricCounts",
      "kind": "LinkedField",
      "name": "compareExperimentRunAnnotationMetricCounts",
      "plural": true,
      "selections": [
        (v1/*: any*/),
        (v3/*: any*/),
        (v4/*: any*/),
        (v5/*: any*/),
        (v6/*: any*/)
      ],
      "storageKey": null
    }
  ],
  "type": "Query",
  "abstractKey": null
};
})();

(node as any).hash = "3b6d3f606d3692c5c8d21ef95a326556";

export default node;
