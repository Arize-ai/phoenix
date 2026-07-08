/**
 * @generated SignedSource<<c13e22286f9ef9d25dd628b803ca4281>>
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
export type SessionsTableSessionCountQuery$variables = {
  filterIoSubstring?: string | null;
  id: string;
  sessionFilterCondition?: string | null;
  timeRange: TimeRange;
};
export type SessionsTableSessionCountQuery$data = {
  readonly project: {
    readonly sessionCount?: number;
  };
};
export type SessionsTableSessionCountQuery = {
  response: SessionsTableSessionCountQuery$data;
  variables: SessionsTableSessionCountQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "filterIoSubstring"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "id"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "sessionFilterCondition"
},
v3 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "timeRange"
},
v4 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
  }
],
v5 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": [
        {
          "kind": "Variable",
          "name": "filterIoSubstring",
          "variableName": "filterIoSubstring"
        },
        {
          "kind": "Variable",
          "name": "sessionFilterCondition",
          "variableName": "sessionFilterCondition"
        },
        {
          "kind": "Variable",
          "name": "timeRange",
          "variableName": "timeRange"
        }
      ],
      "kind": "ScalarField",
      "name": "sessionCount",
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
      (v2/*:: as any*/),
      (v3/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "SessionsTableSessionCountQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v4/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v5/*:: as any*/)
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
      (v1/*:: as any*/),
      (v3/*:: as any*/),
      (v0/*:: as any*/),
      (v2/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "SessionsTableSessionCountQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v4/*:: as any*/),
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
          (v5/*:: as any*/),
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
    "cacheID": "0c5b1658f348d7526a54664cc8eeba90",
    "id": null,
    "metadata": {},
    "name": "SessionsTableSessionCountQuery",
    "operationKind": "query",
    "text": "query SessionsTableSessionCountQuery(\n  $id: ID!\n  $timeRange: TimeRange!\n  $filterIoSubstring: String\n  $sessionFilterCondition: String\n) {\n  project: node(id: $id) {\n    __typename\n    ... on Project {\n      sessionCount(timeRange: $timeRange, filterIoSubstring: $filterIoSubstring, sessionFilterCondition: $sessionFilterCondition)\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "27130c55fa0543b1ce7457c90d62e8d0";

export default node;
