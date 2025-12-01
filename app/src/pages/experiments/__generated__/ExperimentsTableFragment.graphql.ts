/**
 * @generated SignedSource<<a36dc2adbf5b77fc59e6179cde5113ba>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ExperimentsTableFragment$data = {
  readonly experimentAnnotationSummaries: ReadonlyArray<{
    readonly annotationName: string;
    readonly maxScore: number | null;
    readonly minScore: number | null;
  }>;
  readonly experiments: {
    readonly edges: ReadonlyArray<{
      readonly experiment: {
        readonly annotationSummaries: ReadonlyArray<{
          readonly annotationName: string;
          readonly count: number;
          readonly errorCount: number;
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
        readonly createdAt: string;
        readonly datasetSplits: {
          readonly edges: ReadonlyArray<{
            readonly node: {
              readonly color: string;
              readonly id: string;
              readonly name: string;
            };
          }>;
        };
        readonly description: string | null;
        readonly errorRate: number | null;
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
  readonly " $fragmentType": "ExperimentsTableFragment";
};
export type ExperimentsTableFragment$key = {
  readonly " $data"?: ExperimentsTableFragment$data;
  readonly " $fragmentSpreads": FragmentRefs<"ExperimentsTableFragment">;
};

import ExperimentsTableQuery_graphql from './ExperimentsTableQuery.graphql';

const node: ReaderFragment = (function(){
var v0 = [
  "experiments"
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
  "name": "annotationName",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
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
];
return {
  "argumentDefinitions": [
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "after"
    },
    {
      "defaultValue": 100,
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
      "fragmentPathInResult": [
        "node"
      ],
      "operation": ExperimentsTableQuery_graphql,
      "identifierInfo": {
        "identifierField": "id",
        "identifierQueryVariableName": "id"
      }
    }
  },
  "name": "ExperimentsTableFragment",
  "selections": [
    (v1/*: any*/),
    {
      "alias": null,
      "args": null,
      "concreteType": "DatasetExperimentAnnotationSummary",
      "kind": "LinkedField",
      "name": "experimentAnnotationSummaries",
      "plural": true,
      "selections": [
        (v2/*: any*/),
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "minScore",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "maxScore",
          "storageKey": null
        }
      ],
      "storageKey": null
    },
    {
      "alias": "experiments",
      "args": null,
      "concreteType": "ExperimentConnection",
      "kind": "LinkedField",
      "name": "__ExperimentsTable_experiments_connection",
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
                  "name": "description",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "createdAt",
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
                  "kind": "ScalarField",
                  "name": "repetitions",
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
                  "concreteType": "DatasetSplitConnection",
                  "kind": "LinkedField",
                  "name": "datasetSplits",
                  "plural": false,
                  "selections": [
                    {
                      "alias": null,
                      "args": null,
                      "concreteType": "DatasetSplitEdge",
                      "kind": "LinkedField",
                      "name": "edges",
                      "plural": true,
                      "selections": [
                        {
                          "alias": null,
                          "args": null,
                          "concreteType": "DatasetSplit",
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
                              "name": "color",
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
                      "selections": (v4/*: any*/),
                      "storageKey": null
                    },
                    {
                      "alias": null,
                      "args": null,
                      "concreteType": "CostBreakdown",
                      "kind": "LinkedField",
                      "name": "prompt",
                      "plural": false,
                      "selections": (v4/*: any*/),
                      "storageKey": null
                    },
                    {
                      "alias": null,
                      "args": null,
                      "concreteType": "CostBreakdown",
                      "kind": "LinkedField",
                      "name": "completion",
                      "plural": false,
                      "selections": (v4/*: any*/),
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
                    (v2/*: any*/),
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "meanScore",
                      "storageKey": null
                    },
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "count",
                      "storageKey": null
                    },
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "errorCount",
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
              "concreteType": "Experiment",
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
  "type": "Dataset",
  "abstractKey": null
};
})();

(node as any).hash = "60efbafffc865e6c197c185ad3112606";

export default node;
