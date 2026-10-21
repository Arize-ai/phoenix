/**
 * @generated SignedSource<<ff68929440b1948fd6a4fb47a77f8640>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type DecisionActionsDeleteTagMutation$variables = {
  id: string;
};
export type DecisionActionsDeleteTagMutation$data = {
  readonly deleteDecisionVersionTag: {
    readonly query: {
      readonly __typename: "Query";
    };
  };
};
export type DecisionActionsDeleteTagMutation = {
  response: DecisionActionsDeleteTagMutation$data;
  variables: DecisionActionsDeleteTagMutation$variables;
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
            "name": "decisionVersionTagId",
            "variableName": "id"
          }
        ],
        "kind": "ObjectValue",
        "name": "input"
      }
    ],
    "concreteType": "DecisionVersionTagMutationPayload",
    "kind": "LinkedField",
    "name": "deleteDecisionVersionTag",
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
    "name": "DecisionActionsDeleteTagMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "DecisionActionsDeleteTagMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "a177510e9bbe567cf1cf2d1cf20b0b31",
    "id": null,
    "metadata": {},
    "name": "DecisionActionsDeleteTagMutation",
    "operationKind": "mutation",
    "text": "mutation DecisionActionsDeleteTagMutation(\n  $id: ID!\n) {\n  deleteDecisionVersionTag(input: {decisionVersionTagId: $id}) {\n    query {\n      __typename\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "5b149aa17d5ba3f92edafaf65cf3c74e";

export default node;
