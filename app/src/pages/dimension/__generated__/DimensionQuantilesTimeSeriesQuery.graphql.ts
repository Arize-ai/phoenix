/**
 * @generated SignedSource<<16488862606f2505ca2cfcb7d35d7d71>>
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
export type DimensionQuantilesTimeSeriesQuery$variables = {
  dimensionId: string;
  granularity: Granularity;
  timeRange: TimeRange;
};
export type DimensionQuantilesTimeSeriesQuery$data = {
  readonly dimension: {
    readonly id: string;
    readonly p01TimeSeries?: {
      readonly data: ReadonlyArray<{
        readonly timestamp: string;
        readonly value: number | null;
      }>;
    };
    readonly p25TimeSeries?: {
      readonly data: ReadonlyArray<{
        readonly timestamp: string;
        readonly value: number | null;
      }>;
    };
    readonly p50TimeSeries?: {
      readonly data: ReadonlyArray<{
        readonly timestamp: string;
        readonly value: number | null;
      }>;
    };
    readonly p75TimeSeries?: {
      readonly data: ReadonlyArray<{
        readonly timestamp: string;
        readonly value: number | null;
      }>;
    };
    readonly p99TimeSeries?: {
      readonly data: ReadonlyArray<{
        readonly timestamp: string;
        readonly value: number | null;
      }>;
    };
  };
};
export type DimensionQuantilesTimeSeriesQuery = {
  response: DimensionQuantilesTimeSeriesQuery$data;
  variables: DimensionQuantilesTimeSeriesQuery$variables;
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
  "kind": "Variable",
  "name": "granularity",
  "variableName": "granularity"
},
v6 = {
  "kind": "Variable",
  "name": "timeRange",
  "variableName": "timeRange"
},
v7 = [
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
v8 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": "p99TimeSeries",
      "args": [
        (v5/*: any*/),
        {
          "kind": "Literal",
          "name": "metric",
          "value": "p99"
        },
        (v6/*: any*/)
      ],
      "concreteType": "DataQualityTimeSeries",
      "kind": "LinkedField",
      "name": "dataQualityTimeSeries",
      "plural": false,
      "selections": (v7/*: any*/),
      "storageKey": null
    },
    {
      "alias": "p75TimeSeries",
      "args": [
        (v5/*: any*/),
        {
          "kind": "Literal",
          "name": "metric",
          "value": "p75"
        },
        (v6/*: any*/)
      ],
      "concreteType": "DataQualityTimeSeries",
      "kind": "LinkedField",
      "name": "dataQualityTimeSeries",
      "plural": false,
      "selections": (v7/*: any*/),
      "storageKey": null
    },
    {
      "alias": "p50TimeSeries",
      "args": [
        (v5/*: any*/),
        {
          "kind": "Literal",
          "name": "metric",
          "value": "p50"
        },
        (v6/*: any*/)
      ],
      "concreteType": "DataQualityTimeSeries",
      "kind": "LinkedField",
      "name": "dataQualityTimeSeries",
      "plural": false,
      "selections": (v7/*: any*/),
      "storageKey": null
    },
    {
      "alias": "p25TimeSeries",
      "args": [
        (v5/*: any*/),
        {
          "kind": "Literal",
          "name": "metric",
          "value": "p25"
        },
        (v6/*: any*/)
      ],
      "concreteType": "DataQualityTimeSeries",
      "kind": "LinkedField",
      "name": "dataQualityTimeSeries",
      "plural": false,
      "selections": (v7/*: any*/),
      "storageKey": null
    },
    {
      "alias": "p01TimeSeries",
      "args": [
        (v5/*: any*/),
        {
          "kind": "Literal",
          "name": "metric",
          "value": "p01"
        },
        (v6/*: any*/)
      ],
      "concreteType": "DataQualityTimeSeries",
      "kind": "LinkedField",
      "name": "dataQualityTimeSeries",
      "plural": false,
      "selections": (v7/*: any*/),
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
    "name": "DimensionQuantilesTimeSeriesQuery",
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
          (v8/*: any*/)
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
    "name": "DimensionQuantilesTimeSeriesQuery",
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
          (v8/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "04ae2e4b101a75b965867de769810e0c",
    "id": null,
    "metadata": {},
    "name": "DimensionQuantilesTimeSeriesQuery",
    "operationKind": "query",
    "text": "query DimensionQuantilesTimeSeriesQuery(\n  $dimensionId: ID!\n  $timeRange: TimeRange!\n  $granularity: Granularity!\n) {\n  dimension: node(id: $dimensionId) {\n    __typename\n    id\n    ... on Dimension {\n      p99TimeSeries: dataQualityTimeSeries(metric: p99, timeRange: $timeRange, granularity: $granularity) {\n        data {\n          timestamp\n          value\n        }\n      }\n      p75TimeSeries: dataQualityTimeSeries(metric: p75, timeRange: $timeRange, granularity: $granularity) {\n        data {\n          timestamp\n          value\n        }\n      }\n      p50TimeSeries: dataQualityTimeSeries(metric: p50, timeRange: $timeRange, granularity: $granularity) {\n        data {\n          timestamp\n          value\n        }\n      }\n      p25TimeSeries: dataQualityTimeSeries(metric: p25, timeRange: $timeRange, granularity: $granularity) {\n        data {\n          timestamp\n          value\n        }\n      }\n      p01TimeSeries: dataQualityTimeSeries(metric: p01, timeRange: $timeRange, granularity: $granularity) {\n        data {\n          timestamp\n          value\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "83342058bb8f50dad5bec299b4bc034d";

export default node;
