/**
 * @generated SignedSource<<c2ba4d65a81c7eeb2df0fb75c714cd36>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type TimeRange = {
  end: string;
  start: string;
};
export type DimensionQuery$variables = {
  dimensionId: string;
  timeRange: TimeRange;
};
export type DimensionQuery$data = {
  readonly dimension: {
    readonly id?: string;
    readonly " $fragmentSpreads": FragmentRefs<"DimensionCardinalityStats_dimension" | "DimensionCountStats_dimension" | "DimensionDriftStats_dimension" | "DimensionPercentEmptyStats_dimension" | "DimensionQuantilesStats_dimension" | "DimensionSegmentsBarChart_dimension">;
  };
};
export type DimensionQuery = {
  response: DimensionQuery$data;
  variables: DimensionQuery$variables;
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
v3 = {
  "kind": "Variable",
  "name": "timeRange",
  "variableName": "timeRange"
},
v4 = [
  (v3/*: any*/)
],
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v6 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "primaryValue",
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "DimensionQuery",
    "selections": [
      {
        "alias": "dimension",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "kind": "InlineFragment",
            "selections": [
              (v2/*: any*/),
              {
                "args": (v4/*: any*/),
                "kind": "FragmentSpread",
                "name": "DimensionSegmentsBarChart_dimension"
              },
              {
                "args": (v4/*: any*/),
                "kind": "FragmentSpread",
                "name": "DimensionCountStats_dimension"
              },
              {
                "args": (v4/*: any*/),
                "kind": "FragmentSpread",
                "name": "DimensionDriftStats_dimension"
              },
              {
                "args": (v4/*: any*/),
                "kind": "FragmentSpread",
                "name": "DimensionCardinalityStats_dimension"
              },
              {
                "args": (v4/*: any*/),
                "kind": "FragmentSpread",
                "name": "DimensionPercentEmptyStats_dimension"
              },
              {
                "args": (v4/*: any*/),
                "kind": "FragmentSpread",
                "name": "DimensionQuantilesStats_dimension"
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
    "name": "DimensionQuery",
    "selections": [
      {
        "alias": "dimension",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v5/*: any*/),
          {
            "kind": "TypeDiscriminator",
            "abstractKey": "__isNode"
          },
          (v2/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": [
                  {
                    "kind": "Variable",
                    "name": "primaryTimeRange",
                    "variableName": "timeRange"
                  }
                ],
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
                          (v5/*: any*/),
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "name",
                                "storageKey": null
                              }
                            ],
                            "type": "NominalBin",
                            "abstractKey": null
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              {
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
                              }
                            ],
                            "type": "IntervalBin",
                            "abstractKey": null
                          }
                        ],
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "DatasetValues",
                        "kind": "LinkedField",
                        "name": "counts",
                        "plural": false,
                        "selections": (v6/*: any*/),
                        "storageKey": null
                      }
                    ],
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "DatasetValues",
                    "kind": "LinkedField",
                    "name": "totalCounts",
                    "plural": false,
                    "selections": (v6/*: any*/),
                    "storageKey": null
                  }
                ],
                "storageKey": null
              },
              {
                "alias": "count",
                "args": [
                  {
                    "kind": "Literal",
                    "name": "metric",
                    "value": "count"
                  },
                  (v3/*: any*/)
                ],
                "kind": "ScalarField",
                "name": "dataQualityMetric",
                "storageKey": null
              },
              {
                "alias": "psi",
                "args": [
                  {
                    "kind": "Literal",
                    "name": "metric",
                    "value": "psi"
                  },
                  (v3/*: any*/)
                ],
                "kind": "ScalarField",
                "name": "driftMetric",
                "storageKey": null
              },
              {
                "alias": "cardinality",
                "args": [
                  {
                    "kind": "Literal",
                    "name": "metric",
                    "value": "cardinality"
                  },
                  (v3/*: any*/)
                ],
                "kind": "ScalarField",
                "name": "dataQualityMetric",
                "storageKey": null
              },
              {
                "alias": "percentEmpty",
                "args": [
                  {
                    "kind": "Literal",
                    "name": "metric",
                    "value": "percentEmpty"
                  },
                  (v3/*: any*/)
                ],
                "kind": "ScalarField",
                "name": "dataQualityMetric",
                "storageKey": null
              },
              {
                "alias": "p99",
                "args": [
                  {
                    "kind": "Literal",
                    "name": "metric",
                    "value": "p99"
                  },
                  (v3/*: any*/)
                ],
                "kind": "ScalarField",
                "name": "dataQualityMetric",
                "storageKey": null
              },
              {
                "alias": "p75",
                "args": [
                  {
                    "kind": "Literal",
                    "name": "metric",
                    "value": "p75"
                  },
                  (v3/*: any*/)
                ],
                "kind": "ScalarField",
                "name": "dataQualityMetric",
                "storageKey": null
              },
              {
                "alias": "p50",
                "args": [
                  {
                    "kind": "Literal",
                    "name": "metric",
                    "value": "p50"
                  },
                  (v3/*: any*/)
                ],
                "kind": "ScalarField",
                "name": "dataQualityMetric",
                "storageKey": null
              },
              {
                "alias": "p25",
                "args": [
                  {
                    "kind": "Literal",
                    "name": "metric",
                    "value": "p25"
                  },
                  (v3/*: any*/)
                ],
                "kind": "ScalarField",
                "name": "dataQualityMetric",
                "storageKey": null
              },
              {
                "alias": "p1",
                "args": [
                  {
                    "kind": "Literal",
                    "name": "metric",
                    "value": "p01"
                  },
                  (v3/*: any*/)
                ],
                "kind": "ScalarField",
                "name": "dataQualityMetric",
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
    "cacheID": "0a0458b49b1cf74eed82a2fc22067410",
    "id": null,
    "metadata": {},
    "name": "DimensionQuery",
    "operationKind": "query",
    "text": "query DimensionQuery(\n  $dimensionId: GlobalID!\n  $timeRange: TimeRange!\n) {\n  dimension: node(id: $dimensionId) {\n    __typename\n    ... on Dimension {\n      id\n      ...DimensionSegmentsBarChart_dimension_3E0ZE6\n      ...DimensionCountStats_dimension_3E0ZE6\n      ...DimensionDriftStats_dimension_3E0ZE6\n      ...DimensionCardinalityStats_dimension_3E0ZE6\n      ...DimensionPercentEmptyStats_dimension_3E0ZE6\n      ...DimensionQuantilesStats_dimension_3E0ZE6\n    }\n    __isNode: __typename\n    id\n  }\n}\n\nfragment DimensionCardinalityStats_dimension_3E0ZE6 on Dimension {\n  id\n  cardinality: dataQualityMetric(metric: cardinality, timeRange: $timeRange)\n}\n\nfragment DimensionCountStats_dimension_3E0ZE6 on Dimension {\n  id\n  count: dataQualityMetric(metric: count, timeRange: $timeRange)\n}\n\nfragment DimensionDriftStats_dimension_3E0ZE6 on Dimension {\n  id\n  psi: driftMetric(metric: psi, timeRange: $timeRange)\n}\n\nfragment DimensionPercentEmptyStats_dimension_3E0ZE6 on Dimension {\n  id\n  percentEmpty: dataQualityMetric(metric: percentEmpty, timeRange: $timeRange)\n}\n\nfragment DimensionQuantilesStats_dimension_3E0ZE6 on Dimension {\n  p99: dataQualityMetric(metric: p99, timeRange: $timeRange)\n  p75: dataQualityMetric(metric: p75, timeRange: $timeRange)\n  p50: dataQualityMetric(metric: p50, timeRange: $timeRange)\n  p25: dataQualityMetric(metric: p25, timeRange: $timeRange)\n  p1: dataQualityMetric(metric: p01, timeRange: $timeRange)\n}\n\nfragment DimensionSegmentsBarChart_dimension_3E0ZE6 on Dimension {\n  id\n  segmentsComparison(primaryTimeRange: $timeRange) {\n    segments {\n      bin {\n        __typename\n        ... on NominalBin {\n          __typename\n          name\n        }\n        ... on IntervalBin {\n          __typename\n          range {\n            start\n            end\n          }\n        }\n        ... on MissingValueBin {\n          __typename\n        }\n      }\n      counts {\n        primaryValue\n      }\n    }\n    totalCounts {\n      primaryValue\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "69c0f81ca83c98cd33f7fe0f3c3582e8";

export default node;
