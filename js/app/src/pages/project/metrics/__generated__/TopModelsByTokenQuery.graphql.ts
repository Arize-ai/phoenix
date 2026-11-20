/**
 * @generated SignedSource<<7c27be7d3c4fd3e51eaff0fa23d5a687>>
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
export type TopModelsByTokenQuery$variables = {
  projectId: string;
  timeRange: TimeRange;
};
export type TopModelsByTokenQuery$data = {
  readonly project: {
    readonly topModelsByTokenCount?: ReadonlyArray<{
      readonly costDetailSummaryEntries: ReadonlyArray<{
        readonly isPrompt: boolean;
        readonly tokenType: string;
        readonly value: {
          readonly tokens: number | null;
        };
      }>;
      readonly costSummary: {
        readonly completion: {
          readonly tokens: number | null;
        };
        readonly prompt: {
          readonly tokens: number | null;
        };
        readonly total: {
          readonly tokens: number | null;
        };
      };
      readonly modelType: GenerativeModelType;
      readonly name: string;
    }>;
  };
};
export type TopModelsByTokenQuery = {
  response: TopModelsByTokenQuery$data;
  variables: TopModelsByTokenQuery$variables;
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
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "modelType",
  "storageKey": null
},
v6 = [
  {
    "kind": "Variable",
    "name": "projectId",
    "variableName": "projectId"
  },
  (v2/*:: as any*/)
],
v7 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "tokens",
    "storageKey": null
  }
],
v8 = {
  "alias": null,
  "args": (v6/*:: as any*/),
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
      "selections": (v7/*:: as any*/),
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "CostBreakdown",
      "kind": "LinkedField",
      "name": "completion",
      "plural": false,
      "selections": (v7/*:: as any*/),
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "CostBreakdown",
      "kind": "LinkedField",
      "name": "total",
      "plural": false,
      "selections": (v7/*:: as any*/),
      "storageKey": null
    }
  ],
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": (v6/*:: as any*/),
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
      "selections": (v7/*:: as any*/),
      "storageKey": null
    }
  ],
  "storageKey": null
},
v10 = {
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
    "name": "TopModelsByTokenQuery",
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
                "name": "topModelsByTokenCount",
                "plural": true,
                "selections": [
                  (v4/*:: as any*/),
                  (v5/*:: as any*/),
                  (v8/*:: as any*/),
                  (v9/*:: as any*/)
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
    "name": "TopModelsByTokenQuery",
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
                "name": "topModelsByTokenCount",
                "plural": true,
                "selections": [
                  (v4/*:: as any*/),
                  (v5/*:: as any*/),
                  (v8/*:: as any*/),
                  (v9/*:: as any*/),
                  (v10/*:: as any*/)
                ],
                "storageKey": null
              }
            ],
            "type": "Project",
            "abstractKey": null
          },
          (v10/*:: as any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "f589974d992399202e1d71a31acc5a2f",
    "id": null,
    "metadata": {},
    "name": "TopModelsByTokenQuery",
    "operationKind": "query",
    "text": "query TopModelsByTokenQuery(\n  $projectId: ID!\n  $timeRange: TimeRange!\n) {\n  project: node(id: $projectId) {\n    __typename\n    ... on Project {\n      topModelsByTokenCount(timeRange: $timeRange) {\n        name\n        modelType\n        costSummary(projectId: $projectId, timeRange: $timeRange) {\n          prompt {\n            tokens\n          }\n          completion {\n            tokens\n          }\n          total {\n            tokens\n          }\n        }\n        costDetailSummaryEntries(projectId: $projectId, timeRange: $timeRange) {\n          tokenType\n          isPrompt\n          value {\n            tokens\n          }\n        }\n        id\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "59297d0fdd4152e4e91d26fe54c8208a";

export default node;
