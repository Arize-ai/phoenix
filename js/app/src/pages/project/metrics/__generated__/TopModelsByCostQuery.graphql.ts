/**
 * @generated SignedSource<<ee75effa1419bb09bb6387f3f488185d>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type GenerativeModelType = "DECISION" | "EMBEDDING" | "LLM";
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
    readonly costSummary?: {
      readonly total: {
        readonly tokens: number | null;
      };
    };
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
      readonly modelType: GenerativeModelType;
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
  "args": (v3/*:: as any*/),
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
      "name": "total",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "tokens",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "modelType",
  "storageKey": null
},
v7 = [
  {
    "kind": "Variable",
    "name": "projectId",
    "variableName": "projectId"
  },
  (v2/*:: as any*/)
],
v8 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "cost",
    "storageKey": null
  }
],
v9 = {
  "alias": null,
  "args": (v7/*:: as any*/),
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
      "selections": (v8/*:: as any*/),
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "CostBreakdown",
      "kind": "LinkedField",
      "name": "completion",
      "plural": false,
      "selections": (v8/*:: as any*/),
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "CostBreakdown",
      "kind": "LinkedField",
      "name": "total",
      "plural": false,
      "selections": (v8/*:: as any*/),
      "storageKey": null
    }
  ],
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": (v7/*:: as any*/),
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
      "selections": (v8/*:: as any*/),
      "storageKey": null
    }
  ],
  "storageKey": null
},
v11 = {
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
              (v4/*:: as any*/),
              {
                "alias": null,
                "args": (v3/*:: as any*/),
                "concreteType": "GenerativeModel",
                "kind": "LinkedField",
                "name": "topModelsByCost",
                "plural": true,
                "selections": [
                  (v5/*:: as any*/),
                  (v6/*:: as any*/),
                  (v9/*:: as any*/),
                  (v10/*:: as any*/)
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
              (v4/*:: as any*/),
              {
                "alias": null,
                "args": (v3/*:: as any*/),
                "concreteType": "GenerativeModel",
                "kind": "LinkedField",
                "name": "topModelsByCost",
                "plural": true,
                "selections": [
                  (v5/*:: as any*/),
                  (v6/*:: as any*/),
                  (v9/*:: as any*/),
                  (v10/*:: as any*/),
                  (v11/*:: as any*/)
                ],
                "storageKey": null
              }
            ],
            "type": "Project",
            "abstractKey": null
          },
          (v11/*:: as any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "edf30cbe963a9e5930ce097f43fb9fb8",
    "id": null,
    "metadata": {},
    "name": "TopModelsByCostQuery",
    "operationKind": "query",
    "text": "query TopModelsByCostQuery(\n  $projectId: ID!\n  $timeRange: TimeRange!\n) {\n  project: node(id: $projectId) {\n    __typename\n    ... on Project {\n      costSummary(timeRange: $timeRange) {\n        total {\n          tokens\n        }\n      }\n      topModelsByCost(timeRange: $timeRange) {\n        name\n        modelType\n        costSummary(projectId: $projectId, timeRange: $timeRange) {\n          prompt {\n            cost\n          }\n          completion {\n            cost\n          }\n          total {\n            cost\n          }\n        }\n        costDetailSummaryEntries(projectId: $projectId, timeRange: $timeRange) {\n          tokenType\n          isPrompt\n          value {\n            cost\n          }\n        }\n        id\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "cea52b3bc6e019bfa46ce6b771d39cfb";

export default node;
