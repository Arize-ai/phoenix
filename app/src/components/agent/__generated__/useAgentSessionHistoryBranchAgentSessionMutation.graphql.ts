/**
 * @generated SignedSource<<974d09bbc8121a87c5c7abfe2405da61>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type BranchAgentSessionInput = {
  id: string;
  messageId: string;
};
export type useAgentSessionHistoryBranchAgentSessionMutation$variables = {
  connections: ReadonlyArray<string>;
  input: BranchAgentSessionInput;
};
export type useAgentSessionHistoryBranchAgentSessionMutation$data = {
  readonly branchAgentSession: {
    readonly agentSession: {
      readonly createdAt: string;
      readonly firstInput: string | null;
      readonly id: string;
      readonly isTemporary: boolean;
      readonly latestOutput: string | null;
      readonly messages: any;
      readonly title: string;
      readonly updatedAt: string;
      readonly user: {
        readonly profilePictureUrl: string | null;
        readonly username: string;
      } | null;
      readonly " $fragmentSpreads": FragmentRefs<"EditAgentSessionTitleDialog_session">;
    };
  };
};
export type useAgentSessionHistoryBranchAgentSessionMutation = {
  response: useAgentSessionHistoryBranchAgentSessionMutation$data;
  variables: useAgentSessionHistoryBranchAgentSessionMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "connections"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "input"
},
v2 = [
  {
    "kind": "Variable",
    "name": "input",
    "variableName": "input"
  }
],
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
  "name": "title",
  "storageKey": null
},
v5 = {
  "alias": "isTemporary",
  "args": null,
  "kind": "ScalarField",
  "name": "isEphemeral",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "createdAt",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "updatedAt",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "firstInput",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "latestOutput",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "username",
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "profilePictureUrl",
  "storageKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "messages",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v1/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "useAgentSessionHistoryBranchAgentSessionMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*:: as any*/),
        "concreteType": "BranchAgentSessionMutationPayload",
        "kind": "LinkedField",
        "name": "branchAgentSession",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "AgentSession",
            "kind": "LinkedField",
            "name": "agentSession",
            "plural": false,
            "selections": [
              (v3/*:: as any*/),
              (v4/*:: as any*/),
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "EditAgentSessionTitleDialog_session"
              },
              (v5/*:: as any*/),
              (v6/*:: as any*/),
              (v7/*:: as any*/),
              (v8/*:: as any*/),
              (v9/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "User",
                "kind": "LinkedField",
                "name": "user",
                "plural": false,
                "selections": [
                  (v10/*:: as any*/),
                  (v11/*:: as any*/)
                ],
                "storageKey": null
              },
              (v12/*:: as any*/)
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v1/*:: as any*/),
      (v0/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "useAgentSessionHistoryBranchAgentSessionMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*:: as any*/),
        "concreteType": "BranchAgentSessionMutationPayload",
        "kind": "LinkedField",
        "name": "branchAgentSession",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "AgentSession",
            "kind": "LinkedField",
            "name": "agentSession",
            "plural": false,
            "selections": [
              (v3/*:: as any*/),
              (v4/*:: as any*/),
              (v5/*:: as any*/),
              (v6/*:: as any*/),
              (v7/*:: as any*/),
              (v8/*:: as any*/),
              (v9/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "User",
                "kind": "LinkedField",
                "name": "user",
                "plural": false,
                "selections": [
                  (v10/*:: as any*/),
                  (v11/*:: as any*/),
                  (v3/*:: as any*/)
                ],
                "storageKey": null
              },
              (v12/*:: as any*/)
            ],
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "filters": null,
            "handle": "prependNode",
            "key": "",
            "kind": "LinkedHandle",
            "name": "agentSession",
            "handleArgs": [
              {
                "kind": "Variable",
                "name": "connections",
                "variableName": "connections"
              },
              {
                "kind": "Literal",
                "name": "edgeTypeName",
                "value": "AgentSessionEdge"
              }
            ]
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "3de85af91363a8af91fcfe86832b23e0",
    "id": null,
    "metadata": {},
    "name": "useAgentSessionHistoryBranchAgentSessionMutation",
    "operationKind": "mutation",
    "text": "mutation useAgentSessionHistoryBranchAgentSessionMutation(\n  $input: BranchAgentSessionInput!\n) {\n  branchAgentSession(input: $input) {\n    agentSession {\n      id\n      title\n      ...EditAgentSessionTitleDialog_session\n      isTemporary: isEphemeral\n      createdAt\n      updatedAt\n      firstInput\n      latestOutput\n      user {\n        username\n        profilePictureUrl\n        id\n      }\n      messages\n    }\n  }\n}\n\nfragment EditAgentSessionTitleDialog_session on AgentSession {\n  id\n  title\n}\n"
  }
};
})();

(node as any).hash = "ff8c1ba1c20b98cc71cdf64e5ccbe3fe";

export default node;
