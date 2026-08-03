/**
 * @generated SignedSource<<7d1046a31ee781999c6c76ec6415e33d>>
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
export type SessionsTableAsideQuery$variables = {
  filterIoSubstring?: string | null;
  id: string;
  sessionId?: string | null;
  timeRange: TimeRange;
  userId?: string | null;
};
export type SessionsTableAsideQuery$data = {
  readonly project: {
    readonly averageSessionDurationMs?: number | null;
    readonly averageTracesPerSession?: number | null;
    readonly description?: string | null;
    readonly name?: string;
    readonly sessionAnnotationNames?: ReadonlyArray<string>;
    readonly sessionCount?: number;
    readonly sessionDurationMsP50?: number | null;
    readonly sessionDurationMsP99?: number | null;
  };
};
export type SessionsTableAsideQuery = {
  response: SessionsTableAsideQuery$data;
  variables: SessionsTableAsideQuery$variables;
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
  "name": "sessionId"
},
v3 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "timeRange"
},
v4 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "userId"
},
v5 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
  }
],
v6 = {
  "kind": "Variable",
  "name": "filterIoSubstring",
  "variableName": "filterIoSubstring"
},
v7 = {
  "kind": "Variable",
  "name": "sessionId",
  "variableName": "sessionId"
},
v8 = {
  "kind": "Variable",
  "name": "timeRange",
  "variableName": "timeRange"
},
v9 = {
  "kind": "Variable",
  "name": "userId",
  "variableName": "userId"
},
v10 = [
  (v6/*:: as any*/),
  (v7/*:: as any*/),
  (v8/*:: as any*/),
  (v9/*:: as any*/)
],
v11 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "name",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "description",
      "storageKey": null
    },
    {
      "alias": null,
      "args": (v10/*:: as any*/),
      "kind": "ScalarField",
      "name": "sessionCount",
      "storageKey": null
    },
    {
      "alias": null,
      "args": (v10/*:: as any*/),
      "kind": "ScalarField",
      "name": "averageSessionDurationMs",
      "storageKey": null
    },
    {
      "alias": null,
      "args": (v10/*:: as any*/),
      "kind": "ScalarField",
      "name": "averageTracesPerSession",
      "storageKey": null
    },
    {
      "alias": "sessionDurationMsP50",
      "args": [
        (v6/*:: as any*/),
        {
          "kind": "Literal",
          "name": "probability",
          "value": 0.5
        },
        (v7/*:: as any*/),
        (v8/*:: as any*/),
        (v9/*:: as any*/)
      ],
      "kind": "ScalarField",
      "name": "sessionDurationMsQuantile",
      "storageKey": null
    },
    {
      "alias": "sessionDurationMsP99",
      "args": [
        (v6/*:: as any*/),
        {
          "kind": "Literal",
          "name": "probability",
          "value": 0.99
        },
        (v7/*:: as any*/),
        (v8/*:: as any*/),
        (v9/*:: as any*/)
      ],
      "kind": "ScalarField",
      "name": "sessionDurationMsQuantile",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "sessionAnnotationNames",
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
      (v3/*:: as any*/),
      (v4/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "SessionsTableAsideQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v5/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v11/*:: as any*/)
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
      (v2/*:: as any*/),
      (v4/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "SessionsTableAsideQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v5/*:: as any*/),
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
          (v11/*:: as any*/),
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
    "cacheID": "3d447560f0b4833e311fa78c6eb0597e",
    "id": null,
    "metadata": {},
    "name": "SessionsTableAsideQuery",
    "operationKind": "query",
    "text": "query SessionsTableAsideQuery(\n  $id: ID!\n  $timeRange: TimeRange!\n  $filterIoSubstring: String\n  $sessionId: String\n  $userId: String\n) {\n  project: node(id: $id) {\n    __typename\n    ... on Project {\n      name\n      description\n      sessionCount(timeRange: $timeRange, filterIoSubstring: $filterIoSubstring, sessionId: $sessionId, userId: $userId)\n      averageSessionDurationMs(timeRange: $timeRange, filterIoSubstring: $filterIoSubstring, sessionId: $sessionId, userId: $userId)\n      averageTracesPerSession(timeRange: $timeRange, filterIoSubstring: $filterIoSubstring, sessionId: $sessionId, userId: $userId)\n      sessionDurationMsP50: sessionDurationMsQuantile(probability: 0.5, timeRange: $timeRange, filterIoSubstring: $filterIoSubstring, sessionId: $sessionId, userId: $userId)\n      sessionDurationMsP99: sessionDurationMsQuantile(probability: 0.99, timeRange: $timeRange, filterIoSubstring: $filterIoSubstring, sessionId: $sessionId, userId: $userId)\n      sessionAnnotationNames\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "eb8be26ce495bddc8b8d771594243379";

export default node;
