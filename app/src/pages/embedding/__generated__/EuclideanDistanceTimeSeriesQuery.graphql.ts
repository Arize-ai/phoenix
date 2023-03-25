/**
 * @generated SignedSource<<eac64f595141789775ee45e65c86560d>>
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
export type EuclideanDistanceTimeSeriesQuery$variables = {
  countGranularity: Granularity;
  driftGranularity: Granularity;
  embeddingDimensionId: string;
  timeRange: TimeRange;
};
export type EuclideanDistanceTimeSeriesQuery$data = {
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
export type EuclideanDistanceTimeSeriesQuery = {
  response: EuclideanDistanceTimeSeriesQuery$data;
  variables: EuclideanDistanceTimeSeriesQuery$variables;
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
  "name": "driftGranularity"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "embeddingDimensionId"
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
    "variableName": "embeddingDimensionId"
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
      "alias": "euclideanDistanceTimeSeries",
      "args": [
        {
          "kind": "Variable",
          "name": "granularity",
          "variableName": "driftGranularity"
        },
        {
          "kind": "Literal",
          "name": "metric",
          "value": "euclideanDistance"
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
  "type": "EmbeddingDimension",
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
    "name": "EuclideanDistanceTimeSeriesQuery",
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
      (v2/*: any*/),
      (v3/*: any*/),
      (v1/*: any*/),
      (v0/*: any*/)
    ],
    "kind": "Operation",
    "name": "EuclideanDistanceTimeSeriesQuery",
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
    "cacheID": "6b43e153114a0f69e40ab20edb95e6b1",
    "id": null,
    "metadata": {},
    "name": "EuclideanDistanceTimeSeriesQuery",
    "operationKind": "query",
    "text": "query EuclideanDistanceTimeSeriesQuery(\n  $embeddingDimensionId: GlobalID!\n  $timeRange: TimeRange!\n  $driftGranularity: Granularity!\n  $countGranularity: Granularity!\n) {\n  embedding: node(id: $embeddingDimensionId) {\n    __typename\n    id\n    ... on EmbeddingDimension {\n      euclideanDistanceTimeSeries: driftTimeSeries(metric: euclideanDistance, timeRange: $timeRange, granularity: $driftGranularity) {\n        data {\n          timestamp\n          value\n        }\n      }\n      trafficTimeSeries: dataQualityTimeSeries(metric: count, timeRange: $timeRange, granularity: $countGranularity) {\n        data {\n          timestamp\n          value\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "7c2a5644a27632fee91306aa800a317e";

export default node;
