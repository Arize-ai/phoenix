/**
 * @generated SignedSource<<eb2941ad415106216f0aa8649665b85d>>
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
export type projectPageContextRecentSessionsQuery$variables = {
  id: string;
  timeRange?: TimeRange | null;
};
export type projectPageContextRecentSessionsQuery$data = {
  readonly node: {
    readonly __typename: "Project";
    readonly id: string;
    readonly name: string;
    readonly sessions: {
      readonly edges: ReadonlyArray<{
        readonly node: {
          readonly endTime: string;
          readonly id: string;
          readonly numTraces: number;
          readonly sessionId: string;
          readonly startTime: string;
        };
      }>;
    };
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  };
};
export type projectPageContextRecentSessionsQuery = {
  response: projectPageContextRecentSessionsQuery$data;
  variables: projectPageContextRecentSessionsQuery$variables;
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
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": [
    {
      "kind": "Literal",
      "name": "first",
      "value": 5
    },
    {
      "kind": "Literal",
      "name": "sort",
      "value": {
        "col": "startTime",
        "dir": "desc"
      }
    },
    {
      "kind": "Variable",
      "name": "timeRange",
      "variableName": "timeRange"
    }
  ],
  "concreteType": "ProjectSessionConnection",
  "kind": "LinkedField",
  "name": "sessions",
  "plural": false,
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "ProjectSessionEdge",
      "kind": "LinkedField",
      "name": "edges",
      "plural": true,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "ProjectSession",
          "kind": "LinkedField",
          "name": "node",
          "plural": false,
          "selections": [
            (v3/*: any*/),
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "sessionId",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "startTime",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "endTime",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "numTraces",
              "storageKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "projectPageContextRecentSessionsQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v3/*: any*/),
              (v4/*: any*/),
              (v5/*: any*/)
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "projectPageContextRecentSessionsQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          (v3/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v4/*: any*/),
              (v5/*: any*/)
            ],
            "type": "Project",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "d98cb4021df0875ba72dc59cca34622e",
    "id": null,
    "metadata": {},
    "name": "projectPageContextRecentSessionsQuery",
    "operationKind": "query",
    "text": "query projectPageContextRecentSessionsQuery(\n  $id: ID!\n  $timeRange: TimeRange\n) {\n  node(id: $id) {\n    __typename\n    ... on Project {\n      id\n      name\n      sessions(first: 5, sort: {col: startTime, dir: desc}, timeRange: $timeRange) {\n        edges {\n          node {\n            id\n            sessionId\n            startTime\n            endTime\n            numTraces\n          }\n        }\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "7c03a56c38962844a65938690ff91192";

export default node;
