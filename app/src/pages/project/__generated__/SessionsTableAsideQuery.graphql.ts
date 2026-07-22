/**
 * @generated SignedSource<<6eb513d36ee6bc67ea1636564427e9e7>>
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
v4 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
  }
],
v5 = {
  "kind": "Variable",
  "name": "filterIoSubstring",
  "variableName": "filterIoSubstring"
},
v6 = {
  "kind": "Variable",
  "name": "sessionId",
  "variableName": "sessionId"
},
v7 = {
  "kind": "Variable",
  "name": "timeRange",
  "variableName": "timeRange"
},
v8 = [
  (v5/*:: as any*/),
  (v6/*:: as any*/),
  (v7/*:: as any*/)
],
v9 = {
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
      "args": (v8/*:: as any*/),
      "kind": "ScalarField",
      "name": "sessionCount",
      "storageKey": null
    },
    {
      "alias": null,
      "args": (v8/*:: as any*/),
      "kind": "ScalarField",
      "name": "averageSessionDurationMs",
      "storageKey": null
    },
    {
      "alias": null,
      "args": (v8/*:: as any*/),
      "kind": "ScalarField",
      "name": "averageTracesPerSession",
      "storageKey": null
    },
    {
      "alias": "sessionDurationMsP50",
      "args": [
        (v5/*:: as any*/),
        {
          "kind": "Literal",
          "name": "probability",
          "value": 0.5
        },
        (v6/*:: as any*/),
        (v7/*:: as any*/)
      ],
      "kind": "ScalarField",
      "name": "sessionDurationMsQuantile",
      "storageKey": null
    },
    {
      "alias": "sessionDurationMsP99",
      "args": [
        (v5/*:: as any*/),
        {
          "kind": "Literal",
          "name": "probability",
          "value": 0.99
        },
        (v6/*:: as any*/),
        (v7/*:: as any*/)
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
      (v3/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "SessionsTableAsideQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v4/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v9/*:: as any*/)
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
    "name": "SessionsTableAsideQuery",
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
          (v9/*:: as any*/),
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
    "cacheID": "271432fa765dad968dfacd96dad900d6",
    "id": null,
    "metadata": {},
    "name": "SessionsTableAsideQuery",
    "operationKind": "query",
    "text": "query SessionsTableAsideQuery(\n  $id: ID!\n  $timeRange: TimeRange!\n  $filterIoSubstring: String\n  $sessionId: String\n) {\n  project: node(id: $id) {\n    __typename\n    ... on Project {\n      name\n      description\n      sessionCount(timeRange: $timeRange, filterIoSubstring: $filterIoSubstring, sessionId: $sessionId)\n      averageSessionDurationMs(timeRange: $timeRange, filterIoSubstring: $filterIoSubstring, sessionId: $sessionId)\n      averageTracesPerSession(timeRange: $timeRange, filterIoSubstring: $filterIoSubstring, sessionId: $sessionId)\n      sessionDurationMsP50: sessionDurationMsQuantile(probability: 0.5, timeRange: $timeRange, filterIoSubstring: $filterIoSubstring, sessionId: $sessionId)\n      sessionDurationMsP99: sessionDurationMsQuantile(probability: 0.99, timeRange: $timeRange, filterIoSubstring: $filterIoSubstring, sessionId: $sessionId)\n      sessionAnnotationNames\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "67d25925d174621807b12661e70110e6";

export default node;
