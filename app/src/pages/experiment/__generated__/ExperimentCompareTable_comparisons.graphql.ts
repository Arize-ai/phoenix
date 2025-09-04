/**
 * @generated SignedSource<<7d042209cfc2109c72448a413b0b2d99>>
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
  readonly dataset: {
    readonly examples?: {
      readonly edges: ReadonlyArray<{
        readonly example: {
          readonly experiments: {
            readonly edges: ReadonlyArray<{
              readonly experiment: {
                readonly id: string;
                readonly runCount: number;
                readonly runs: {
                  readonly edges: ReadonlyArray<{
                    readonly run: {
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
                    };
                  }>;
                };
              };
            }>;
          };
          readonly id: string;
          readonly revision: {
            readonly input: any;
            readonly referenceOutput: any;
          };
        };
      }>;
    };
    readonly experiments?: {
      readonly edges: ReadonlyArray<{
        readonly experiment: {
          readonly averageRunLatencyMs: number | null;
          readonly costSummary: {
            readonly total: {
              readonly cost: number | null;
              readonly tokens: number | null;
            };
          };
          readonly id: string;
          readonly metadata: any;
          readonly name: string;
          readonly project: {
            readonly id: string;
          } | null;
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
  "dataset",
  "examples"
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
    "kind": "Variable",
    "name": "experimentIds",
    "variableName": "experimentIds"
  }
],
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "runCount",
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
  "name": "tokens",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "cost",
  "storageKey": null
},
v7 = {
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
      "name": "datasetId"
    },
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "datasetVersionId"
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
              "alias": "examples",
              "args": [
                {
                  "kind": "Variable",
                  "name": "datasetVersionId",
                  "variableName": "datasetVersionId"
                },
                {
                  "kind": "Variable",
                  "name": "filterCondition",
                  "variableName": "filterCondition"
                }
              ],
              "concreteType": "DatasetExampleConnection",
              "kind": "LinkedField",
              "name": "__ExperimentCompareTable_examples_connection",
              "plural": false,
              "selections": [
                {
                  "alias": null,
                  "args": null,
                  "concreteType": "DatasetExampleEdge",
                  "kind": "LinkedField",
                  "name": "edges",
                  "plural": true,
                  "selections": [
                    {
                      "alias": "example",
                      "args": null,
                      "concreteType": "DatasetExample",
                      "kind": "LinkedField",
                      "name": "node",
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
                        },
                        {
                          "alias": null,
                          "args": (v2/*: any*/),
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
                                      "args": [
                                        {
                                          "kind": "Literal",
                                          "name": "first",
                                          "value": 5
                                        }
                                      ],
                                      "concreteType": "ExperimentRunConnection",
                                      "kind": "LinkedField",
                                      "name": "runs",
                                      "plural": false,
                                      "selections": [
                                        {
                                          "alias": null,
                                          "args": null,
                                          "concreteType": "ExperimentRunEdge",
                                          "kind": "LinkedField",
                                          "name": "edges",
                                          "plural": true,
                                          "selections": [
                                            {
                                              "alias": "run",
                                              "args": null,
                                              "concreteType": "ExperimentRun",
                                              "kind": "LinkedField",
                                              "name": "node",
                                              "plural": false,
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
                                                (v4/*: any*/),
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
                                                        (v6/*: any*/)
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
                                                            (v7/*: any*/),
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
                                      "storageKey": "runs(first:5)"
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
                      "concreteType": "DatasetExample",
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
              "alias": null,
              "args": (v2/*: any*/),
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
                        (v7/*: any*/),
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
                                (v6/*: any*/),
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
                          "kind": "ScalarField",
                          "name": "averageRunLatencyMs",
                          "storageKey": null
                        },
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

(node as any).hash = "d8749c1981c18fb413ec3381c98f63c6";

export default node;
