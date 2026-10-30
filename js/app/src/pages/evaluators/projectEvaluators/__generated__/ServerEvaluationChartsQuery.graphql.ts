/**
 * @generated SignedSource<<30bb57df09b96c1d0470aa8ceb92abfe>>
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
export type ServerEvaluationChartsQuery$variables = {
  timeBinConfig: TimeBinConfig;
  timeRange: TimeRange;
};
export type ServerEvaluationChartsQuery$data = {
  readonly evaluationActivity: {
    readonly cost: number | null;
    readonly evaluatedCount: number;
    readonly failedCount: number;
    readonly groups: ReadonlyArray<{
      readonly cost: number | null;
      readonly evaluatedCount: number;
      readonly failedCount: number;
      readonly project: {
        readonly id: string;
        readonly name: string;
      };
    }>;
    readonly series: ReadonlyArray<{
      readonly groups: ReadonlyArray<{
        readonly evaluatedCount: number;
        readonly failedCount: number;
        readonly project: {
          readonly id: string;
        };
        readonly queueSize: number;
        readonly queuedCount: number;
      }>;
      readonly timestamp: string;
    }>;
  };
  readonly evaluationQueue: {
    readonly projects: ReadonlyArray<{
      readonly project: {
        readonly id: string;
      };
      readonly queuedCount: number;
    }>;
    readonly queuedCount: number;
    readonly queuedLimit: number;
  };
};
export type ServerEvaluationChartsQuery = {
  response: ServerEvaluationChartsQuery$data;
  variables: ServerEvaluationChartsQuery$variables;
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
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "queuedCount",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "concreteType": "Project",
  "kind": "LinkedField",
  "name": "project",
  "plural": false,
  "selections": [
    (v3/*:: as any*/)
  ],
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "evaluatedCount",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "failedCount",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "cost",
  "storageKey": null
},
v8 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "EvaluationQueue",
    "kind": "LinkedField",
    "name": "evaluationQueue",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "queuedLimit",
        "storageKey": null
      },
      (v2/*:: as any*/),
      {
        "alias": null,
        "args": [
          {
            "kind": "Literal",
            "name": "first",
            "value": 1000
          }
        ],
        "concreteType": "EvaluationQueueProject",
        "kind": "LinkedField",
        "name": "projects",
        "plural": true,
        "selections": [
          (v4/*:: as any*/),
          (v2/*:: as any*/)
        ],
        "storageKey": "projects(first:1000)"
      }
    ],
    "storageKey": null
  },
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
      (v5/*:: as any*/),
      (v6/*:: as any*/),
      (v7/*:: as any*/),
      {
        "alias": null,
        "args": null,
        "concreteType": "EvaluationActivityGroup",
        "kind": "LinkedField",
        "name": "groups",
        "plural": true,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "Project",
            "kind": "LinkedField",
            "name": "project",
            "plural": false,
            "selections": [
              (v3/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "name",
                "storageKey": null
              }
            ],
            "storageKey": null
          },
          (v5/*:: as any*/),
          (v6/*:: as any*/),
          (v7/*:: as any*/)
        ],
        "storageKey": null
      },
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
              (v4/*:: as any*/),
              (v5/*:: as any*/),
              (v6/*:: as any*/),
              (v2/*:: as any*/),
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
];
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v1/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "ServerEvaluationChartsQuery",
    "selections": (v8/*:: as any*/),
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
    "name": "ServerEvaluationChartsQuery",
    "selections": (v8/*:: as any*/)
  },
  "params": {
    "cacheID": "e81de4cf71c05ffc490a55109a177c24",
    "id": null,
    "metadata": {},
    "name": "ServerEvaluationChartsQuery",
    "operationKind": "query",
    "text": "query ServerEvaluationChartsQuery(\n  $timeRange: TimeRange!\n  $timeBinConfig: TimeBinConfig!\n) {\n  evaluationQueue {\n    queuedLimit\n    queuedCount\n    projects(first: 1000) {\n      project {\n        id\n      }\n      queuedCount\n    }\n  }\n  evaluationActivity(timeRange: $timeRange, timeBinConfig: $timeBinConfig) {\n    evaluatedCount\n    failedCount\n    cost\n    groups {\n      project {\n        id\n        name\n      }\n      evaluatedCount\n      failedCount\n      cost\n    }\n    series {\n      timestamp\n      groups {\n        project {\n          id\n        }\n        evaluatedCount\n        failedCount\n        queuedCount\n        queueSize\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "c96fe6cc9baf227ef0482b64c2a4b234";

export default node;
