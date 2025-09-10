/**
 * @generated SignedSource<<65276f62cb3c58b3032cddd0d6c51240>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type TimeRange = {
  end?: string | null;
  start?: string | null;
};
export type DimensionDriftBreakdownSegmentBarChartQuery$variables = {
  dimensionId: string;
  timeRange: TimeRange;
};
export type DimensionDriftBreakdownSegmentBarChartQuery$data = {
  readonly dimension: {
    readonly id: string;
    readonly segmentsComparison?: {
      readonly segments: ReadonlyArray<{
        readonly bin: {
          readonly __typename: "IntervalBin";
          readonly range: {
            readonly end: number;
            readonly start: number;
          };
        } | {
          readonly __typename: "MissingValueBin";
        } | {
          readonly __typename: "NominalBin";
          readonly name: string;
        } | {
          // This will never be '%other', but we need some
          // value in case none of the concrete values match.
          readonly __typename: "%other";
        };
        readonly counts: {
          readonly primaryValue: number | null;
          readonly referenceValue: number | null;
        };
      }>;
      readonly totalCounts: {
        readonly primaryValue: number | null;
        readonly referenceValue: number | null;
      };
    };
  };
};
export type DimensionDriftBreakdownSegmentBarChartQuery = {
  response: DimensionDriftBreakdownSegmentBarChartQuery$data;
  variables: DimensionDriftBreakdownSegmentBarChartQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "dimensionId"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "timeRange"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "dimensionId"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v3 = [
  {
    "kind": "Variable",
    "name": "primaryTimeRange",
    "variableName": "timeRange"
  }
],
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "concreteType": "NumericRange",
  "kind": "LinkedField",
  "name": "range",
  "plural": false,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "start",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "end",
      "storageKey": null
    }
  ],
  "storageKey": null
},
v7 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "primaryValue",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "referenceValue",
    "storageKey": null
  }
],
v8 = {
  "alias": null,
  "args": null,
  "concreteType": "DatasetValues",
  "kind": "LinkedField",
  "name": "counts",
  "plural": false,
  "selections": (v7/*: any*/),
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "concreteType": "DatasetValues",
  "kind": "LinkedField",
  "name": "totalCounts",
  "plural": false,
  "selections": (v7/*: any*/),
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "DimensionDriftBreakdownSegmentBarChartQuery",
    "selections": [
      {
        "alias": "dimension",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "kind": "RequiredField",
                "field": {
                  "alias": null,
                  "args": (v3/*: any*/),
                  "concreteType": "Segments",
                  "kind": "LinkedField",
                  "name": "segmentsComparison",
                  "plural": false,
                  "selections": [
                    {
                      "alias": null,
                      "args": null,
                      "concreteType": "Segment",
                      "kind": "LinkedField",
                      "name": "segments",
                      "plural": true,
                      "selections": [
                        {
                          "alias": null,
                          "args": null,
                          "concreteType": null,
                          "kind": "LinkedField",
                          "name": "bin",
                          "plural": false,
                          "selections": [
                            {
                              "kind": "InlineFragment",
                              "selections": [
                                (v4/*: any*/),
                                (v5/*: any*/)
                              ],
                              "type": "NominalBin",
                              "abstractKey": null
                            },
                            {
                              "kind": "InlineFragment",
                              "selections": [
                                (v4/*: any*/),
                                (v6/*: any*/)
                              ],
                              "type": "IntervalBin",
                              "abstractKey": null
                            },
                            {
                              "kind": "InlineFragment",
                              "selections": [
                                (v4/*: any*/)
                              ],
                              "type": "MissingValueBin",
                              "abstractKey": null
                            }
                          ],
                          "storageKey": null
                        },
                        (v8/*: any*/)
                      ],
                      "storageKey": null
                    },
                    (v9/*: any*/)
                  ],
                  "storageKey": null
                },
                "action": "THROW"
              }
            ],
            "type": "Dimension",
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "DimensionDriftBreakdownSegmentBarChartQuery",
    "selections": [
      {
        "alias": "dimension",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v4/*: any*/),
          (v2/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": (v3/*: any*/),
                "concreteType": "Segments",
                "kind": "LinkedField",
                "name": "segmentsComparison",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "Segment",
                    "kind": "LinkedField",
                    "name": "segments",
                    "plural": true,
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": null,
                        "kind": "LinkedField",
                        "name": "bin",
                        "plural": false,
                        "selections": [
                          (v4/*: any*/),
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v5/*: any*/)
                            ],
                            "type": "NominalBin",
                            "abstractKey": null
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v6/*: any*/)
                            ],
                            "type": "IntervalBin",
                            "abstractKey": null
                          }
                        ],
                        "storageKey": null
                      },
                      (v8/*: any*/)
                    ],
                    "storageKey": null
                  },
                  (v9/*: any*/)
                ],
                "storageKey": null
              }
            ],
            "type": "Dimension",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "2e05d1ca13480861b72938edd162c36f",
    "id": null,
    "metadata": {},
    "name": "DimensionDriftBreakdownSegmentBarChartQuery",
    "operationKind": "query",
    "text": "query DimensionDriftBreakdownSegmentBarChartQuery(\n  $dimensionId: ID!\n  $timeRange: TimeRange!\n) {\n  dimension: node(id: $dimensionId) {\n    __typename\n    id\n    ... on Dimension {\n      segmentsComparison(primaryTimeRange: $timeRange) {\n        segments {\n          bin {\n            __typename\n            ... on NominalBin {\n              __typename\n              name\n            }\n            ... on IntervalBin {\n              __typename\n              range {\n                start\n                end\n              }\n            }\n            ... on MissingValueBin {\n              __typename\n            }\n          }\n          counts {\n            primaryValue\n            referenceValue\n          }\n        }\n        totalCounts {\n          primaryValue\n          referenceValue\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "f42c6bfff21c628edc1e297e0a0462d4";

export default node;
