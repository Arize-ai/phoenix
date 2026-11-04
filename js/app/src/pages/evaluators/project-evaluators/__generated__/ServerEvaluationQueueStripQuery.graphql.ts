/**
 * @generated SignedSource<<436e3242192a699c730446f3abf715e2>>
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
  timeRange: TimeRange;
};
export type ServerEvaluationQueueStripQuery$data = {
  readonly evaluationQueue: {
    readonly atCapacity: boolean;
    readonly evaluationsPerMinute: number;
    readonly oldestQueuedAt: string | null;
    readonly projects: ReadonlyArray<{
      readonly project: {
        readonly id: string;
        readonly name: string;
      };
      readonly queuedCount: number;
    }>;
    readonly queuedCount: number;
    readonly queuedLimit: number;
    readonly queuedPerMinute: number;
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
  readonly rangeActivity: {
    readonly cost: number | null;
    readonly evaluatedCount: number;
    readonly failedCount: number;
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
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "timeRange"
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
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "atCapacity",
        "storageKey": null
      },
      (v1/*:: as any*/),
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "queuedLimit",
        "storageKey": null
      },
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
        "name": "oldestQueuedAt",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "queuedPerMinute",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "evaluationsPerMinute",
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
  },
  {
    "alias": "rangeActivity",
    "args": [
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
        "kind": "ScalarField",
        "name": "evaluatedCount",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "failedCount",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "cost",
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
    "cacheID": "8efff75f481d5ea990ffeafd8a505d3e",
    "id": null,
    "metadata": {},
    "name": "ServerEvaluationQueueStripQuery",
    "operationKind": "query",
    "text": "query ServerEvaluationQueueStripQuery(\n  $lastHour: TimeRange!\n  $timeRange: TimeRange!\n) {\n  evaluationQueue {\n    status\n    atCapacity\n    queuedCount\n    queuedLimit\n    runningCount\n    oldestQueuedAt\n    queuedPerMinute\n    evaluationsPerMinute\n    targets {\n      evaluationTarget\n      queuedCount\n    }\n    projects(first: 5) {\n      project {\n        id\n        name\n      }\n      queuedCount\n    }\n  }\n  lastHourActivity: evaluationActivity(timeRange: $lastHour) {\n    lag {\n      p50Seconds\n      p95Seconds\n      p99Seconds\n    }\n  }\n  rangeActivity: evaluationActivity(timeRange: $timeRange) {\n    evaluatedCount\n    failedCount\n    cost\n  }\n}\n"
  }
};
})();

(node as any).hash = "8e77445255749472bf52f8783d2ef7bb";

export default node;
