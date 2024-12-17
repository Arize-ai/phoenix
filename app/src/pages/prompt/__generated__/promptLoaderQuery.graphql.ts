/**
 * @generated SignedSource<<4a81e1f1513814f083bc51a07ce917a6>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type promptLoaderQuery$variables = {
  id: string;
};
export type promptLoaderQuery$data = {
  readonly prompt: {
    readonly __typename: string;
    readonly id: string;
    readonly name?: string;
    readonly " $fragmentSpreads": FragmentRefs<"PromptIndexPage__main">;
  };
};
export type promptLoaderQuery = {
  response: promptLoaderQuery$data;
  variables: promptLoaderQuery$variables;
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
  "name": "name",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "promptLoaderQuery",
    "selections": [
      {
        "alias": "prompt",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          (v3/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v4/*: any*/),
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "PromptIndexPage__main"
              }
            ],
            "type": "Prompt",
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "promptLoaderQuery",
    "selections": [
      {
        "alias": "prompt",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          (v3/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v4/*: any*/),
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "description",
                "storageKey": null
              }
            ],
            "type": "Prompt",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "d761fdccc57a8447624373f49ed05cff",
    "id": null,
    "metadata": {},
    "name": "promptLoaderQuery",
    "operationKind": "query",
    "text": "query promptLoaderQuery(\n  $id: GlobalID!\n) {\n  prompt: node(id: $id) {\n    __typename\n    id\n    ... on Prompt {\n      name\n      ...PromptIndexPage__main\n    }\n  }\n}\n\nfragment PromptIndexPage__aside on Prompt {\n  description\n}\n\nfragment PromptIndexPage__main on Prompt {\n  ...PromptIndexPage__aside\n}\n"
  }
};
})();

(node as any).hash = "021f2527b6acd8cc4402bad932311b5a";

export default node;
