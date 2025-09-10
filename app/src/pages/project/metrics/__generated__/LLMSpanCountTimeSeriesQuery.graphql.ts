/**
 * @generated SignedSource<<b3cecfe51b85eafa8af3b254238af2d7>>
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
export type LLMSpanCountTimeSeriesQuery$variables = {
  filterCondition: string;
  projectId: string;
  timeBinConfig: TimeBinConfig;
  timeRange: TimeRange;
};
export type LLMSpanCountTimeSeriesQuery$data = {
  readonly project: {
    readonly spanCountTimeSeries?: {
      readonly data: ReadonlyArray<{
        readonly errorCount: number | null;
        readonly okCount: number | null;
        readonly timestamp: string;
        readonly unsetCount: number | null;
      }>;
    };
  };
};
export type LLMSpanCountTimeSeriesQuery = {
  response: LLMSpanCountTimeSeriesQuery$data;
  variables: LLMSpanCountTimeSeriesQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "filterCondition"
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
          "name": "filterCondition",
          "variableName": "filterCondition"
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
      "concreteType": "SpanCountTimeSeries",
      "kind": "LinkedField",
      "name": "spanCountTimeSeries",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "SpanCountTimeSeriesDataPoint",
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
              "name": "okCount",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "errorCount",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "unsetCount",
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
      (v2/*: any*/),
      (v3/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "LLMSpanCountTimeSeriesQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v4/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
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
      (v1/*: any*/),
      (v3/*: any*/),
      (v2/*: any*/),
      (v0/*: any*/)
    ],
    "kind": "Operation",
    "name": "LLMSpanCountTimeSeriesQuery",
    "selections": [
      {
        "alias": "project",
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
    "cacheID": "d53f83979a3c6e1c08999f5b6ac8a3f7",
    "id": null,
    "metadata": {},
    "name": "LLMSpanCountTimeSeriesQuery",
    "operationKind": "query",
    "text": "query LLMSpanCountTimeSeriesQuery(\n  $projectId: ID!\n  $timeRange: TimeRange!\n  $timeBinConfig: TimeBinConfig!\n  $filterCondition: String!\n) {\n  project: node(id: $projectId) {\n    __typename\n    ... on Project {\n      spanCountTimeSeries(timeRange: $timeRange, timeBinConfig: $timeBinConfig, filterCondition: $filterCondition) {\n        data {\n          timestamp\n          okCount\n          errorCount\n          unsetCount\n        }\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "514bda0696087b04a30995ca559b80c1";

export default node;
