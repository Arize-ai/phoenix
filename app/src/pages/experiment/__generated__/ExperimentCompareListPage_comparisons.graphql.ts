/**
 * @generated SignedSource<<f9244c389a68977844f574b446f3bcaa>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ExperimentCompareListPage_comparisons$data = {
  readonly experiment: {
    readonly id?: string;
    readonly runs?: {
      readonly edges: ReadonlyArray<{
        readonly run: {
          readonly annotations: {
            readonly edges: ReadonlyArray<{
              readonly annotation: {
                readonly id: string;
                readonly label: string | null;
                readonly name: string;
                readonly score: number | null;
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
          readonly example: {
            readonly experimentRepeatedRunGroups: ReadonlyArray<{
              readonly experimentId: string;
              readonly runs: ReadonlyArray<{
                readonly annotations: {
                  readonly edges: ReadonlyArray<{
                    readonly annotation: {
                      readonly id: string;
                      readonly label: string | null;
                      readonly name: string;
                      readonly score: number | null;
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
                readonly experimentId: string;
                readonly id: string;
                readonly output: any | null;
                readonly startTime: string;
              }>;
            }>;
            readonly id: string;
            readonly revision: {
              readonly input: any;
              readonly referenceOutput: any;
            };
          };
          readonly id: string;
          readonly output: any | null;
          readonly repetitionNumber: number;
          readonly startTime: string;
          readonly trace: {
            readonly projectId: string;
            readonly traceId: string;
          } | null;
        };
      }>;
    };
  };
  readonly " $fragmentType": "ExperimentCompareListPage_comparisons";
};
export type ExperimentCompareListPage_comparisons$key = {
  readonly " $data"?: ExperimentCompareListPage_comparisons$data;
  readonly " $fragmentSpreads": FragmentRefs<"ExperimentCompareListPage_comparisons">;
};

import ExperimentCompareListPageQuery_graphql from './ExperimentCompareListPageQuery.graphql';

const node: ReaderFragment = (function(){
var v0 = [
  "experiment",
  "runs"
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
  "kind": "ScalarField",
  "name": "output",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "startTime",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "endTime",
  "storageKey": null
},
v5 = {
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
v6 = {
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
            (v1/*: any*/)
          ],
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "experimentId",
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
      "defaultValue": 50,
      "kind": "LocalArgument",
      "name": "first"
    },
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "sort"
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
      "operation": ExperimentCompareListPageQuery_graphql
    }
  },
  "name": "ExperimentCompareListPage_comparisons",
  "selections": [
    {
      "alias": "experiment",
      "args": [
        {
          "kind": "Variable",
          "name": "id",
          "variableName": "baseExperimentId"
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
            (v1/*: any*/),
            {
              "alias": "runs",
              "args": [
                {
                  "kind": "Variable",
                  "name": "sort",
                  "variableName": "sort"
                }
              ],
              "concreteType": "ExperimentRunConnection",
              "kind": "LinkedField",
              "name": "__ExperimentCompareListPage_runs_connection",
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
                          "name": "repetitionNumber",
                          "storageKey": null
                        },
                        (v2/*: any*/),
                        (v3/*: any*/),
                        (v4/*: any*/),
                        {
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
                        (v5/*: any*/),
                        (v6/*: any*/),
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
                            },
                            {
                              "alias": null,
                              "args": [
                                {
                                  "kind": "Variable",
                                  "name": "experimentIds",
                                  "variableName": "compareExperimentIds"
                                }
                              ],
                              "concreteType": "ExperimentRepeatedRunGroup",
                              "kind": "LinkedField",
                              "name": "experimentRepeatedRunGroups",
                              "plural": true,
                              "selections": [
                                (v7/*: any*/),
                                {
                                  "alias": null,
                                  "args": null,
                                  "concreteType": "ExperimentRun",
                                  "kind": "LinkedField",
                                  "name": "runs",
                                  "plural": true,
                                  "selections": [
                                    (v1/*: any*/),
                                    (v7/*: any*/),
                                    (v2/*: any*/),
                                    (v3/*: any*/),
                                    (v4/*: any*/),
                                    (v5/*: any*/),
                                    (v6/*: any*/)
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
                      "concreteType": "ExperimentRun",
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
            }
          ],
          "type": "Experiment",
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

(node as any).hash = "9ccda00d27d4d8a3fb4233f2ffadb778";

export default node;
