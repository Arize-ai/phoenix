/**
 * @generated SignedSource<<757b414f9ada09225ab586933b6c9ba1>>
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
export type TopModelsByCostQuery$variables = {
  projectId: string;
  timeRange: TimeRange;
};
export type TopModelsByCostQuery$data = {
  readonly project: {
    readonly topModelsByCost?: ReadonlyArray<{
      readonly costDetailSummaryEntries: ReadonlyArray<{
        readonly isPrompt: boolean;
        readonly tokenType: string;
        readonly value: {
          readonly cost: number | null;
        };
      }>;
      readonly costSummary: {
        readonly completion: {
          readonly cost: number | null;
        };
        readonly prompt: {
          readonly cost: number | null;
        };
        readonly total: {
          readonly cost: number | null;
        };
      };
      readonly name: string;
    }>;
  };
};
export type TopModelsByCostQuery = {
  response: TopModelsByCostQuery$data;
  variables: TopModelsByCostQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "projectId"
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
    "variableName": "projectId"
  }
],
v2 = {
  "kind": "Variable",
  "name": "timeRange",
  "variableName": "timeRange"
},
v3 = [
  (v2/*:: as any*/)
],
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v5 = [
  {
    "kind": "Variable",
    "name": "projectId",
    "variableName": "projectId"
  },
  (v2/*:: as any*/)
],
v6 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "cost",
    "storageKey": null
  }
],
v7 = {
  "alias": null,
  "args": (v5/*:: as any*/),
  "concreteType": "SpanCostSummary",
  "kind": "LinkedField",
  "name": "costSummary",
  "plural": false,
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "CostBreakdown",
      "kind": "LinkedField",
      "name": "prompt",
      "plural": false,
      "selections": (v6/*:: as any*/),
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "CostBreakdown",
      "kind": "LinkedField",
      "name": "completion",
      "plural": false,
      "selections": (v6/*:: as any*/),
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "CostBreakdown",
      "kind": "LinkedField",
      "name": "total",
      "plural": false,
      "selections": (v6/*:: as any*/),
      "storageKey": null
    }
  ],
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": (v5/*:: as any*/),
  "concreteType": "SpanCostDetailSummaryEntry",
  "kind": "LinkedField",
  "name": "costDetailSummaryEntries",
  "plural": true,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "tokenType",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "isPrompt",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "CostBreakdown",
      "kind": "LinkedField",
      "name": "value",
      "plural": false,
      "selections": (v6/*:: as any*/),
      "storageKey": null
    }
  ],
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "TopModelsByCostQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": (v3/*:: as any*/),
                "concreteType": "GenerativeModel",
                "kind": "LinkedField",
                "name": "topModelsByCost",
                "plural": true,
                "selections": [
                  (v4/*:: as any*/),
                  (v7/*:: as any*/),
                  (v8/*:: as any*/)
                ],
                "storageKey": null
              }
            ],
            "type": "Project",
            "abstractKey": null
          }
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
    "name": "TopModelsByCostQuery",
    "selections": [
      {
        "alias": "project",
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
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": (v3/*:: as any*/),
                "concreteType": "GenerativeModel",
                "kind": "LinkedField",
                "name": "topModelsByCost",
                "plural": true,
                "selections": [
                  (v4/*:: as any*/),
                  (v7/*:: as any*/),
                  (v8/*:: as any*/),
                  (v9/*:: as any*/)
                ],
                "storageKey": null
              }
            ],
            "type": "Project",
            "abstractKey": null
          },
          (v9/*:: as any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "2461b23a178ea4043d2111825eae396c",
    "id": null,
    "metadata": {},
    "name": "TopModelsByCostQuery",
    "operationKind": "query",
    "text": "query TopModelsByCostQuery(\n  $projectId: ID!\n  $timeRange: TimeRange!\n) {\n  project: node(id: $projectId) {\n    __typename\n    ... on Project {\n      topModelsByCost(timeRange: $timeRange) {\n        name\n        costSummary(projectId: $projectId, timeRange: $timeRange) {\n          prompt {\n            cost\n          }\n          completion {\n            cost\n          }\n          total {\n            cost\n          }\n        }\n        costDetailSummaryEntries(projectId: $projectId, timeRange: $timeRange) {\n          tokenType\n          isPrompt\n          value {\n            cost\n          }\n        }\n        id\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "bbbc9069dd3e137073ec4869d348c050";

export default node;
