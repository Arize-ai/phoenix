/**
 * @generated SignedSource<<795c93bbceb0e58bc52a97442607a8f5>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
export type PromptTemplateFormat = "FSTRING" | "MUSTACHE" | "NONE";
export type PromptTemplateType = "CHAT" | "STRING";
export type promptVersionLoaderQuery$variables = {
  id: string;
};
export type promptVersionLoaderQuery$data = {
  readonly promptVersion: {
    readonly __typename: string;
    readonly description?: string;
    readonly id: string;
    readonly invocationParameters?: any | null;
    readonly modelName?: string;
    readonly modelProvider?: string;
    readonly outputSchema?: any | null;
    readonly template?: any;
    readonly templateFormat?: PromptTemplateFormat;
    readonly templateType?: PromptTemplateType;
    readonly tools?: any | null;
    readonly user?: string | null;
  };
};
export type promptVersionLoaderQuery = {
  response: promptVersionLoaderQuery$data;
  variables: promptVersionLoaderQuery$variables;
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
    "alias": "promptVersion",
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
            "name": "description",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "invocationParameters",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "modelName",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "modelProvider",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "outputSchema",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "template",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "templateFormat",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "templateType",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "tools",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "user",
            "storageKey": null
          }
        ],
        "type": "PromptVersion",
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
    "name": "promptVersionLoaderQuery",
    "selections": (v1/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "promptVersionLoaderQuery",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "593cd30b91779d0021d6beae17d7e0a6",
    "id": null,
    "metadata": {},
    "name": "promptVersionLoaderQuery",
    "operationKind": "query",
    "text": "query promptVersionLoaderQuery(\n  $id: GlobalID!\n) {\n  promptVersion: node(id: $id) {\n    __typename\n    id\n    ... on PromptVersion {\n      description\n      invocationParameters\n      modelName\n      modelProvider\n      outputSchema\n      template\n      templateFormat\n      templateType\n      tools\n      user\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "e1972bbad5d6c0ae81e4407d7765627d";

export default node;
