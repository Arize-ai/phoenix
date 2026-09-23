/**
 * @generated SignedSource<<a99bb66ea73b807cae66205ab176783a>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type agentSessionModelSessionQuery$variables = {
  id: string;
};
export type agentSessionModelSessionQuery$data = {
  readonly agentSession: {
    readonly __typename: "AgentSession";
    readonly id: string;
    readonly " $fragmentSpreads": FragmentRefs<"agentSessionModel_session">;
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  };
};
export type agentSessionModelSessionQuery = {
  response: agentSessionModelSessionQuery$data;
  variables: agentSessionModelSessionQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
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
  "name": "modelName",
  "storageKey": null
},
v5 = [
  {
    "alias": null,
    "args": null,
    "concreteType": null,
    "kind": "LinkedField",
    "name": "model",
    "plural": false,
    "selections": [
      (v2/*:: as any*/),
      {
        "kind": "InlineFragment",
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "provider",
            "storageKey": null
          },
          (v4/*:: as any*/)
        ],
        "type": "AgentBuiltinProviderModelSelection",
        "abstractKey": null
      },
      {
        "kind": "InlineFragment",
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "providerId",
            "storageKey": null
          },
          (v4/*:: as any*/)
        ],
        "type": "AgentCustomProviderModelSelection",
        "abstractKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "agentSessionModelSessionQuery",
    "selections": [
      {
        "alias": "agentSession",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v3/*:: as any*/),
              {
                "kind": "InlineDataFragmentSpread",
                "name": "agentSessionModel_session",
                "selections": (v5/*:: as any*/),
                "args": null,
                "argumentDefinitions": []
              }
            ],
            "type": "AgentSession",
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
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "agentSessionModelSessionQuery",
    "selections": [
      {
        "alias": "agentSession",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*:: as any*/),
          (v3/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": (v5/*:: as any*/),
            "type": "AgentSession",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "8b4aa487112b6c2d68be979d6261d7bc",
    "id": null,
    "metadata": {},
    "name": "agentSessionModelSessionQuery",
    "operationKind": "query",
    "text": "query agentSessionModelSessionQuery(\n  $id: ID!\n) {\n  agentSession: node(id: $id) {\n    __typename\n    ... on AgentSession {\n      id\n      ...agentSessionModel_session\n    }\n    id\n  }\n}\n\nfragment agentSessionModel_session on AgentSession {\n  model {\n    __typename\n    ... on AgentBuiltinProviderModelSelection {\n      provider\n      modelName\n    }\n    ... on AgentCustomProviderModelSelection {\n      providerId\n      modelName\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "d140585f544fc672fd81565d93216b01";

export default node;
