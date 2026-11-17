/**
 * @generated SignedSource<<0ce18156fca8f41930bf7e841f759059>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
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
  includeQueueSize: boolean;
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
  readonly " $fragmentSpreads": FragmentRefs<"ServerEvaluationCharts_queueSize">;
};
export type ServerEvaluationChartsQuery = {
  response: ServerEvaluationChartsQuery$data;
  variables: ServerEvaluationChartsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "includeQueueSize"
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
v3 = {
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
v4 = {
  "kind": "Variable",
  "name": "timeBinConfig",
  "variableName": "timeBinConfig"
},
v5 = {
  "kind": "Variable",
  "name": "timeRange",
  "variableName": "timeRange"
},
v6 = [
  (v4/*:: as any*/),
  (v5/*:: as any*/)
],
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "evaluatedCount",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "failedCount",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "cost",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "timestamp",
  "storageKey": null
},
v12 = {
  "alias": null,
  "args": (v6/*:: as any*/),
  "concreteType": "EvaluationActivity",
  "kind": "LinkedField",
  "name": "evaluationActivity",
  "plural": false,
  "selections": [
    (v7/*:: as any*/),
    (v8/*:: as any*/),
    (v9/*:: as any*/),
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
            (v10/*:: as any*/),
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
        (v7/*:: as any*/),
        (v8/*:: as any*/),
        (v9/*:: as any*/),
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
        (v11/*:: as any*/),
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
                (v10/*:: as any*/)
              ],
              "storageKey": null
            },
            (v7/*:: as any*/),
            (v8/*:: as any*/),
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
    "name": "ServerEvaluationChartsQuery",
    "selections": [
      (v3/*:: as any*/),
      (v12/*:: as any*/),
      {
        "kind": "Defer",
        "selections": [
          {
            "args": [
              {
                "kind": "Variable",
                "name": "includeQueueSize",
                "variableName": "includeQueueSize"
              },
              (v4/*:: as any*/),
              (v5/*:: as any*/)
            ],
            "kind": "FragmentSpread",
            "name": "ServerEvaluationCharts_queueSize"
          }
        ]
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v2/*:: as any*/),
      (v1/*:: as any*/),
      (v0/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "ServerEvaluationChartsQuery",
    "selections": [
      (v3/*:: as any*/),
      (v12/*:: as any*/),
      {
        "if": null,
        "kind": "Defer",
        "label": "ServerEvaluationChartsQuery$defer$ServerEvaluationCharts_queueSize_1DeIt4",
        "selections": [
          {
            "condition": "includeQueueSize",
            "kind": "Condition",
            "passingValue": true,
            "selections": [
              {
                "alias": "queueSizeActivity",
                "args": (v6/*:: as any*/),
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
                      (v11/*:: as any*/),
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
            ]
          }
        ]
      }
    ]
  },
  "params": {
    "cacheID": "5468abdd5ae4b8fc1ca7fb05b870fbb9",
    "id": null,
    "metadata": {},
    "name": "ServerEvaluationChartsQuery",
    "operationKind": "query",
    "text": "query ServerEvaluationChartsQuery(\n  $timeRange: TimeRange!\n  $timeBinConfig: TimeBinConfig!\n  $includeQueueSize: Boolean!\n) {\n  evaluationQueue {\n    queuedCount\n  }\n  evaluationActivity(timeRange: $timeRange, timeBinConfig: $timeBinConfig) {\n    evaluatedCount\n    failedCount\n    cost\n    excludesUntracedEvaluators\n    groups {\n      project {\n        id\n        name\n      }\n      evaluatedCount\n      failedCount\n      cost\n      evaluationSeconds\n    }\n    series {\n      timestamp\n      groups {\n        project {\n          id\n        }\n        evaluatedCount\n        failedCount\n        addedCount\n        lagP95Seconds\n      }\n    }\n  }\n  ...ServerEvaluationCharts_queueSize_1DeIt4 @defer(label: \"ServerEvaluationChartsQuery$defer$ServerEvaluationCharts_queueSize_1DeIt4\")\n}\n\nfragment ServerEvaluationCharts_queueSize_1DeIt4 on Query {\n  queueSizeActivity: evaluationActivity(timeRange: $timeRange, timeBinConfig: $timeBinConfig) @include(if: $includeQueueSize) {\n    series {\n      timestamp\n      queueSize\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "2f77126a387b82b6b1fd85bd0aa9c0ae";

export default node;
