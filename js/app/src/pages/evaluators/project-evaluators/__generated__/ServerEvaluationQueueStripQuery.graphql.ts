/**
 * @generated SignedSource<<a6b959e519809edb955edd69088c2ee2>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type EvaluationQueueStatus = "DEGRADED" | "HEALTHY";
export type EvaluationTarget = "SESSION" | "SPAN" | "TRACE";
export type TimeRange = {
  end?: string | null;
  start?: string | null;
};
export type ServerEvaluationQueueStripQuery$variables = {
  lastHour: TimeRange;
};
export type ServerEvaluationQueueStripQuery$data = {
  readonly evaluationQueue: {
    readonly addedPerMinute: number;
    readonly completedPerMinute: number;
    readonly oldestWaitingAt: string | null;
    readonly projects: ReadonlyArray<{
      readonly project: {
        readonly id: string;
        readonly name: string;
      };
      readonly queuedCount: number;
    }>;
    readonly queuedCount: number;
    readonly runningCount: number;
    readonly status: EvaluationQueueStatus;
    readonly targets: ReadonlyArray<{
      readonly evaluationTarget: EvaluationTarget;
      readonly queuedCount: number;
    }>;
  };
  readonly lastHourActivity: {
    readonly lag: {
      readonly p50Seconds: number;
      readonly p95Seconds: number;
      readonly p99Seconds: number;
    } | null;
  };
};
export type ServerEvaluationQueueStripQuery = {
  response: ServerEvaluationQueueStripQuery$data;
  variables: ServerEvaluationQueueStripQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "lastHour"
  }
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "queuedCount",
  "storageKey": null
},
v2 = [
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
        "name": "status",
        "storageKey": null
      },
      (v1/*:: as any*/),
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "runningCount",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "oldestWaitingAt",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "addedPerMinute",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "completedPerMinute",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "EvaluationQueueTarget",
        "kind": "LinkedField",
        "name": "targets",
        "plural": true,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "evaluationTarget",
            "storageKey": null
          },
          (v1/*:: as any*/)
        ],
        "storageKey": null
      },
      {
        "alias": null,
        "args": [
          {
            "kind": "Literal",
            "name": "first",
            "value": 5
          }
        ],
        "concreteType": "EvaluationQueueProject",
        "kind": "LinkedField",
        "name": "projects",
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
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "id",
                "storageKey": null
              },
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
          (v1/*:: as any*/)
        ],
        "storageKey": "projects(first:5)"
      }
    ],
    "storageKey": null
  },
  {
    "alias": "lastHourActivity",
    "args": [
      {
        "kind": "Variable",
        "name": "timeRange",
        "variableName": "lastHour"
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
        "concreteType": "EvaluationLag",
        "kind": "LinkedField",
        "name": "lag",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "p50Seconds",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "p95Seconds",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "p99Seconds",
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
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ServerEvaluationQueueStripQuery",
    "selections": (v2/*:: as any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "ServerEvaluationQueueStripQuery",
    "selections": (v2/*:: as any*/)
  },
  "params": {
    "cacheID": "0dee78573aa16efe6931f1e6e2ad022e",
    "id": null,
    "metadata": {},
    "name": "ServerEvaluationQueueStripQuery",
    "operationKind": "query",
    "text": "query ServerEvaluationQueueStripQuery(\n  $lastHour: TimeRange!\n) {\n  evaluationQueue {\n    status\n    queuedCount\n    runningCount\n    oldestWaitingAt\n    addedPerMinute\n    completedPerMinute\n    targets {\n      evaluationTarget\n      queuedCount\n    }\n    projects(first: 5) {\n      project {\n        id\n        name\n      }\n      queuedCount\n    }\n  }\n  lastHourActivity: evaluationActivity(timeRange: $lastHour) {\n    lag {\n      p50Seconds\n      p95Seconds\n      p99Seconds\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "d4a91a30f08933c39a144a3abcdc06fe";

export default node;
