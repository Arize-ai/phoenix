/**
 * @generated SignedSource<<c760a44bda5012d2d41ca21417ba6162>>
 * @lightSyntaxTransform
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
export type TraceTokenCountTimeSeriesQuery$variables = {
  projectId: string;
  timeBinConfig: TimeBinConfig;
  timeRange: TimeRange;
};
export type TraceTokenCountTimeSeriesQuery$data = {
  readonly project: {
    readonly traceTokenCountTimeSeries?: {
      readonly data: ReadonlyArray<{
        readonly completionTokenCount: number | null;
        readonly completionTokenCountDetails: ReadonlyArray<{
          readonly tokenCount: number | null;
          readonly tokenType: string;
        }>;
        readonly promptTokenCount: number | null;
        readonly promptTokenCountDetails: ReadonlyArray<{
          readonly tokenCount: number | null;
          readonly tokenType: string;
        }>;
        readonly timestamp: string;
        readonly totalTokenCount: number | null;
      }>;
    };
  };
};
export type TraceTokenCountTimeSeriesQuery = {
  response: TraceTokenCountTimeSeriesQuery$data;
  variables: TraceTokenCountTimeSeriesQuery$variables;
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
v4 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "tokenType",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "tokenCount",
    "storageKey": null
  }
],
v5 = {
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
      "concreteType": "TraceTokenCountTimeSeries",
      "kind": "LinkedField",
      "name": "traceTokenCountTimeSeries",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "TraceTokenCountTimeSeriesDataPoint",
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
              "name": "promptTokenCount",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "completionTokenCount",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "totalTokenCount",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "concreteType": "TraceTokenCountDetailsTimeSeriesEntry",
              "kind": "LinkedField",
              "name": "promptTokenCountDetails",
              "plural": true,
              "selections": (v4/*:: as any*/),
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "concreteType": "TraceTokenCountDetailsTimeSeriesEntry",
              "kind": "LinkedField",
              "name": "completionTokenCountDetails",
              "plural": true,
              "selections": (v4/*:: as any*/),
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
      (v0/*:: as any*/),
      (v1/*:: as any*/),
      (v2/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "TraceTokenCountTimeSeriesQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v3/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v5/*:: as any*/)
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
      (v0/*:: as any*/),
      (v2/*:: as any*/),
      (v1/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "TraceTokenCountTimeSeriesQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v3/*:: as any*/),
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
          (v5/*:: as any*/),
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
    "cacheID": "271dd9a2039761542883d47969aa23f1",
    "id": null,
    "metadata": {},
    "name": "TraceTokenCountTimeSeriesQuery",
    "operationKind": "query",
    "text": "query TraceTokenCountTimeSeriesQuery(\n  $projectId: ID!\n  $timeRange: TimeRange!\n  $timeBinConfig: TimeBinConfig!\n) {\n  project: node(id: $projectId) {\n    __typename\n    ... on Project {\n      traceTokenCountTimeSeries(timeRange: $timeRange, timeBinConfig: $timeBinConfig) {\n        data {\n          timestamp\n          promptTokenCount\n          completionTokenCount\n          totalTokenCount\n          promptTokenCountDetails {\n            tokenType\n            tokenCount\n          }\n          completionTokenCountDetails {\n            tokenType\n            tokenCount\n          }\n        }\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "e03579d83337bb96055dc138e0477b40";

export default node;
