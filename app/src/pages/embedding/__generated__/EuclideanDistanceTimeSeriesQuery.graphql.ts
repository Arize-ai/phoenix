/**
 * @generated SignedSource<<800d881a6741bcbb6d567317ff155661>>
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
export type EuclideanDistanceTimeSeriesQuery$variables = {
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
    } | null;
    readonly id: string;
  };
};
export type EuclideanDistanceTimeSeriesQuery = {
  response: EuclideanDistanceTimeSeriesQuery$data;
  variables: EuclideanDistanceTimeSeriesQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "embeddingDimensionId"
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
    "variableName": "embeddingDimensionId"
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
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": "euclideanDistanceTimeSeries",
      "args": [
        {
          "kind": "Literal",
          "name": "metric",
          "value": "euclideanDistance"
        },
        {
          "kind": "Variable",
          "name": "timeRange",
          "variableName": "timeRange"
        }
      ],
      "concreteType": "DriftTimeSeries",
      "kind": "LinkedField",
      "name": "driftTimeSeries",
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
  "type": "EmbeddingDimension",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "EuclideanDistanceTimeSeriesQuery",
    "selections": [
      {
        "alias": "embedding",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          (v3/*: any*/)
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
    "name": "EuclideanDistanceTimeSeriesQuery",
    "selections": [
      {
        "alias": "embedding",
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
          (v2/*: any*/),
          (v3/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "7cb0ebbb8c7e16add1ea091b859f664e",
    "id": null,
    "metadata": {},
    "name": "EuclideanDistanceTimeSeriesQuery",
    "operationKind": "query",
    "text": "query EuclideanDistanceTimeSeriesQuery(\n  $embeddingDimensionId: GlobalID!\n  $timeRange: TimeRange!\n) {\n  embedding: node(id: $embeddingDimensionId) {\n    __typename\n    id\n    ... on EmbeddingDimension {\n      euclideanDistanceTimeSeries: driftTimeSeries(metric: euclideanDistance, timeRange: $timeRange) {\n        data {\n          timestamp\n          value\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "6aed47f21e902103c4d77bdacad96bd4";

export default node;
