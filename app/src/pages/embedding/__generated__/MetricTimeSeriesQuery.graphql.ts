/**
 * @generated SignedSource<<5d6bff22c80e8f3c35047a0a9d9448e8>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
export type PerformanceMetric = "accuracyScore";
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
  fetchPerformance: boolean;
  fetchQueryDistance: boolean;
  metricGranularity: Granularity;
  performanceMetric: PerformanceMetric;
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
    readonly retrievalMetricTimeSeries?: {
      readonly data: ReadonlyArray<{
        readonly timestamp: string;
        readonly value: number | null;
      }>;
    };
    readonly trafficTimeSeries?: {
      readonly data: ReadonlyArray<{
        readonly timestamp: string;
        readonly value: number | null;
      }>;
    };
  };
  readonly model: {
    readonly performanceTimeSeries?: {
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
  "name": "fetchPerformance"
},
v6 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "fetchQueryDistance"
},
v7 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "metricGranularity"
},
v8 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "performanceMetric"
},
v9 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "timeRange"
},
v10 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "embeddingDimensionId"
  }
],
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v12 = {
  "kind": "Variable",
  "name": "granularity",
  "variableName": "metricGranularity"
},
v13 = {
  "kind": "Variable",
  "name": "timeRange",
  "variableName": "timeRange"
},
v14 = [
  (v12/*: any*/),
  {
    "kind": "Literal",
    "name": "metric",
    "value": "euclideanDistance"
  },
  (v13/*: any*/)
],
v15 = [
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
v16 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "condition": "fetchDrift",
      "kind": "Condition",
      "passingValue": true,
      "selections": [
        {
          "alias": "euclideanDistanceTimeSeries",
          "args": (v14/*: any*/),
          "concreteType": "DriftTimeSeries",
          "kind": "LinkedField",
          "name": "driftTimeSeries",
          "plural": false,
          "selections": (v15/*: any*/),
          "storageKey": null
        }
      ]
    },
    {
      "condition": "fetchQueryDistance",
      "kind": "Condition",
      "passingValue": true,
      "selections": [
        {
          "alias": null,
          "args": (v14/*: any*/),
          "concreteType": "DriftTimeSeries",
          "kind": "LinkedField",
          "name": "retrievalMetricTimeSeries",
          "plural": false,
          "selections": (v15/*: any*/),
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
        (v13/*: any*/)
      ],
      "concreteType": "DataQualityTimeSeries",
      "kind": "LinkedField",
      "name": "dataQualityTimeSeries",
      "plural": false,
      "selections": (v15/*: any*/),
      "storageKey": null
    }
  ],
  "type": "EmbeddingDimension",
  "abstractKey": null
},
v17 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "dimensionId"
  }
],
v18 = {
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
        (v12/*: any*/),
        {
          "kind": "Literal",
          "name": "metric",
          "value": "mean"
        },
        (v13/*: any*/)
      ],
      "concreteType": "DataQualityTimeSeries",
      "kind": "LinkedField",
      "name": "dataQualityTimeSeries",
      "plural": false,
      "selections": (v15/*: any*/),
      "storageKey": null
    }
  ],
  "type": "Dimension",
  "abstractKey": null
},
v19 = {
  "alias": null,
  "args": null,
  "concreteType": "Model",
  "kind": "LinkedField",
  "name": "model",
  "plural": false,
  "selections": [
    {
      "condition": "fetchPerformance",
      "kind": "Condition",
      "passingValue": true,
      "selections": [
        {
          "alias": null,
          "args": [
            (v12/*: any*/),
            {
              "fields": [
                {
                  "kind": "Variable",
                  "name": "metric",
                  "variableName": "performanceMetric"
                }
              ],
              "kind": "ObjectValue",
              "name": "metric"
            },
            (v13/*: any*/)
          ],
          "concreteType": "PerformanceTimeSeries",
          "kind": "LinkedField",
          "name": "performanceTimeSeries",
          "plural": false,
          "selections": (v15/*: any*/),
          "storageKey": null
        }
      ]
    }
  ],
  "storageKey": null
},
v20 = {
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
      (v6/*: any*/),
      (v7/*: any*/),
      (v8/*: any*/),
      (v9/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "MetricTimeSeriesQuery",
    "selections": [
      {
        "alias": "embedding",
        "args": (v10/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v11/*: any*/),
          (v16/*: any*/)
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
            "args": (v17/*: any*/),
            "concreteType": null,
            "kind": "LinkedField",
            "name": "node",
            "plural": false,
            "selections": [
              (v18/*: any*/)
            ],
            "storageKey": null
          }
        ]
      },
      (v19/*: any*/)
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v2/*: any*/),
      (v9/*: any*/),
      (v7/*: any*/),
      (v0/*: any*/),
      (v4/*: any*/),
      (v6/*: any*/),
      (v3/*: any*/),
      (v1/*: any*/),
      (v5/*: any*/),
      (v8/*: any*/)
    ],
    "kind": "Operation",
    "name": "MetricTimeSeriesQuery",
    "selections": [
      {
        "alias": "embedding",
        "args": (v10/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v20/*: any*/),
          (v11/*: any*/),
          (v16/*: any*/)
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
            "args": (v17/*: any*/),
            "concreteType": null,
            "kind": "LinkedField",
            "name": "node",
            "plural": false,
            "selections": [
              (v20/*: any*/),
              (v18/*: any*/),
              {
                "kind": "TypeDiscriminator",
                "abstractKey": "__isNode"
              },
              (v11/*: any*/)
            ],
            "storageKey": null
          }
        ]
      },
      (v19/*: any*/)
    ]
  },
  "params": {
    "cacheID": "a68a8204bf7fdd13e6915b338d4b5497",
    "id": null,
    "metadata": {},
    "name": "MetricTimeSeriesQuery",
    "operationKind": "query",
    "text": "query MetricTimeSeriesQuery(\n  $embeddingDimensionId: GlobalID!\n  $timeRange: TimeRange!\n  $metricGranularity: Granularity!\n  $countGranularity: Granularity!\n  $fetchDrift: Boolean!\n  $fetchQueryDistance: Boolean!\n  $fetchDataQuality: Boolean!\n  $dimensionId: GlobalID!\n  $fetchPerformance: Boolean!\n  $performanceMetric: PerformanceMetric!\n) {\n  embedding: node(id: $embeddingDimensionId) {\n    __typename\n    id\n    ... on EmbeddingDimension {\n      euclideanDistanceTimeSeries: driftTimeSeries(metric: euclideanDistance, timeRange: $timeRange, granularity: $metricGranularity) @include(if: $fetchDrift) {\n        data {\n          timestamp\n          value\n        }\n      }\n      retrievalMetricTimeSeries(metric: euclideanDistance, timeRange: $timeRange, granularity: $metricGranularity) @include(if: $fetchQueryDistance) {\n        data {\n          timestamp\n          value\n        }\n      }\n      trafficTimeSeries: dataQualityTimeSeries(metric: count, timeRange: $timeRange, granularity: $countGranularity) {\n        data {\n          timestamp\n          value\n        }\n      }\n    }\n  }\n  dimension: node(id: $dimensionId) @include(if: $fetchDataQuality) {\n    __typename\n    ... on Dimension {\n      name\n      dataQualityTimeSeries(metric: mean, timeRange: $timeRange, granularity: $metricGranularity) {\n        data {\n          timestamp\n          value\n        }\n      }\n    }\n    __isNode: __typename\n    id\n  }\n  model {\n    performanceTimeSeries(metric: {metric: $performanceMetric}, timeRange: $timeRange, granularity: $metricGranularity) @include(if: $fetchPerformance) {\n      data {\n        timestamp\n        value\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "f31abad2141a5a1c461ef2a598ffa4f3";

export default node;
