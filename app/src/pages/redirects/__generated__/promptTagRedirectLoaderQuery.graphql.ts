/**
 * @generated SignedSource<<484cda900956e4dbd2bd11fafeeb2020>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type promptTagRedirectLoaderQuery$variables = {
  promptId: string;
  tagName: string;
};
export type promptTagRedirectLoaderQuery$data = {
  readonly prompt: {
    readonly __typename: "Prompt";
    readonly version: {
      readonly id: string;
    };
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  };
};
export type promptTagRedirectLoaderQuery = {
  response: promptTagRedirectLoaderQuery$data;
  variables: promptTagRedirectLoaderQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "promptId"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "tagName"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "promptId"
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
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": [
        {
          "kind": "Variable",
          "name": "tagName",
          "variableName": "tagName"
        }
      ],
      "concreteType": "PromptVersion",
      "kind": "LinkedField",
      "name": "version",
      "plural": false,
      "selections": [
        (v3/*: any*/)
      ],
      "storageKey": null
    }
  ],
  "type": "Prompt",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "promptTagRedirectLoaderQuery",
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
          (v4/*: any*/)
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
    "name": "promptTagRedirectLoaderQuery",
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
          (v4/*: any*/),
          (v3/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "4c2da4fe623315c48c2773cf67b5e347",
    "id": null,
    "metadata": {},
    "name": "promptTagRedirectLoaderQuery",
    "operationKind": "query",
    "text": "query promptTagRedirectLoaderQuery(\n  $promptId: ID!\n  $tagName: Identifier!\n) {\n  prompt: node(id: $promptId) {\n    __typename\n    ... on Prompt {\n      version(tagName: $tagName) {\n        id\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "13413e0192167268aec895db8b691930";

export default node;
