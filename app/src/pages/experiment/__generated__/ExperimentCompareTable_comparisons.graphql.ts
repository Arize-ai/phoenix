/**
 * @generated SignedSource<<19c424e3dc59f3b21824121c1d6de30f>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type ExperimentRunAnnotatorKind = "CODE" | "HUMAN" | "LLM";
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE" | "NONE";
import { FragmentRefs } from "relay-runtime";
export type ExperimentCompareTable_comparisons$data = {
  readonly compareExperiments: {
    readonly edges: ReadonlyArray<{
      readonly comparison: {
        readonly example: {
          readonly id: string;
          readonly revision: {
            readonly input: any;
            readonly referenceOutput: any;
          };
        };
        readonly repeatedRunGroups: ReadonlyArray<{
          readonly annotationSummaries: ReadonlyArray<{
            readonly annotationName: string;
            readonly meanScore: number | null;
          }>;
          readonly experimentId: string;
          readonly runs: ReadonlyArray<{
            readonly annotations: {
              readonly edges: ReadonlyArray<{
                readonly annotation: {
                  readonly annotatorKind: ExperimentRunAnnotatorKind;
                  readonly explanation: string | null;
                  readonly id: string;
                  readonly label: string | null;
                  readonly metadata: any;
                  readonly name: string;
                  readonly score: number | null;
                  readonly trace: {
                    readonly projectId: string;
                    readonly traceId: string;
                  } | null;
                };
              }>;
            };
            readonly costSummary: {
              readonly total: {
                readonly cost: number | null;
                readonly tokens: number | null;
              };
            };
            readonly error: string | null;
            readonly id: string;
            readonly latencyMs: number;
            readonly output: any | null;
            readonly repetitionNumber: number;
            readonly trace: {
              readonly projectId: string;
              readonly traceId: string;
            } | null;
          }>;
          readonly " $fragmentSpreads": FragmentRefs<"ExperimentRepeatedRunGroupMetadataFragment">;
        }>;
      };
    }>;
  };
  readonly dataset: {
    readonly datasetEvaluators?: {
      readonly edges: ReadonlyArray<{
        readonly node: {
          readonly name: string;
          readonly outputConfig: {
            readonly lowerBound?: number | null;
            readonly name?: string;
            readonly optimizationDirection?: OptimizationDirection;
            readonly upperBound?: number | null;
            readonly values?: ReadonlyArray<{
              readonly label: string;
              readonly score: number | null;
            }>;
          } | null;
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
            readonly total: {
              readonly cost: number | null;
              readonly tokens: number | null;
            };
          };
          readonly datasetVersionId: string;
          readonly id: string;
          readonly metadata: any;
          readonly name: string;
          readonly project: {
            readonly id: string;
          } | null;
          readonly repetitions: number;
          readonly runCount: number;
          readonly sequenceNumber: number;
        };
      }>;
    };
    readonly id: string;
  };
  readonly " $fragmentType": "ExperimentCompareTable_comparisons";
};
export type ExperimentCompareTable_comparisons$key = {
  readonly " $data"?: ExperimentCompareTable_comparisons$data;
  readonly " $fragmentSpreads": FragmentRefs<"ExperimentCompareTable_comparisons">;
};

import ExperimentCompareTableQuery_graphql from './ExperimentCompareTableQuery.graphql';

const node: ReaderFragment = (function(){
var v0 = [
  "compareExperiments"
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v2 = [
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
v3 = {
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
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "tokens",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "cost",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "score",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "label",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "metadata",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "optimizationDirection",
  "storageKey": null
};
return {
  "argumentDefinitions": [
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "after"
    },
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
      "name": "filterCondition"
    },
    {
      "defaultValue": 50,
      "kind": "LocalArgument",
      "name": "first"
    }
  ],
  "kind": "Fragment",
  "metadata": {
    "connection": [
      {
        "count": "first",
        "cursor": "after",
        "direction": "forward",
        "path": (v0/*: any*/)
      }
    ],
    "refetch": {
      "connection": {
        "forward": {
          "count": "first",
          "cursor": "after"
        },
        "backward": null,
        "path": (v0/*: any*/)
      },
      "fragmentPathInResult": [],
      "operation": ExperimentCompareTableQuery_graphql
    }
  },
  "name": "ExperimentCompareTable_comparisons",
  "selections": [
    {
      "alias": "compareExperiments",
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
        },
        {
          "kind": "Variable",
          "name": "filterCondition",
          "variableName": "filterCondition"
        }
      ],
      "concreteType": "ExperimentComparisonConnection",
      "kind": "LinkedField",
      "name": "__ExperimentCompareTable_compareExperiments_connection",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "ExperimentComparisonEdge",
          "kind": "LinkedField",
          "name": "edges",
          "plural": true,
          "selections": [
            {
              "alias": "comparison",
              "args": null,
              "concreteType": "ExperimentComparison",
              "kind": "LinkedField",
              "name": "node",
              "plural": false,
              "selections": [
                {
                  "alias": null,
                  "args": null,
                  "concreteType": "DatasetExample",
                  "kind": "LinkedField",
                  "name": "example",
                  "plural": false,
                  "selections": [
                    (v1/*: any*/),
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
                  "concreteType": "ExperimentRepeatedRunGroup",
                  "kind": "LinkedField",
                  "name": "repeatedRunGroups",
                  "plural": true,
                  "selections": [
                    {
                      "args": null,
                      "kind": "FragmentSpread",
                      "name": "ExperimentRepeatedRunGroupMetadataFragment"
                    },
                    {
                      "alias": null,
                      "args": null,
                      "concreteType": "ExperimentRepeatedRunGroupAnnotationSummary",
                      "kind": "LinkedField",
                      "name": "annotationSummaries",
                      "plural": true,
                      "selections": (v2/*: any*/),
                      "storageKey": null
                    },
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
                        (v1/*: any*/),
                        {
                          "alias": null,
                          "args": null,
                          "kind": "ScalarField",
                          "name": "latencyMs",
                          "storageKey": null
                        },
                        {
                          "alias": null,
                          "args": null,
                          "kind": "ScalarField",
                          "name": "repetitionNumber",
                          "storageKey": null
                        },
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
                        (v3/*: any*/),
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
                              "selections": [
                                (v4/*: any*/),
                                (v5/*: any*/)
                              ],
                              "storageKey": null
                            }
                          ],
                          "storageKey": null
                        },
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
                                    (v1/*: any*/),
                                    (v6/*: any*/),
                                    (v7/*: any*/),
                                    (v8/*: any*/),
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
                                    (v9/*: any*/),
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
              "concreteType": "ExperimentComparison",
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
      "storageKey": null
    },
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
        (v1/*: any*/),
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
                        (v1/*: any*/),
                        (v6/*: any*/),
                        {
                          "alias": null,
                          "args": null,
                          "kind": "ScalarField",
                          "name": "sequenceNumber",
                          "storageKey": null
                        },
                        (v9/*: any*/),
                        {
                          "alias": null,
                          "args": null,
                          "kind": "ScalarField",
                          "name": "datasetVersionId",
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
                            (v1/*: any*/)
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
                              "name": "total",
                              "plural": false,
                              "selections": [
                                (v5/*: any*/),
                                (v4/*: any*/)
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
                          "name": "averageRunLatencyMs",
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
                          "kind": "ScalarField",
                          "name": "repetitions",
                          "storageKey": null
                        },
                        {
                          "alias": null,
                          "args": null,
                          "concreteType": "ExperimentAnnotationSummary",
                          "kind": "LinkedField",
                          "name": "annotationSummaries",
                          "plural": true,
                          "selections": (v2/*: any*/),
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
                        (v6/*: any*/),
                        {
                          "alias": null,
                          "args": null,
                          "concreteType": null,
                          "kind": "LinkedField",
                          "name": "outputConfig",
                          "plural": false,
                          "selections": [
                            {
                              "kind": "InlineFragment",
                              "selections": [
                                (v6/*: any*/),
                                (v10/*: any*/),
                                {
                                  "alias": null,
                                  "args": null,
                                  "concreteType": "CategoricalAnnotationValue",
                                  "kind": "LinkedField",
                                  "name": "values",
                                  "plural": true,
                                  "selections": [
                                    (v8/*: any*/),
                                    (v7/*: any*/)
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
                                (v6/*: any*/),
                                (v10/*: any*/),
                                {
                                  "alias": null,
                                  "args": null,
                                  "kind": "ScalarField",
                                  "name": "lowerBound",
                                  "storageKey": null
                                },
                                {
                                  "alias": null,
                                  "args": null,
                                  "kind": "ScalarField",
                                  "name": "upperBound",
                                  "storageKey": null
                                }
                              ],
                              "type": "ContinuousAnnotationConfig",
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
    }
  ],
  "type": "Query",
  "abstractKey": null
};
})();

(node as any).hash = "b9b2e7f7b273b38ac6f267a4eb5e817f";

export default node;
