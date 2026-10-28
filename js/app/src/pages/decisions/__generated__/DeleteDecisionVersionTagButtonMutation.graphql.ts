/**
 * @generated SignedSource<<57eb26e4c49b5013beda8d9bdb83496f>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type DeleteDecisionVersionTagButtonMutation$variables = {
  id: string;
};
export type DeleteDecisionVersionTagButtonMutation$data = {
  readonly deleteDecisionVersionTag: {
    readonly query: {
      readonly __typename: "Query";
    };
  };
};
export type DeleteDecisionVersionTagButtonMutation = {
  response: DeleteDecisionVersionTagButtonMutation$data;
  variables: DeleteDecisionVersionTagButtonMutation$variables;
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
    "name": "DeleteDecisionVersionTagButtonMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "DeleteDecisionVersionTagButtonMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "050acbfea8393c059317ef7a34fd2544",
    "id": null,
    "metadata": {},
    "name": "DeleteDecisionVersionTagButtonMutation",
    "operationKind": "mutation",
    "text": "mutation DeleteDecisionVersionTagButtonMutation(\n  $id: ID!\n) {\n  deleteDecisionVersionTag(input: {decisionVersionTagId: $id}) {\n    query {\n      __typename\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "81139d57f900728a394c8387427b6362";

export default node;
