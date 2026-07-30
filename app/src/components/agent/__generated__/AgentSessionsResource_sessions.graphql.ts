/**
 * @generated SignedSource<<05f2cb9ce0229829d34661fd8e7bb974>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type AgentSessionsResource_sessions$data = {
  readonly agentSessions: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly createdAt: string;
        readonly id: string;
        readonly isTemporary: boolean;
        readonly title: string;
        readonly updatedAt: string;
        readonly " $fragmentSpreads": FragmentRefs<"EditAgentSessionTitleDialog_session">;
      };
    }>;
  };
  readonly " $fragmentType": "AgentSessionsResource_sessions";
};
export type AgentSessionsResource_sessions$key = {
  readonly " $data"?: AgentSessionsResource_sessions$data;
  readonly " $fragmentSpreads": FragmentRefs<"AgentSessionsResource_sessions">;
};

import AgentSessionsResourcePaginationQuery_graphql from './AgentSessionsResourcePaginationQuery.graphql';

const node: ReaderFragment = (function(){
var v0 = [
  "agentSessions"
];
return {
  "argumentDefinitions": [
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "after"
    },
    {
      "defaultValue": 20,
      "kind": "LocalArgument",
      "name": "first"
    }
  ],
  "kind": "Fragment",
  "metadata": {
    "connection": [
      {
        "count": "first",
        "cursor": "after",
        "direction": "forward",
        "path": (v0/*:: as any*/)
      }
    ],
    "refetch": {
      "connection": {
        "forward": {
          "count": "first",
          "cursor": "after"
        },
        "backward": null,
        "path": (v0/*:: as any*/)
      },
      "fragmentPathInResult": [],
      "operation": AgentSessionsResourcePaginationQuery_graphql
    }
  },
  "name": "AgentSessionsResource_sessions",
  "selections": [
    {
      "alias": "agentSessions",
      "args": null,
      "concreteType": "AgentSessionConnection",
      "kind": "LinkedField",
      "name": "__AgentSessionsResource_agentSessions_connection",
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
                  "args": null,
                  "kind": "FragmentSpread",
                  "name": "EditAgentSessionTitleDialog_session"
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
    }
  ],
  "type": "Query",
  "abstractKey": null
};
})();

(node as any).hash = "f139691753745b6b9ab58de36be057c4";

export default node;
