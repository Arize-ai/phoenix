/**
 * @generated SignedSource<<a9e4058ef6021bcd2d88e7e2fefb07c0>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type GenerateSystemAPIKeyButtonMutation$variables = {
  name: string;
};
export type GenerateSystemAPIKeyButtonMutation$data = {
  readonly createSystemApiKey: {
    readonly apiKey: {
      readonly id: string;
    };
    readonly jwt: string;
  };
};
export type GenerateSystemAPIKeyButtonMutation = {
  response: GenerateSystemAPIKeyButtonMutation$data;
  variables: GenerateSystemAPIKeyButtonMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "name"
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
            "name": "name",
            "variableName": "name"
          }
        ],
        "kind": "ObjectValue",
        "name": "input"
      }
    ],
    "concreteType": "CreateSystemApiKeyMutationPayload",
    "kind": "LinkedField",
    "name": "createSystemApiKey",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "jwt",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "SystemApiKey",
        "kind": "LinkedField",
        "name": "apiKey",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "id",
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "GenerateSystemAPIKeyButtonMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "GenerateSystemAPIKeyButtonMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "b495f2792476469f7084ece9689b8b32",
    "id": null,
    "metadata": {},
    "name": "GenerateSystemAPIKeyButtonMutation",
    "operationKind": "mutation",
    "text": "mutation GenerateSystemAPIKeyButtonMutation(\n  $name: String!\n) {\n  createSystemApiKey(input: {name: $name}) {\n    jwt\n    apiKey {\n      id\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "a4a6b1b433242b55ad39cef1f6db92a6";

export default node;
