/**
 * @generated SignedSource<<09986eb46439f3b0e1f47b6b7eca5176>>
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
export type TraceLatencyPercentilesTimeSeriesQuery$variables = {
  projectEvaluatorId?: string | null;
  projectId: string;
  timeBinConfig: TimeBinConfig;
  timeRange: TimeRange;
};
export type TraceLatencyPercentilesTimeSeriesQuery$data = {
  readonly project: {
    readonly traceLatencyMsPercentileTimeSeries?: {
      readonly data: ReadonlyArray<{
        readonly max: number | null;
        readonly p50: number | null;
        readonly p75: number | null;
        readonly p90: number | null;
        readonly p95: number | null;
        readonly p99: number | null;
        readonly p999: number | null;
        readonly timestamp: string;
      }>;
    };
  };
};
export type TraceLatencyPercentilesTimeSeriesQuery = {
  response: TraceLatencyPercentilesTimeSeriesQuery$data;
  variables: TraceLatencyPercentilesTimeSeriesQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "projectEvaluatorId"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "projectId"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "timeBinConfig"
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
    "variableName": "projectId"
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
          "name": "projectEvaluatorId",
          "variableName": "projectEvaluatorId"
        },
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
      "concreteType": "TraceLatencyPercentileTimeSeries",
      "kind": "LinkedField",
      "name": "traceLatencyMsPercentileTimeSeries",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "TraceLatencyMsPercentileTimeSeriesDataPoint",
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
              "name": "p50",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "p75",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "p90",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "p95",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "p99",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "p999",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "max",
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
      (v2/*:: as any*/),
      (v3/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "TraceLatencyPercentilesTimeSeriesQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v4/*:: as any*/),
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
      (v1/*:: as any*/),
      (v3/*:: as any*/),
      (v2/*:: as any*/),
      (v0/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "TraceLatencyPercentilesTimeSeriesQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v4/*:: as any*/),
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
    "cacheID": "774691b6e28221e060760b71e83a06b7",
    "id": null,
    "metadata": {},
    "name": "TraceLatencyPercentilesTimeSeriesQuery",
    "operationKind": "query",
    "text": "query TraceLatencyPercentilesTimeSeriesQuery(\n  $projectId: ID!\n  $timeRange: TimeRange!\n  $timeBinConfig: TimeBinConfig!\n  $projectEvaluatorId: ID\n) {\n  project: node(id: $projectId) {\n    __typename\n    ... on Project {\n      traceLatencyMsPercentileTimeSeries(timeRange: $timeRange, timeBinConfig: $timeBinConfig, projectEvaluatorId: $projectEvaluatorId) {\n        data {\n          timestamp\n          p50\n          p75\n          p90\n          p95\n          p99\n          p999\n          max\n        }\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "f097e1a81381a09c0e51ba0f76bbd85b";

export default node;
