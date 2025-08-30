/**
 * @generated SignedSource<<a160be5b536996cba10696dfa30b1c5f>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ExperimentCompareListPage_comparisons$data = {
  readonly experimentRunComparisons: {
    readonly edges: ReadonlyArray<{
      readonly comparison: {
        readonly example: {
          readonly id: string;
          readonly revision: {
            readonly input: any;
            readonly referenceOutput: any;
          };
        };
        readonly runs: ReadonlyArray<{
          readonly repetitions: ReadonlyArray<{
            readonly annotations: {
              readonly edges: ReadonlyArray<{
                readonly annotation: {
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
            readonly output: any | null;
            readonly startTime: string;
          }>;
        }>;
      };
    }>;
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
  "experimentRunComparisons"
];
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
      "kind": "RootArgument",
      "name": "compareExperimentIds"
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
      "operation": ExperimentCompareListPageQuery_graphql
    }
  },
  "name": "ExperimentCompareListPage_comparisons",
  "selections": [
    {
      "alias": "experimentRunComparisons",
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
      "concreteType": "ExperimentRunComparisonConnection",
      "kind": "LinkedField",
      "name": "__ExperimentCompareListPage_experimentRunComparisons_connection",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "ExperimentRunComparisonEdge",
          "kind": "LinkedField",
          "name": "edges",
          "plural": true,
          "selections": [
            {
              "alias": "comparison",
              "args": null,
              "concreteType": "ExperimentRunComparison",
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
                  "concreteType": "ExperimentRun",
                  "kind": "LinkedField",
                  "name": "runs",
                  "plural": true,
                  "selections": [
                    {
                      "alias": null,
                      "args": null,
                      "concreteType": "ExperimentRepetition",
                      "kind": "LinkedField",
                      "name": "repetitions",
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
                          "kind": "ScalarField",
                          "name": "output",
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
              "concreteType": "ExperimentRunComparison",
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
  "type": "Query",
  "abstractKey": null
};
})();

(node as any).hash = "b3a73979a6fd30c0c39cc1e797abc675";

export default node;
