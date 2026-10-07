/**
 * @generated SignedSource<<043b7a141d5e46f385abbd31e95373e6>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type TimeRange = {
  end?: string | null;
  start?: string | null;
};
export type ProjectEvaluatorStatsDailyRatesQuery$variables = {
  projectEvaluatorId: string;
  timeRange: TimeRange;
};
export type ProjectEvaluatorStatsDailyRatesQuery$data = {
  readonly projectEvaluator: {
    readonly failureSummary?: {
      readonly evaluatedCount: number;
      readonly failedCount: number;
    };
  };
};
export type ProjectEvaluatorStatsDailyRatesQuery = {
  response: ProjectEvaluatorStatsDailyRatesQuery$data;
  variables: ProjectEvaluatorStatsDailyRatesQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "projectEvaluatorId"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "timeRange"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "projectEvaluatorId"
  }
],
v2 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": [
        {
          "kind": "Variable",
          "name": "timeRange",
          "variableName": "timeRange"
        }
      ],
      "concreteType": "ProjectEvaluatorFailureSummary",
      "kind": "LinkedField",
      "name": "failureSummary",
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
        }
      ],
      "storageKey": null
    }
  ],
  "type": "ProjectEvaluator",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ProjectEvaluatorStatsDailyRatesQuery",
    "selections": [
      {
        "alias": "projectEvaluator",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*:: as any*/)
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "ProjectEvaluatorStatsDailyRatesQuery",
    "selections": [
      {
        "alias": "projectEvaluator",
        "args": (v1/*:: as any*/),
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
          (v2/*:: as any*/),
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
    "cacheID": "4186073ff647be1848d8294453b34a9f",
    "id": null,
    "metadata": {},
    "name": "ProjectEvaluatorStatsDailyRatesQuery",
    "operationKind": "query",
    "text": "query ProjectEvaluatorStatsDailyRatesQuery(\n  $projectEvaluatorId: ID!\n  $timeRange: TimeRange!\n) {\n  projectEvaluator: node(id: $projectEvaluatorId) {\n    __typename\n    ... on ProjectEvaluator {\n      failureSummary(timeRange: $timeRange) {\n        evaluatedCount\n        failedCount\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "046a9be732e195d097695b54601d6fb8";

export default node;
