/**
 * @generated SignedSource<<520153af4d5b251638fe83ed158d203e>>
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
      readonly countsAreLowerBounds: boolean;
      readonly project: {
        readonly id: string;
      };
      readonly queuedCount: number;
    }>;
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
          (v2/*:: as any*/),
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "countsAreLowerBounds",
            "storageKey": null
          }
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
    "cacheID": "f63ab4da4f9fa775bf4280e222aed9fb",
    "id": null,
    "metadata": {},
    "name": "ServerEvaluationChartsQuery",
    "operationKind": "query",
    "text": "query ServerEvaluationChartsQuery(\n  $timeRange: TimeRange!\n  $timeBinConfig: TimeBinConfig!\n) {\n  evaluationQueue {\n    queuedCount\n    projects(first: 1000) {\n      project {\n        id\n      }\n      queuedCount\n      countsAreLowerBounds\n    }\n  }\n  evaluationActivity(timeRange: $timeRange, timeBinConfig: $timeBinConfig) {\n    evaluatedCount\n    failedCount\n    cost\n    groups {\n      project {\n        id\n        name\n      }\n      evaluatedCount\n      failedCount\n      cost\n    }\n    series {\n      timestamp\n      groups {\n        project {\n          id\n        }\n        evaluatedCount\n        failedCount\n        queuedCount\n        queueSize\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "c6133a5c30e17d4c505ca82df9279bc6";

export default node;
