/**
 * @generated SignedSource<<51ef9a17c768e80fa794b5471d7ade05>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type TimeBinScale = "DAY" | "HOUR" | "MINUTE" | "MONTH" | "WEEK" | "YEAR";
export type TimeRange = {
  end?: string | null;
  start?: string | null;
};
export type TimeBinConfig = {
  scale?: TimeBinScale;
  utcOffsetMinutes?: number;
};
export type TraceTokenCostTimeSeriesQuery$variables = {
  projectId: string;
  timeBinConfig: TimeBinConfig;
  timeRange: TimeRange;
};
export type TraceTokenCostTimeSeriesQuery$data = {
  readonly project: {
    readonly traceTokenCostTimeSeries?: {
      readonly data: ReadonlyArray<{
        readonly completionCost: number | null;
        readonly promptCost: number | null;
        readonly timestamp: string;
        readonly totalCost: number | null;
      }>;
    };
  };
};
export type TraceTokenCostTimeSeriesQuery = {
  response: TraceTokenCostTimeSeriesQuery$data;
  variables: TraceTokenCostTimeSeriesQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "projectId"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "timeBinConfig"
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
    "variableName": "projectId"
  }
],
v4 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": [
        {
          "kind": "Variable",
          "name": "timeBinConfig",
          "variableName": "timeBinConfig"
        },
        {
          "kind": "Variable",
          "name": "timeRange",
          "variableName": "timeRange"
        }
      ],
      "concreteType": "TraceTokenCostTimeSeries",
      "kind": "LinkedField",
      "name": "traceTokenCostTimeSeries",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "TraceTokenCostTimeSeriesDataPoint",
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
              "name": "promptCost",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "completionCost",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "totalCost",
              "storageKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "Project",
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
    "name": "TraceTokenCostTimeSeriesQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v3/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v4/*: any*/)
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
    "name": "TraceTokenCostTimeSeriesQuery",
    "selections": [
      {
        "alias": "project",
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
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "id",
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "7522c293e243611bc4bebfe30c7522ef",
    "id": null,
    "metadata": {},
    "name": "TraceTokenCostTimeSeriesQuery",
    "operationKind": "query",
    "text": "query TraceTokenCostTimeSeriesQuery(\n  $projectId: ID!\n  $timeRange: TimeRange!\n  $timeBinConfig: TimeBinConfig!\n) {\n  project: node(id: $projectId) {\n    __typename\n    ... on Project {\n      traceTokenCostTimeSeries(timeRange: $timeRange, timeBinConfig: $timeBinConfig) {\n        data {\n          timestamp\n          promptCost\n          completionCost\n          totalCost\n        }\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "109edc0430448e11877ced236204dd49";

export default node;
