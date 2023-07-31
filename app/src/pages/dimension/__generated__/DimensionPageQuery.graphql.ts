/**
 * @generated SignedSource<<629874fab12c4ab50d151e5c03f57ec4>>
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
export type DimensionPageQuery$variables = {
  dimensionId: string;
  hasReference: boolean;
  timeRange: TimeRange;
};
export type DimensionPageQuery$data = {
  readonly dimension: {
    readonly id?: string;
    readonly " $fragmentSpreads": FragmentRefs<"DimensionCardinalityStats_dimension" | "DimensionCountStats_dimension" | "DimensionDriftStats_dimension" | "DimensionPercentEmptyStats_dimension" | "DimensionQuantilesStats_dimension" | "DimensionSegmentsBarChart_dimension">;
  };
};
export type DimensionPageQuery = {
  response: DimensionPageQuery$data;
  variables: DimensionPageQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "dimensionId"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "hasReference"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "timeRange"
},
v3 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "dimensionId"
  }
],
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v5 = {
  "kind": "Variable",
  "name": "timeRange",
  "variableName": "timeRange"
},
v6 = [
  (v5/*: any*/)
],
v7 = [
  {
    "kind": "Variable",
    "name": "hasReference",
    "variableName": "hasReference"
  },
  (v5/*: any*/)
],
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v9 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "primaryValue",
    "storageKey": null
  }
],
v10 = {
  "kind": "Literal",
  "name": "metric",
  "value": "cardinality"
},
v11 = {
  "kind": "Literal",
  "name": "metric",
  "value": "percentEmpty"
},
v12 = {
  "kind": "Literal",
  "name": "datasetRole",
  "value": "reference"
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/),
      (v2/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "DimensionPageQuery",
    "selections": [
      {
        "alias": "dimension",
        "args": (v3/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "kind": "InlineFragment",
            "selections": [
              (v4/*: any*/),
              {
                "args": (v6/*: any*/),
                "kind": "FragmentSpread",
                "name": "DimensionSegmentsBarChart_dimension"
              },
              {
                "args": (v6/*: any*/),
                "kind": "FragmentSpread",
                "name": "DimensionCountStats_dimension"
              },
              {
                "args": (v6/*: any*/),
                "kind": "FragmentSpread",
                "name": "DimensionDriftStats_dimension"
              },
              {
                "args": (v7/*: any*/),
                "kind": "FragmentSpread",
                "name": "DimensionCardinalityStats_dimension"
              },
              {
                "args": (v7/*: any*/),
                "kind": "FragmentSpread",
                "name": "DimensionPercentEmptyStats_dimension"
              },
              {
                "args": (v6/*: any*/),
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
    "argumentDefinitions": [
      (v0/*: any*/),
      (v2/*: any*/),
      (v1/*: any*/)
    ],
    "kind": "Operation",
    "name": "DimensionPageQuery",
    "selections": [
      {
        "alias": "dimension",
        "args": (v3/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v8/*: any*/),
          {
            "kind": "TypeDiscriminator",
            "abstractKey": "__isNode"
          },
          (v4/*: any*/),
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
                          (v8/*: any*/),
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
                        "selections": (v9/*: any*/),
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
                    "selections": (v9/*: any*/),
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
                  (v5/*: any*/)
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
                  (v5/*: any*/)
                ],
                "kind": "ScalarField",
                "name": "driftMetric",
                "storageKey": null
              },
              {
                "alias": "cardinality",
                "args": [
                  (v10/*: any*/),
                  (v5/*: any*/)
                ],
                "kind": "ScalarField",
                "name": "dataQualityMetric",
                "storageKey": null
              },
              {
                "alias": "percentEmpty",
                "args": [
                  (v11/*: any*/),
                  (v5/*: any*/)
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
                  (v5/*: any*/)
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
                  (v5/*: any*/)
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
                  (v5/*: any*/)
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
                  (v5/*: any*/)
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
                  (v5/*: any*/)
                ],
                "kind": "ScalarField",
                "name": "dataQualityMetric",
                "storageKey": null
              },
              {
                "condition": "hasReference",
                "kind": "Condition",
                "passingValue": true,
                "selections": [
                  {
                    "alias": "referenceCardinality",
                    "args": [
                      (v12/*: any*/),
                      (v10/*: any*/)
                    ],
                    "kind": "ScalarField",
                    "name": "dataQualityMetric",
                    "storageKey": "dataQualityMetric(datasetRole:\"reference\",metric:\"cardinality\")"
                  },
                  {
                    "alias": "referencePercentEmpty",
                    "args": [
                      (v12/*: any*/),
                      (v11/*: any*/)
                    ],
                    "kind": "ScalarField",
                    "name": "dataQualityMetric",
                    "storageKey": "dataQualityMetric(datasetRole:\"reference\",metric:\"percentEmpty\")"
                  }
                ]
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
    "cacheID": "9c8cfb791dbd8ff321722f2864db30e9",
    "id": null,
    "metadata": {},
    "name": "DimensionPageQuery",
    "operationKind": "query",
    "text": "query DimensionPageQuery(\n  $dimensionId: GlobalID!\n  $timeRange: TimeRange!\n  $hasReference: Boolean!\n) {\n  dimension: node(id: $dimensionId) {\n    __typename\n    ... on Dimension {\n      id\n      ...DimensionSegmentsBarChart_dimension_3E0ZE6\n      ...DimensionCountStats_dimension_3E0ZE6\n      ...DimensionDriftStats_dimension_3E0ZE6\n      ...DimensionCardinalityStats_dimension_1JBzL3\n      ...DimensionPercentEmptyStats_dimension_1JBzL3\n      ...DimensionQuantilesStats_dimension_3E0ZE6\n    }\n    __isNode: __typename\n    id\n  }\n}\n\nfragment DimensionCardinalityStats_dimension_1JBzL3 on Dimension {\n  id\n  cardinality: dataQualityMetric(metric: cardinality, timeRange: $timeRange)\n  referenceCardinality: dataQualityMetric(metric: cardinality, datasetRole: reference) @include(if: $hasReference)\n}\n\nfragment DimensionCountStats_dimension_3E0ZE6 on Dimension {\n  id\n  count: dataQualityMetric(metric: count, timeRange: $timeRange)\n}\n\nfragment DimensionDriftStats_dimension_3E0ZE6 on Dimension {\n  id\n  psi: driftMetric(metric: psi, timeRange: $timeRange)\n}\n\nfragment DimensionPercentEmptyStats_dimension_1JBzL3 on Dimension {\n  id\n  percentEmpty: dataQualityMetric(metric: percentEmpty, timeRange: $timeRange)\n  referencePercentEmpty: dataQualityMetric(metric: percentEmpty, datasetRole: reference) @include(if: $hasReference)\n}\n\nfragment DimensionQuantilesStats_dimension_3E0ZE6 on Dimension {\n  p99: dataQualityMetric(metric: p99, timeRange: $timeRange)\n  p75: dataQualityMetric(metric: p75, timeRange: $timeRange)\n  p50: dataQualityMetric(metric: p50, timeRange: $timeRange)\n  p25: dataQualityMetric(metric: p25, timeRange: $timeRange)\n  p1: dataQualityMetric(metric: p01, timeRange: $timeRange)\n}\n\nfragment DimensionSegmentsBarChart_dimension_3E0ZE6 on Dimension {\n  id\n  segmentsComparison(primaryTimeRange: $timeRange) {\n    segments {\n      bin {\n        __typename\n        ... on NominalBin {\n          __typename\n          name\n        }\n        ... on IntervalBin {\n          __typename\n          range {\n            start\n            end\n          }\n        }\n        ... on MissingValueBin {\n          __typename\n        }\n      }\n      counts {\n        primaryValue\n      }\n    }\n    totalCounts {\n      primaryValue\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "d194bfd656408e8ba7cb427ddc80fc85";

export default node;
