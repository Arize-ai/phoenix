/**
 * @generated SignedSource<<4fc9d6193754fb9b02b74c44a30f8a68>>
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
export type Granularity = {
  evaluationWindowMinutes: number;
  samplingIntervalMinutes: number;
};
export type DimensionCardinalityTimeSeriesQuery$variables = {
  dimensionId: string;
  granularity: Granularity;
  timeRange: TimeRange;
};
export type DimensionCardinalityTimeSeriesQuery$data = {
  readonly dimension: {
    readonly cardinalityTimeSeries?: {
      readonly data: ReadonlyArray<{
        readonly timestamp: string;
        readonly value: number | null;
      }>;
    };
    readonly id: string;
  };
};
export type DimensionCardinalityTimeSeriesQuery = {
  response: DimensionCardinalityTimeSeriesQuery$data;
  variables: DimensionCardinalityTimeSeriesQuery$variables;
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
  "name": "granularity"
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
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": "cardinalityTimeSeries",
      "args": [
        {
          "kind": "Variable",
          "name": "granularity",
          "variableName": "granularity"
        },
        {
          "kind": "Literal",
          "name": "metric",
          "value": "cardinality"
        },
        {
          "kind": "Variable",
          "name": "timeRange",
          "variableName": "timeRange"
        }
      ],
      "concreteType": "DataQualityTimeSeries",
      "kind": "LinkedField",
      "name": "dataQualityTimeSeries",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "TimeSeriesDataPoint",
          "kind": "LinkedField",
          "name": "data",
          "plural": true,
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "timestamp",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "value",
              "storageKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "Dimension",
  "abstractKey": null
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
    "name": "DimensionCardinalityTimeSeriesQuery",
    "selections": [
      {
        "alias": "dimension",
        "args": (v3/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v4/*: any*/),
          (v5/*: any*/)
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
    "name": "DimensionCardinalityTimeSeriesQuery",
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
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "__typename",
            "storageKey": null
          },
          (v4/*: any*/),
          (v5/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "3c329f10094fdfe6dfbc0c7742bcffc4",
    "id": null,
    "metadata": {},
    "name": "DimensionCardinalityTimeSeriesQuery",
    "operationKind": "query",
    "text": "query DimensionCardinalityTimeSeriesQuery(\n  $dimensionId: ID!\n  $timeRange: TimeRange!\n  $granularity: Granularity!\n) {\n  dimension: node(id: $dimensionId) {\n    __typename\n    id\n    ... on Dimension {\n      cardinalityTimeSeries: dataQualityTimeSeries(metric: cardinality, timeRange: $timeRange, granularity: $granularity) {\n        data {\n          timestamp\n          value\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "54017cf4e3febc3e99e1d95c98800ef7";

export default node;
