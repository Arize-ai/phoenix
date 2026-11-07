/**
 * @generated SignedSource<<c3b3fc173682532f206baad9e9fc89cc>>
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
  unitsPerBin?: number;
  utcOffsetMinutes?: number;
};
export type EvaluatorQueueSizeChartQuery$variables = {
  projectId: string;
  timeBinConfig: TimeBinConfig;
  timeRange: TimeRange;
};
export type EvaluatorQueueSizeChartQuery$data = {
  readonly project: {
    readonly evaluationActivity?: {
      readonly series: ReadonlyArray<{
        readonly groups: ReadonlyArray<{
          readonly queueSize: number;
        }>;
        readonly timestamp: string;
      }>;
    };
  };
};
export type EvaluatorQueueSizeChartQuery = {
  response: EvaluatorQueueSizeChartQuery$data;
  variables: EvaluatorQueueSizeChartQuery$variables;
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
      "concreteType": "EvaluationActivity",
      "kind": "LinkedField",
      "name": "evaluationActivity",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "EvaluationActivityBin",
          "kind": "LinkedField",
          "name": "series",
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
              "concreteType": "EvaluationActivityBinGroup",
              "kind": "LinkedField",
              "name": "groups",
              "plural": true,
              "selections": [
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "queueSize",
                  "storageKey": null
                }
              ],
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
    "name": "EvaluatorQueueSizeChartQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v3/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v4/*:: as any*/)
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
    "name": "EvaluatorQueueSizeChartQuery",
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
          (v4/*:: as any*/),
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
    "cacheID": "df0a37031453658cd2773be6f569f201",
    "id": null,
    "metadata": {},
    "name": "EvaluatorQueueSizeChartQuery",
    "operationKind": "query",
    "text": "query EvaluatorQueueSizeChartQuery(\n  $projectId: ID!\n  $timeRange: TimeRange!\n  $timeBinConfig: TimeBinConfig!\n) {\n  project: node(id: $projectId) {\n    __typename\n    ... on Project {\n      evaluationActivity(timeRange: $timeRange, timeBinConfig: $timeBinConfig) {\n        series {\n          timestamp\n          groups {\n            queueSize\n          }\n        }\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "83faaef57c4609386f98f6710e98b3ca";

export default node;
