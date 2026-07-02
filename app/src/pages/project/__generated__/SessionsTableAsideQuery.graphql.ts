/**
 * @generated SignedSource<<9b8ccbfc5b29e4f9880229b830b76361>>
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
export type SessionsTableAsideQuery$variables = {
  filterIoSubstring?: string | null;
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
  "name": "timeRange"
},
v3 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
  }
],
v4 = {
  "kind": "Variable",
  "name": "filterIoSubstring",
  "variableName": "filterIoSubstring"
},
v5 = {
  "kind": "Variable",
  "name": "timeRange",
  "variableName": "timeRange"
},
v6 = [
  (v4/*: any*/),
  (v5/*: any*/)
],
v7 = {
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
      "args": (v6/*: any*/),
      "kind": "ScalarField",
      "name": "sessionCount",
      "storageKey": null
    },
    {
      "alias": null,
      "args": (v6/*: any*/),
      "kind": "ScalarField",
      "name": "averageSessionDurationMs",
      "storageKey": null
    },
    {
      "alias": null,
      "args": (v6/*: any*/),
      "kind": "ScalarField",
      "name": "averageTracesPerSession",
      "storageKey": null
    },
    {
      "alias": "sessionDurationMsP50",
      "args": [
        (v4/*: any*/),
        {
          "kind": "Literal",
          "name": "probability",
          "value": 0.5
        },
        (v5/*: any*/)
      ],
      "kind": "ScalarField",
      "name": "sessionDurationMsQuantile",
      "storageKey": null
    },
    {
      "alias": "sessionDurationMsP99",
      "args": [
        (v4/*: any*/),
        {
          "kind": "Literal",
          "name": "probability",
          "value": 0.99
        },
        (v5/*: any*/)
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
      (v0/*: any*/),
      (v1/*: any*/),
      (v2/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "SessionsTableAsideQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v3/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v7/*: any*/)
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
      (v1/*: any*/),
      (v2/*: any*/),
      (v0/*: any*/)
    ],
    "kind": "Operation",
    "name": "SessionsTableAsideQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v3/*: any*/),
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
          (v7/*: any*/),
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
    "cacheID": "342f8e3cec6c060baee1de24c4e9a6b8",
    "id": null,
    "metadata": {},
    "name": "SessionsTableAsideQuery",
    "operationKind": "query",
    "text": "query SessionsTableAsideQuery(\n  $id: ID!\n  $timeRange: TimeRange!\n  $filterIoSubstring: String\n) {\n  project: node(id: $id) {\n    __typename\n    ... on Project {\n      name\n      description\n      sessionCount(timeRange: $timeRange, filterIoSubstring: $filterIoSubstring)\n      averageSessionDurationMs(timeRange: $timeRange, filterIoSubstring: $filterIoSubstring)\n      averageTracesPerSession(timeRange: $timeRange, filterIoSubstring: $filterIoSubstring)\n      sessionDurationMsP50: sessionDurationMsQuantile(probability: 0.5, timeRange: $timeRange, filterIoSubstring: $filterIoSubstring)\n      sessionDurationMsP99: sessionDurationMsQuantile(probability: 0.99, timeRange: $timeRange, filterIoSubstring: $filterIoSubstring)\n      sessionAnnotationNames\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "2d143007946e7d7441222f8a4e82bedb";

export default node;
