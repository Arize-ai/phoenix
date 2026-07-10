/**
 * @generated SignedSource<<604ba83f35f31188016e4be20a236076>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type RevokeOAuth2GrantInput = {
  id: string;
};
export type OAuth2GrantsTableRevokeMutation$variables = {
  input: RevokeOAuth2GrantInput;
};
export type OAuth2GrantsTableRevokeMutation$data = {
  readonly revokeOAuth2Grant: {
    readonly grantId: string;
  };
};
export type OAuth2GrantsTableRevokeMutation = {
  response: OAuth2GrantsTableRevokeMutation$data;
  variables: OAuth2GrantsTableRevokeMutation$variables;
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
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "input",
        "variableName": "input"
      }
    ],
    "concreteType": "RevokeOAuth2GrantMutationPayload",
    "kind": "LinkedField",
    "name": "revokeOAuth2Grant",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "grantId",
        "storageKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "OAuth2GrantsTableRevokeMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "OAuth2GrantsTableRevokeMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "e8ee9446e91dfc74a974b06aeeee3c12",
    "id": null,
    "metadata": {},
    "name": "OAuth2GrantsTableRevokeMutation",
    "operationKind": "mutation",
    "text": "mutation OAuth2GrantsTableRevokeMutation(\n  $input: RevokeOAuth2GrantInput!\n) {\n  revokeOAuth2Grant(input: $input) {\n    grantId\n  }\n}\n"
  }
};
})();

(node as any).hash = "73d89d8cab9fb9ddd4c959c907c867ba";

export default node;
