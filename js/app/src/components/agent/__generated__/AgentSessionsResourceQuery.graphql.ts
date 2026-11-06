/**
 * @generated SignedSource<<db27a07453bd83c8c0d55c82abe20a8b>>
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
  readonly " $fragmentSpreads": FragmentRefs<"AgentSessionsResource_sessions">;
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
v1 = {
  "kind": "Variable",
  "name": "first",
  "variableName": "first"
},
v2 = [
  (v1/*:: as any*/),
  {
    "kind": "Literal",
    "name": "viewerOnly",
    "value": true
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "AgentSessionsResourceQuery",
    "selections": [
      {
        "args": [
          (v1/*:: as any*/)
        ],
        "kind": "FragmentSpread",
        "name": "AgentSessionsResource_sessions"
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
        "args": (v2/*:: as any*/),
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
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "id",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "title",
                    "storageKey": null
                  },
                  {
                    "alias": "isTemporary",
                    "args": null,
                    "kind": "ScalarField",
                    "name": "isEphemeral",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "isActive",
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
        "args": (v2/*:: as any*/),
        "filters": [],
        "handle": "connection",
        "key": "AgentSessionsResource_agentSessions",
        "kind": "LinkedHandle",
        "name": "agentSessions"
      }
    ]
  },
  "params": {
    "cacheID": "23ed66a5cc93ad300e5ba670db20cf77",
    "id": null,
    "metadata": {},
    "name": "AgentSessionsResourceQuery",
    "operationKind": "query",
    "text": "query AgentSessionsResourceQuery(\n  $first: Int!\n) {\n  ...AgentSessionsResource_sessions_3ASum4\n}\n\nfragment AgentSessionsResource_sessions_3ASum4 on Query {\n  agentSessions(first: $first, viewerOnly: true) {\n    edges {\n      node {\n        id\n        title\n        ...EditAgentSessionTitleDialog_session\n        isTemporary: isEphemeral\n        isActive\n        createdAt\n        updatedAt\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n\nfragment EditAgentSessionTitleDialog_session on AgentSession {\n  id\n  title\n}\n"
  }
};
})();

(node as any).hash = "ac090fc7cd97a145fbc9e570373e0a43";

export default node;
