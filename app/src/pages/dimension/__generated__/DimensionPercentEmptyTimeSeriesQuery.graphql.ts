/**
 * @generated SignedSource<<1d683f52169d732940957f769107c0dc>>
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
export type DimensionPercentEmptyTimeSeriesQuery$variables = {
  dimensionId: string;
  granularity: Granularity;
  timeRange: TimeRange;
};
export type DimensionPercentEmptyTimeSeriesQuery$data = {
  readonly embedding: {
    readonly id: string;
    readonly percentEmptyTimeSeries?: {
      readonly data: ReadonlyArray<{
        readonly timestamp: string;
        readonly value: number | null;
      }>;
    };
  };
};
export type DimensionPercentEmptyTimeSeriesQuery = {
  response: DimensionPercentEmptyTimeSeriesQuery$data;
  variables: DimensionPercentEmptyTimeSeriesQuery$variables;
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
      "alias": "percentEmptyTimeSeries",
      "args": [
        {
          "kind": "Variable",
          "name": "granularity",
          "variableName": "granularity"
        },
        {
          "kind": "Literal",
          "name": "metric",
          "value": "percentEmpty"
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
    "name": "DimensionPercentEmptyTimeSeriesQuery",
    "selections": [
      {
        "alias": "embedding",
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
    "name": "DimensionPercentEmptyTimeSeriesQuery",
    "selections": [
      {
        "alias": "embedding",
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
    "cacheID": "85842391b76ccca79e3b6f506fb1d78d",
    "id": null,
    "metadata": {},
    "name": "DimensionPercentEmptyTimeSeriesQuery",
    "operationKind": "query",
    "text": "query DimensionPercentEmptyTimeSeriesQuery(\n  $dimensionId: ID!\n  $timeRange: TimeRange!\n  $granularity: Granularity!\n) {\n  embedding: node(id: $dimensionId) {\n    __typename\n    id\n    ... on Dimension {\n      percentEmptyTimeSeries: dataQualityTimeSeries(metric: percentEmpty, timeRange: $timeRange, granularity: $granularity) {\n        data {\n          timestamp\n          value\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "c04e7d788249ceb6f9f7a9ff50a28efd";

export default node;
