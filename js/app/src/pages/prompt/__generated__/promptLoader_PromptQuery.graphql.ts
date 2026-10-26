/**
 * @generated SignedSource<<eeb941be5f6185228e8d7c0c2910cc68>>
 * @lightSyntaxTransform
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
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "name",
    "storageKey": null
  }
],
v2 = [
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
        "selections": (v1/*:: as any*/),
        "type": "Prompt",
        "abstractKey": null
      },
      {
        "kind": "InlineFragment",
        "selections": (v1/*:: as any*/),
        "type": "Decision",
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
    "name": "promptLoader_PromptQuery",
    "selections": (v2/*:: as any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "promptLoader_PromptQuery",
    "selections": (v2/*:: as any*/)
  },
  "params": {
    "cacheID": "1a4b0155f63c9b1c3e9edc8cfb4c91e6",
    "id": null,
    "metadata": {},
    "name": "promptLoader_PromptQuery",
    "operationKind": "query",
    "text": "query promptLoader_PromptQuery(\n  $id: ID!\n) {\n  prompt: node(id: $id) {\n    __typename\n    id\n    ... on Prompt {\n      name\n    }\n    ... on Decision {\n      name\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "c18d7e58cbe68af6f39b2a0f6ba545c2";

export default node;
