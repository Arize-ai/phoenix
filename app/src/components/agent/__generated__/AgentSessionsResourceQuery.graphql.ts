/**
 * @generated SignedSource<<7ead5780ccb000a3216df7f9aab5d9ac>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type AgentSessionsResourceQuery$variables = {
  first: number;
};
export type AgentSessionsResourceQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"AgentSessionsResource_sessions" | "SettingsAgentSessionsCard_sessions">;
};
export type AgentSessionsResourceQuery = {
  response: AgentSessionsResourceQuery$data;
  variables: AgentSessionsResourceQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "first"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "first",
    "variableName": "first"
  }
],
v2 = {
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
    "name": "AgentSessionsResourceQuery",
    "selections": [
      {
        "args": (v1/*:: as any*/),
        "kind": "FragmentSpread",
        "name": "AgentSessionsResource_sessions"
      },
      {
        "args": (v1/*:: as any*/),
        "kind": "FragmentSpread",
        "name": "SettingsAgentSessionsCard_sessions"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "AgentSessionsResourceQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "AgentSessionConnection",
        "kind": "LinkedField",
        "name": "agentSessions",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "AgentSessionEdge",
            "kind": "LinkedField",
            "name": "edges",
            "plural": true,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "AgentSession",
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  (v2/*:: as any*/),
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "title",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "isTemporary",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "createdAt",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "updatedAt",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "__typename",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "User",
                    "kind": "LinkedField",
                    "name": "user",
                    "plural": false,
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "username",
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "profilePictureUrl",
                        "storageKey": null
                      },
                      (v2/*:: as any*/)
                    ],
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "firstInput",
                    "storageKey": null
                  }
                ],
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "cursor",
                "storageKey": null
              }
            ],
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "concreteType": "PageInfo",
            "kind": "LinkedField",
            "name": "pageInfo",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "endCursor",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "hasNextPage",
                "storageKey": null
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      },
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "filters": null,
        "handle": "connection",
        "key": "AgentSessionsResource_agentSessions",
        "kind": "LinkedHandle",
        "name": "agentSessions"
      },
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "filters": null,
        "handle": "connection",
        "key": "SettingsAgentSessionsCard_agentSessions",
        "kind": "LinkedHandle",
        "name": "agentSessions"
      }
    ]
  },
  "params": {
    "cacheID": "4da327fc99ed86f8840d74314bcd6250",
    "id": null,
    "metadata": {},
    "name": "AgentSessionsResourceQuery",
    "operationKind": "query",
    "text": "query AgentSessionsResourceQuery(\n  $first: Int!\n) {\n  ...AgentSessionsResource_sessions_3ASum4\n  ...SettingsAgentSessionsCard_sessions_3ASum4\n}\n\nfragment AgentSessionsResource_sessions_3ASum4 on Query {\n  agentSessions(first: $first) {\n    edges {\n      node {\n        id\n        title\n        isTemporary\n        createdAt\n        updatedAt\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n\nfragment SettingsAgentSessionsCard_sessions_3ASum4 on Query {\n  agentSessions(first: $first) {\n    edges {\n      node {\n        id\n        title\n        user {\n          username\n          profilePictureUrl\n          id\n        }\n        firstInput\n        createdAt\n        updatedAt\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "5eab824b5f213c3560d23fd28eacc731";

export default node;
