/**
 * @generated SignedSource<<6a6698be6c9b0adce8e4431524555501>>
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
export type ServerEvaluationQueueSizeChartQuery$variables = {
  timeBinConfig: TimeBinConfig;
  timeRange: TimeRange;
};
export type ServerEvaluationQueueSizeChartQuery$data = {
  readonly evaluationActivity: {
    readonly series: ReadonlyArray<{
      readonly queueSize: number;
      readonly timestamp: string;
    }>;
  };
};
export type ServerEvaluationQueueSizeChartQuery = {
  response: ServerEvaluationQueueSizeChartQuery$data;
  variables: ServerEvaluationQueueSizeChartQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "timeBinConfig"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "timeRange"
},
v2 = [
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
];
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v1/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "ServerEvaluationQueueSizeChartQuery",
    "selections": (v2/*:: as any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v1/*:: as any*/),
      (v0/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "ServerEvaluationQueueSizeChartQuery",
    "selections": (v2/*:: as any*/)
  },
  "params": {
    "cacheID": "53fd58e7dff6bf6d3117b392221ebfd4",
    "id": null,
    "metadata": {},
    "name": "ServerEvaluationQueueSizeChartQuery",
    "operationKind": "query",
    "text": "query ServerEvaluationQueueSizeChartQuery(\n  $timeRange: TimeRange!\n  $timeBinConfig: TimeBinConfig!\n) {\n  evaluationActivity(timeRange: $timeRange, timeBinConfig: $timeBinConfig) {\n    series {\n      timestamp\n      queueSize\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "474b1d9bcbc62fae6de41a6bc81c26b9";

export default node;
