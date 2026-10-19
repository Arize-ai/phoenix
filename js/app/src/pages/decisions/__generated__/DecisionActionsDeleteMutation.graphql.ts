/**
 * @generated SignedSource<<ee63acd8fd0bd2a249cc2da2104c7a66>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type DecisionActionsDeleteMutation$variables = {
  id: string;
};
export type DecisionActionsDeleteMutation$data = {
  readonly deleteDecision: {
    readonly query: {
      readonly __typename: "Query";
    };
  };
};
export type DecisionActionsDeleteMutation = {
  response: DecisionActionsDeleteMutation$data;
  variables: DecisionActionsDeleteMutation$variables;
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
    "alias": null,
    "args": [
      {
        "fields": [
          {
            "kind": "Variable",
            "name": "decisionId",
            "variableName": "id"
          }
        ],
        "kind": "ObjectValue",
        "name": "input"
      }
    ],
    "concreteType": "DeleteDecisionMutationPayload",
    "kind": "LinkedField",
    "name": "deleteDecision",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "Query",
        "kind": "LinkedField",
        "name": "query",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "__typename",
            "storageKey": null
          }
        ],
        "storageKey": null
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
    "name": "DecisionActionsDeleteMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "DecisionActionsDeleteMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "a71b05d59c1855973cfb12dde3992eee",
    "id": null,
    "metadata": {},
    "name": "DecisionActionsDeleteMutation",
    "operationKind": "mutation",
    "text": "mutation DecisionActionsDeleteMutation(\n  $id: ID!\n) {\n  deleteDecision(input: {decisionId: $id}) {\n    query {\n      __typename\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "dbe2692856f29d884ab07db168e202ec";

export default node;
