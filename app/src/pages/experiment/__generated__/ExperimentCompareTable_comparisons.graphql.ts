/**
 * @generated SignedSource<<c0f815052c6d02046dee4250604c7f4f>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type ExperimentRunAnnotatorKind = "CODE" | "HUMAN" | "LLM";
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
            readonly costSummary: {
              readonly total: {
                readonly cost: number | null;
                readonly tokens: number | null;
              };
            };
            readonly endTime: string;
            readonly error: string | null;
            readonly id: string;
            readonly output: any | null;
            readonly startTime: string;
            readonly trace: {
              readonly projectId: string;
              readonly traceId: string;
            } | null;
          }>;
        }>;
      };
    }>;
  };
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
v2 = {
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
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
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
      "name": "baselineExperimentId"
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
          "name": "baselineExperimentId",
          "variableName": "baselineExperimentId"
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
                        (v1/*: any*/),
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
                        (v2/*: any*/),
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
                                    (v3/*: any*/),
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
                                    (v2/*: any*/)
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
                        (v1/*: any*/),
                        (v3/*: any*/),
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
                            (v1/*: any*/)
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
    }
  ],
  "type": "Query",
  "abstractKey": null
};
})();

(node as any).hash = "a4625896f8c59c20b5b08c9a498658aa";

export default node;
