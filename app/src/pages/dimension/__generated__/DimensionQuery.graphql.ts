/**
 * @generated SignedSource<<2116e56b2dc9b627e6eeb4cf83641715>>
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
    readonly " $fragmentSpreads": FragmentRefs<"DimensionCardinalityStats_dimension" | "DimensionCountStats_dimension" | "DimensionDriftStats_dimension" | "DimensionPercentEmptyStats_dimension">;
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
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "__typename",
            "storageKey": null
          },
          {
            "kind": "TypeDiscriminator",
            "abstractKey": "__isNode"
          },
          (v2/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
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
    "cacheID": "9a82f49fd02e60241952b2a292c7f437",
    "id": null,
    "metadata": {},
    "name": "DimensionQuery",
    "operationKind": "query",
    "text": "query DimensionQuery(\n  $dimensionId: GlobalID!\n  $timeRange: TimeRange!\n) {\n  dimension: node(id: $dimensionId) {\n    __typename\n    ... on Dimension {\n      id\n      ...DimensionCountStats_dimension_3E0ZE6\n      ...DimensionDriftStats_dimension_3E0ZE6\n      ...DimensionCardinalityStats_dimension_3E0ZE6\n      ...DimensionPercentEmptyStats_dimension_3E0ZE6\n    }\n    __isNode: __typename\n    id\n  }\n}\n\nfragment DimensionCardinalityStats_dimension_3E0ZE6 on Dimension {\n  id\n  cardinality: dataQualityMetric(metric: cardinality, timeRange: $timeRange)\n}\n\nfragment DimensionCountStats_dimension_3E0ZE6 on Dimension {\n  id\n  count: dataQualityMetric(metric: count, timeRange: $timeRange)\n}\n\nfragment DimensionDriftStats_dimension_3E0ZE6 on Dimension {\n  id\n  psi: driftMetric(metric: psi, timeRange: $timeRange)\n}\n\nfragment DimensionPercentEmptyStats_dimension_3E0ZE6 on Dimension {\n  id\n  percentEmpty: dataQualityMetric(metric: percentEmpty, timeRange: $timeRange)\n}\n"
  }
};
})();

(node as any).hash = "79beaec0aa62d8b8881982157c94ba29";

export default node;
