/**
 * @generated SignedSource<<0e63621ffe6e6c5d2c3a9ec416503b3b>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type TruncateAgentSessionInput = {
  id: string;
  messageId: string;
};
export type useAgentChatTruncateAgentSessionMutation$variables = {
  input: TruncateAgentSessionInput;
};
export type useAgentChatTruncateAgentSessionMutation$data = {
  readonly truncateAgentSession: {
    readonly agentSession: {
      readonly firstInput: string | null;
      readonly id: string;
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
export type useAgentChatTruncateAgentSessionMutation = {
  response: useAgentChatTruncateAgentSessionMutation$data;
  variables: useAgentChatTruncateAgentSessionMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "input"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "input",
    "variableName": "input"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "title",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "updatedAt",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "firstInput",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "latestOutput",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "username",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "profilePictureUrl",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "messages",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "useAgentChatTruncateAgentSessionMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "TruncateAgentSessionMutationPayload",
        "kind": "LinkedField",
        "name": "truncateAgentSession",
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
              (v2/*:: as any*/),
              (v3/*:: as any*/),
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "EditAgentSessionTitleDialog_session"
              },
              (v4/*:: as any*/),
              (v5/*:: as any*/),
              (v6/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "User",
                "kind": "LinkedField",
                "name": "user",
                "plural": false,
                "selections": [
                  (v7/*:: as any*/),
                  (v8/*:: as any*/)
                ],
                "storageKey": null
              },
              (v9/*:: as any*/)
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
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "useAgentChatTruncateAgentSessionMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "TruncateAgentSessionMutationPayload",
        "kind": "LinkedField",
        "name": "truncateAgentSession",
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
              (v2/*:: as any*/),
              (v3/*:: as any*/),
              (v4/*:: as any*/),
              (v5/*:: as any*/),
              (v6/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "User",
                "kind": "LinkedField",
                "name": "user",
                "plural": false,
                "selections": [
                  (v7/*:: as any*/),
                  (v8/*:: as any*/),
                  (v2/*:: as any*/)
                ],
                "storageKey": null
              },
              (v9/*:: as any*/)
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "4dcfa2811df577efcb8c6f90672d6500",
    "id": null,
    "metadata": {},
    "name": "useAgentChatTruncateAgentSessionMutation",
    "operationKind": "mutation",
    "text": "mutation useAgentChatTruncateAgentSessionMutation(\n  $input: TruncateAgentSessionInput!\n) {\n  truncateAgentSession(input: $input) {\n    agentSession {\n      id\n      title\n      ...EditAgentSessionTitleDialog_session\n      updatedAt\n      firstInput\n      latestOutput\n      user {\n        username\n        profilePictureUrl\n        id\n      }\n      messages\n    }\n  }\n}\n\nfragment EditAgentSessionTitleDialog_session on AgentSession {\n  id\n  title\n}\n"
  }
};
})();

(node as any).hash = "0d82577e9363cd95c8846fe499dd32e6";

export default node;
