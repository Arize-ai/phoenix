/**
 * @generated SignedSource<<2c9778563fff5e319f9ec998d5e2047e>>
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
export type MetricTimeSeriesQuery$variables = {
  countGranularity: Granularity;
  dimensionId: string;
  embeddingDimensionId: string;
  fetchDataQuality: boolean;
  fetchDrift: boolean;
  metricGranularity: Granularity;
  timeRange: TimeRange;
};
export type MetricTimeSeriesQuery$data = {
  readonly dimension?: {
    readonly dataQualityTimeSeries?: {
      readonly data: ReadonlyArray<{
        readonly timestamp: string;
        readonly value: number | null;
      }>;
    };
    readonly name?: string;
  };
  readonly embedding: {
    readonly euclideanDistanceTimeSeries?: {
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
export type MetricTimeSeriesQuery = {
  response: MetricTimeSeriesQuery$data;
  variables: MetricTimeSeriesQuery$variables;
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
  "name": "embeddingDimensionId"
},
v3 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "fetchDataQuality"
},
v4 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "fetchDrift"
},
v5 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "metricGranularity"
},
v6 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "timeRange"
},
v7 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "embeddingDimensionId"
  }
],
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v9 = {
  "kind": "Variable",
  "name": "granularity",
  "variableName": "metricGranularity"
},
v10 = {
  "kind": "Variable",
  "name": "timeRange",
  "variableName": "timeRange"
},
v11 = [
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
v12 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "condition": "fetchDrift",
      "kind": "Condition",
      "passingValue": true,
      "selections": [
        {
          "alias": "euclideanDistanceTimeSeries",
          "args": [
            (v9/*: any*/),
            {
              "kind": "Literal",
              "name": "metric",
              "value": "euclideanDistance"
            },
            (v10/*: any*/)
          ],
          "concreteType": "DriftTimeSeries",
          "kind": "LinkedField",
          "name": "driftTimeSeries",
          "plural": false,
          "selections": (v11/*: any*/),
          "storageKey": null
        }
      ]
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
        (v10/*: any*/)
      ],
      "concreteType": "DataQualityTimeSeries",
      "kind": "LinkedField",
      "name": "dataQualityTimeSeries",
      "plural": false,
      "selections": (v11/*: any*/),
      "storageKey": null
    }
  ],
  "type": "EmbeddingDimension",
  "abstractKey": null
},
v13 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "dimensionId"
  }
],
v14 = {
  "kind": "InlineFragment",
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
      "args": [
        (v9/*: any*/),
        {
          "kind": "Literal",
          "name": "metric",
          "value": "mean"
        },
        (v10/*: any*/)
      ],
      "concreteType": "DataQualityTimeSeries",
      "kind": "LinkedField",
      "name": "dataQualityTimeSeries",
      "plural": false,
      "selections": (v11/*: any*/),
      "storageKey": null
    }
  ],
  "type": "Dimension",
  "abstractKey": null
},
v15 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/),
      (v2/*: any*/),
      (v3/*: any*/),
      (v4/*: any*/),
      (v5/*: any*/),
      (v6/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "MetricTimeSeriesQuery",
    "selections": [
      {
        "alias": "embedding",
        "args": (v7/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v8/*: any*/),
          (v12/*: any*/)
        ],
        "storageKey": null
      },
      {
        "condition": "fetchDataQuality",
        "kind": "Condition",
        "passingValue": true,
        "selections": [
          {
            "alias": "dimension",
            "args": (v13/*: any*/),
            "concreteType": null,
            "kind": "LinkedField",
            "name": "node",
            "plural": false,
            "selections": [
              (v14/*: any*/)
            ],
            "storageKey": null
          }
        ]
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v2/*: any*/),
      (v6/*: any*/),
      (v5/*: any*/),
      (v0/*: any*/),
      (v4/*: any*/),
      (v3/*: any*/),
      (v1/*: any*/)
    ],
    "kind": "Operation",
    "name": "MetricTimeSeriesQuery",
    "selections": [
      {
        "alias": "embedding",
        "args": (v7/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v15/*: any*/),
          (v8/*: any*/),
          (v12/*: any*/)
        ],
        "storageKey": null
      },
      {
        "condition": "fetchDataQuality",
        "kind": "Condition",
        "passingValue": true,
        "selections": [
          {
            "alias": "dimension",
            "args": (v13/*: any*/),
            "concreteType": null,
            "kind": "LinkedField",
            "name": "node",
            "plural": false,
            "selections": [
              (v15/*: any*/),
              (v14/*: any*/),
              {
                "kind": "TypeDiscriminator",
                "abstractKey": "__isNode"
              },
              (v8/*: any*/)
            ],
            "storageKey": null
          }
        ]
      }
    ]
  },
  "params": {
    "cacheID": "19810791bc6ec966259eb2637e4b9724",
    "id": null,
    "metadata": {},
    "name": "MetricTimeSeriesQuery",
    "operationKind": "query",
    "text": "query MetricTimeSeriesQuery(\n  $embeddingDimensionId: GlobalID!\n  $timeRange: TimeRange!\n  $metricGranularity: Granularity!\n  $countGranularity: Granularity!\n  $fetchDrift: Boolean!\n  $fetchDataQuality: Boolean!\n  $dimensionId: GlobalID!\n) {\n  embedding: node(id: $embeddingDimensionId) {\n    __typename\n    id\n    ... on EmbeddingDimension {\n      euclideanDistanceTimeSeries: driftTimeSeries(metric: euclideanDistance, timeRange: $timeRange, granularity: $metricGranularity) @include(if: $fetchDrift) {\n        data {\n          timestamp\n          value\n        }\n      }\n      trafficTimeSeries: dataQualityTimeSeries(metric: count, timeRange: $timeRange, granularity: $countGranularity) {\n        data {\n          timestamp\n          value\n        }\n      }\n    }\n  }\n  dimension: node(id: $dimensionId) @include(if: $fetchDataQuality) {\n    __typename\n    ... on Dimension {\n      name\n      dataQualityTimeSeries(metric: mean, timeRange: $timeRange, granularity: $metricGranularity) {\n        data {\n          timestamp\n          value\n        }\n      }\n    }\n    __isNode: __typename\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "8373911f50fcffbd57569939f0e20c0c";

export default node;
