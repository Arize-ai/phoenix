/**
 * @generated SignedSource<<e046fd4e0f1bfd9c3d25ca714ba62846>>
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
    readonly " $fragmentSpreads": FragmentRefs<"PromptIndexPage__main" | "PromptLayout__main" | "PromptVersionsPageContent__main">;
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
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
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
              },
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "PromptVersionsPageContent__main"
              },
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "PromptLayout__main"
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
              (v5/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "PromptVersionConnection",
                "kind": "LinkedField",
                "name": "promptVersions",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "PromptVersionEdge",
                    "kind": "LinkedField",
                    "name": "edges",
                    "plural": true,
                    "selections": [
                      {
                        "alias": "version",
                        "args": null,
                        "concreteType": "PromptVersion",
                        "kind": "LinkedField",
                        "name": "node",
                        "plural": false,
                        "selections": [
                          (v3/*: any*/),
                          (v5/*: any*/)
                        ],
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "PromptVersion",
                        "kind": "LinkedField",
                        "name": "node",
                        "plural": false,
                        "selections": [
                          (v3/*: any*/)
                        ],
                        "storageKey": null
                      }
                    ],
                    "storageKey": null
                  }
                ],
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
    "cacheID": "1ef3f5e1a5129f8ff263db17d9937da0",
    "id": null,
    "metadata": {},
    "name": "promptLoaderQuery",
    "operationKind": "query",
    "text": "query promptLoaderQuery(\n  $id: GlobalID!\n) {\n  prompt: node(id: $id) {\n    __typename\n    id\n    ... on Prompt {\n      name\n      ...PromptIndexPage__main\n      ...PromptVersionsPageContent__main\n      ...PromptLayout__main\n    }\n  }\n}\n\nfragment PromptIndexPage__aside on Prompt {\n  description\n}\n\nfragment PromptIndexPage__main on Prompt {\n  ...PromptIndexPage__aside\n}\n\nfragment PromptLayout__main on Prompt {\n  promptVersions {\n    edges {\n      node {\n        id\n      }\n    }\n  }\n}\n\nfragment PromptVersionsList__main on Prompt {\n  promptVersions {\n    edges {\n      version: node {\n        id\n        description\n      }\n    }\n  }\n}\n\nfragment PromptVersionsPageContent__main on Prompt {\n  ...PromptVersionsList__main\n}\n"
  }
};
})();

(node as any).hash = "dd012c15d97eec72a33a69900a92dc9a";

export default node;
