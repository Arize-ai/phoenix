/**
 * @generated SignedSource<<a0891a3647bb23c2f05092da5ad9e074>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type promptConfigLoaderQuery$variables = {
  id: string;
};
export type promptConfigLoaderQuery$data = {
  readonly prompt: {
    readonly " $fragmentSpreads": FragmentRefs<"PromptVersionTagsConfigCard_data">;
  };
};
export type promptConfigLoaderQuery = {
  response: promptConfigLoaderQuery$data;
  variables: promptConfigLoaderQuery$variables;
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
  "name": "id",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "promptConfigLoaderQuery",
    "selections": [
      {
        "alias": "prompt",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "PromptVersionTagsConfigCard_data"
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
    "name": "promptConfigLoaderQuery",
    "selections": [
      {
        "alias": "prompt",
        "args": (v1/*: any*/),
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
          (v2/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "PromptVersionTag",
                "kind": "LinkedField",
                "name": "versionTags",
                "plural": true,
                "selections": [
                  (v2/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "name",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "description",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "promptVersionId",
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
    "cacheID": "bb3d56ec191577418a8de0eaf53b6bde",
    "id": null,
    "metadata": {},
    "name": "promptConfigLoaderQuery",
    "operationKind": "query",
    "text": "query promptConfigLoaderQuery(\n  $id: ID!\n) {\n  prompt: node(id: $id) {\n    __typename\n    ... on Prompt {\n      ...PromptVersionTagsConfigCard_data\n    }\n    id\n  }\n}\n\nfragment PromptVersionTagsConfigCard_data on Prompt {\n  id\n  versionTags {\n    id\n    name\n    description\n    promptVersionId\n  }\n}\n"
  }
};
})();

(node as any).hash = "14c6b4bb4ca5f20cce70677746b16459";

export default node;
