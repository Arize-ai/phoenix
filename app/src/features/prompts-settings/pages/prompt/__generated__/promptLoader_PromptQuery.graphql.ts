/**
 * @generated SignedSource<<b402f8a3569f1a9db9d73a597a42ce5c>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type promptLoader_PromptQuery$variables = {
  id: string;
};
export type promptLoader_PromptQuery$data = {
  readonly prompt: {
    readonly __typename: string;
    readonly id: string;
    readonly name?: string;
  };
};
export type promptLoader_PromptQuery = {
  response: promptLoader_PromptQuery$data;
  variables: promptLoader_PromptQuery$variables;
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
    "alias": "prompt",
    "args": [
      {
        "kind": "Variable",
        "name": "id",
        "variableName": "id"
      }
    ],
    "concreteType": null,
    "kind": "LinkedField",
    "name": "node",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "__typename",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "id",
        "storageKey": null
      },
      {
        "kind": "InlineFragment",
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "name",
            "storageKey": null
          }
        ],
        "type": "Prompt",
        "abstractKey": null
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
    "name": "promptLoader_PromptQuery",
    "selections": (v1/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "promptLoader_PromptQuery",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "e2002360cae1a354ce5c0128989a0ecb",
    "id": null,
    "metadata": {},
    "name": "promptLoader_PromptQuery",
    "operationKind": "query",
    "text": "query promptLoader_PromptQuery(\n  $id: ID!\n) {\n  prompt: node(id: $id) {\n    __typename\n    id\n    ... on Prompt {\n      name\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "933d252110e9044883a0cde91038d763";

export default node;
