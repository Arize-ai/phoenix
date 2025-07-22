/**
 * @generated SignedSource<<2e7df0997ce80c4622658445a89fb998>>
 * @lightSyntaxTransform
 * @nogrep
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
    readonly topModelsByCost?: {
      readonly costSummaries: ReadonlyArray<{
        readonly completion: {
          readonly cost: number | null;
        };
        readonly prompt: {
          readonly cost: number | null;
        };
        readonly total: {
          readonly cost: number | null;
        };
      }>;
      readonly models: ReadonlyArray<{
        readonly id: string;
        readonly name: string;
      }>;
    };
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
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v3 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "cost",
    "storageKey": null
  }
],
v4 = {
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
      "concreteType": "TopModelsByCost",
      "kind": "LinkedField",
      "name": "topModelsByCost",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "GenerativeModel",
          "kind": "LinkedField",
          "name": "models",
          "plural": true,
          "selections": [
            (v2/*: any*/),
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
        {
          "alias": null,
          "args": null,
          "concreteType": "SpanCostSummary",
          "kind": "LinkedField",
          "name": "costSummaries",
          "plural": true,
          "selections": [
            {
              "alias": null,
              "args": null,
              "concreteType": "CostBreakdown",
              "kind": "LinkedField",
              "name": "prompt",
              "plural": false,
              "selections": (v3/*: any*/),
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "concreteType": "CostBreakdown",
              "kind": "LinkedField",
              "name": "completion",
              "plural": false,
              "selections": (v3/*: any*/),
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "concreteType": "CostBreakdown",
              "kind": "LinkedField",
              "name": "total",
              "plural": false,
              "selections": (v3/*: any*/),
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "TopModelsByCostQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v4/*: any*/)
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "TopModelsByCostQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v1/*: any*/),
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
          (v4/*: any*/),
          (v2/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "fe17116b114a3212c3b182786c827a62",
    "id": null,
    "metadata": {},
    "name": "TopModelsByCostQuery",
    "operationKind": "query",
    "text": "query TopModelsByCostQuery(\n  $projectId: ID!\n  $timeRange: TimeRange!\n) {\n  project: node(id: $projectId) {\n    __typename\n    ... on Project {\n      topModelsByCost(timeRange: $timeRange) {\n        models {\n          id\n          name\n        }\n        costSummaries {\n          prompt {\n            cost\n          }\n          completion {\n            cost\n          }\n          total {\n            cost\n          }\n        }\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "0c48def9d01a9cf39d677fd7a6c0fba6";

export default node;
