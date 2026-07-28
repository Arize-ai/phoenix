/**
 * @generated SignedSource<<bc5a3f8eeff5e42a2ae7e484f62eb3d7>>
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
  id: string;
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
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
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
    "variableName": "id"
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
      "args": (v3/*:: as any*/),
      "kind": "ScalarField",
      "name": "sessionCount",
      "storageKey": null
    },
    {
      "alias": null,
      "args": (v3/*:: as any*/),
      "kind": "ScalarField",
      "name": "averageSessionDurationMs",
      "storageKey": null
    },
    {
      "alias": null,
      "args": (v3/*:: as any*/),
      "kind": "ScalarField",
      "name": "averageTracesPerSession",
      "storageKey": null
    },
    {
      "alias": "sessionDurationMsP50",
      "args": [
        {
          "kind": "Literal",
          "name": "probability",
          "value": 0.5
        },
        (v2/*:: as any*/)
      ],
      "kind": "ScalarField",
      "name": "sessionDurationMsQuantile",
      "storageKey": null
    },
    {
      "alias": "sessionDurationMsP99",
      "args": [
        {
          "kind": "Literal",
          "name": "probability",
          "value": 0.99
        },
        (v2/*:: as any*/)
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
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "SessionsTableAsideQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v4/*:: as any*/)
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
    "name": "SessionsTableAsideQuery",
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
          (v4/*:: as any*/),
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
    "cacheID": "e2d22b0d732aeed847eec9956794c77a",
    "id": null,
    "metadata": {},
    "name": "SessionsTableAsideQuery",
    "operationKind": "query",
    "text": "query SessionsTableAsideQuery(\n  $id: ID!\n  $timeRange: TimeRange!\n) {\n  project: node(id: $id) {\n    __typename\n    ... on Project {\n      name\n      description\n      sessionCount(timeRange: $timeRange)\n      averageSessionDurationMs(timeRange: $timeRange)\n      averageTracesPerSession(timeRange: $timeRange)\n      sessionDurationMsP50: sessionDurationMsQuantile(probability: 0.5, timeRange: $timeRange)\n      sessionDurationMsP99: sessionDurationMsQuantile(probability: 0.99, timeRange: $timeRange)\n      sessionAnnotationNames\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "517e736e8152d1032dcb1e6dd163b4f0";

export default node;
