/**
 * @generated SignedSource<<cd728850deda069d73d9420223179bdd>>
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
    readonly excludesUntracedEvaluators: boolean;
    readonly failedCount: number;
    readonly groups: ReadonlyArray<{
      readonly cost: number | null;
      readonly evaluatedCount: number;
      readonly evaluationSeconds: number | null;
      readonly failedCount: number;
      readonly project: {
        readonly id: string;
        readonly name: string;
      };
    }>;
    readonly series: ReadonlyArray<{
      readonly groups: ReadonlyArray<{
        readonly addedCount: number;
        readonly evaluatedCount: number;
        readonly failedCount: number;
        readonly lagP95Seconds: number | null;
        readonly project: {
          readonly id: string;
        };
      }>;
      readonly timestamp: string;
    }>;
  };
  readonly evaluationQueue: {
    readonly queuedCount: number;
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
  "name": "evaluatedCount",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "failedCount",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "cost",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v6 = [
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
        "name": "queuedCount",
        "storageKey": null
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
      (v2/*:: as any*/),
      (v3/*:: as any*/),
      (v4/*:: as any*/),
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "excludesUntracedEvaluators",
        "storageKey": null
      },
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
              (v5/*:: as any*/),
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
          (v2/*:: as any*/),
          (v3/*:: as any*/),
          (v4/*:: as any*/),
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "evaluationSeconds",
            "storageKey": null
          }
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
              {
                "alias": null,
                "args": null,
                "concreteType": "Project",
                "kind": "LinkedField",
                "name": "project",
                "plural": false,
                "selections": [
                  (v5/*:: as any*/)
                ],
                "storageKey": null
              },
              (v2/*:: as any*/),
              (v3/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "addedCount",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "lagP95Seconds",
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
    "selections": (v6/*:: as any*/),
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
    "selections": (v6/*:: as any*/)
  },
  "params": {
    "cacheID": "6b0f73a7d9c3df6401dd7bf538f80e6a",
    "id": null,
    "metadata": {},
    "name": "ServerEvaluationChartsQuery",
    "operationKind": "query",
    "text": "query ServerEvaluationChartsQuery(\n  $timeRange: TimeRange!\n  $timeBinConfig: TimeBinConfig!\n) {\n  evaluationQueue {\n    queuedCount\n  }\n  evaluationActivity(timeRange: $timeRange, timeBinConfig: $timeBinConfig) {\n    evaluatedCount\n    failedCount\n    cost\n    excludesUntracedEvaluators\n    groups {\n      project {\n        id\n        name\n      }\n      evaluatedCount\n      failedCount\n      cost\n      evaluationSeconds\n    }\n    series {\n      timestamp\n      groups {\n        project {\n          id\n        }\n        evaluatedCount\n        failedCount\n        addedCount\n        lagP95Seconds\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "b03c54348cacbcac02f90e4f039b27a4";

export default node;
