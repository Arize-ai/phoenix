/**
 * @generated SignedSource<<83529195af188de6b4db60e75d127772>>
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
export type EvaluatorActivityChartsQuery$variables = {
  projectId: string;
  timeBinConfig: TimeBinConfig;
  timeRange: TimeRange;
};
export type EvaluatorActivityChartsQuery$data = {
  readonly project: {
    readonly evaluationActivity?: {
      readonly groups: ReadonlyArray<{
        readonly cost: number | null;
        readonly evaluatedCount: number;
        readonly failedCount: number;
        readonly projectEvaluator: {
          readonly id: string;
          readonly name: string;
        } | null;
      }>;
      readonly series: ReadonlyArray<{
        readonly groups: ReadonlyArray<{
          readonly cost: number | null;
          readonly evaluatedCount: number;
          readonly failedCount: number;
          readonly lagP95Seconds: number | null;
          readonly projectEvaluator: {
            readonly id: string;
          } | null;
          readonly queueSize: number;
        }>;
        readonly timestamp: string;
      }>;
    };
  };
};
export type EvaluatorActivityChartsQuery = {
  response: EvaluatorActivityChartsQuery$data;
  variables: EvaluatorActivityChartsQuery$variables;
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
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
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
v8 = {
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
          "concreteType": "EvaluationActivityGroup",
          "kind": "LinkedField",
          "name": "groups",
          "plural": true,
          "selections": [
            {
              "alias": null,
              "args": null,
              "concreteType": "ProjectEvaluator",
              "kind": "LinkedField",
              "name": "projectEvaluator",
              "plural": false,
              "selections": [
                (v4/*:: as any*/),
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
                {
                  "alias": null,
                  "args": null,
                  "concreteType": "ProjectEvaluator",
                  "kind": "LinkedField",
                  "name": "projectEvaluator",
                  "plural": false,
                  "selections": [
                    (v4/*:: as any*/)
                  ],
                  "storageKey": null
                },
                (v5/*:: as any*/),
                (v6/*:: as any*/),
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "lagP95Seconds",
                  "storageKey": null
                },
                (v7/*:: as any*/),
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
    "name": "EvaluatorActivityChartsQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v3/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v8/*:: as any*/)
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
    "name": "EvaluatorActivityChartsQuery",
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
          (v8/*:: as any*/),
          (v4/*:: as any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "811649420a1a4889626818fa066d8055",
    "id": null,
    "metadata": {},
    "name": "EvaluatorActivityChartsQuery",
    "operationKind": "query",
    "text": "query EvaluatorActivityChartsQuery(\n  $projectId: ID!\n  $timeRange: TimeRange!\n  $timeBinConfig: TimeBinConfig!\n) {\n  project: node(id: $projectId) {\n    __typename\n    ... on Project {\n      evaluationActivity(timeRange: $timeRange, timeBinConfig: $timeBinConfig) {\n        groups {\n          projectEvaluator {\n            id\n            name\n          }\n          evaluatedCount\n          failedCount\n          cost\n        }\n        series {\n          timestamp\n          groups {\n            projectEvaluator {\n              id\n            }\n            evaluatedCount\n            failedCount\n            lagP95Seconds\n            cost\n            queueSize\n          }\n        }\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "38684bba7e0ddedc12269a5bbed38892";

export default node;
