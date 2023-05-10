/**
 * @generated SignedSource<<c04690ce7e542478b8e4ef605b57609b>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
export type TimeRange = {
  end: string;
  start: string;
};
export type Granularity = {
  evaluationWindowMinutes: number;
  samplingIntervalMinutes: number;
};
export type DimensionDriftTimeSeriesQuery$variables = {
  countGranularity: Granularity;
  dimensionId: string;
  driftGranularity: Granularity;
  timeRange: TimeRange;
};
export type DimensionDriftTimeSeriesQuery$data = {
  readonly embedding: {
    readonly driftTimeSeries?: {
      readonly data: ReadonlyArray<{
        readonly timestamp: string;
        readonly value: number | null;
      }>;
    };
    readonly id: string;
    readonly trafficTimeSeries?: {
      readonly data: ReadonlyArray<{
        readonly timestamp: string;
        readonly value: number | null;
      }>;
    };
  };
};
export type DimensionDriftTimeSeriesQuery = {
  response: DimensionDriftTimeSeriesQuery$data;
  variables: DimensionDriftTimeSeriesQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "countGranularity"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "dimensionId"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "driftGranularity"
},
v3 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "timeRange"
},
v4 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "dimensionId"
  }
],
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
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
      "alias": null,
      "args": [
        {
          "kind": "Variable",
          "name": "granularity",
          "variableName": "driftGranularity"
        },
        {
          "kind": "Literal",
          "name": "metric",
          "value": "psi"
        },
        (v6/*: any*/)
      ],
      "concreteType": "DriftTimeSeries",
      "kind": "LinkedField",
      "name": "driftTimeSeries",
      "plural": false,
      "selections": (v7/*: any*/),
      "storageKey": null
    },
    {
      "alias": "trafficTimeSeries",
      "args": [
        {
          "kind": "Variable",
          "name": "granularity",
          "variableName": "countGranularity"
        },
        {
          "kind": "Literal",
          "name": "metric",
          "value": "count"
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
      (v2/*: any*/),
      (v3/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "DimensionDriftTimeSeriesQuery",
    "selections": [
      {
        "alias": "embedding",
        "args": (v4/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v5/*: any*/),
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
      (v1/*: any*/),
      (v3/*: any*/),
      (v2/*: any*/),
      (v0/*: any*/)
    ],
    "kind": "Operation",
    "name": "DimensionDriftTimeSeriesQuery",
    "selections": [
      {
        "alias": "embedding",
        "args": (v4/*: any*/),
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
          (v5/*: any*/),
          (v8/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "af2d25e28675891b3c8a6bc75027f731",
    "id": null,
    "metadata": {},
    "name": "DimensionDriftTimeSeriesQuery",
    "operationKind": "query",
    "text": "query DimensionDriftTimeSeriesQuery(\n  $dimensionId: GlobalID!\n  $timeRange: TimeRange!\n  $driftGranularity: Granularity!\n  $countGranularity: Granularity!\n) {\n  embedding: node(id: $dimensionId) {\n    __typename\n    id\n    ... on Dimension {\n      driftTimeSeries(metric: psi, timeRange: $timeRange, granularity: $driftGranularity) {\n        data {\n          timestamp\n          value\n        }\n      }\n      trafficTimeSeries: dataQualityTimeSeries(metric: count, timeRange: $timeRange, granularity: $countGranularity) {\n        data {\n          timestamp\n          value\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "6312b58dbb252b17efdf08d44dd58630";

export default node;
